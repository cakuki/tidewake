#!/usr/bin/env bash
# Tidewake — deterministic usage-aware sprint scheduler (Component B of #152). NO LLM.
#
# A plain control loop: poll the active 5-hour usage window (scripts/lib/usage.sh), compute the target
# utilization curve (ramp to <=80% early over 270 min, <=90% in the last 30 min, with a SAFETY margin),
# and — if there is headroom and no sprint is running — launch ONE `scripts/sprint.sh --run` sized to the
# headroom. Otherwise sleep POLL. One sprint at a time; window rollover is automatic; backs off on any
# rate_limit.
#
# SAFETY — like sprint.sh, this NEVER auto-fires by default. Default = DRY: read usage, print the single
# decision it WOULD take, and exit. It only launches live sprints under --run.
#
# Usage:
#   scripts/sprint-scheduler.sh                 # DRY: print one decision from current usage, exit
#   scripts/sprint-scheduler.sh --run           # LIVE: continuous poll -> pace -> launch loop
#   scripts/sprint-scheduler.sh --run --once    # LIVE: one iteration (launch-or-wait) then exit
#   scripts/sprint-scheduler.sh --budget 25000000 --poll 90
#
# Flags: [--run] [--once] [--budget TOKENS] [--poll SECS]
# Env overrides: CALIBRATED_WINDOW_BUDGET, AVG_TOKENS_PER_TURN, MAX_SPRINT_MIN (see docs/runbook/SPRINT.md).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
cd "$REPO_ROOT"
# shellcheck source=scripts/lib/usage.sh
. "$SCRIPT_DIR/lib/usage.sh"

# --- pacing constants (deterministic) --------------------------------------
WINDOW_MIN=300           # 5-hour window
EARLY_CAP=0.80           # ramp ceiling for the early phase
LATE_CAP=0.90            # ceiling in the final LATE_MIN minutes
LATE_MIN=30              # length of the "late push" phase
SAFETY=0.03              # margin subtracted from the cap on every decision
MIN_SLICE=0.05           # don't launch for < 5% headroom (pace down instead)
POLL=90                  # seconds between polls when waiting

# Calibrated proxy budget (tokens for the 5h window) — EMPIRICAL, operator-tuned. See SPRINT.md.
BUDGET="${CALIBRATED_WINDOW_BUDGET:-25000000}"
AVG_TOKENS_PER_TURN="${AVG_TOKENS_PER_TURN:-50000}"
MAX_SPRINT_MIN="${MAX_SPRINT_MIN:-60}"

# --- flags ------------------------------------------------------------------
RUN=0; ONCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --run)    RUN=1; shift ;;
    --once)   ONCE=1; shift ;;
    --budget) BUDGET="${2:?--budget needs TOKENS}"; shift 2 ;;
    --poll)   POLL="${2:?--poll needs SECS}"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "sprint-scheduler.sh: unknown option '$1'" >&2; exit 2 ;;
  esac
done

# --- decide(): deterministic decision from a usage reading ------------------
# Prints exactly one action line: "WAIT <secs> <reason>" or "LAUNCH <max_turns> <timeout_secs> <budget_usd> <headroom>".
decide() {
  local usage_json="$1"
  printf '%s' "$usage_json" | \
    WINDOW_MIN="$WINDOW_MIN" EARLY_CAP="$EARLY_CAP" LATE_CAP="$LATE_CAP" LATE_MIN="$LATE_MIN" \
    SAFETY="$SAFETY" MIN_SLICE="$MIN_SLICE" POLL="$POLL" BUDGET="$BUDGET" \
    AVG_TOKENS_PER_TURN="$AVG_TOKENS_PER_TURN" MAX_SPRINT_MIN="$MAX_SPRINT_MIN" \
    python3 -c '
import sys, json, os, time, math

E=os.environ
WINDOW=float(E["WINDOW_MIN"]); EARLY=float(E["EARLY_CAP"]); LATE=float(E["LATE_CAP"])
LATE_MIN=float(E["LATE_MIN"]); SAFETY=float(E["SAFETY"]); MIN_SLICE=float(E["MIN_SLICE"])
POLL=int(float(E["POLL"])); BUDGET=float(E["BUDGET"]); APT=float(E["AVG_TOKENS_PER_TURN"])
MAX_SPRINT_MIN=float(E["MAX_SPRINT_MIN"])

try: U=json.load(sys.stdin)
except Exception:
    print(f"WAIT {POLL} bad-usage-read"); sys.exit(0)

now=time.time()
ws=float(U.get("win_start") or 0); we=float(U.get("win_end") or 0)
if (not U.get("active")) or ws<=0 or we<=0 or now>=we:
    print(f"WAIT {POLL} no-active-block-or-rollover"); sys.exit(0)

def target_curve():
    remaining=(we-now)/60.0
    if remaining<=LATE_MIN: return LATE
    early_span=WINDOW-LATE_MIN                       # 270 min
    elapsed=(now-ws)/60.0
    return EARLY*min(1.0, elapsed/early_span)        # linear ramp -> 80%

used=float(U.get("total_tokens") or 0)/BUDGET if BUDGET>0 else 1.0
cap=target_curve()-SAFETY
headroom=cap-used
if headroom<MIN_SLICE:
    print(f"WAIT {POLL} ahead-of-curve(used={used:.3f},cap={cap:.3f},headroom={headroom:.3f})"); sys.exit(0)

sprint_tokens=headroom*BUDGET
max_turns=int(max(20, min(400, math.floor(sprint_tokens/APT))))
mins_to_end=(we-now)/60.0
timeout=int(max(1.0, min(mins_to_end-2, MAX_SPRINT_MIN))*60)
budget_usd=round(sprint_tokens/1_000_000.0*3.0, 2)   # rough $ hint; sprint reads true cost from JSON
print(f"LAUNCH {max_turns} {timeout} {budget_usd} {headroom:.3f}")
'
}

# --- one iteration: read usage, decide, act ---------------------------------
# Returns 0 on WAIT, 10 on LAUNCH-done, 20 on rate-limit backoff.
iterate() {
  local usage action verb
  usage="$(read_usage)"
  action="$(decide "$usage")"
  verb="${action%% *}"
  local u_summary
  u_summary="$(printf '%s' "$usage" | python3 -c 'import sys,json
u=json.load(sys.stdin)
print("src=%s active=%s tok=%s" % (u.get("source"), u.get("active"), u.get("total_tokens")))' 2>/dev/null || echo '?')"
  echo "[$(date -u +%H:%M:%SZ)] usage=$u_summary  ->  $action" >&2

  if [ "$verb" = "WAIT" ]; then
    return 0
  fi

  # LAUNCH <max_turns> <timeout> <budget_usd> <headroom>
  # shellcheck disable=SC2086
  set -- $action
  local max_turns="$2" timeout="$3" budget_usd="$4"

  if [ "$RUN" -eq 0 ]; then
    echo "DRY: would launch -> scripts/sprint.sh --run --max-turns $max_turns --timeout $timeout --budget-usd $budget_usd" >&2
    return 10
  fi

  echo "[$(date -u +%H:%M:%SZ)] launching sprint.sh --run (max-turns=$max_turns timeout=$timeout budget=\$$budget_usd)" >&2
  local result rc
  set +e
  result="$(scripts/sprint.sh --run --max-turns "$max_turns" --timeout "$timeout" --budget-usd "$budget_usd")"
  rc=$?
  set -e
  echo "sprint-result: $result" >&2
  if [ "$rc" -ne 0 ]; then
    # Non-zero exit (timeout, guard, or a rate_limit surfaced by claude) -> back off to window end.
    echo "[$(date -u +%H:%M:%SZ)] sprint exited $rc — backing off until window rollover." >&2
    return 20
  fi
  return 10
}

# --- main -------------------------------------------------------------------
if [ "$RUN" -eq 0 ]; then
  echo "== sprint-scheduler DRY (no --run: prints one decision, launches nothing) =="
  echo "  budget=$BUDGET tok  avg/turn=$AVG_TOKENS_PER_TURN  max-sprint=${MAX_SPRINT_MIN}m  poll=${POLL}s"
  iterate || true
  echo "sprint-scheduler: DRY complete — nothing launched. Use --run to schedule live."
  exit 0
fi

echo "== sprint-scheduler LIVE (--run) ==  budget=$BUDGET tok  poll=${POLL}s  one sprint at a time" >&2
while :; do
  set +e
  iterate
  rc=$?
  set -e
  case "$rc" in
    20)
      # Rate-limit / error back-off: WAIT until this window rolls over (used -> ~0 next read).
      sleep "$POLL" ;;
    *)
      sleep "$POLL" ;;
  esac
  [ "$ONCE" -eq 1 ] && break
done
