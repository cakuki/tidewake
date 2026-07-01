---
id: 2026-07-01-city-music-one-tone-not-melody
date: 2026-07-01
type: bug
status: assessed
value: "Per-town 'music' reads as hollow — the owner expected a melody/song per city and hears a single sustained chord. Undercuts a shipped feature (#69/#94 phase 3)."
feasibility: "ROOT CAUSE FOUND (not a playback bug): src/town-theme.js is DRONE-ONLY by design — chordMidi=[root,third,fifth,octave], music.setTownTheme() ramps the drone's frequencies (transposition-first slice). No melody. The melodic version is already filed as #129 (not yet built). Fix = add a per-town melodic motif over the drone, reusing the melody engine (melody-variation.js / music-director.js)."
decision: "Attach to #129 (per-town richer themes / melodies), mark from-owner, prioritise. Quick side-check: confirm the drone voices all 4 chord notes (not just the root) in case a voicing/playback issue thins it further."
issue: "https://github.com/cakuki/tidewake/issues/129"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Bug report: city musics are just one tone/chord, not a music. When I saw you said each city has a music like Cmaj, I thought it was a song in Cmajor but this is just one chord. Or it's a playback error, not sure. But I hear just one tone.

## Triage log (newest at the bottom)

- 2026-07-01 — Captured. Read `src/town-theme.js`: per-town identity = a sustained tavern DRONE transposed per town (root/mode/tint/tremolo), voiced as `[root, third, fifth, octave]`. **No melody** — shipped "transposition-first" (#69 TL constraint: fixed tempo, re-voice the drone, no tracks). So the owner's "one tone" is the drone; **not a playback bug**, a known first-slice limitation.
- 2026-07-01 — The melodic version is already **#129** ("richer themes: distinct melodies/instrument sets"), filed but unbuilt. → Attach the owner report to #129, mark **from-owner**, prioritise. Also flagged a quick check that all 4 chord notes actually sound.
