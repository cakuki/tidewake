# Feedback REGISTER — the PM desk pipeline

Index of every owner-feedback item and its current status. The PM desk keeps this in lockstep
with the item files in `inbox/`. Raw items are never deleted — only their status advances.

**Pipeline:** `raw → triaging → needs-clarification → assessed → accepted (#issue) / parked / declined`

| Status | Meaning |
|--------|---------|
| `raw` | Captured, untouched. The owner's "don't act yet" guarantee. |
| `triaging` | PM is interviewing the owner. |
| `needs-clarification` | Waiting on the owner to answer a question. |
| `assessed` | Has a PM `value` note + a TL `feasibility` note. |
| `accepted` | Owner confirmed → GitHub issue created + on the roadmap. |
| `parked` | Worth revisiting later; reason logged. |
| `declined` | Not pursuing; reason logged. |

## Items

| id | type | status | value (1-line) | issue |
|----|------|--------|----------------|-------|
| 2026-06-27-camera-default-astern | feature | accepted | One-line default-camera fix; removes daily friction | [#49](https://github.com/cakuki/tidewake/issues/49) |
| 2026-06-27-wind-indicator-misalignment | bug | accepted | Compass wind arrow drifts on turn; erodes HUD trust | [#50](https://github.com/cakuki/tidewake/issues/50) |
| 2026-06-27-wave-scale-disappearing-coasts | bug | accepted | Protects the 'believable sea' pillar; coasts/docks vanish under swell | [#51](https://github.com/cakuki/tidewake/issues/51) |
| 2026-06-27-performance-budget-and-optimizations | feature | accepted | Measurement-first guardrail for the whole roadmap (+ ongoing epic) | [#52](https://github.com/cakuki/tidewake/issues/52) |
| 2026-06-27-self-contained-tested-ui | feature | accepted | Self-contained, self-tested UI standard; compounding reliability | [#53](https://github.com/cakuki/tidewake/issues/53) |
| 2026-06-27-bigger-map-view | feature | accepted | Toggleable bigger map (MVP); waypoint interactivity parked | [#54](https://github.com/cakuki/tidewake/issues/54) |
| 2026-06-27-art-asset-sourcing | idea | accepted | Research only: cost/effectiveness sourcing report → designer budget | [#55](https://github.com/cakuki/tidewake/issues/55) |
| 2026-06-27-mobile-support-feasibility | idea | accepted | Report done; **Phase 0 device spike approved** ([#62](https://github.com/cakuki/tidewake/issues/62)); full build parked (owner-decision) | [#56](https://github.com/cakuki/tidewake/issues/56) |
| 2026-06-27-sea-texture-caribbean | feature | accepted | Sunny/holiday Caribbean sea: turquoise palette + sun glint + subtle detail, low perf cost | [#61](https://github.com/cakuki/tidewake/issues/61) |
| 2026-06-27-ios-native-mvc-frontend | idea | accepted | iOS via WebView/PWA (Approach 1); native renderer parked, full rewrite declined | [#63](https://github.com/cakuki/tidewake/issues/63) |
| 2026-06-27-ship-water-inside | bug | accepted | Sea clips through open hull; add opaque bilge cap | [#65](https://github.com/cakuki/tidewake/issues/65) |
| 2026-06-27-mobile-hud-overlap | bug | accepted | iPhone12: touch buttons overlap town/trade panel; hide-while-docked | [#66](https://github.com/cakuki/tidewake/issues/66) |
| 2026-06-27-auto-harbor-on-approach | feature | accepted | Staged auto-harbor (announce→slow→city view→nav off→Leave); visible+audible cues, short, reversible | [#67](https://github.com/cakuki/tidewake/issues/67) |
| 2026-06-27-seagulls-ambience | feature | accepted | Gull SFX exists → 'louder near coast' S slice; visual flock M | [#68](https://github.com/cakuki/tidewake/issues/68) |
| 2026-06-27-per-town-music | feature | accepted | Distinct per-town music; transposition-first, rides #67 | [#69](https://github.com/cakuki/tidewake/issues/69) |
| 2026-06-27-ocean-fun-microdetails | idea | accepted | Ocean sail-over delight + standing '1-2 per loop/retro' rule | [#70](https://github.com/cakuki/tidewake/issues/70) |
| 2026-06-27-islands-tlc | feature | accepted | Island palette/variety/props polish, coord w/ #61 | [#71](https://github.com/cakuki/tidewake/issues/71) |
| 2026-06-27-collision-and-harbour-slowdown | feature | assessed | Island + ship collision and arcade slow-to-stop for harbour/fight; believability-pillar gap exposed by combat #59 — filed P1 (pending owner nod) | [#76](https://github.com/cakuki/tidewake/issues/76) |
| 2026-06-27-shipwheel-mobile-nav | idea | needs-clarification | Mobile nav more fun/easy; ship's-wheel touch steering (owner will explain more) |  |
