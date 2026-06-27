---
id: 2026-06-27-ship-water-inside
date: 2026-06-27
type: bug
status: accepted
value: "Immersion/polish: 'water in the boat' reads as broken and sits dead-centre of the screen every moment of play. Quick, high-visibility fix."
feasibility: "TL: S, low risk (visual-only). The hull (ship.js) is an open-topped swept bowl; the deck is raised + inset, leaving an open ring through which the single 4000u ocean plane draws at ship-local y≈0 — so you see sea inside the hull, amplified by the #51 swell on the coarse ocean grid. Fix: add ONE opaque interior 'sole/bilge' cap (reuse deckShape flush to the hull wall, woodHull material, ~y=1.0, above waterline + swell margin) — occludes the sea, ~1 draw call. Do NOT raise the ship (breaks sampleHeight/wake/camera). Coordinate the margin with the #51 amplitude fix."
decision: "ACCEPT P1 — owner accepted. Add an opaque interior bilge cap; coordinate the waterline margin with #51."
issue: "https://github.com/cakuki/tidewake/issues/65"
assets: []
---

## Raw (owner's words — verbatim, never edited)

our ship looks like it has some water in it :D

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. Hull appears to have water inside — likely the
  ocean surface clipping through the open hull. Relates to [[2026-06-27-wave-scale-disappearing-coasts]]
  and ship.js hull geometry.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded. status → assessed. PM recommendation:
  **ACCEPT P1** (quick visual fix: opaque interior cap), coordinate the waterline margin with #51.
  PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept** ("accept all"). Issue #65 created. status → accepted.
  Added to ROADMAP M1/🌊. Proposed P1 for loop PM+TL sign-off.
