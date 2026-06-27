---
id: 2026-06-27-sea-texture-caribbean
date: 2026-06-27
type: feature         # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Serves the 🌊 realism + atmosphere pillar and fixes a mood problem: the sea fills most of the view and currently reads dark/flat ('Black Sea'), dragging the whole game's feel down. Owner wants the opposite — a SUNNY, HOLIDAY, Caribbean feeling. A bright turquoise surface with subtle detail + sun glint lifts every single frame at low cost and sells the swashbuckling-holiday fantasy on load. Pairs with the wave-amplitude fix (#51)."
feasibility: "TL (from ocean/render review): ocean.js fragment shading is near-flat procedural colour; scene.background is a flat colour; no envMap, no specular sun glint. Low-cost / high-impact plan: (1) lighten + shift to a depth-based Caribbean palette (shallow turquoise → deep teal) — fragment-shader constants, ~free; (2) cheap surface detail via low-octave scrolling procedural normal perturbation (or a small tiling normal map) to break flatness — modest cost; (3) sun specular glint (Blinn-Phong term from the directional light against the existing wave normals) — very cheap, high impact; (4) reduce + slow the swell and align surface-detail scroll speed to it (ties to #51). Bigger optional win: an HDRI envMap skybox (from #55) for true reflections — defer. Keep noise octaves low; verify against the new perf gate (#52). Effort: S–M (palette + glint + detail); envMap path M. Risk: shader cost on low-end → measure via #52."
decision: "ACCEPT — P1 (🌊 realism/atmosphere). Owner approved the IP-compliant approach (original shader from real-Caribbean/CC0 references, NO franchise sampling) and a sunny/holiday brief. Pairs with #51."
issue: "https://github.com/cakuki/tidewake/issues/61"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

The sea-texture feels too flat. And some parts are too dark, making the general feeling of the game too dark as the seas cover most of the view. Let's add a little bit of water surface feeling texture/shader, try to find a clever solution: for the least performance loss get the most visual impact.
It should feel like carribbean sea not like black sea :)

Combined with smaller tide amplitude the sea surface will need more detail anyhow. Right now it's moving too big too fast. See videos of Sid Meier's Pirates and maybe capture some samples for texture. Take some detailed snapshots from a video to see the animation and try to align the tide and urface detail animation speed.

Sun reflection would also be great. Start small and smart.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. Split out from the sea-texture thread of
  [[2026-06-27-wave-scale-disappearing-coasts]] once the owner detailed it. status: raw → assessed.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — ⚠️ CONSTITUTION/IP FLAG: owner referenced "Sid Meier's Pirates" and "capture
  some samples for texture." Per CONSTITUTION (never reference/imitate a named commercial franchise;
  original work only) and copyright, we will NOT sample or capture assets from that game. Compliant
  substitute proposed: study real Caribbean-sea footage/photography + CC0 references for palette,
  animation cadence and sun-glint, and build an ORIGINAL shader. Needs owner acknowledgement before
  the issue is opened.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT** (P1, 🌊 realism/atmosphere; pairs with #51) via the
  original-shader / CC0-reference approach. Start small: Caribbean palette + sun glint first, then
  surface detail, then align animation speed to the calmer swell. Holding final acceptance only on the
  owner's OK of the IP-compliant approach. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept**. Approved the IP-compliant approach ("good call on not
  sampling copyrighted material") and added the brief: "something sunny and holiday feeling rather than
  our current big dark waves." Issue #61 created (https://github.com/cakuki/tidewake/issues/61).
  status → accepted. Added to ROADMAP M1 / 🌊 realism. Proposed priority P1 logged for loop PM+TL sign-off.
