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
| R6 | 📨 Morning owner briefing | 08:00 | daily | product-manager | — |
| R7 | 🗺️ Weekly planning | 09:00 | Mon | product-manager + tech-lead | — |
| R1 | 😴 Sleep / defrag (memory) | 10:00–12:00 | daily | all 9 agents (fan-out) | — |
| R2 | 📚 Deep reading | 13:00 | daily | all 9 agents (fan-out) | — |
| R3 | 🧪 Pre-release hardening | 16:00 | daily (heavier Fri) | qa + software-developer | — |
| R4 | 🚀 Daily release | 17:00 | Mon–Thu | project-manager + tech-lead | — |
| R4w | 🌟 Weekly release (replaces R4) | 17:00 | Fri | PM + TL + graphic-designer + sound-engineer | — |
| R5 | 🔁 Daily retro (+ queue-sync) | 18:30 | daily | project-manager | — |

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
- **R3 Pre-release hardening** — run the full test + playtest gate so the 17:00 promote is clean; heavier
  regression on Fridays.
- **R4 / R4w Release** — promote the latest **green preview** build to **public** (daily = list notes;
  Friday = marketing notes with screenshots/clip). Needs the preview→public promote infra (see the
  `from-owner` infra issue); until that lands, release behaviour is unchanged.
- **R5 Daily retro** — `studio/retros/YYYY-MM-DD-retro.md`: lessons + process fixes; **verify accepted
  PM-desk build issues actually reached `queue.md`** (queue-sync — grep `studio/comms/` for the issue #).
