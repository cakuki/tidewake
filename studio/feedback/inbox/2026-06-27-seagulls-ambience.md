---
id: 2026-06-27-seagulls-ambience
date: 2026-06-27
type: feature
status: accepted
value: "Atmosphere + life: gulls wheeling and calling near the coast is a cheap, instantly-felt 'you're really at sea/approaching land' cue. 🌊 atmosphere, fun first."
feasibility: "TL: SFX-only S, SFX+visuals M. GOOD NEWS — gull cries already exist in audio.js (playGull/scheduleGull, procedural, stereo-panned, random 12–34s). The only missing audio piece is 'louder near coasts/ports' = plumbing: pass a coastProximity into audio.update(state) (nearest island/port distance) and scale gain up / delay down near land — S, very low risk, add a pure coastGain/coastRate helper for unit tests. Visuals = new src/gulls.js InstancedMesh flock wheeling around island centres (+ optional Graphic Designer sprite/canvas; primitive V-wing is asset-free) — M; one draw call, drive flock density off the same nearest-island distance as the audio."
decision: "ACCEPT P2 — owner accepted. Ship the S coast-proximity SFX slice first (synth already exists), then the M visual flock (src/gulls.js)."
issue: "https://github.com/cakuki/tidewake/issues/68"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Some seagulls add seagulls and their noises!!!

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. Seagulls: visual gulls near coasts/ports +
  their calls (spatial SFX). Graphic Designer (visuals) + Sound Engineer (SFX).
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded. status → assessed. PM recommendation:
  **ACCEPT** — ship the S 'gulls louder near the coast' SFX slice now (the synth already exists!), then
  the M visual flock (src/gulls.js) as a follow-up. Propose P2. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept** ("accept all"). Issue #68 created. status → accepted.
  Added to ROADMAP (Art & Audio). Proposed P2 for loop PM+TL sign-off.
