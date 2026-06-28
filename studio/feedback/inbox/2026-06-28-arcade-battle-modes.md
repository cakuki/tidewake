---
id: 2026-06-28-arcade-battle-modes
date: 2026-06-28
type: idea
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Core M6 drama: ship combat as the marquee arcade fantasy (one boat → feared pirate / beloved governor). Sink for Infamy OR capture for Standing; the verbal duel finally gets its climax slot. Highest fun-per-scope on the board per the GD brief."
feasibility: "GD brief (#100) costed 4 options; owner chose 2→4 incremental. Option 2 (Maneuvering Battle) Scope M (~4–6w) rides the #95 mode-switch infra already building; cannons.js becomes the NPC-vs-NPC auto-resolver (nothing discarded). Option 4 (Three-Act Raid) Scope L, layered on top later. Delivered as SMALL shippable steps, not one drop."
decision: "ACCEPTED 2026-06-28 — owner picked **Option 2 then Option 4**, delivered as small incremental steps (PM coordinates ongoing deliver/test/evaluate; lane held until something impressive & gamer-testable ships before switching lanes). Filed from-owner battle epic #135. #100 stays the design source-of-truth; mode-switch infra #95 proceeds in parallel."
issue: "https://github.com/cakuki/tidewake/issues/135 (battle epic) · design source #100"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Let the game designer do their magic! There should be some arcade fun. I think the gun batte could be an arcade mode, like in the Sid Meier's Pirates game, going into battle mode, shooting with cannons to the other ship. And to be able to add on cannons from town workshops and switch cannons/ammo during combat. And when you can board the other ship there can be a crew fight and or captain duel. Let the game designer research and design different modes for battle. The verbal fight could be the duel (I think it's more fun than ship to ship jab fight or duel with swords which can become monotonous). But also the dialog/jab options should be much more.

## Triage log (newest at the bottom)

- 2026-06-28 — Captured at PM desk (owner dump). status: raw. A **combat vision / "let the game
  designer design battle modes"** brief. Threads to pull (for the designer to research & shape, not
  to pre-decide here):
  - **Arcade battle mode** à la *Sid Meier's Pirates* — entering a dedicated battle mode, aiming &
    firing cannons at the enemy ship (extends cannon combat #59).
  - **Loadout depth:** buy/fit cannons at **town workshops** (ties the town-mode dump
    [[2026-06-28-town-mode-trade-view]]); **switch cannons/ammo mid-combat**.
  - **Boarding → crew fight and/or captain duel** as a follow-on combat phase.
  - **Keep the verbal/insult duel** (#33) as *the* duel — owner finds it more fun than a sword duel
    or a ship-to-ship jab fight, which "can become monotonous" — but **expand the dialog/jab options
    a lot** (more variety, anti-repetition).
  - Explicit owner direction: **let the game designer research and design different battle modes.**
  - Relates: cannon combat #59, combat depth follow-ups #72, juice pass #80, insult duel #33.
  - This is a **design-research item**, likely a parent epic that fans out into several issues. Triage
    should route to the Game Designer for a modes proposal before any build sign-off.
- 2026-06-28 — **Owner direction: Game Designer brief, not auto-build.** Owner wants the Game Designer
  to research & propose 2–4 battle-mode options **over Telegram ~08:00 CEST 2026-06-28**, then owner taps a
  direction → PM triages the chosen scope into accepted issues. Filed GD research task **#100**
  (design + owner-decision; deliberately NOT `from-owner` — no accepted build yet). The **mode-switch
  infrastructure** is unblocked separately in **#95** and may proceed in parallel. status stays raw
  (scenario blocked on the brief). Cloud briefing routine `trig_012nQS8QiGzT1uDEb3zKr7qC` fires 06:00 UTC
  2026-06-28 (08:00 CEST); guaranteed deliverable = brief posted to #100, Telegram best-effort.
- 2026-06-28T06:04Z — **Brief delivered on time** as a comment on #100 (the guaranteed channel). The
  Telegram ping did **not** fire: the cloud routine had **no Telegram credentials in its environment**
  (root cause logged in the brief itself). Deliverable never at risk; the *ping* needs a token
  provisioned into the routine to work next time. → flagged to owner, not yet actioned.
- 2026-06-28T09:49Z — **OWNER DECISION: Option 2 → then Option 4, small incremental steps.** Owner read
  the brief at the desk and chose the hybrid: ship **Option 2 (Maneuvering Battle)** first as a sequence
  of small, gamer-testable slices, then grow into **Option 4 (Three-Act Raid)**. PM (me) coordinates the
  effort: deliver → test → evaluate each slice. status → accepted. Filed from-owner battle epic **#135**
  with the slice breakdown + provenance footer. #100 kept open as the design source. Mode-switch infra
  #95 proceeds in parallel regardless.
