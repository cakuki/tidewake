---
id: 2026-06-28-town-mode-trade-view
date: 2026-06-28
type: feature        # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Fixes a real usability break (mobile market buried under sail/attack buttons) AND reframes trading as a place you visit — harbour→disembark→market — the home for future town activities (economy M3, governance M8). High value."
feasibility: "TL: split. Mode manager = M (pure src/mode.js state machine SAILING/TOWN/BATTLE; refactor main.js freeze gate through it; determinism safe — player eases to stop, NPCs keep integrating). Town walking/market scene = L (a 2nd gameplay scene, src/town.js, own explicit Leave button). First slices: (mode) rename existing freeze to BATTLE through mode.js, zero behaviour change; (town) static town view from a docked port w/ market panel, helm hidden, explicit Leave."
decision: "ACCEPT (owner GO 2026-06-28: 'we can start working on town/city mode and battle mode switches. Having a mode system. Where sailing will stop. But other ships still go on.') — split into mode-system #95 (P1) + town/city mode #96 (P1 entry / P2 walking depth)."
issue: "https://github.com/cakuki/tidewake/issues/95 (mode system) + https://github.com/cakuki/tidewake/issues/96 (town mode)"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Mobile town market is not usable. Sell/buy on a price which is under sail and attack control buttons.
Make town/city view a different view and only with a specific button user can leave. It should be a mode not a temporary popup when you are close by. Think like a real ship, you have to harbour, offboard and walk to the market to actually trade. We could also add different thigns to do in the town.

## Triage log (newest at the bottom)

- 2026-06-28 — Captured at PM desk (owner dump). status: raw. Two linked points:
  1. **Bug (mobile):** the town market's Sell/Buy controls sit *under* the sail/attack control
     buttons on mobile — unusable. Overlaps [[2026-06-27-mobile-hud-overlap]] (#66, iPhone touch
     buttons overlap town/trade panel).
  2. **Bigger design ask:** make the town/city a **distinct VIEW/MODE**, not a temporary pop-up that
     shows when you're nearby — entered deliberately and **left only via a specific button**. Model it
     on a real ship: harbour → disembark → walk to the market to trade; "different things to do in
     the town" beyond trading. This **extends/reframes** auto-harbor [[2026-06-27-auto-harbor-on-approach]]
     (#67, which today is a slow→city-view→Leave flow) into a true town mode, and is where future town
     activities live (ties governance epic M8). Likely needs to be split: a quick mobile-overlap fix
     (rides #66) vs the larger "town as a mode + activities" feature (own issue, probably phased).
- 2026-06-28 — **Owner GO + TL split.** Owner wants a real mode system (sailing stops, NPCs continue).
  TL feasibility recorded. **ACCEPTED** → **#95 mode system** (P1, the manager + battle-mode switch;
  buildable now) + **#96 town/city mode** (P1 deliberate-entry + mobile-overlap fix riding #66; P2
  walking/activities depth). status → accepted. NOTE: #95's mode signal is the shared spine the sound
  system #94 (battle/town music) also consumes — build #95 first.
