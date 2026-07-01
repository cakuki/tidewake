---
id: 2026-06-29-loop-rituals-and-release-cadence
date: 2026-06-29
type: feedback
status: accepted
value: "Human-scaled release cadence (daily list + marketed weekly) + a daily ritual schedule run by the local loop; cuts release noise, protects weekends, institutionalises retro/deep-reading/memory-defrag."
feasibility: "Rituals = local-loop runbook wiring (done: LOOP.md + studio/comms/rituals.md). Release preview→public split = CI/infra, effort M, TL to confirm → #145."
decision: "Accept. Curated-promote release model; rituals driven by local loop (no cloud routines); kept the 4 PM-added rituals. Runbook wired; infra filed as #145."
issue: "https://github.com/cakuki/tidewake/issues/145"
assets: []
---

## Raw (owner's words — verbatim, never edited)

I want to change the release cycles to daily (instead of each loop) and weekly. Release on each loop is too much for humans to consume. Keep daily release notes as a list.

For weekly notes let's have a better, readible, nice looking release notes with screenshots and/or videos of the new features. Use some marketing skills for this.

Let's structure the loop schedules.

- Retros daily (not every x loop)
- Deep reading daily (each agent improves their skills, gets inspiration from the past and news, from fiction to non-fiction, makes connections to relevant and irrelevant stuff)
- Sleep routine: each agent defrags, optimizes their memories for a better optimized file/dir structure (entry files link to files with more details, and those to even more details and so on). Do this btw 10-12 in the morning while I am at work.
- Daily releases (try to do it around 5pm Berlin time each day)
- Weekly releases every Friday taking over the daily release time (ready for the weekend), make sure this weekly release is super well tested. No frustration for the weekend!!!

If I forgot any routine/ritual add it to schedule.

## Triage log (newest at the bottom)

- 2026-06-29T00:00Z — Captured. Brainstormed the design (brainstorming skill).
- 2026-06-29T00:00Z — Owner decided release model: **curated promote** (continuous→preview; daily 17:00 + Friday weekly promote→public). Not announce-only.
- 2026-06-29T00:00Z — Owner decided deliverable: design + stand up rituals + file infra issue.
- 2026-06-29T00:00Z — Owner decided mechanism: **local loop, NO cloud routines**; ±1h DST acceptable.
- 2026-06-29T00:00Z — PM added 4 rituals (owner kept all): pre-release hardening, queue-sync (in retro), morning owner briefing, Monday weekly planning.
- 2026-06-29T00:00Z — **Accepted.** Spec `docs/superpowers/specs/2026-06-29-loop-rituals-and-release-cadence-design.md`; runbook wired (`docs/runbook/LOOP.md` step 0.5 + `studio/comms/rituals.md`); infra → **#145**.
- 2026-06-29T00:00Z — Owner: **weekends also get the daily release** → daily release = every day except Fri (incl. Sat/Sun); Friday stays the weekly. Updated spec/rituals/LOOP/ROADMAP. Changes **pushed to main**.
- 2026-06-30 — Owner: preview = **Pages subpath**, remotely viewable. Add a **simple landing page** routing to **3 channels** with stability **weekly > daily > preview** — weekly→`/weekly/` (tag+Release), daily→`/daily/` (commit+date), preview→`/preview/` (commit+datetime). **Intense QA session before the weekly** (Friday = the week's event). Folded into #145 (comment) + spec/rituals/ROADMAP.
- 2026-06-30 — Owner: **make room for fixes between Friday QA and release** — team needs space to fix + revert to stable. → Friday QA moved **early (~14:00)** with a **fix & stabilize window (~14:00–16:30)** + **go/no-go ~16:30** before the **17:00** weekly. Updated spec (Friday timeline)/rituals/ROADMAP.
- 2026-07-01 — Owner: **put `/preview/` in the next lane.** Battle gate cleared (Loop 100) → promoted **#145 slice 1 (remotely-viewable `/preview/` subpath, S·tech)** to the **top of `queue.md`** as the active build lane; slices 2–5 (landing/`/daily/`/`/weekly/`/notes) stay P2 behind it. Commented on #145.
- 2026-07-01 — Owner: add a **funky, funny Marketing Manager** — **Monkey Island × Black Isle** voice, free to **subtly roast the team + the game's position**. → New role `studio/agents/marketing-manager.md`; authors the **weekly** notes (R4w) + landing/daily copy; folded into spec/rituals/#145. Guardrails: original style not IP, kind to players, punch up. (Still-open: #145 build priority — awaiting owner call.)
