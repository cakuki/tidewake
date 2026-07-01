#!/usr/bin/env bash
# Tidewake — usage reader for the sprint scheduler (Component B helper).
#
# read_usage() prints a single-line JSON object describing the ACTIVE 5-hour usage block:
#   {"source","active","win_start","win_end","input_tokens","output_tokens",
#    "cache_creation_tokens","cache_read_tokens","total_tokens","cost_usd"}
# win_start / win_end are UNIX epoch seconds. `active` is true|false.
#
# Primary source : `npx ccusage@latest blocks --active --json` (reads ~/.claude JSONL; gives the real
#                  block start/end + token counts + costUSD + burn-rate projection).
# Fallback (0-dep): glob ~/.claude/projects/**/*.jsonl, keep entries from the last 5h, sum
#                  message.usage.*_tokens. Never hard-depends on ccusage or the network.
#
# Source this file (`. scripts/lib/usage.sh`) and call read_usage, or run it directly to print once.
set -euo pipefail

CLAUDE_HOME="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
WINDOW_SECS=$((5 * 60 * 60))

# --- primary: ccusage -------------------------------------------------------
_usage_from_ccusage() {
  command -v npx >/dev/null 2>&1 || return 1
  local json
  json="$(npx ccusage@latest blocks --active --json 2>/dev/null)" || return 1
  [ -n "$json" ] || return 1
  printf '%s' "$json" | python3 -c '
import sys, json, datetime

def epoch(s):
    if not s: return 0
    try:
        return int(datetime.datetime.fromisoformat(s.replace("Z","+00:00")).timestamp())
    except Exception:
        return 0

try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(1)

blocks = d.get("blocks") or d.get("data") or []
active = None
for b in blocks:
    if b.get("isActive") or b.get("active"):
        active = b; break
if active is None:
    print(json.dumps({"source":"ccusage","active":False,"win_start":0,"win_end":0,
        "input_tokens":0,"output_tokens":0,"cache_creation_tokens":0,"cache_read_tokens":0,
        "total_tokens":0,"cost_usd":0.0}))
    sys.exit(0)

tc = active.get("tokenCounts") or {}
inp = int(tc.get("inputTokens", tc.get("input", 0)) or 0)
out = int(tc.get("outputTokens", tc.get("output", 0)) or 0)
cc  = int(tc.get("cacheCreationInputTokens", tc.get("cacheCreation", 0)) or 0)
cr  = int(tc.get("cacheReadInputTokens", tc.get("cacheRead", 0)) or 0)
ws = epoch(active.get("startTime"))
we = epoch(active.get("endTime"))
if we == 0 and ws:
    we = ws + '"$WINDOW_SECS"'
print(json.dumps({"source":"ccusage","active":True,"win_start":ws,"win_end":we,
    "input_tokens":inp,"output_tokens":out,"cache_creation_tokens":cc,"cache_read_tokens":cr,
    "total_tokens":inp+out+cc+cr,"cost_usd":float(active.get("costUSD",0) or 0)}))
' || return 1
}

# --- fallback: raw JSONL glob ----------------------------------------------
_usage_from_jsonl() {
  local proj="$CLAUDE_HOME/projects"
  CLAUDE_PROJECTS="$proj" WINDOW_SECS="$WINDOW_SECS" python3 -c '
import os, glob, json, time

root = os.environ["CLAUDE_PROJECTS"]
window = int(os.environ["WINDOW_SECS"])
now = int(time.time())
cutoff = now - window

def ts_of(rec):
    t = rec.get("timestamp")
    if not t: return 0
    try:
        import datetime
        return int(datetime.datetime.fromisoformat(str(t).replace("Z","+00:00")).timestamp())
    except Exception:
        return 0

inp=out=cc=cr=0
earliest=0
files = glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True) if os.path.isdir(root) else []
for f in files:
    try:
        with open(f, "r", encoding="utf-8", errors="ignore") as fh:
            for line in fh:
                line=line.strip()
                if not line: continue
                try: rec=json.loads(line)
                except Exception: continue
                t=ts_of(rec)
                if t < cutoff: continue
                u=((rec.get("message") or {}).get("usage")) or rec.get("usage") or {}
                if not isinstance(u, dict): continue
                inp += int(u.get("input_tokens",0) or 0)
                out += int(u.get("output_tokens",0) or 0)
                cc  += int(u.get("cache_creation_input_tokens",0) or 0)
                cr  += int(u.get("cache_read_input_tokens",0) or 0)
                if t and (earliest==0 or t<earliest): earliest=t
    except Exception:
        continue

if earliest:
    ws = earliest - (earliest % 3600)   # floor to the hour, like a session block start
else:
    ws = now
we = ws + window
active = (inp+out+cc+cr) > 0 and now < we
print(json.dumps({"source":"jsonl","active":bool(active),"win_start":ws,"win_end":we,
    "input_tokens":inp,"output_tokens":out,"cache_creation_tokens":cc,"cache_read_tokens":cr,
    "total_tokens":inp+out+cc+cr,"cost_usd":0.0}))
'
}

read_usage() {
  if [ "${USAGE_FORCE_FALLBACK:-0}" = "1" ]; then
    _usage_from_jsonl && return 0
  fi
  _usage_from_ccusage && return 0
  _usage_from_jsonl && return 0
  # Last resort: an empty, inactive reading (scheduler treats as WAIT).
  echo '{"source":"none","active":false,"win_start":0,"win_end":0,"input_tokens":0,"output_tokens":0,"cache_creation_tokens":0,"cache_read_tokens":0,"total_tokens":0,"cost_usd":0.0}'
}

# Run directly → print one reading.
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  read_usage
fi
