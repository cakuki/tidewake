---
id: 2026-06-27-performance-budget-and-optimizations
date: 2026-06-27
type: feature         # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Foundational guardrail for the whole roadmap — every future system (NPCs, combat, bigger map, mobile) adds cost; without measurement we won't know when we break the ~60fps web budget where retention lives (PM research: the first 5 minutes decide retention). Benefits all players, low-end especially. Cheap to instrument now, before the scene grows."
feasibility: "TL: measurement slice S; optimizations M–L ongoing. Today an FPS counter exists (__tidewake.fps) but nothing asserts a budget; no draw-call/frame-time metrics; islands not instanced/LOD'd; dead shadow flags (shadowMap never enabled). Approach: expose renderer.info (calls/triangles)+frame-time, add a budget guard to playtest.mjs (<100 draw calls, 16.6ms). Then InstancedMesh for rocks/palms, THREE.LOD per island, resolve shadows. Risk: real bottleneck unproven until measured — hence measurement-first."
decision: "ACCEPT — measurement-first slice P1 + ongoing optimization epic. Owner accepted."
issue: "https://github.com/cakuki/tidewake/issues/52"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

Make sure the performance is something measured and under control. Learn and apply performance optimizations applicable for games like this (e.g. reduced calculations for things out of view, level of detail adjustments, and efficient use of shaders).

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. Awaiting owner to finish dumping before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT** — but framed as measurement-first. Ship the S-sized
  instrumentation + budget gate now (P1); treat culling/LOD/shader optimizations as an ongoing epic
  threaded through milestones (esp. M4), not a one-shot. Overlaps [[2026-06-27-mobile-support-feasibility]]
  (low-end perf). Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept**. Issue #52 created
  (https://github.com/cakuki/tidewake/issues/52). status → accepted. Added to ROADMAP M4 (+ ongoing
  theme). Proposed priority P1 (measurement slice) logged for loop PM+TL sign-off.
