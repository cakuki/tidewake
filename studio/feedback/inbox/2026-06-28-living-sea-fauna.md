---
id: 2026-06-28-living-sea-fauna
date: 2026-06-28
type: idea
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Living world: moving life (gulls, breaching dolphins, animals) turns the sea from backdrop into an inhabited place — high delight per draw call, every clip/screenshot more believable. High value, low cost."
feasibility: "TL: S–M, risk Low (only the draw-call budget; mitigated by instancing + tight cull). New src/fauna.js {group, update(dt,t,shipPos)} ticked in main.js update(); spawn-near-player + recycle-on-cull pool of THREE.InstancedMesh (one draw call per type) reusing npc.js respawn() idiom. First slice: one ~6-bird instanced gull flock recycled on cull, assert draw-call delta within BUDGET."
decision: "ACCEPT P2 (owner GO 2026-06-28). Extends seagulls #68; steady 'living world' track."
issue: "https://github.com/cakuki/tidewake/issues/97"
assets: []
---

## Raw (owner's words — verbatim, never edited)

I want to see other moving things, like flying seagulls, sometimes jumpoing dolphins, maybe some other sea and land animals.

## Triage log (newest at the bottom)

- 2026-06-28 — Captured at PM desk (owner dump). status: raw. A **living world / ambient fauna**
  ask: moving life beyond the player — flying seagulls, occasionally jumping dolphins, and other
  sea & land animals. Broader than the existing seagull SFX/flock item [[2026-06-27-seagulls-ambience]]
  (#68), which it overlaps/extends — triage should decide whether to fold #68 in or run this as a
  parent "ambient life" epic. Perf-sensitive (moving meshes / draw calls) — flag for the TL.
- 2026-06-28 — **Owner GO.** TL feasibility recorded. **ACCEPTED P2** → **#97** (gulls-first phasing,
  then dolphins, then other animals). status → accepted.
