# Loop rituals & release cadence — design

**Date:** 2026-06-29 · **Source:** owner (ckk) steering at the PM desk · feedback `2026-06-29-loop-rituals-and-release-cadence`
**Status:** approved (design) → wiring the runbook + filing infra issue

## Problem / goal

The loop releases a public, tagged build on **every** game-code commit (several per hour). That is too
much for humans to consume. The owner wants a **human-scaled release cadence** and an explicit set of
**daily studio rituals**, all driven by the **local loop** (no cloud routines).

Two outcomes:
1. **Release cadence** — continuous building stays, but the *public* game and its *release notes* batch
   to **daily** (a plain list) and **weekly** (a polished, marketed release for the weekend).
2. **Ritual schedule** — retros, deep reading, a memory "sleep/defrag", releases, and a few supporting
   rituals run on a **daily clock**, self-scheduled by the orchestrator.

## Release model — "preview always-live, public is curated"

| Channel | Updates | Audience | Gate |
|---|---|---|---|
| **Preview** | every green game-code commit (as today, but to a preview URL) | studio + owner, to test | CI tests + headless playtest |
| **Public** (the real game) | daily 17:00, and Friday weekly | players | promotion-time hardening |

- The cycle-runner keeps committing/pushing game code to `main` → CI deploys to **preview**. The game
  stays "always playable" for the studio + owner. **No per-commit public release / tag-as-release.**
- **Daily release (17:00 Berlin, every day except Friday — incl. weekends):** the release ritual takes the latest green preview build,
  re-runs the full gate, **promotes it to the public site**, tags it, and publishes **list-style notes**
  (bulleted "what changed today", auto-assembled from the day's closed issues + loop-log rows).
- **Weekly release (Fri, 17:00 — replaces that day's daily):** extra regression + extended playtest,
  promotes the **weekend build**, and ships **marketing notes** (intro, feature highlights, **screenshots
  and/or a short capture clip**, "play now" CTA) using the marketing-plan skill. Because the public build
  only moves on a hardened promote, the "no weekend frustration" guarantee is real.

The **preview→public promote split** (a `release.yml` change + a promote workflow + notes generation) is
CI/infra → filed as a `from-owner` issue for the loop/TL. Until it lands, release behaviour is unchanged.

## Ritual schedule (local Berlin wall clock — the loop reads the machine's local time)

The orchestrator, at the **top of each cycle** (before picking the next build slice):
1. Read local date + time (machine TZ = Europe/Berlin; DST handled by the OS; ±1h is acceptable).
2. If a ritual's window is **due today**, it **hasn't run yet today**, and the day-of-week matches →
   **run that ritual instead of the next build slice**, record it done-for-today, then resume. One
   ritual per cycle (earliest-due first) to keep cycles lean.
3. Otherwise proceed with the queue's top slice as normal. **A `from-owner` P1 still preempts everything.**

| # | Ritual | Window (Berlin) | Days | Runs as | Output |
|---|---|---|---|---|---|
| R6 | 📨 **Morning owner briefing** | 08:00 | daily | PM | digest (Telegram/issue): shipped overnight · today's focused lane · anything needing the owner |
| R7 | 🗺️ **Weekly planning** | 09:00 | **Mon** | PM + TL | set the week's focused lane + the Friday release's headline feature |
| R1 | 😴 **Sleep / defrag** | 10:00–12:00 | daily | each of the 9 agents (fan-out) | reorganize each agent's in-repo knowledge into a layered **entry → detail → deeper-detail** tree |
| R2 | 📚 **Deep reading** | 13:00 | daily | each agent (fan-out) | dated inspiration log → `studio/agents/notebooks/<role>.md`; standout ideas → PM-desk inbox |
| R3 | 🧪 **Pre-release hardening** | 16:00 | daily (heavier Fri) | qa + software-developer | full test+playtest gate; triage/fix reds so the 17:00 promote is clean |
| R4 | 🚀 **Daily release** | 17:00 | **Mon–Thu + Sat–Sun** (every day except Fri) | project-manager + tech-lead | promote latest green preview → public + **list** notes + tag |
| R4w | 🌟 **Weekly release** | 17:00 | **Fri** (replaces R4) | PM + TL + graphic-designer + sound-engineer | hardened weekend build → public + **marketing** notes w/ screenshots/clip |
| R5 | 🔁 **Daily retro** | 18:30 | daily | project-manager (digest all roles) | `studio/retros/YYYY-MM-DD-retro.md`: lessons + process fixes + **queue-sync** |

**Replaces the old counter-based rituals:** retro (was ~every 7–8 cycles) and deep-learning research
(was ~every 10) are now **daily, time-gated** — the loop-counter triggers in `LOOP.md` Fan-out and the
`queue.md`/`decisions.md` "next retro ~loop N" notes are superseded.

### Behaviour details
- **Run-late (catch-up), don't skip:** if the loop wasn't running at a window, run the missed ritual on
  the next cycle that day (still marks done-today). End-of-day rituals not run by day's end are skipped,
  not stacked into the next day.
- **Loop-down = no ritual:** local scheduling means a ritual only fires while the loop runs on the
  owner's machine. Accepted tradeoff (owner chose local over cloud). Releases simply move to the next
  run; the briefing covers the gap.
- **Queue-sync inside R5:** every retro verifies accepted PM-desk build issues actually reached
  `queue.md` (grep `studio/comms/` for the issue #) — closes the gap that left #135 invisible for ~13 loops.

## Mechanism

- **No cloud routines.** The schedule lives in the **loop runbook**:
  - `docs/runbook/LOOP.md` gains a **Ritual schedule** section + the per-cycle check above; the
    Fan-out retro/DL lines change from counter-based to "see Ritual schedule (daily)".
  - `studio/comms/rituals.md` (new) is the **canonical schedule + run-log** the orchestrator updates
    (`<ritual> last ran <date>`), keeping ritual bookkeeping out of `loop-state.md`/`board.md`.
- The rituals themselves are just the orchestrator **dispatching the right subagent(s)** at the due time
  — no new infra. The **only** infra ticket is the preview→public promote split.

## Deliverables

1. PM-desk intake: `studio/feedback/inbox/2026-06-29-loop-rituals-and-release-cadence.md` + REGISTER row.
2. This spec (committed).
3. Runbook wiring: `docs/runbook/LOOP.md` Ritual-schedule section + per-cycle check; new
   `studio/comms/rituals.md`.
4. `from-owner` infra issue: preview→public promote split + daily/weekly notes generation.
5. Light ROADMAP note under Working principles pointing at the cadence + infra issue.

## Assumptions (confirmed with owner)

- **"Memories" for sleep/defrag** = the studio's **in-repo** knowledge (comms, retros, per-agent
  notebooks), not the owner's local machine.
- **DST:** loop uses local wall clock; ±1h around the seasonal switch is acceptable (owner confirmed).
- **Local scheduling** is the chosen mechanism (owner rejected cloud routines).

## Acceptance ("the studio can now…")

- *The public game updates at most once a day (17:00), with a Friday weekend release — and humans read a
  clean daily list or a marketed weekly note, while the studio still iterates continuously on preview.*
- *The loop runs retro, deep-reading, and memory-defrag on a daily clock, self-scheduled, and never
  promotes an untested build to the public on a Friday.*
