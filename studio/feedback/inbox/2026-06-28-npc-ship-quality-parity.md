---
id: 2026-06-28-npc-ship-quality-parity
date: 2026-06-28
type: bug             # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Visual consistency: after the #32 hero-ship swap, NPC ships look conspicuously cheaper, breaking immersion — and NPC ships are the bulk of on-screen content, especially in the battle lane (#135). Fixing parity is high visible-quality per effort."
feasibility: "Reuses the #32 GLTFLoader pipeline (already wired) extended to npc.js; the work is curating a CC0 ship SET (class variety) + role mapping + perf (these are the most-instanced meshes → instancing/LOD/#52). Loop TL confirms the perf approach."
decision: "ACCEPTED 2026-06-28 — owner-directed visual fix; the first concrete task of the standing visual-quality order #143 (Art & Audio epic #6). Filed #144. Ready to build."
issue: "https://github.com/cakuki/tidewake/issues/144"
assets: []
---

## Raw (owner's words — verbatim, never edited)

All NPC ships also should be replaced they now look lower q than player's. Lets arrange suitable ship sets and use in the game

## Triage log (newest at the bottom)

- 2026-06-28T09:50Z — Captured at PM desk. Owner reports NPC ships look **lower quality than the
  player's** since the #32 hero-ship glTF swap (NPCs still on the old procedural mesh). Fix = swap NPCs
  to a **curated CC0 ship set** with class variety (sloop/merchantman/frigate/cruise) so the sea reads
  at one fidelity. This is the **first concrete execution of the standing visual-quality order #143**
  (epic #6). Reuses #32's loader; coordinates with nations #137 (national/pirate/merchant looks) and
  shipyards #141 (ship classes). Perf-gated (#52, instancing/LOD — most-instanced meshes on screen).
  Filed **#144**, accepted (owner-directed, ready to build); noted on GfxD memory.