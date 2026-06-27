---
id: 2026-06-27-self-contained-tested-ui
date: 2026-06-27
type: feature         # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Engineering-quality investment that compounds — prevents the whole class of bug like the wind-indicator drift across HUD/ledger/trade/duel as the UI grows (especially before mobile responsive work). Player-invisible but reliability-positive; cheapest to adopt while the UI surface is still small."
feasibility: "TL: M for the first meaningful slice, then ongoing. Today minimap.js is already the good model (pure functions + unit tests); hud.js is one ~240-line blob reaching ~20 elements by id, fed the global state, with no per-element tests. Approach: adopt the minimap pattern as house style — src/ui/<name>.js with pure derive/format fns + a create(el, deps) factory + explicit update(props)/named states; add jsdom under node:test for component DOM-state tests (one dev-only dep), keep Puppeteer as the integration gate. First slice: extract the wind compass (doubles as the fix for the wind-indicator bug); then iterate one element per slice. Risk: full decomposition is L/scope-creep; needs a devDependency."
decision: "ACCEPT — standing convention + first slice (wind compass, #50). Owner accepted."
issue: "https://github.com/cakuki/tidewake/issues/53"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

In general ensure the UI elements are behaving correctly and consistently across different states of the element with automated testing tools. Elements should be self contained and not dependent on external factors that could cause misalignment or unexpected behavior. So if an element needs to be adjusted for different case, it implements its own states, not the parent or external elements. Self contained, self tested.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (bulk dump, paragraph 3 of 5 — split B: the general standard).
  status: raw. Engineering-quality directive: self-contained, self-tested UI components with automated
  cross-state testing; ownership of state lives in the element, not the parent. The concrete instance
  that prompted it is [[2026-06-27-wind-indicator-misalignment]]. Awaiting owner go-ahead before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT as a standing convention + a first slice** bundled with
  [[2026-06-27-wind-indicator-misalignment]] (extract the wind compass as the pattern-setter + harness);
  then iterate element-by-element. Awaiting owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept**. Issue #53 created
  (https://github.com/cakuki/tidewake/issues/53). status → accepted. Added to ROADMAP (Tech, ongoing).
  Proposed priority P2 logged for loop PM+TL sign-off. First slice paired with #50.
