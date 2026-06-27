---
id: 2026-06-27-wind-indicator-misalignment
date: 2026-06-27
type: bug             # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Small but real — the compass is core sailing readability (M1 'feel the wind'); a drifting wind arrow undermines trust in the HUD on every turn. Also the natural pilot for the self-contained-UI standard."
feasibility: "TL: S. Render/pivot bug, not angle math: hud.js rotates #windarrow via SVG rotate(deg 24 24) while CSS adds a transform transition with mismatched transform-origin/box, so the arrow orbits off-centre during turns; unbounded heading accumulation aggravates. Approach: pin the pivot (transform-box: fill-box; origin centre; plain rotate) OR drop the CSS transition; normalize the angle to [-180,180). Isolated to hud.js + #windarrow CSS."
decision: "ACCEPT — P1 quick fix. Owner accepted. To be fixed as the 1st slice of the self-contained-UI standard (#53)."
issue: "https://github.com/cakuki/tidewake/issues/50"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

The wind indicator in the compass is getting out of place when the ship rotates. Check this with screenshots or native DOM elements to ensure that the wind indicator remains correctly aligned with the ship's orientation.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (bulk dump, paragraph 3 of 5 — split A: the concrete bug).
  status: raw. The general UI-quality principle from the same paragraph is logged separately as
  [[2026-06-27-self-contained-tested-ui]]. Awaiting owner go-ahead before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT** (quick win) and fix it as the first slice of the
  [[2026-06-27-self-contained-tested-ui]] standard (extract the wind compass into a self-contained,
  jsdom-tested component). Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept**. Issue #50 created
  (https://github.com/cakuki/tidewake/issues/50). status → accepted. Added to ROADMAP M1. Proposed
  priority P1 logged for loop PM+TL sign-off. Paired with #53 (self-contained-UI first slice).
