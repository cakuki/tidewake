---
id: 2026-06-28-delivery-operating-principles
date: 2026-06-28
type: feedback        # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Standing operating doctrine for the whole loop — keeps autonomous delivery honest (testable or human-gated), keeps the lights on (BAU bugs/UI), and prevents lane-thrash (don't hop roadmap lanes until the current one lands something impressive players can test). Compounds quality the way #52/#53 do for perf/UI."
feasibility: "Process change, no code. Encoded into docs/ROADMAP.md Working principles + the four team memories (PM/TL/GD/GfxD). The loop's PjM/PM already run a lean cadence; this tightens the lane-switch gate and the self-eval bar."
decision: "ACCEPTED 2026-06-28 — folded into docs/ROADMAP.md 'Working principles' as standing rules and mirrored into team memories so every role planning a loop honours them."
issue: ""
assets: []
---

## Raw (owner's words — verbatim, never edited)

Meanwhile the team, mstly you as the PM coordinating the effort, continues to deliver, test, and evaluate results.

Make sure the team continues to do:
- self-eval = deliver things with clearly achievable and testable outcomes (or include a human in the loop, for now only me!), and improve self-awareness with self-improvements (iterating on the process by itself)
- business as usual (bug fixes, UI improvements)
- then focused deliver on the most important improvement tasks (only after meaningul improvements withing several loops switch to another lane in the roadmap, example: only switch from the new battle system lane to music after delivering something impressive for and testable by the gamers)

## Triage log (newest at the bottom)

- 2026-06-28T09:49Z — Captured at PM desk. Three standing rules, accepted and folded into the roadmap's
  Working principles + team memories:
  1. **Self-eval bar** — every slice ships with a *clearly achievable, testable outcome*; if it can't be
     machine-verified, put a **human in the loop** (for now that human is **only the owner**). Plus a
     self-improvement duty: iterate on the *process itself* (raise self-awareness, fix the loop), not just
     the game. (Dovetails with #53 self-tested UI and the existing self-eval/retro cadence.)
  2. **Business as usual** — always keep delivering bug fixes + UI improvements; the lights stay on
     alongside the headline lane.
  3. **Focused lane delivery + a lane-switch GATE** — work the single most important improvement lane and
     **do not hop lanes until it has shipped something impressive AND gamer-testable** over several loops.
     Owner's example: *don't switch from the new battle-system lane to the music lane until the battle work
     has delivered something impressive players can actually test.* PM (me) owns calling the gate.
