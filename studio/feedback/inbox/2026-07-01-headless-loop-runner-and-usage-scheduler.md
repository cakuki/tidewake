---
id: 2026-07-01-headless-loop-runner-and-usage-scheduler
date: 2026-07-01
type: feature
status: accepted
value: "Run the delivery loop headless from the terminal (agentic sprint → changelog) + a deterministic usage-aware scheduler that paces sprints to fill the 5h window. Unlocks running the studio outside a single interactive Claude shell."
feasibility: "TL: Component A (headless sprint runner) M, Component B (deterministic scheduler) M, overall risk medium. Headless supports -p + subagents + bounding; usage read via ccusage (no official OAuth %, so calibrated token proxy). Full design embedded in #152."
decision: "Accept → spec'd as a self-contained ticket #152 for owner to deliver in a separate session. tech·epic·P3, NOT a build-loop item (kept out of queue.md)."
issue: "https://github.com/cakuki/tidewake/issues/152"
assets: []
---

## Raw (owner's words — verbatim, never edited)

I want to have a technical change. I want to be able to run this ralph-loop like delivery loop outside of a single Claude code shell, directly from terminal: `claude --some-args tidewake/docs/runbook/LOOP.md`. Which will run the loop (agentic sprint?) and exit with a human & machine readible changelog (descriptions are more like the PM-desk style, but also linked with commits). And I want another deterministic runner script to run loops checking claude usage and optimize the run schedules (tries to fill the 5hour window up to 80% in the first hours, and 90% towards the last 30mins).

Check with TL and write this as a detailed spec in a ticket. It's not top prio for the loop but I'll deliver this via different claude session. So all context required to deliver this task should be in the ticket (GitHub issue).

## Triage log (newest at the bottom)

- 2026-07-01 — Captured. Dispatched a **Tech Lead feasibility/design subagent** (per owner "check with TL"). Ticket will be **self-contained** (owner delivers via a separate session) and **NOT a build-loop item**.
- 2026-07-01 — TL returned: A=M, B=M, risk medium; verified headless `claude -p` supports subagents + bounding; usage via `ccusage` calibrated token proxy (no official OAuth per-window %). **Accepted → filed self-contained spec #152** (tech·epic·P3, owner-delivered, kept OUT of `queue.md` with a "not a build-loop item" banner).
