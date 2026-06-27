# Loop state (orchestrator)

Single source of truth for the never-stopping delivery loop. The orchestrator
updates this each loop so progress survives context resets.

- **Current loop:** 13 (art polish #42 shipped; next: #43 port/NPC reactions to renown)
- **Loops since last retro:** 0 (Retro 3 DONE — reset; covered cycles 7,8,9,11)
- **Cycles since last deep-learning loop:** 0 (Deep-learning loop #1 DONE — all 9 agents refreshed; filed #32-#40)
- **Research backlog (prioritise):** #43 (port reputation reactions, #39-followup) port reputation reactions (NEXT), #32 glTF ship, #33 Insult Broadside combat, #16 minimap, #35 cannon SFX, #36 fixed-timestep, #37 visual-diff QA, #40 adaptive music, #25 actions bump ( #34 contract step ADOPTED into runbook/PARALLEL.md)
- **Next slices (Retro 3, priority):** (1) #43 (port reputation reactions, #39-followup) ports/NPCs react to renown — reactivity; (2) #32 CC0 glTF hull — charm; PARALLEL BATCH candidate (#43 (port reputation reactions, #39-followup) edits reputation/state, #32 edits ship mesh — disjoint files; CONTRACT: renown/reputation read API — name·shape·owner before dispatch). Then (3) #33 Insult Broadside (bigger, after stakes exist); (4) #16 minimap as a batch B-side.
- **QA gotcha (note):** synchronous tw.step() doesn't advance wall-clock → CSS fade-in transitions (e.g. #trade .show opacity) read mid-flight; QA must wait real time (~600ms) before asserting opacity-based visibility.
- **Last Telegram update (UTC):** 2026-06-27T07:35 (morning catch-up + art screenshot)
- **Next hourly update due (UTC):** ~2026-06-27T08:35
- **Latest release:** v0.0.20260627072700 (art polish: carved hull, richer islands, ink-wash)
- **Live:** https://cakuki.github.io/tidewake/
- **Note:** session hit usage limit ~01:43-07:20 UTC (paused), resumed on owner "continue".
- **Open enablers:** #25 bump Actions off Node-20; #41 HUD/title overlap (P3)

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
| — | Retro 3 (subagent) | — | — | Fantasy now legible (sail→trade→renown rank, NPCs). Adopted #34 shared-contract step + re-dispatch-glitched-subagent rule + QA nav/timing gotchas into runbook; new guardrail "reactive verbs over inert content". Next = #43 (port reputation reactions, #39-followup) reputation reactions + #32 glTF ship (parallel, contract'd) |

## Hourly Telegram log

| UTC | Version | What changed | Media |
|-----|---------|--------------|-------|
| 23:25 | v0.0.2026...1938 | Test update + v0 status | screenshot |
| 00:10 | v0.0.2026...0101 | Wake, sail, audio, wind compass (5 releases) | video |
| 00:50 | v0.0.2026...4415 | Ports + save/load + modularise (clearer video) | video |
| 01:48 | v0.0.2026...4341 | Economy, NPCs, persistence, deep-learning loop, Captain's Ledger | screenshot |
