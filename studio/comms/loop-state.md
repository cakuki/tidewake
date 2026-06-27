# Loop state (orchestrator)

Single source of truth for the never-stopping delivery loop. The orchestrator
updates this each loop so progress survives context resets.

- **Current loop:** 26 (ALL owner P1s done; P2: #54 map done, next #53 UI-std, #55 art-research; #56 mobile=owner-decision; Retro 5 + DL#2 due soon)
- **Loops since last retro:** 0 (Retro 4 DONE — reset; covered cycles 16,17,18,19)
- **Cycles since last deep-learning loop:** ~9 — **#2 DUE NOW** (run before the well runs dry; #1 filed #32-#40)
- **Research backlog (prioritise):** #57 tune renown curve (NEXT), #50/#51 from-owner P1 bugs (FAST-LANE), #58 weather & day-night, #59 ship-vs-ship cannon combat, #60 invisible onboarding, #49 camera astern (P1), #32 glTF hull, #35 cannon SFX, #37 deterministic visual-diff (schedule — owned since cycle 10), #52 perf budget (P1), #40 adaptive music, #36 fixed-timestep, #53 self-tested UI components
- **Next slices (Retro 4, priority):** (1) **#57 tune the renown/legend curve** — the arc is complete but the ~12,800 grind is unreachable in a ~4.45-min web session; most shareable, highest-leverage slice. (2) **from-owner P1 bug fast-lane #51 (swell submerges ports/docks) + #50 (compass drift)** — visible breakage, cheap, cleans every capture; PARALLEL-BATCH candidate (disjoint: #57 tunes renown numbers, #50/#51 touch sea/compass — but #51+#58 share the water/swell, contract first). (3) **#58 weather & day-night** — biggest charm-per-pixel depth, asset-free, shareable. (4) **#59 ship-vs-ship cannon combat** — depth that complements the Insult Broadside duel (design-first, after the curve is tuned). Then #60 onboarding + #49 camera-astern as a follow-on batch; build #37 deterministic visual diff.
- **Process (Retro 4):** cycle-runner's QA step now OWNS the Chrome-MCP gallery capture + diff (orchestrator stops manual visual QA); Game Designer owns a per-block balance/tuning pass; from-owner P1 bugs jump the feature queue.
- **QA gotcha (note):** synchronous tw.step() doesn't advance wall-clock → CSS fade-in transitions (e.g. #trade .show opacity) read mid-flight; QA must wait real time (~600ms) before asserting opacity-based visibility.
- **Last Telegram update (UTC):** 2026-06-27T07:35 (morning catch-up + art screenshot)
- **Next hourly update due (UTC):** ~2026-06-27T08:35
- **Latest release:** v0.0.20260627072700 (art polish: carved hull, richer islands, ink-wash)
- **Live:** https://cakuki.github.io/tidewake/
- **OWNER filed issues (from-owner label, P1 first):** #50/#51/#49 DONE; #61 Caribbean water, #57 renown tuning, #52 perf, #53 UI-component std, #54 bigger map, #55 art-sourcing, #56 mobile-go owner-decision
- **Note:** session hit usage limit ~01:43-07:20 UTC (paused), resumed on owner "continue".
- **Open enablers:** #37 deterministic visual-diff (schedule); #52 perf-budget gate (P1, gates #58 weather)

## Loop log

| Loop | Slice(s) | Issue | Release | Notes |
|------|----------|-------|---------|-------|
| 0 | Bootstrap: working v0, CI/CD, studio, backlog | — | v0.0.20260626231938 | Foundation shipped |
| 1 | Bow wake + trailing foam | #18 | v0.0.20260626233635 | QA: wake reads well; logged sail-visibility #23 |
| 1.5 | TDD harness + physics module; audio agents; QA system; parallel protocol | — | v0.0.20260626234838 | Framework expansion per owner |
| 2 | Sail visibility (#23) + ambient audio (#14) in parallel | #23,#14 | v0.0.20260626235544 | First parallel-dev batch |
| 3 | Wind compass + point-of-sail label (TDD) | #10 | v0.0.20260627000101 | 33 unit tests |
| — | Retro 1 (subagent) | — | — | Filed #24 modularise, #25 actions-bump; next = gameplay verb |
| 4 | Dockable ports (3 named) + harbourmaster arrival toast | #12,#22 | v0.0.20260627002601 | First gameplay verb; 39 unit tests |
| 5 | Save/load voyage to localStorage (TDD) + N=new voyage | #11 | v0.0.20260627003834 | 50 unit tests |
| 6 | Modularise main.js → input/hud/sailing/persistence | #24 | v0.0.20260627004415 | −43% lines; behaviour identical |
| — | Retro 2 (subagent) | — | — | Creative roles dark + gallery lapsed → CREATIVE SPARK beat, enforced gallery gate, parallel-default. Filed #26 economy, #27 Musician theme, #28 NPC ship. Next = #26+#27 parallel batch |
| 7 | Port economy (5 goods, 3 ports, arbitrage, trade panel) + Musician sailing theme — parallel | #26,#27 | v0.0.20260627010038 | 73 tests; QA found trade bug #29 |
| 8 | Fix trade (state.port getter + buy-by-name) | #29 | v0.0.20260627011026 | 76 tests; trade verified live (Rum buy coins 100→34). #30 filed→closed non-bug |
| 9 | Wandering NPC ships + persist economy (parallel) | #28,#31 | v0.0.20260627012517 | 96 tests; 3 AI vessels; save v2 (coins/cargo) |
| 10 | Deep-learning research loop #1 (9 agents, web research) | — | — | Filed #32-#40; agents' identities refreshed |
| 11 | Captain's Ledger — renown/rank ladder (TDD) | #39 | v0.0.20260627014341 | 114 tests; Bilge-rat→Terror of the Tidewake; persisted |
| 12 | Art polish: carved hull + richer islands + ink-wash horizon | #42 | v0.0.20260627072700 | 114 tests; procedural, no assets |
| 13 | Ports react to renown (tiered greetings + standing perk) | #43 | v0.0.20260627074620 | 124 tests; greets by title; price perk |
| 14 | Insult Broadside — comedic insult-duel combat vs NPCs | #33 | v0.0.20260627080427 | 134 tests; morale duel, 14 jabs, coin+renown reward; cleaned stray branch, filed #44 |
| 15 | Minimap radar (islands/ports/NPCs, north-up) | #16 | v0.0.20260627083006 | 141 tests; bottom-left, plots world |
| 16 | KEYSTONE: renown two-poles — Infamy(pirate)↔Standing(governor) | #45 | v0.0.20260627085452 | 155 tests; diverging titles, pole-aware port reactions, persisted |
| 17 | Endgame milestones — become THE pirate/governor (legend overlay) | #46 | v0.0.20260627100354 | 180 tests; persisted legends, sandbox continues |
| 18 | Polish batch: legend overlay persists, HUD/title overlap, Node-24 actions | #47,#41,#25 | v0.0.20260627102844 | 180 tests; CI annotation cleared |
| 19 | Duel audio juice — procedural SFX stings | #48 | v0.0.20260627104334 | 182 tests; playtest now wins a full duel |
| — | Retro 3 (subagent) | — | — | Fantasy now legible (sail→trade→renown rank, NPCs). Adopted #34 shared-contract step + re-dispatch-glitched-subagent rule + QA nav/timing gotchas into runbook; new guardrail "reactive verbs over inert content". Next = #43 (port reputation reactions, #39-followup) reputation reactions + #32 glTF ship (parallel, contract'd) |
| — | Retro 4 (subagent) | — | — | **Core fantasy arc COMPLETE** (two poles #45 → crowned a legend #46). Depth-vs-breadth: TUNE the arc to be reachable first (#57, the ~12,800 grind is unreachable in a web session), then depth (weather #58, cannon combat #59) over breadth. Process: cycle-runner QA step owns the gallery capture+diff (not orchestrator); Game Designer owns balance/tuning; from-owner P1 bugs jump the queue; build #37 diff. Filed #57-#60. Deep-learning #2 due. Next = #57 tune curve, then #51/#50 P1-bug fast-lane |

## Hourly Telegram log

| UTC | Version | What changed | Media |
|-----|---------|--------------|-------|
| 23:25 | v0.0.2026...1938 | Test update + v0 status | screenshot |
| 00:10 | v0.0.2026...0101 | Wake, sail, audio, wind compass (5 releases) | video |
| 00:50 | v0.0.2026...4415 | Ports + save/load + modularise (clearer video) | video |
| 01:48 | v0.0.2026...4341 | Economy, NPCs, persistence, deep-learning loop, Captain's Ledger | screenshot |
