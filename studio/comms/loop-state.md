# Loop state (orchestrator)

Single source of truth (resume brain) for the never-stopping delivery loop. Survives context resets.

> ▶️ **LOOP RUNNING (owner restart 2026-06-27 ~14:00 UTC) — two-way owner channel LIVE.**
> **PER CYCLE:** (0) `scripts/owner-channel.sh peek` → route a pending-question answer / dispatch a
> PM-desk-triage subagent for unsolicited owner input (`studio/comms/OWNER-CHANNEL.md`); (1) read
> **`studio/comms/queue.md`** top item; (2) dispatch ONE self-sufficient cycle-runner; (3) read its
> <10-line report. Cycle-runners own ALL bookkeeping (commit specific files, push, verify CI, close
> the issue, append their own loop-log row, self-QA, **report the release out over Telegram**); the
> orchestrator does not edit this file per cycle. Full protocol: "Lean orchestrator protocol
> (post-compact)" in `docs/runbook/LOOP.md`.

- **Current loop:** 29 done → next is **30** (read `queue.md` top). Loops 27–29 this session: #59
  cannon combat → #63 mobile PWA → PWA notch safe-area fix.
- **Loops since last retro:** **3** (27–29; Retro 5 covered 20–26) — **🟡 RETRO 6 DUE NOW** (every 3–4).
- **Cycles since last deep-learning loop:** ~21 — **🔴 DL #2 BADLY OVERDUE** (trigger every 10; #1 at
  loop 10 filed #32–#40; loops 11–29 all mined it — refill the well). #5 in `queue.md`. Run soon.
- **State:** core arc COMPLETE + tuned reachable + onboarded + sunny + perf-gated; **+ cannon combat
  (#59), + installable mobile PWA with heat-aware DPR cap (#63), + PWA safe-area-top (part of #75).**
- **Next slices (`queue.md`):** **#73** settings/toggles UI → **#58** weather (OPTIONAL toggle, sunny
  default) → **#55** art research → **DL loop #2** + **Retro 6** (both ritual-overdue) → depth #76
  collision / #72 cannon-followup / #32 glTF; polish #66 docked-touch-overlap, rest of #75.
- **Owner-decisions ANSWERED (Telegram 2026-06-27):** #56 mobile = **GO (shipped #63)**; #58 weather =
  **GO as optional toggle**. New owner-steered: **#73** toggles UI, **#76** collision+harbour-slowdown.
- **⏳ Pending owner question:** **#76 priority — P1 (jump queue) vs P2?** Held at filed-P1, NOT
  preempting until he confirms (logged in `OWNER-CHANNEL.md` → Pending questions).
- **Comms:** **two-way owner channel LIVE** (`OWNER-CHANNEL.md` + `scripts/owner-channel.sh`) — report
  out on every release/roadmap change; smart intent-routing in (pending-answer / thread-reaction /
  small ad-hoc inline / planning→PM-desk). Poll `owner-channel.sh peek` each cycle (step 0).
- **Process (Retro 5):** lean orchestrator protocol live; cycle-runners own ALL bookkeeping &
  `git add <specific files>` (NEVER `git add -A`); no docs-subagent concurrent with a `git add -A`
  runner; live QA only for owner visuals (cache-bust `ignoreCache`, one shot, then park tab on
  `about:blank`); rituals run as scheduled subagents. (Retro 4 still holds: cycle-runner owns visual
  QA; Game Designer owns balance/tuning; from-owner P1s jump the queue.)
- **QA gotcha (note):** synchronous tw.step() doesn't advance wall-clock → CSS fade-in transitions
  read mid-flight; QA must wait real time (~600ms) before asserting opacity-based visibility.
- **Latest release:** **v0.0.20260627133536** (PWA safe-area-top). 31 releases, **249 tests**.
- **Live:** https://cakuki.github.io/tidewake/
- **Open enablers:** #37 deterministic visual-diff (schedule — open since cycle 10); #38 PR-validation
  CI gate; #36 fixed-timestep.

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
| 20 | from-owner P1 batch: camera opens astern + centre/stabilise wind compass + calm swell (ports/docks stop submerging) | #49,#50,#51 | v0.0.20260627110811 | Owner P1 fast-lane; cleaned every capture |
| 21 | Sunny Caribbean holiday water — palette, sun glint, micro-detail (owner's signature vibe) | #61 | v0.0.20260627111728 | Most shareable visual of the night; do NOT undo |
| 22 | Tune renown/legend curve for a single web session — fast early ranks, reachable legend | #57 | v0.0.20260627112714 | LEGEND_AT 2400 (was ~12,800); Game-Designer tuning pass; arc now *felt* in a sitting |
| 23 | Measurement-first perf budget gate — src/perf.js ceilings + P overlay; playtest asserts draws/tris | #52 | v0.0.20260627113504 | Owner P1; 130 draws/150k tris (~70% headroom); deterministic counters, not fps |
| 24 | Bigger-map route-planning chart of the whole archipelago (Tab toggle) | #54 | v0.0.20260627114207 | Owner P2; complements the minimap |
| 25 | Self-contained, self-tested wind compass UI component (first src/ui/ component) | #53 | v0.0.20260627114757 | Owner P2; the UI-component standard made real |
| 26 | Invisible onboarding — seeded first goal + juicy first-win beats, no tutorial wall | #60 | v0.0.20260627115834 | 229 tests; latest release; cheapest retention lever now the arc is reachable |
| — | Retro 5 (subagent) | — | — | **Arc now LANDABLE** (tuned reachable + onboarded + sunny + perf-gated). Owner-feedback sprint: all owner P1s + P2s #53/#54 shipped same session. Process headline (owner ask): added **Lean orchestrator protocol (post-compact)** — per cycle = read `queue.md` top → dispatch one self-sufficient cycle-runner → read <10-line report; cycle-runners own ALL bookkeeping & `git add <specific files>` (never `-A`); live QA only for owner visuals (cache-bust, park tab on about:blank); rituals as scheduled subagents. Created `queue.md`. Next direction: thin depth (cannon #59) + polish (#19/#15/#20/#21), gated by owner-decisions #56/#58. DL #2 overdue. **LOOP STOPPED for compaction.** |

| 27 | Cannon Broadside — open fire (G) as a teeth-y alternative to the Insult Broadside duel; deterministic seedable exchange, two aims, coin+Infamy on a sinking | #59 | v0.0.20260627130215 | 242 tests (+13); `src/cannons.js` pure+TDD mirrors duel.js; fire-orange HUD panel; QA hook .cannons/.openFire/.cannonFire; playtest drives a cannon win. Closed #59, filed depth follow-up #72 |
| 28 | Mobile MVP — installable PWA (`manifest.webmanifest` + brass-anchor icons, Add-to-Home-Screen, standalone, sunny theme) + heat-aware DPR cap (`pixelRatioCap` ≤1.5x on coarse-pointer so a 3x phone doesn't cook the per-vertex ocean) atop the existing touch controls + responsive HUD (#17) | #63 | v0.0.20260627131832 | 249 unit tests (+7: pixelRatioCap + PWA install contract); playtest now fetches the manifest in-browser & asserts the touch verbs exist; perf unchanged (77 draws/85.2k tris). Phone-viewport QA shot clean — controls thumb-reachable, no overlap (`studio/qa/gallery/v0.0.20260627131832-mobile-pwa.png`). Docking is automatic (no dock button needed). Workflow copies manifest into `_site`. Closed #63; filed follow-ups #74 (service-worker offline) + #75 (safe-area/landscape/low-end-throttle); docked overlap already tracked as #66 |
| 29 | PWA top-notch safe-area spacing (owner request via Telegram, §3c small fix) — swept `env(safe-area-inset-*)` onto every top-anchored HUD element (`#hud`, `#title`, `#map-toggle`, `#audio-toggle`, `#perf`, touch `#minimap`) so the top HUD no longer hides under the notch / status bar in PWA standalone; also fixed the ≤560px media-query `#title` rule that re-pinned a bare `top:12px` and would have dropped the inset on a narrow phone. CSS-only; `viewport-fit=cover` already present; insets collapse to 0 on desktop/non-notch | #75 (partial) | v0.0.20260627133536 | 249 unit tests (unchanged — pure CSS); playtest ✓, perf unchanged (77/130 draws · 85.2k/150k tris), zero console errors. Headless phone-viewport QA (390×844) with a simulated 47px notch: all four top elements clear it (hud/audio/map 59px, title 65px ≥ 47) — gallery shot `studio/qa/gallery/v0.0.20260627133536-safe-area-top.png`. Reported out over Telegram. #75 safe-area-**top** done; landscape pass, home-indicator/side insets in other orientations, low-end throttle, gesture steering remain → #75 stays open. #66 (docked button overlap) untouched, kept out of scope |

## Hourly Telegram log

| UTC | Version | What changed | Media |
|-----|---------|--------------|-------|
| 23:25 | v0.0.2026...1938 | Test update + v0 status | screenshot |
| 00:10 | v0.0.2026...0101 | Wake, sail, audio, wind compass (5 releases) | video |
| 00:50 | v0.0.2026...4415 | Ports + save/load + modularise (clearer video) | video |
| 01:48 | v0.0.2026...4341 | Economy, NPCs, persistence, deep-learning loop, Captain's Ledger | screenshot |
