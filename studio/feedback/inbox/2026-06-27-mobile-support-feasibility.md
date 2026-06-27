---
id: 2026-06-27-mobile-support-feasibility
date: 2026-06-27
type: idea            # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Strategic market-expansion bet — potentially a large new audience, but a big multi-workstream lift that could dilute 'fun first' focus if rushed. The cheap, high-value move now is the feasibility report (a decision input), not the build. Aligns with roadmap M4 (touch + responsive + streaming)."
feasibility: "TL: report S; act-on L overall, decomposes into S/M slices. Current: all gameplay keyboard-only (unreachable on touch); drag-look already pointer-based; HUD fixed-px (no media queries/safe-area); pixelRatio cap 2 heavy on 3x phones; per-vertex ocean shader the prime mobile perf risk; sim already framerate-independent (good). Workstreams: touch controls (M, new src/touch.js feeding existing input surface), responsive HUD (M), low-end perf (M–L, bundle w/ perf item), world streaming (L, defer), device testing (M, new capability). Biggest risks: low-end GPU perf of the ocean shader; iOS Safari quirks."
decision: "ACCEPT REPORT ONLY — owner chose research. Feasibility report delivered; BUILD parked pending owner go via owner-decision issue #56."
issue: "https://github.com/cakuki/tidewake/issues/56"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

Mobile support? I know the game is for desktop now and targeting two different screen sizes will make things complicated. But this could be a great market to go into. Research and discover possibilities, do a feasibility study on mobile support, and provide a detailed report on the potential challenges, required adjustments, and estimated costs for adapting the game for mobile platforms. Include considerations for touch controls, performance optimization for lower-end devices, and any necessary UI/UX changes.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (bulk dump, paragraph 2 of 5). status: raw. Research/feasibility
  ask, not a build: report on challenges, required adjustments, estimated cost for mobile. Touches
  roadmap M4 (touch controls, responsive HUD) and overlaps [[2026-06-27-performance-budget-and-optimizations]]
  (low-end-device perf). Awaiting owner go-ahead before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT the feasibility report** (largely complete — PM will
  package the TL study for the owner) and log a separate `owner-decision` for whether to BUILD mobile;
  **PARK the implementation** pending the owner's go after reading the report. Keeps us lean, avoids a
  big-bang. Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept report only**. Issue #56 created as an owner-decision
  (https://github.com/cakuki/tidewake/issues/56) holding the feasibility report; BUILD parked pending
  owner go. status → accepted (report). Added to ROADMAP M4 as a decision marker. PM to send the
  feasibility report to the owner via Telegram.
- 2026-06-27T00:00Z — Owner DECISION update: **"Go for mobile Phase 0 too."** Phase 0 (the real-device
  measurement spike) accepted → issue #62 created (https://github.com/cakuki/tidewake/issues/62),
  linked from #56. The full mobile build stays parked under owner-decision #56 pending Phase 0 numbers.
