---
id: 2026-06-28-multiple-bg-music
date: 2026-06-28
type: feature        # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Owner cares 'a lot' — music sets the scene across the whole game. Multiple rotating sea tracks (anti-fatigue) + distinct city music (auditory identity of a place) anchor immersion. High value."
feasibility: "TL: L (M for first slice), risk Medium — real exposure is asset reality (game is 100% procedural WebAudio today; real multi-track = MBs of static audio + mobile decode + iOS unlock). Pure src/music-director.js context→track resolver + crossfading layer-gain bank in music.js under the shared master (mute still covers it); driven by main.js update() harbourDistance loop. Hybrid asset path: parametric-procedural now, lazy fetch→decodeAudioData later — same resolver. First slice: procedural proximity crossfade only."
decision: "ACCEPT P1 (owner GO 2026-06-28: 'merge all into one sound system: sailing, town, battle musics multiple!!'). Consolidated with approach-town-music-cue + #69 into the unified sound-system epic."
issue: "https://github.com/cakuki/tidewake/issues/94"   # + sail-zones future hook → #99
assets: []
---

## Raw (owner's words — verbatim, never edited)

More than one bg music please! Change it over time. And towns/cities with different city like music.

## Triage log (newest at the bottom)

- 2026-06-28 — Captured at PM desk (owner dump). status: raw. Two parts: (1) **more than one
  sailing/background track, rotating over time** (variety, anti-fatigue on long voyages); (2) **towns
  /cities get their own city-like music**. Heavily overlaps per-town music [[2026-06-27-per-town-music]]
  (#69) and the approach-cue dump [[2026-06-28-approach-town-music-cue]]; together these three form a
  **music-system** theme (sailing playlist + town themes + proximity crossfade). Triage to consolidate
  into one audio plan so the loop builds a coherent music layer, not three disjoint slices.
- 2026-06-28 — **Owner GO + consolidation.** Owner: *"merge all into one sound system: sailing, town,
  battle musics (multiple!!). Towns/cities have their own tone, auditory image for places."* TL feasibility
  recorded above. **ACCEPTED P1** → unified sound-system epic **#94** (absorbs approach-town-music-cue +
  #69 per-town music; adds battle music keyed off mode system #95). The owner's separate **sail-zones**
  aside (*"invisible regions with different musics… may set hostility/weather… separate ticket, comes
  later"*) filed as future **#99**, P3 — the #94 music resolver is built context-shaped so #99 plugs in
  later. status → accepted.
