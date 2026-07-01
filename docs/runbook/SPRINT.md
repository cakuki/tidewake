# Tidewake — Headless Sprint & Scheduler (operator guide)

How to run the delivery loop **outside an interactive Claude Code shell**: a bounded headless *sprint*
(Component A) and a deterministic *usage-aware scheduler* that paces sprints across the 5-hour usage
window (Component B). Built per issue #152. **The interactive `docs/runbook/LOOP.md` is the A/B baseline
and is never modified by any of this.**

## Pieces
| File | Role |
|---|---|
| `scripts/sprint.sh` | Component A — runs ONE bounded `claude -p` sprint, then exits with a dual changelog + result JSON. **Dry-run by default.** |
| `scripts/changelog.mjs` | Node ESM (no deps) — turns `git log BASE..HEAD` into `CHANGELOG-<sprint>.md` + `changelog-<sprint>.json`. |
| `scripts/sprint-scheduler.sh` | Component B — deterministic (no LLM) pacer that launches sprints to hit the target curve. **Dry by default.** |
| `scripts/lib/usage.sh` | `read_usage()` — active 5h window via `ccusage` (primary) or a zero-dep JSONL glob (fallback). |
| `docs/runbook/LOOP-SPRINT.md` | The bounded sprint envelope (A/B twin of LOOP.md; same cycle-runner contract). |
| `docs/runbook/BOOTSTRAP.md` | Loop constitution injected via `--append-system-prompt-file` (identity · THE ONE RULE · guardrails · pointers). |
| `docs/runbook/sprint.settings.json` | Trimmed `--settings` (all plugins off, `hooks:{}`, opus, acceptEdits) to shrink the cold boot prefix. |
| `docs/runbook/changelogs/` | Per-sprint artifacts (outside the release `paths:` → they never trigger a deploy). |

## Prerequisites
- **`claude`** (Claude Code CLI) on `PATH`, authenticated via the subscription/OAuth (keychain). Do **not**
  use `--bare` — it forces `ANTHROPIC_API_KEY`-only auth and drops the 5-hour subscription window the
  scheduler depends on.
- **`jq`** recommended (the runner falls back to `python3` if it's missing).
- **`ccusage`** is used on demand via `npx ccusage@latest` — **not** a `package.json` dependency; if it or
  the network is unavailable, `usage.sh` falls back to reading `~/.claude/projects/**/*.jsonl` directly.
- **`node`** (already required by the game toolchain) for `changelog.mjs`.

## Running a single sprint

### Dry-run (default — safe, calls nothing)
```bash
scripts/sprint.sh                      # prints guard status + the exact composed `claude -p`, exits 0
scripts/sprint.sh --cycles 3 --max-turns 200 --timeout 5400
```
Dry-run **never** calls `claude`. It shows the four guards and the command it *would* run.

### Live (`--run` — launches one bounded sprint)
```bash
scripts/sprint.sh --run --cycles 4 --max-turns 300 --timeout 9000 --budget-usd 6
```
A live run requires **`--run` AND all guards passing**:
1. **build-tree only** — refuses the `tidewake-pm` worktree (basename check).
2. **clean tree** — `git status --porcelain` must be empty (no foreign/uncommitted work).
3. **no `STOP-SPRINTS`** — the operator stop-file pauses sprints between runs (`touch STOP-SPRINTS`).
4. **atomic lock** — `mkdir studio/comms/.sprint.lock` (trap-released), so only one sprint runs at a time.
5. **no other `claude`** — `pgrep -fl claude` (excluding self) must find no interactive loop / rival sprint.

On success it captures `BASE..HEAD`, writes both changelog artifacts, and prints one line of result JSON
to **stdout** (everything else is on stderr):
```json
{"sprint":"20260701T140311Z","base":"…","head":"…","commits":5,"cost_usd":4.12,"exit":0}
```

### Boot-prefix probe (`--probe`)
```bash
scripts/sprint.sh --probe               # tiny claude call → {"boot_prefix_tokens":…}
```
Measures the cold-entry token tax (turn-1 `input + cache_creation + cache_read`). **Target ≤ ~15k.** If it
is much higher, something heavy is still auto-loading (an MCP schema, the skill list, a plugin agent def) —
recheck `sprint.settings.json` (`enabledPlugins` all `false`, `hooks:{}`) and the `--strict-mcp-config
--mcp-config '{}'` / `--disable-slash-commands` flags.

## Running the scheduler

### Dry (default — one decision, launches nothing)
```bash
scripts/sprint-scheduler.sh                          # prints the decision it would take now
scripts/sprint-scheduler.sh --budget 25000000
```
### Live (`--run` — continuous pacing loop)
```bash
scripts/sprint-scheduler.sh --run                    # poll → pace → launch sprint.sh --run → repeat
scripts/sprint-scheduler.sh --run --once             # a single live launch-or-wait iteration
```
Each iteration reads the active window, computes `target_curve`, and either **WAITs** (`POLL` seconds) or
**LAUNCHes** one sprint sized to the current headroom. It runs **strictly one sprint at a time** (the call
is blocking and `sprint.sh` also holds a lock), resets automatically on window rollover, and **backs off**
when a sprint exits non-zero (a surfaced `rate_limit`, timeout, or guard failure).

### The pacing curve (deterministic)
`WINDOW=300min · EARLY_CAP=0.80 · LATE_CAP=0.90 · LATE_MIN=30 · SAFETY=0.03 · MIN_SLICE=0.05 · POLL=90s`
- Early phase: a **linear ramp** to ≤80% over the first 270 minutes (busy but bounded — ramp, not spike).
- Final 30 minutes: push to ≤90%.
- Every launch is sized to `cap − SAFETY`; on any observed 429 the scheduler waits out the window.

## BUDGET calibration (important — the biggest unknown)
Anthropic exposes **no official programmatic per-window %** for subscription/OAuth plans, so utilization is
a **token proxy**: `used = total_tokens / CALIBRATED_WINDOW_BUDGET`. Calibrate it empirically:
1. Start a fresh 5h window. Run sprints (or normal interactive work) and watch `scripts/lib/usage.sh`
   (`bash scripts/lib/usage.sh` prints the live reading).
2. Note the **`total_tokens` at the moment you first hit a `rate_limit`** in that window.
3. Set `CALIBRATED_WINDOW_BUDGET` ≈ that number (env var or `--budget`), and rely on `SAFETY` (0.03) plus
   the hard back-off for headroom.
4. **Re-calibrate whenever the plan tier changes.** The default (`25000000`) is a placeholder, not a
   measured value — treat the first live window as calibration.
Optionally tune `AVG_TOKENS_PER_TURN` (default 50000, converts headroom → `--max-turns`) and
`MAX_SPRINT_MIN` (default 60, caps a single sprint's wall clock).

## A/B metrics
The sprint JSON carries the comparison signal. Compare interactive window N vs headless window N+1 (same
model, gates, queue, BASE): **`boot_prefix_tokens`** (from `--probe`), cost/cycle, cycles/window, slices
shipped/window, gate-pass vs rework rate, **cache_read fraction** (sprints fired <5 min apart should show
`cache_read > 0`), wall-clock/cycle. Fair by construction — only the *envelope* differs (LOOP.md ↔
LOOP-SPRINT.md share the cycle-runner contract).

## Safety guards (recap)
- **Dry-run by default** on both `sprint.sh` and `sprint-scheduler.sh` — neither fires without `--run`.
- **`acceptEdits` + explicit `--allowedTools`** (never `bypassPermissions`); Bash constrained with rule
  syntax (`Bash(git *)`, `Bash(npm test)`, `Bash(node *)`, `Bash(gh *)`, `Bash(scripts/*)`).
- **Prompt injection** — the sprint prompt + BOOTSTRAP keep LOOP.md's REFUSE-AND-FLAG rule verbatim.
- **The gate is the safety net** — every commit still passes headless playtest + unit tests + perf budget;
  a sprint must never weaken a gate. Changelog commits live in `docs/**` → **no spurious releases**.
- **Stop conditions** — clean-tree abort, build-tree-only, `STOP-SPRINTS` stop-file, atomic lock, and
  live-`claude` detection.

## The `--mcp-config` chrome-only exception (real-browser QA)
The default invocation runs `--strict-mcp-config --mcp-config '{}'` (zero MCP servers) to keep the boot
prefix small. If a sprint genuinely needs **real-browser QA** (an owner-facing visual pass), pass a
**chrome-only** MCP config instead of the empty one — e.g. `--mcp-config` pointing at *only* the
chrome-devtools server — so you add back that one tool set and nothing else. Keep every other server out;
re-measure the boot prefix with `--probe` if you do.

## Manual trigger (owner)
```bash
cd /Users/ckk/Developer/github.com/cakuki/tidewake && scripts/sprint.sh --run --cycles 4
```
