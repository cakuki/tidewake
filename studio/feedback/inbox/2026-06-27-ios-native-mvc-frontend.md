---
id: 2026-06-27-ios-native-mvc-frontend
date: 2026-06-27
type: idea            # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "The real prize is the MVC *discipline*, not the iOS app: a deterministic advance(state,input,dt) core gives replay, far stronger headless testing/CI, and the OPTION of any future frontend — and the codebase is already ~70% there. That refactor is low-regret regardless of iOS. The native iOS renderer itself is premature: the game is pre-MVP (core pirate/governor loop unbuilt) and a second renderer would double all art forever."
feasibility: "TL: codebase ~70% to model/view split — pure logic core (physics/economy/renown/save/npc-ai/duel) is already THREE-free & unit-tested; the weld is in sailing.js/npc.js where step/update interleaves model-advance with three.js mutation (#36 not done). Approaches: (1) WebView/PWA wrapper = S (+ #56 touch/HUD M), reuses 100%, view not native; (2) owner's MVC + native Swift/Metal renderer = L→XL: pure modules port via JavaScriptCore, but the ENTIRE visual layer (geometry + ocean/wake GLSL→Metal + HUD→SwiftUI) must be rebuilt natively (three.js doesn't run as a native view), a permanent dual-renderer burden (~halves visual velocity); JSC state-bridge perf unproven; (3) full native rewrite = XL, abandons the browser product (violates CONSTITUTION). Native paths also add an Xcode/Metal/signing toolchain outside the no-build pipeline."
decision: "ACCEPT Approach 1 — WebView/PWA wrapper (#63). Owner chose it. Native Swift/Metal renderer (approach 2) PARKED as a future owner-decision (gated on MVP + measured perf); full rewrite (approach 3) DECLINED. MVC split (#36) remains independently recommended for testability."
issue: "https://github.com/cakuki/tidewake/issues/63"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

I am a technical person so I consider MVC framework. With that we could have different end UI easier. Maybe building a native iOS app for the frontend for this game. How feasible is this? JS engine can run the model and controller where iOS view can be native. I want a research (feas, effort, opportunity/value) result on this,

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk. status: raw. Research ask (feasibility + effort +
  opportunity/value) on an MVC split: JS engine runs the Model + Controller; a native iOS View renders
  the frontend, enabling multiple end UIs. Architecture-research subagent dispatched. Relates to
  [[2026-06-27-mobile-support-feasibility]] (mobile reach) but is a distinct architectural question.
- 2026-06-27T00:00Z — Architecture-research subagent (TL) returned full feas/effort/value study.
  PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation (research result):
  1. **DO the MVC split now (low-regret)** — fold into existing #36 (fixed-timestep + render/update
     separation: extract a pure advance(state,input,dt) from sailing.js/npc.js); pairs with #53. Captures
     ~all the "multiple frontends / testability" value at S→M with no new toolchain.
  2. **WebView/PWA (approach 1)** = the cheap path to iOS when mobile is prioritized → slot as Phase 1
     of #56 (with the touch/responsive-HUD slices), after the #62 device spike.
  3. **PARK the native Swift/Metal renderer (approach 2)** as a future owner-decision, gated on (a) an
     MVP core loop worth distributing and (b) the web build being *measured* perf-bound on real phones.
  4. **Decline the full native rewrite (approach 3)** — abandons the browser product per CONSTITUTION.
  Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **"Approach 1."** WebView/PWA wrapper accepted → issue #63 created
  (https://github.com/cakuki/tidewake/issues/63), sequenced behind the #62 device spike + #56 touch/HUD.
  status → accepted. Added to ROADMAP M4. Approach 2 (native renderer) parked; approach 3 declined.
