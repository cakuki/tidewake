---
id: 2026-06-27-bigger-map-view
date: 2026-06-27
type: feature         # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Advances the 'plan your route / stateable goal' loop (PM thesis: legible progression) — a bigger map lets players choose destinations deliberately, strengthening the sail→trade verb. Interactivity (waypoints/POI) is a nice stretch but not needed for the core value. Builds on the existing minimap."
feasibility: "TL: MVP S–M, stretch M–L. minimap.js already takes a configurable radius + canvas with pure projection math. Lean MVP: a second createMinimap instance on a full-screen canvas with a large radius, toggled on a key (m=mute is taken; use Tab/p) — trivial 2D redraw, perf a non-issue. Stretch: interactivity needs an inverse projection (canvas px→world), click-to-waypoint state, and POI hit-testing. MVP touches index.html + main.js + the reused minimap.js."
decision: "ACCEPT MVP ONLY — owner chose MVP (toggle larger map). Stretch interactivity (clickable POIs / waypoints) PARKED as a follow-up; raw kept."
issue: "https://github.com/cakuki/tidewake/issues/54"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

How about a way to open bigger map? So the user can see more of the surrounding area and plan their route better. This could be implemented as a zoom feature or a separate map view that can be toggled on and off. Ensure that the map is interactive, allowing users to click on points of interest or set waypoints. Consider performance implications of rendering a larger map and optimize accordingly.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (bulk dump, paragraph 5 of 5). status: raw. Feature: a toggleable
  larger/zoomable map for route planning; stretch scope includes interactivity (click POIs, set
  waypoints) and perf-aware rendering. Builds on the existing minimap; relates to roadmap M2 minimap +
  M4 perf. Awaiting owner go-ahead before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT the MVP** (toggleable bigger map, P2) and **PARK the
  stretch interactivity** (clickable POIs / waypoints) as a follow-up once the MVP proves useful.
  Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept MVP only**. Issue #54 created
  (https://github.com/cakuki/tidewake/issues/54), scoped to MVP. status → accepted. Added to ROADMAP
  M2/M4. Proposed priority P2 logged for loop PM+TL sign-off. Stretch interactivity parked (not deleted).
