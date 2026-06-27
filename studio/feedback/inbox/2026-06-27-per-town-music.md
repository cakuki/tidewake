---
id: 2026-06-27-per-town-music
date: 2026-06-27
type: feature
status: accepted
value: "Place identity — each town feeling musically distinct makes the world memorable and rewards exploration; lands right inside the auto-harbor city-view moment. Pure charm."
feasibility: "TL: first slice S–M, full M–L. music.js plays one hardcoded D-major hornpipe but is pure-data (root/scale/patterns) with adaptive intensity and documented seams for a 'mood' field. First slice = transposition-only: a per-town descriptor {root, scale, leadType, seed} keyed to PORT_NAMES in ports.js + a music.setTheme() that re-derives + crossfades, debounced to dock/undock. KEEP TEMPO FIXED first (live tempo change glitches the scheduler). No assets (procedural). Full = distinct per-town melodies/instrument sets + a dedicated docked cue. Sequence with/after the auto-harbor city view so there's a moment to play it."
decision: "ACCEPT P2 — owner accepted. Transposition-first (fixed tempo, crossfade); sequence with the auto-harbor city view (#67)."
issue: "https://github.com/cakuki/tidewake/issues/69"
assets: []
---

## Raw (owner's words — verbatim, never edited)

If towns had different town musics that'd be awesome!

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. Per-town music for place identity; pairs with
  [[2026-06-27-auto-harbor-on-approach]]. Music role.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded. status → assessed. PM recommendation:
  **ACCEPT P2**, sequenced with/after the auto-harbor city view; start with the cheap transposition-only
  slice (root/scale/waveform, fixed tempo). PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept** ("accept all"). Issue #69 created. status → accepted.
  Added to ROADMAP (Art & Audio). Proposed P2 for loop PM+TL sign-off. Sequenced with #67.
