---
id: 2026-06-27-wave-scale-disappearing-coasts
date: 2026-06-27
type: bug             # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Protects the core 'believable sea' pillar (🌊 realism): when ports/coasts vanish under swell the world stops reading as real and docking (the M2/M3 verb) becomes unreadable. Hits every player every session — high immersion damage for low fix cost, and it's visible in the shipped build now."
feasibility: "TL: S (global amplitude clamp) → M (shore-aware attenuation). Cause: ocean.js swell() sums sines to ±10.9 units applied everywhere; islands/ports sit at fixed y with no shore awareness, so crests submerge docks/beaches. Approach: cut swell amplitudes in swell()+sampleHeight (keep lock-step), optionally attenuate swell near island centres/radii via shader uniform, nudge critical geometry above residual crest. Risk: CPU/GPU sampler drift → ship-float regression."
decision: "ACCEPT — P1 realism bug. Owner accepted. Sea-surface look/Caribbean palette tracked separately (sea-texture item)."
issue: "https://github.com/cakuki/tidewake/issues/51"
assets:               # paths under studio/feedback/assets/
  - studio/feedback/assets/2026-06-27-wave-scale-high-tide.png
  - studio/feedback/assets/2026-06-27-wave-scale-low-tide.png
---

## Raw (owner's words — verbatim, never edited)

The tides of waves are big that ports and whole coasts with big portion of the island mass are appearing and disappearing. Let's fix this portioning. A little bit comical scaling is good but critical objects should not disapper. The texture of the sea is also important.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. Awaiting owner to finish dumping before triage.
- 2026-06-27T00:00Z — Owner supplied two screenshots (build v0.0.20260627083006) of the same cove at two
  tide phases. high-tide.png: swell up — water laps over the right-hand dock/jetty, a red buoy floats
  high and the sandy spit is partly submerged; the far coastline is a thin sliver. low-tide.png: swell
  down — the same dock sits well clear of the water, more beach/island mass exposed, coastline reads
  much larger. The delta between frames shows the vertical tide swing eating dock + coast geometry.
  Pinned both under assets/.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
  NOTE: this item carries TWO threads from the raw — (a) wave amplitude eating coasts [assessed here],
  and (b) "the texture of the sea is also important" [sea surface look], which has NOT been triaged and
  needs an owner clarification before it can be scoped. Flagged in the decision ask.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT** as a P1 bug (🌊 realism). Start with the S-sized
  amplitude clamp; add shore-aware attenuation if needed. Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept**. Issue #51 created
  (https://github.com/cakuki/tidewake/issues/51). status → accepted. Added to ROADMAP M1. Proposed
  priority P1 logged for loop PM+TL sign-off. Owner clarified the sea-texture thread (too flat/too
  dark/Caribbean feel/sun reflection + align animation speed) → split into its own item.
