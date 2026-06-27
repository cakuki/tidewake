---
id: 2026-06-27-auto-harbor-on-approach
date: 2026-06-27
type: feature
status: accepted
value: "Turns docking into a real 'making landfall' moment — the staged announce → slow → city-view is the spine that per-town-music, seagulls and trade all hang on. Strong fantasy beat, and it cleanly resolves the mobile control overlap (nav hidden while harboured)."
feasibility: "TL: first slice M, full polish L. Building blocks exist: physics.js nearestPort/isDocked/dockingUpdate (DOCK_RADIUS=90), ports.js onArrive announce, hud.js renderTrade auto-opens the panel when state.port set, and the duel-gate in main.js (skip sailing.step) is the pattern to disable nav. Missing: an EARLIER approach ring (~200u) announce, an auto-slow brake, the nav-disable gate, and a Leave Harbour control (mobile tap / desktop key). CRITICAL risk: docking re-arms on proximity — stopping inside the radius with nav disabled would TRAP the player; Leave must re-enable throttle + nudge seaward (jetty angle) or latch suppression until out of range. Resolve before coding."
decision: "ACCEPT P1 — owner accepted, with refinements: strong VISIBLE + AUDIBLE (town-music) harbour cues, a SHORT transition (not a cutscene), and a single EASILY-REVERSIBLE Leave action (re-enable throttle + seaward nudge)."
issue: "https://github.com/cakuki/tidewake/issues/67"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Ship should stop moving when it anchors to the city/town. Let's have the ship automatically harbor when it's close to the city. First announce the place we are approaching, if the ship gets real close, slow down, open city view and ship harbors in the background. the navigation is disabled (buttons hidden in mobile). only there will be a button (mobile tap, desktop keyboard) to leave the harbour.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. A staged auto-harbor flow: announce → slow →
  city view (ship harbours in background) → nav disabled (buttons hidden on mobile) → single Leave
  Harbour control. Builds on the existing docking state machine.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded. status → assessed. PM recommendation:
  **ACCEPT** — first slice M (approach-ring announce + auto-slow + Leave button that re-enables nav &
  nudges seaward), full polish L (explicit harbour state machine + camera framing). Propose P1 (it
  also fixes the mobile overlap). Must-resolve: the proximity re-arm trap. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept** ("accept all") + REFINEMENTS: "auto-harbor should come
  with a really visible (and with town music hearable) cues, be really short to execute, and easily
  revertable action." Folded into the acceptance criteria + an "Owner refinements (must-haves)" section
  on issue #67. status → accepted. Added to ROADMAP M2. Proposed P1 for loop PM+TL sign-off.
