---
id: 2026-06-28-approach-town-music-cue
date: 2026-06-28
type: feature        # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Diegetic wayfinding: a town's music swelling from a distance hints 'port nearby' before the dock is visible — immersion + soft navigation aid in one. High value, cheap first slice."
feasibility: "TL: this IS the first slice of the sound-system epic — procedural proximity crossfade driven by the existing main.js harbourDistance loop (309-313) + ports.docked/nearestPort. One new layer-gain in music.js, one resolver call. No assets, mute still covers it, playtest green."
decision: "ACCEPT (owner GO 2026-06-28) — folded into unified sound-system epic #94 as its first slice."
issue: "https://github.com/cakuki/tidewake/issues/94"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Town music! When we sail it's different, when we are getting close to a town/city we could start hearing tavern or city music from a distance. Which hints users there is a local place to stay.

## Triage log (newest at the bottom)

- 2026-06-28 — Captured at PM desk (owner dump). status: raw. **Distance-based audio cue:** as the
  player nears a town/city, tavern/city music fades up from a distance over the sailing track —
  a *diegetic wayfinding hint* that there's a port to visit. Overlaps the per-town-music item
  [[2026-06-27-per-town-music]] (#69) and the auto-harbor flow [[2026-06-27-auto-harbor-on-approach]]
  (#67); also relates to the broader "rotate background music" dump [[2026-06-28-multiple-bg-music]].
  Triage to decide consolidation. Distinct nuance worth preserving: it's a **proximity crossfade as a
  gameplay hint**, not just "a theme per town."
- 2026-06-28 — **Owner GO.** Folded into the unified sound-system epic **#94** as its always-working
  first slice (procedural proximity crossfade). status → accepted.
