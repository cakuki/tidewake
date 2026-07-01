# Ritual schedule — the loop's daily clock

**The orchestrator reads this at the top of each cycle.** All times are **local Berlin wall clock**
(the machine's TZ; DST handled by the OS; ±1h around the seasonal switch is fine). Rituals are driven by
the **local loop only** — there are no cloud routines.

## Per-cycle check (before picking the next build slice)
1. Read local date + time.
2. If a ritual below is **due today** (now ≥ its window), **day-of-week matches**, and its **Last ran**
   date is **not today** → run that ritual **instead of** the next build slice, then update **Last ran**
   to today. One ritual per cycle (earliest-due first); keep cycles lean.
3. Else, proceed with `queue.md`'s top slice. **A `from-owner` P1 preempts everything, rituals included.**
4. **Run-late, don't skip:** a window missed because the loop was down runs on the next cycle that day.
   An end-of-day ritual not run by day's end is skipped (not stacked into tomorrow).

## Schedule

| # | Ritual | Window | Days | Runs as | Last ran |
|---|---|---|---|---|---|
| R6 | 📨 Morning owner briefing | 08:00 | daily | product-manager | 2026-07-01 |
| R7 | 🗺️ Weekly planning | 09:00 | Mon | product-manager + tech-lead | — |
| R1 | 😴 Sleep / defrag (memory) | 10:00–12:00 | daily | all 9 agents (fan-out) | — |
| R2 | 📚 Deep reading | 13:00 | daily | all 9 agents (fan-out) | 2026-07-01 |
| R3 | 🧪 Pre-release hardening (**Fri = intense QA event, runs early**) | 16:00 daily · **~14:00 Fri** | daily | qa + software-developer | — |
| R4 | 🚀 Daily release | 17:00 | **Mon–Thu + Sat–Sun** (every day except Fri) | project-manager + tech-lead | — |
| R4w | 🌟 Weekly release (replaces R4) | 17:00 | Fri | **marketing-manager** + PM + TL + graphic-designer + sound-engineer | — |
| R5 | 🔁 Daily retro (+ queue-sync) | 18:30 | daily | project-manager | 2026-06-30 |

> Update the **Last ran** cell (to today's date) when a ritual completes. Full design + each ritual's
> output: `docs/superpowers/specs/2026-06-29-loop-rituals-and-release-cadence-design.md`.

## What each ritual does (pointers — the subagent reads the spec for detail)

- **R6 Morning briefing** — PM digest to the owner (Telegram/issue): shipped overnight · today's focused
  lane · anything needing the owner's call.
- **R7 Weekly planning (Mon)** — set the week's focused lane + the Friday release's headline feature.
- **R1 Sleep / defrag** — each agent reorganizes its in-repo knowledge into a layered
  **entry → detail → deeper-detail** tree (index files link down to detail files).
- **R2 Deep reading** — each agent studies (craft, news, fiction↔non-fiction), logs inspiration +
  cross-connections → `studio/agents/notebooks/<role>.md`; standout ideas → PM-desk inbox.
- **R3 Pre-release hardening** — run the full test + playtest gate so the 17:00 promote is clean.
  **Friday is an INTENSE QA SESSION — the week's event — and runs EARLY (~14:00)** to leave a real fix
  window before release. **Friday flow:** 🧪 QA ~14:00 → 🔧 **fix & stabilize ~14:00–16:30** (fix forward
  where safe; **revert risky/unfinished work to the last known-good**; re-QA until green) → ✅ **go/no-go
  ~16:30** (if not green, ship the last known-good to `/weekly/` or hold — never a shaky weekend build) →
  🌟 release **17:00**. A rushed weekly is worse than no weekly.
- **R4 / R4w Release — three channels, stability `weekly > daily > preview`** (landing page at `/` routes
  to all three; see spec):
  - **Daily (R4)** → promote latest green preview to **`/daily/`** with **list** notes; record commit + date.
  - **Weekly (R4w, Fri)** → after the intense QA, promote the hardened build to **`/weekly/`**, **tag +
    GitHub Release**, **marketing** notes with screenshots/clip — authored by the **Marketing Manager**
    in the **Monkey Island × Black Isle** voice (funny, self-aware, roasts the team/our position, kind
    to players; `studio/agents/marketing-manager.md`).
  - Continuous commits keep deploying to **`/preview/`** (commit + datetime). Needs the channels/promote
    infra (`from-owner` **#145**); until it lands, release behaviour is unchanged.
- **R5 Daily retro** — `studio/retros/YYYY-MM-DD-retro.md`: lessons + process fixes; **verify accepted
  PM-desk build issues actually reached `queue.md`** (queue-sync — grep `studio/comms/` for the issue #).
