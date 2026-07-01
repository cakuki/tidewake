# Next-slice queue (orchestrator reads top-down)

**This is the orchestrator's per-cycle starting point after a compact.** Read the TOP unblocked
item → dispatch ONE self-sufficient cycle-runner subagent for it → read its <10-line report →
move on. The cycle-runner owns all bookkeeping (commit specific files, push, verify CI, close the
issue, append its loop-log row, QA). See `docs/runbook/LOOP.md` → **Lean orchestrator protocol
(post-compact)**. Re-prioritise only when a higher item lands or the owner files new feedback.

**PREEMPTION RULE:** an owner `from-owner` **P1** issue (filed via the PM Desk — including the
**async Telegram intake**, `studio/comms/OWNER-CHANNEL.md`) **jumps to the top** of this queue,
ahead of everything below. Owner P1s preempt; do them first, then resume here.

**OWNER-DECISION RULE:** items marked **[OWNER-DECISION]** are *questions to ask the owner*, not work
to do. Surface them over the **two-way owner channel** (Telegram) with options — `owner-channel.sh
ask …` for a tappable choice — log them under `OWNER-CHANNEL.md` → ## Pending questions, and route
his reply back (never auto-adopt).

**QUEUE-SYNC RULE (Retro 9):** after any PM-desk intake batch, **re-sort this queue's top before the
next build dispatch** — a flat "items to file" list in `loop-state.md` is not a prioritised queue.

**PHASE-LABEL RULE (Retro 10, extended Retro 11):** several umbrellas (#94/#97/#101/#106/#70) shipped
a phase and stay OPEN. "OPEN" ≠ "untouched" — each line states **what shipped vs. what remains** so
priority tracks *delivered* value, not the issue's open/closed flag. **Retro 11 addition:** an
umbrella that **hosts a standing rule** (e.g. **#70** = the "1–2 sea-delight beats per loop" rule)
stays OPEN *deliberately* and is marked **[STANDING-RULE]** — it is **not** a candidate to close even
when its latest slice shipped.

---

_Set by **Retro 12** (2026-06-28, loops 62–68). State: the **reactive loop is CLOSED end-to-end** —
walk into a tavern → listen → chase a rumour with a **map marker** → arrive to a **reward** (coin +
Ballad verse) → Set Sail and the watch **reads your visit back** (#112/#111/#115 + #105). **Both
reputation poles now have symmetric verbs:** the pirate half (raid/false-colours/legend) is mirrored
by the governor half — **claim & grow a home port** for Standing (#118). **The open sea is now
reactive** — a foundering ship offers a rescue-vs-plunder moral choice (#125). **Each port sounds
like itself** (#69) and **recalls your last deed by name** (#104b). And the **save system is
hardened** — a declarative migration codec + frozen old-save corpus (#122) after we caught a REAL
silent-wipe bug (see below). **669 tests**, perf **32/130 draws · 90k/150k tris**, save **v12**.
Latest `v0.0.20260628070429`._

_**⚠️ #122 process headline (now a standing rule):** `deserialize` had hard-rejected any save whose
version ≠ current → **every schema bump (v8→v12 over ~20 cycles) silently WIPED player progress**,
undetected because tests only ever round-tripped a *current* save. Fixed structurally. **Standing
rule:** a save-schema change is not done until it migrates every prior version forward AND a frozen
blob of the new version is added to the corpus (the coverage guard enforces it)._

_**Next leverage: BUILD BATTLE — the owner decided it, it is the focused lane.** Battle is **DECIDED**
(owner chose **Option 2 → Option 4**, 2026-06-28). The accepted build is **#135** (`from-owner` · `P1`
· `epic`); the design brief **#100 is CLOSED** as reference. Per the **PREEMPTION RULE**, #135 stays at
the **TOP** of this queue until the lane ships something impressive + gamer-testable (lane-switch gate)._

_**UPDATE Loop 85 (2026-06-30, v0.0.20260630054448): slice 1 — Battle Mode shell — SHIPPED.** Deliberate
**E = give battle** → held BATTLE stance on the #95 infra, quarter-view camera, `⚔ BATTLE` banner, #94
music settle, NPCs sail underneath, **Flee always available**. Pure `src/systems/battle.js` TDD'd first;
no save-schema change (stays v16); perf unchanged (48 draws/90k tris)._

_**UPDATE Loop 87 (2026-06-30, v0.0.20260630073159): slice 2 — real-time broadside — SHIPPED.** Inside
the deliberate stance the **helm now stays LIVE** — **steer to bring the foe ABEAM** and press **SPACE**
to discharge the loaded guns in real time; a clean beam shot bites hard, a wide one flies past, the guns
**reload on the sim clock** (≈2.2s). Sinking pays Infamy, a crew that breaks pays Standing — reusing
`cannons.js` damage/morale via new pure `resolveBroadside` + `broadsideAim` (TDD'd first, 848 tests). The
turn-based #59 exchange is kept untouched as the alternate verb. No save-schema change (stays v16); perf
unchanged (48 draws/90k tris). Gallery `battle-broadside-135.png`. **#135 stays OPEN — next build is
slice 3 (workshop loadouts + mid-combat ammo cycle, ties town #96): buy/fit cannons & ammo at a town
workshop, one key cycles round/chain/grape/light/heavy/swivel mid-fight (no buying in combat).** Then
slice 4 (boarding → crew brawl → verbal duel climax: capture=Standing/sink=Infamy, early strike-colours →
ransom), slice 5 (expanded 50+ insult duel, anti-repeat within an engagement), then Option 4 phase-coupling.
Slice-2 follow-ups: an arena-spawn so the engaged foe is a dedicated maneuvering target (today reuses the
open-sea NPC); false-colours/letters-of-marque reward nuances on the real-time path; battle-HUD polish._

_**UPDATE Loop 88 (2026-06-30, v0.0.20260630210414): slice 3 — workshop loadouts + mid-combat shot cycle —
SHIPPED.** You now **fit shot at a town ⚒ Gunner's Workshop** (ties #96; the first ashore activity beyond
the market) and **press X mid-fight to cycle the LOADED shot** — round (balanced) / chain (cripples rigging,
weak reply) / grape (breaks crew nerve → a faster capture) / light (forgiving arc) / heavy (devastating but
slow) / swivel (quick-firing), **each a distinct effect on the broadside**. New pure `src/systems/ammo.js`
(6 profiles + cycle/fit loadout helpers, TDD'd first, 873 tests); `cannons.resolveBroadside` takes an optional
ammo profile (omitting = byte-identical round, so slice 2 is untouched). **No save-schema change — the loadout
is session-scoped, NOT persisted (stays v16)**; perf 32/130 draws · 90k/150k tris (zero new draws). Galleries
`workshop-loadout-135.png` + `ammo-cycle-135.png`._

_**UPDATE Loop 89 (2026-06-30, v0.0.20260630213520): slice 4 — boarding → crew brawl → verbal captain duel —
SHIPPED.** Beat a foe to **≤30% hull** and a gold **⚔ BOARD HER! (F)** finisher lights — **F** (or tap) sends the
crew over the rail for a quick **auto crew brawl** (crew × morale × loadout, 2–3 original comic lines), which
**hands off to the existing verbal captain's duel (#33 — reused, the climax)**. A boarded win is a **CAPTURE** →
pays **Standing** on top of Infamy; sinking via the broadside stays **pure Infamy** — the owner's capture/sink
fork is now real. New pure `src/systems/board.js` (canBoard/resolveBrawl/brawlMoraleDent, TDD'd first, 890 tests);
`duel.tryChallenge` takes an optional `{openingDent, boarded}` (open-sea hail byte-identical). **No save-schema
change — boarding is transient (stays v16)**; perf 32/130 draws · 90k/150k tris (zero new draws). Galleries
`boarding-brawl-135.png` + `captain-duel-climax-135.png`. **#135 stays OPEN — next build is slice 5 (expanded
50+ insult duel, 7 categories, anti-repeat within an engagement), then Option 4 phase-coupling.** Slice-4
follow-ups (deferred to keep this increment smallest): the **early strike-colours → ransom** short-circuit, a
post-duel explicit **sink-or-spare** choice, the brawl casualties actually gating the duel (Option 4), an
arena-spawn for a dedicated boarded target. Slice-3's PERSIST-loadout + BUY-economy follow-up still parked._

_**UPDATE Loop 90 (2026-06-30, v0.0.20260630215140): slice 5 (FINAL Option-2 slice) — expanded verbal
captain's duel — SHIPPED.** #33's duel grew from a 14-line stub into the climax the boarding fork deserves:
**14 → 56 original jab/riposte pairs** (every line authored for Tidewake, no recycled copy) and **5 → 7
categories** (added **Superstition** + **Hygiene**, each ≥6 lines), with **ANTI-REPEAT selection** —
`pickOptions(rng, enemy, n, recent)` prefers lines not shown recently; the duel controller keeps
session-scoped memory: `engagementSeen` (never re-offer a jab WITHIN a fight while the bench can cover it) +
a `DUEL_MEMORY`=18 rolling window ACROSS hails (back-to-back duels open fresh). The two hard guarantees — a
winning/weakness line is always offered, the hand is always n distinct — always beat freshness. Pure logic
TDD'd first (895 tests); **no save-schema change — static corpus + session-scoped history (stays v16)**; perf
32/130 draws · 90k/150k tris (zero new draws). Gallery `expanded-duel-135.png`. **ALL 5 Option-2 slices now
SHIPPED → the battle CORE is complete and the lane-switch gate is CLEARED** (gamer-testable end-to-end:
maneuver→broadside→board→brawl→expanded captain-duel→capture/sink fork). **#135 stays OPEN** — remaining is
the later **Option 4 ("Three-Act Raid", M7) phase-coupling** (hull→boarding odds; brawl casualties→duel
confidence; early strike-colours→ransom + post-duel sink-or-spare + arena-spawn fold in here). **Closing #135
is the OWNER's call** — commented on the issue with the full shipped/remains read. With the lane-switch gate
cleared, the loop MAY now consider switching lanes (e.g. #132 reputation-needle, or the next reactive/charm
reservoir item) — owner/PM steering applies._

## Top of queue (do in order) — re-sorted by DL #5 (loop ~71): finish engine de-risk, drain DL #4

_**UPDATE Loop 86 (2026-06-30): from-owner P1 #146 — port-view mobile clipping — SHIPPED.** The
town/port view clipped on phone viewports; fixed with a scrollable `.town-scroll` body + a PINNED
"⚓ Set Sail" footer + responsive sizing, and a **standing mobile-viewport guard** added to
`tests/playtest.mjs` (390×844 · 360×640 · 844×390 — asserts the panel fits, the body scrolls to its
end, Set Sail stays on screen). **#146 CLOSED.** The owner's larger "less scroll, MORE navigation"
ask is now an **[OWNER-DECISION]** below._

- **[OWNER-DECISION] #147 — Port-view redesign: less scroll, MORE navigation.** Follow-up to #146
  (the quick fix shipped). Ask the owner to pick a navigation model before building: **A** segmented
  tabs (Market·Tavern·Harbour) · **B** collapsible accordion · **C** quayside hub + drill-in cards
  (most mobile-native, biggest build). Options + tradeoffs in issue #147. **Do not build until the
  owner picks** (owner-decision rule); whichever ships inherits the #146 mobile-viewport guard.


**DL #5 (2026-06-28, 9-role fan-out) re-sorted this top. #126 / #120-mechanism / #123 / #125 / #118 /
#122 / #130 / #121 / #117 / #110 ALL SHIPPED & CLOSED; #133 contested rumour now SHIPPED.** The next
build top is the replay-gate hardening that must precede battle (#131), then the next reactive meter /
charm that battle inherits (#124, #116). **UPDATE 2026-06-29: battle is now DECIDED → build #135**
(`from-owner` P1); it preempts to the top, no longer owner-held. See `studio/retros/2026-06-28-deep-learning-5.md`.

_**Top re-promoted (Loop 82, queue hygiene):** the prior top (#131 replay-gate, #124 crew morale) both
SHIPPED & CLOSED (Loops 80–81); the engine de-risk quartet is done. Per DL #5's "next reactive meter /
charm that battle inherits" + the pole-tension frontier, the strongest UNBLOCKED reservoir items are
promoted below. **#135 battle is DECIDED & promoted to TOP (from-owner P1, preempts) — see below.**_

- ~~**#116 — Diegetic feedback for the reactive loop**~~ — ✅ **SHIPPED & CLOSED** (Loop 83,
   v0.0.20260629210608) — listen/approach/payoff/loss cues sung over the music bus + quantised to the
   bar-clock; battle inherits the feedback vocabulary. Pure `src/systems/loop-cues.js`. **Follow-ups
   (reservoir below):** ~~richer per-rumour-kind interaction SFX~~ ✅ (#148) · ~~a coin-chime under payoff~~ ✅ (#148) ·
   ~~a distinct rival-sail-sighted sting~~ ✅ **SHIPPED & CLOSED as #151** (Loop 98, v0.0.20260630235409) ·
   ~~a continuous wake/helm water-bed SFX (the #81 cheap cousin)~~ ✅ (#150) · ~~#81 hull-creak proper~~ ✅
   **SHIPPED & CLOSED as #81** (Loop 99, v0.0.20260701001358) — sparse parameter-driven creak grains
   under the wake-bed, driven by speed/helm/swell. **Reservoir FULLY DRAINED.** _(#81 deepenings deferred:
   a continuous modal resonator bank excited by roll+pitch; a comic over-creak on run-aground #76.)_

- ~~**#134 — [DL#5] Your Harbour, threatened**~~ — ✅ **SHIPPED & CLOSED** (Loop 84, v0.0.20260629214854,
  **save v16**). The home port (#118) now acquires a STAKE: a hard Infamy lean draws a **navy blockade**,
  a hard Standing lean a **pirate raid**, off your own home water — pricing pole-commitment. Shipped the
  **lightweight NON-BATTLE resolution** (pay tribute / stand firm + seeded dice), warned via the #105
  digest + an alarm-red town panel; pure `src/systems/harbour-threat.js` TDD'd first. Battle #100 NOT
  implied — this is its ready-made reason to fight (stakes-in → consequence-out). **Follow-up:** the
  defensive engagement rides WITH battle #100; richer threat escalation across visits.

- ~~**#132 — [DL#5] The reputation needle, made personal & audible**~~ — ✅ **SHIPPED & CLOSED** (both
  slices delivered; the issue's full stated scope is done). **Slice A (ship hull/sail material lerp, art)**
  — Loop 91, v0.0.20260630221704: the player's own ship grimes/darkens toward Infamy and brightens/glows
  toward Standing off `repLean`; pure `src/systems/reputation-aura.js`, zero new draws. **Slice B (harmonic
  modal recolour, audio)** — Loop 92, v0.0.20260630223335: the SAME `repLean` continuously recolours the
  procedural bed's lead MODE (Infamy→freygish/phrygian-dominant bite · Standing→warm Lydian · balanced→the
  honest D-major Ionian), ONE cross-faded gain, **percussive bed fixed** (the DL#3 trap), no `loadTrack`;
  pure `src/systems/harmonic-mood.js`, save v16, AudioContext-free in the gate. _(#132 had been prematurely
  closed once by a different HUD-gauge slice — reopened, both real slices then shipped, now genuinely
  closed.)_ **Follow-ups (deferred):** a per-pole lead *timbre* shift; a diegetic flourish on crossing the
  neutral band; generalise the hull cast into a reusable battle hull-damage state (#135 bonus).

- ~~**#131 — [DL#5] Harden the golden-replay gate**~~ — ✅ **SHIPPED & CLOSED** (Loops 79–80) — both
  invariants (determinism-parity + save-round-trip-per-tick) now gate the #123 fixture.
- ~~**#124 — Crew morale/loyalty meter**~~ — ✅ **SHIPPED & CLOSED** (Loop 81, save v15). Its Ballad
  verses + a dominant-pole closing couplet shipped Loop 82 (**#90 partial, kept OPEN**).
- ~~**#130 — Migrate the remaining hand-wired systems onto the registry**~~ — ✅ **SHIPPED & CLOSED**
  (Loop 72). The whole `update()` is the registry now; `when(ctx)` predicate folded in.
- ~~**#121 — Gate resource-conservation invariant + transition-frame perf sample**~~ — ✅ **SHIPPED &
  CLOSED** (Loop 76). Mesh-leak + build/teardown perf sample now gate every release.
- ~~**#133 — [DL#5] Contested rumour: a rival chases the same prize**~~ — ✅ **SHIPPED & CLOSED** (this
  loop) — a seeded soft clock + recurring named rival; arrive in time to win it, dawdle and the rival
  CLAIMS it first (no reward); both paths sing into the Ballad. Save **v14**. Follow-ups below.
- ~~**#126 — Reputation-reactive world grade**~~ — ✅ **SHIPPED & CLOSED** (Loop 69, v0.0.20260628073440).
  Diegetic rhumb-line heading wisp for #111 remains a separate art/design follow-up.
- ~~**#120 — Self-registering systems registry → thin `main.js`**~~ — ✅ **MECHANISM SHIPPED, #120 STAYS
  OPEN** (Loop 70, v0.0.20260628074440). `src/systems/registry.js` + a representative block migrated
  byte-for-byte; remaining systems → **#130** (above).
- ~~**#123 — QA golden-replay fixture for the full reactive loop**~~ — ✅ **SHIPPED & CLOSED** (rides the
  #122 hardening theme). Its two remaining gate holes → **#131** (above).

## ⚔️ TOP OF QUEUE — BATTLE, DECIDED (from-owner P1, preempts) — BUILD, don't nudge

- **#135 — Battle system, Option 2 → Option 4** (`from-owner` · `P1` · `epic`). **DECIDED 2026-06-28**
  — the owner read the Game-Designer brief (#100, now CLOSED as reference) and chose **Option 2
  (Maneuvering Battle) → then Option 4 (Three-Act Raid)**, shipped as small gamer-testable slices.
  This is the owner's **focused delivery lane**; per the **PREEMPTION RULE** it sits at the TOP.
  Its mode-switch infra (#95) + seam (#106 ph1) + QA (#107) + save-migration codec (#122) are all
  built — battle is the room now being filled, slice by slice.
  **SHIPPED:** slice 1 — Battle Mode shell (Loop 85, v0.0.20260630054448) · slice 2 — real-time
  broadside (Loop 87, v0.0.20260630073159) · slice 3 — workshop loadouts + mid-combat shot cycle
  (Loop 88, v0.0.20260630210414) · slice 4 — boarding → crew brawl → verbal captain duel (Loop 89,
  v0.0.20260630213520; ≤30% hull lights a **Board!** finisher → auto crew brawl → the #33 verbal duel
  is the climax; **capture = Standing / sink = Infamy**). **NEXT BUILD (top buildable item) = slice 5 —
  expanded verbal duel:** 14 → 50+ insults, 7 categories (+ Superstition, + Hygiene), **anti-repeat
  within an engagement**, an original comeback per line. Then **Option 4 phase-coupling** (hull damage →
  boarding odds; brawl casualties → duel confidence; the early strike-colours → ransom short-circuit +
  a post-duel sink-or-spare choice fold in here). **No owner nudge — the decision is in; #135 stays at
  the TOP until the lane ships impressive + gamer-testable (it now has: a full maneuver→broadside→board→
  brawl→captain-duel beat is playable end-to-end).**

## DL #4 + DL #5 candidates (research reservoir — below the #135 battle lane at top)

_Filed by **Deep-Learning #4** (`2026-06-28-deep-learning-4.md`) + **Deep-Learning #5**
(`2026-06-28-deep-learning-5.md`, 9-role fan-out, loop ~71). Asset-light, original-work-only,
reactive-verbs-first. Ordered by leverage. **DL #5 drain note:** DL #4 was 7/12 shipped — the strongest
remaining items are promoted into the top trio (#130/#121) and re-listed here; DL #5 added only 4 new._

- **Engine/gate de-risk — ride WITH battle #100 (Retro 11/12: a QA-coverage slice on each state-space
  growth; #122 generalised it to the player's *data*):**
  - ~~**#115 — typed world-target model (`objectives.js`)**~~ — ✅ **SHIPPED & CLOSED** (Loop 62).
  - **#130 — finish the registry migration** — _promoted to TOP (#1 above); fold in Dev's `when(ctx)`._
  - **#121 — gate resource-conservation invariant + transition-frame perf sample** — _promoted to TOP
    (#2 above); ride WITH #100._
  - **#131 — [DL#5] harden the golden-replay gate** (determinism-parity + save-round-trip) — _promoted
    to TOP (#3 above)._
  - ~~**#120 — registry mechanism**~~ ✅ MECHANISM SHIPPED (Loop 70) · ~~**#122 — save codec**~~ ✅
    CLOSED (Loop 68) · ~~**#123 — golden-replay**~~ ✅ CLOSED.
- **Governor pole — close the arc's last asymmetry (Product):**
  - ~~**#118 — governor's first reactive verb: claim & grow a home port**~~ — ✅ **SHIPPED & CLOSED**
    (Loop 67, save v12).
  - **#119 — governorship endgame milestone** (mirror of legend-crown #46). _design P3; **NOW UNBLOCKED**
    — deps #118 + #19 both CLOSED. Promote once battle #100 is steered (Retro 12 parks it behind battle)._
- **Pole TENSION + chase energy (DL #5 — the next depth frontier):**
  - ~~**#134 — [DL#5] Your Harbour, threatened**~~ — ✅ **SHIPPED & CLOSED** (Loop 84, save v16) — Infamy →
    navy blockade, Standing → pirate raid off your home water; lightweight non-battle resolution (tribute /
    stand-firm dice) shipped first. Battle's reason to exist — the defensive engagement rides WITH #100.
  - ~~**#133 — [DL#5] contested rumour: a rival chases the same prize**~~ — ✅ **SHIPPED & CLOSED** (this
    loop, save v14) — seeded soft clock + recurring named rival; arrive-first wins, dawdle and the rival
    claims it (no reward); both paths sing into the Ballad. _Follow-ups filed: a visible rival sail +
    interception (#128-adjacent), and the recurring rival feeding battle #100's antagonist (note-only)._
- **Make the needle FELT on the player (DL #5 convergence):**
  - **#132 — [DL#5] the reputation needle, made personal & audible** (hull/sail material lerp + harmonic
    modal recolour on the *same* needle). _art+audio+design P3; procedural, zero new assets._
- **Loop feedback / charm:**
  - ~~**#116 — diegetic feedback for the reactive loop**~~ — ✅ **SHIPPED & CLOSED** (Loop 83) — the four
    loop-beat cues (listen/approach/payoff/loss). **Reservoir follow-ups:** ~~per-rumour-kind LISTEN colour
    + coin-chime under the payoff~~ ✅ **SHIPPED & CLOSED as #148** (Loop 93, v0.0.20260630224900, save v16);
    ~~a continuous **wake/helm water-bed SFX**~~ ✅ **SHIPPED & CLOSED as #150** (Loop 96,
    v0.0.20260630232820, save v16) — an always-on speed/helm-driven noise wash through musicGain;
    ~~a distinct **rival-sail-sighted sting**~~ ✅ **SHIPPED & CLOSED as #151** (Loop 98,
    v0.0.20260630235409, save v16) — a tense low rising-tritone sting on first sighting a hostile sail,
    a hysteresis sighting latch through musicGain. ~~only #81 hull-creak proper remains~~ ✅ **SHIPPED &
    CLOSED as #81** (Loop 99, v0.0.20260701001358) — parameter-driven creak grains under the wake-bed.
    **Reservoir FULLY DRAINED.**
  - ~~**#117 — seeded per-pass melody variation**~~ — ✅ **SHIPPED & CLOSED** (Loop 77).
- **Reactive-world reservoir:**
  - **#124 — crew morale/loyalty meter** fed by your choices (DL #1's earned-mutiny; battle
    surrender/boarding currency — build *before* battle). _design P3; the next reactive meter._
  - ~~**#125 — emergent at-sea encounter: foundering ship, rescue vs plunder**~~ — ✅ **SHIPPED & CLOSED**
    (Loop 66). Follow-ups: more encounter types, grateful-crew-fights-alongside, a flying distress flag.
  - ~~_Reservoir note: a continuous wake/helm water-bed SFX (speed/turn-rate driven) — the cheap
    cousin of #81 hull-creak_~~ ✅ **SHIPPED & CLOSED as #150** (Loop 96). ~~#81 proper still open~~
    ✅ **SHIPPED & CLOSED as #81** (Loop 99) — grain-based creak voice under the wake-bed, driven by
    speed/helm/swell. Deepenings (continuous modal bank excited by roll+pitch; run-aground over-creak) deferred.

## Rumour-loop depth (#112 umbrella OPEN — close more reward kinds)

- **#127 — Trade rumour live price-spike** at the named port (richer chase payoff vs a flat bounty).
  _feature/design; deepens the closed loop._
- **#128 — Disposition/bounty rumour spawns a matching vessel** (chase a prize/patrol — a 2nd rumour
  type that proves the typed-objective pattern generalises). _feature/design._

## Charm / atmosphere fillers (from-owner; slot in around the depth slices)

4. **#106 — Mode-seam hardening, slice 1** (declarative `{[mode]:{onEnter,onLeave}}` registry — sugar
   over the bus). Cheap; **now overlaps #120's systems registry — sequence them together.** _(slice 4
   per-mode disposal PARKED — blocked on #100 battle meshes.)_
5. ~~**#110 — Living fauna phase 2: jumping dolphins**~~ **SHIPPED + CLOSED Loop 75 (v0.0.20260628094945)** — instanced pod arcs alongside the moving ship, deterministic + distance-culled, ≤1 extra draw. _#97 stays OPEN for phase 3 (other animals)._
6. **#101 — props phase 3: loose props** (lanterns/market stalls **feed the town mode** #96/#103).
   P2 from-owner. _(island dressing shipped via #71; texture-embed + extra variety PARKED.)_
7. **#129 — Per-town music, richer** (distinct melodies/instrument sets + a dedicated docked cue +
   live tempo — the #69 full follow-up). P3 audio.
8. **#70 [STANDING-RULE] — ocean sail-over curios** (flotsam/turtle/bottle → SFX + witty-line pool —
   the issue's *original* slice 1) + **#113** bow-spray flourish + **#114** sea-colour variation /
   current streaks. **#70 stays OPEN deliberately** as the home of the "1–2 sea-delight beats per
   loop" rule — do NOT close it. P2 from-owner.
9. **#68 — seagulls: louder calls near the coast** (SFX exists) + tie to the #97 visual flock. P2 from-owner.

## #94 remaining phases (P1 OPEN — but phase-1 headline acceptance is MET; not top-of-queue)

10. **#94 — rotating sea themes** (phase 2) + **real battle cue** (phase 4, rides #100) + **real audio
    files behind `loadTrack`** (phase 5 — **PARKED on an asset/owner decision**). #69 (phase 3, per-town)
    is promoted to the top trio above. _Proximity crossfade + mode-aware bed already shipped (Loop 50)._
11. **#109 — mode-aware audio craft** (constant-power crossfade · bar-clock transitions · procedural
    per-mode reverb · modal recolour). P3 audio. _Rides #94._
12. **#108 — per-mode perf budget + throttle world work in town** (gate ocean/wake + DPR by mode).
    P2 tech. _Promote **#36 fixed-timestep** above #84 (DL #3)._

## Depth / DL reservoir (between-mode fillers; prefer depth over breadth)

13. **#72 — cannon-combat depth follow-ups** (hull-damage visuals, tougher foes/gunnery spread, more
    aims, fleeing chase, cannon audio, foe initiative). Much of it **feeds #100 battle** — revisit
    after the owner brief.
14. **#80 — combat/harbour game-feel "juice" pass** (hit-stop, screenshake, camera punch; toggle-able).
    Pairs with #102's landfall punch + any #100 battle.
15. **#90 — Ballad richer composition** — _PARTIAL, OPEN (Loop 82 + 94 + 95 + 96): crew-morale verses +
    a dominant-pole closing couplet + 3-variant pools (Loop 82), a **"best of voyage" superlative line
    — richest haul + fiercest foe, named, deterministic, save-free** (Loop 94, v0.0.20260630230030),
    **share-as-image — a downloadable parchment PNG of the ballad** (pure `src/share-card.js` + guarded
    DOM raster, **SHIPPED & CLOSED as #149**, Loop 95, v0.0.20260630231453), and **two more superlatives —
    the kindest turn (max rescue standing, the governor-road peak) + a coin milestone (total voyage takings
    in the tally)**, pure + save-free v16 (Loop 96, v0.0.20260630233928). **Remains:** deed types needing a
    NEW tracked field / #122 migration (best trade, rank/title rung, ports-charted count) · seeded "daily
    voyage" ballad · PNG share via the Web Share API on mobile · further mood/length variation._ P3.
16. **#92 — richer privateering** (faction/bounty + persisted Letter-of-Marque commission + more false
    ensigns) — **its bounty side feeds #112 rumour-payoff**. DL reservoir: **#82 crew chorus**,
    **#81 hull creak**, **#83 watercolour chart**, **#40/#35 Klezmer 'freygish' + procedural cannon
    SFX** (pairs with the #94 battle cue).

## Polish (cheap, charming, compounds shareability — natural fillers)

17. **#15 — comedic loading-tip line pool.** — _humour surface, near-zero cost._
18. **#21 — HUD coins placeholder + cleaner layout.** — _legibility; sets up future HUD work._
19. **#88 — full weather (rain/storm/clouds), optional behind the #73 toggle.** — _extends day-night._

## Enablers / tech debt (schedule, don't let them perpetually lose)

20. **#36 — fixed-timestep accumulator loop.** — _**DL #3 promotes this above #84**: "the world lives
    under a paused helm" wants a sim that steps independently of input/render; `playerPaused` is its
    natural seam. Unlocks #108 + record/replay golden traces (extends #107)._
21. **#38 — lightweight PR-validation CI gate** (tests + headless playtest, no deploy). — _Retro 8's
    allow-list means script/test-only pushes no longer run unit tests at all; this is the proper home._
22. **#37 — tolerance-based deterministic visual diff.** Open since cycle 10. — _automates the last
    manual visual-QA step._
23. **#74 — PWA service worker (offline caching).** · **#75 — mobile safe-area/landscape/low-end
    polish.** · **#84/#85 — WebGPU / OffscreenCanvas spikes** (DL #2 tech reservoir; #84 below #36).

## Blocked / held
- **#99 — sail zones** (invisible regions driving music; later hostility/weather) — P3, naturally
  rides #94 + the #95 mode/zone seam; revisit after the rumour loop + battle land.

## ⏳ iOS — batch the next owner re-test (Retro 10, still open)
- Three device-dependent slices are shipped **best-effort, UNCONFIRMED** pending one owner iPhone
  re-test: **#77** audio unlock · **#87** no-text-select · **#93** ship's-wheel touch. Don't stack
  dependent work; ask the owner to confirm all three on the latest build in one pass.

---

_SHIPPED & CLOSED this block (Retro 12, loops 62–68): **#112/#111/#115** rumours that pay off
(town→rumour→marker→reward loop CLOSED; #111+#115 closed, #112 stays OPEN as the umbrella) · **#105**
"while you were ashore" digest · **#69** per-town music identity · **#104b** port recalls your last
deed by name (save v11) · **#125** at-sea foundering-ship encounter (rescue vs plunder) · **#118**
Your Harbour claim & grow — the governor pole's first verb (save v12) · **#122** declarative
save-migration codec + frozen old-save corpus (caught + fixed a REAL silent save-wipe bug). Filed
follow-ups: **#127/#128** richer rumour-reward kinds, **#129** richer per-town music. Earlier (Retro
11, loops 55–61): #103/#102/#107/#104/#71 + #70-ph1 ([STANDING-RULE], stays OPEN). DL #4 (2026-06-28)
filed #115–#126 — see `studio/retros/2026-06-28-deep-learning-4.md`. EPICs #1–#9 are umbrellas, not
slices._
</content>
