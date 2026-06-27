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
