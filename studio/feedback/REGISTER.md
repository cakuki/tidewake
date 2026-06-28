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
| 2026-06-27-collision-and-harbour-slowdown | feature | accepted | **DELIVERED & CLOSED** — island + ship collision + arcade slow-to-stop; loop built all 4 phases (a1/c/b/a2) | [#76](https://github.com/cakuki/tidewake/issues/76) |
| 2026-06-27-shipwheel-mobile-nav | idea | accepted | Draggable ship's-wheel touch steering; camera-coexistence solved by DOM layering (dup #98 closed) | [#93](https://github.com/cakuki/tidewake/issues/93) |
| 2026-06-28-living-sea-fauna | idea | accepted | Living world: gulls/dolphins/animals, instanced + culled (extends #68) | [#97](https://github.com/cakuki/tidewake/issues/97) |
| 2026-06-28-approach-town-music-cue | feature | accepted | Proximity crossfade 'port nearby' cue — first slice of the sound-system epic | [#94](https://github.com/cakuki/tidewake/issues/94) |
| 2026-06-28-town-mode-trade-view | feature | accepted | Town as a real MODE (harbour→market, leave via button) + mobile-overlap fix; split mode/town | [#95](https://github.com/cakuki/tidewake/issues/95) + [#96](https://github.com/cakuki/tidewake/issues/96) |
| 2026-06-28-arcade-battle-modes | idea | accepted | Owner chose **Option 2 → then 4**, small incremental steps; battle epic filed | [#135](https://github.com/cakuki/tidewake/issues/135) · design [#100](https://github.com/cakuki/tidewake/issues/100) |
| 2026-06-28-delivery-operating-principles | feedback | accepted | Standing doctrine: self-eval (testable/human-gated) + BAU + focused-lane delivery with a lane-switch gate; in ROADMAP | — (roadmap + memories) |
| 2026-06-28-community-manager-role | idea | raw | **RECORD-ONLY** (owner): hire a Community Manager (4th test layer — post updates, gather player feedback); start after weekly usage reset | — (held) |
| 2026-06-28-batch-… · leaderboard | idea | raw | Rank player among notorious captains (marquees) — loop to refine/prio | [#136](https://github.com/cakuki/tidewake/issues/136) |
| 2026-06-28-batch-… · nations | idea | raw | Nations own cities; ship allegiance; fight for/capture cities (big, split) | [#137](https://github.com/cakuki/tidewake/issues/137) |
| 2026-06-28-batch-… · localities | idea | raw | More islands/cities + size tiers (camp/town/city) | [#138](https://github.com/cakuki/tidewake/issues/138) |
| 2026-06-28-batch-… · online-mp | idea | raw | **Owner-decision**: online/multiplayer session — major architecture, needs options brief | [#139](https://github.com/cakuki/tidewake/issues/139) |
| 2026-06-28-batch-… · map-support | idea | raw | Fixed maps and/or random map generation | [#140](https://github.com/cakuki/tidewake/issues/140) |
| 2026-06-28-batch-… · shipyards | idea | raw | Shipyards: buy ships & parts; small→big ship progression | [#141](https://github.com/cakuki/tidewake/issues/141) |
| 2026-06-28-batch-… · named-persons | idea | raw | USP vs SMP: persona creation + every person named with traits | [#142](https://github.com/cakuki/tidewake/issues/142) |
| 2026-06-28-batch-… · ship-fights (folded) | idea | raw | Visible NPC-vs-NPC fights → noted on battle epic | [#135](https://github.com/cakuki/tidewake/issues/135) |
| 2026-06-28-batch-… · named-crew (folded) | idea | raw | Named crew + per-member skills + loyalty/mutiny → extends crew epic | [#4](https://github.com/cakuki/tidewake/issues/4) + [#124](https://github.com/cakuki/tidewake/issues/124) |
| 2026-06-28-multiple-bg-music | feature | accepted | Unified sound system: multiple sailing/town/battle tracks + crossfade (absorbs #69; future zones #99) | [#94](https://github.com/cakuki/tidewake/issues/94) |
| 2026-06-28-use-cc0-pirate-kit-assets | feature | accepted | Start using CC0 Pirate Kit (Quaternius/Kenney) — ships (#32 greenlit) + props (#101) | [#32](https://github.com/cakuki/tidewake/issues/32) + [#101](https://github.com/cakuki/tidewake/issues/101) |
