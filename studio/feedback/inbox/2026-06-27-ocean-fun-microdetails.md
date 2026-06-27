---
id: 2026-06-27-ocean-fun-microdetails
date: 2026-06-27
type: idea
status: accepted
value: "The cheapest 'every session makes a story' engine — small surprises (flotsam, a turtle, a message in a bottle) that reward attention with a smile. Pure 🪶 humour + 🌊 atmosphere, perfectly on-brand, and a steady drip keeps the world feeling alive between big features."
feasibility: "TL: first slice S. No raycasting today, so sail-over = a distance check against the ship (mirrors ports.js docking) — fired once on entry. New src/sealife.js: data-driven prop list (cheap primitives bobbing on ocean.sampleHeight like NPCs) + a random-text pool surfaced via the existing hud.flashBanner + a WebAudio SFX (playGull-style). First slice = ONE prop type + a sail-over random line from a ~15-line pool + a cheap SFX. Broader (M): multiple prop types, TAP picking (needs a new THREE.Raycaster in input.js), despawn/respawn near the player, a 'seen' set so lines don't repeat. Perf-aware per #52. PROCESS half of the ask: bake 'add 1-2 micro-details per loop/retro' into the studio cadence (Project Manager runbook)."
decision: "ACCEPT P2 — owner accepted. First sail-over slice (src/sealife.js: one prop + random-line pool + SFX) + a STANDING studio rule '1-2 ocean micro-details per loop/retro' for the Project Manager runbook."
issue: "https://github.com/cakuki/tidewake/issues/70"
assets: []
---

## Raw (owner's words — verbatim, never edited)

More random stuff on the oceans and seas. Just for fun. Have this part of the loop or retro to add at least one or two micro/small details. It would be great to have simple and fun interactions with some of them. A click/tap or sailing over intearctions. A sound effect or just a text. To put a smile. If text make sure it's a selected text from a numerous random options.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. TWO things: (a) a CONTENT stream of small fun
  ocean details with light tap/sail-over interactions → SFX or a random line (from a large pool); and
  (b) a PROCESS ask — bake 'add 1-2 micro-details per loop/retro' into the cadence. 🪶 + 🌊.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded. status → assessed. PM recommendation:
  **ACCEPT** as (1) an epic/standing studio rule ('1-2 ocean micro-details every loop/retro', into the
  Project Manager runbook) + (2) a first slice S (one sail-over prop + random-line pool + SFX via
  src/sealife.js). Propose P2. Tap-picking deferred to a later slice. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept** ("accept all"). Issue #70 created (carries both the
  first slice + the standing-rule process ask for the loop's Project Manager). status → accepted.
  Added to ROADMAP (Humour & Writing + ongoing theme). Proposed P2 for loop PM+TL sign-off.
