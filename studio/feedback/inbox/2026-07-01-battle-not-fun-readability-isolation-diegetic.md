---
id: 2026-07-01-battle-not-fun-readability-isolation-diegetic
date: 2026-07-01
type: feedback
status: accepted
value: "The marquee battle system (#135, ~20 loops of work) isn't FUN because it's not readable, not isolated, and not diegetic. Highest-value fix set — combat is the core arcade fantasy and the owner is disappointed."
feasibility: "GD+TL triage done → docs/briefs/2026-07-01-battle-fun-fixes.md. Presentation gap, not mechanics: center-modal occlusion, no foe highlight, isolation BUG (f.paused=false lets #125 + hails leak in), zero cannonball meshes, no raycast. 6 slices, first = hard mode isolation (the bug)."
decision: "Accept → filed epic #161 (from-owner P1). Recommend a presentation-hardening lane that preempts new battle mechanics until slices 1-5 land; owner lane-order confirm pending over Telegram."
issue: "https://github.com/cakuki/tidewake/issues/161"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Feedback: Fights are not fun :( There are some sound effects but the popup covers my ship and I cannot see my ship in action. Also while moving other ships are all around: I don't know which one I am fighting with! And ship rescue choice can interfere the battle. In ship battle mode nothing else should interfere, we should see the cannon balls, the angles should matter. Also interacting with other ships should be hovering on the ship in the view, not like a HUD element.

## Triage log (newest at the bottom)

- 2026-07-01 — Captured. Broke into 5 distinct threads: (1) **UI occlusion** — the battle popup/banner covers the ship, can't see it in action; (2) **target ambiguity** — other NPCs crowd the battle, unclear which foe you're fighting; (3) **mode isolation** — the open-sea rescue choice (#125) & other interactions leak into battle; (4) **missing viz** — want to SEE cannonballs fly + the aim ANGLE to visibly matter; (5) **diegetic interaction** — interact by HOVERING the ship in the 3D view, not via a HUD element. Dispatched a GD+TL triage to root-cause each in code and propose buildable slices.
