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

## 🧭 TOP OF QUEUE — PRODUCT REFILL (2026-07-02) — **POST-RISE POLISH** (consolidate the big run) — BUILD IN ORDER

_**UPDATE 2026-07-02 — PRODUCT cycle right after THE RISE (epic #168) closed (roadmap change, report-worthy).**
Two enormous fun-first lanes just shipped back-to-back — battle-fun #161, difficulty/variety #162, and THE RISE
#168 (rank-up → buy-a-cannon → bigger-ship → world-fears-you → bounty-board → port-growth). Per
`docs/design/what-makes-it-fun.md` the fun loop **action→feedback→progression→mastery is now closed end-to-end**.
The honest call this cycle: **DEEPEN & CONSOLIDATE what just shipped — do NOT spin up a third large epic while
the owner hasn't reacted to #168.** This is a short, cheap, high-fun, low-risk lane built entirely from **filed
follow-ups** of the big run — it completes half-finished beats (a dread that flees but never speaks; a Ballad that
can't yet sing the rise), juices the RISE's climaxes, and keeps the sea alive. **Every slice is NO save bump.**
Brief [`docs/briefs/2026-07-02-post-rise-polish.md`](https://github.com/cakuki/tidewake/blob/main/docs/briefs/2026-07-02-post-rise-polish.md)._

- **#175 — Dread's HEAR half: a fearful hail names you (S · game-designer + software-developer). BUILD FIRST.**
  #172 shipped the SEE + FEEL of dread (a weak ship flees / strikes early to a notorious captain) but left the
  **HEAR** half unbuilt (noted on #172, now filed as #175). When the sea blinks, the world **names you** — a short
  fearful hail / watch murmur sized to your dread (*"God ha' mercy — it's the [rank] herself!"*), via the EXISTING
  hail banner + voice path; pole-aware, anti-repeat, withheld under a false-colours disguise (#79). **FUN:** HEAR the
  crew name your Infamy aloud — the payoff of being feared, now audible. Reuses #172's dread gate — **no new
  mechanic, NO save bump.** _Completes the freshest just-shipped beat → highest-fun cheapest win, leads the lane._

- **#90 — The Ballad sings your RISE (S · software-developer + writer). Reuse #90.** The voyage-log recorder is
  pure + extensible (add a `sanitizeEvent` case + a narrator line), and THE RISE just created rich new deed material
  it can't yet narrate. Add deed types for the arc the player just lived — **rank climbed** (#169), **a bounty
  claimed** (#173), **a bigger ship bought** (#171), **a port grown** (#174) — so the end-of-voyage Ballad reads
  the rise back to you. **FUN:** SEE your climb narrated as a story ("…rose to Corsair, ran down the Grey Gull, and
  set a frigate under her flag"). Builds on `src/voyage-log.js` — **NO save bump.**

- **#80 — Climax juice: the kill & the surrender LAND (S · game-designer + software-developer). Reuse #80
  (deferred events).** #80's juice pass shipped the broadside; its deferred events (kill time-dilation · the
  surrender beat · harbour settle) are the RISE's climaxes going unjuiced. Add a beat of **hit-stop + light
  time-dilation on a bounty-target sinking/capture** (#173) and a **camera settle on "she strikes her colours"**
  (#172) — each short, event-tied, and **toggle-able via the #73 settings panel** (juice echoes the mechanic,
  never masks it). **FUN:** FEEL the notorious kill land with weight; the surrender beat gets its exhale. Reuses
  the shipped juice rig — **NO save bump.**

- **#70 — One new sea curio (S · game-designer + software-developer). [STANDING-RULE] — the 1–2-per-loop drip.**
  Honour the standing #70 rule with one fresh ocean micro-detail that keeps the world alive between the big beats —
  bias it RISE-flavoured (e.g. drifting flotsam that murmurs a rumour of *your* deeds by name, reusing #104b port
  memory; or a gull that shadows a notorious hull). Data-driven prop + witty line pool (never twice running) + SFX,
  on the shipped `src/sealife.js` pattern. **FUN:** SEE a small surprise reward attention; a smile between fights.
  **NO save bump.**

**Sequencing note:** all four slices are unblocked, buildable now, original, in-vision, and carry **NO save bump** —
**4 READY build slices → the loop stays in DELIVERY.** #175 leads (completes the freshest shipped beat, cheapest,
highest-fun), then the Ballad weaves the arc, then the climax juice, then the curio keeps the drip alive. This is a
**deliberate consolidation lane** — small, cheap, low-risk — chosen over a third big epic while the owner reacts to
THE RISE. The owner-decision items below are **questions to surface, NOT build blockers.**

**[OWNER-DECISION] — Playtest THE RISE & steer the next MAJOR direction.** The loop has now delivered well beyond
the explicit ask: three big fun-first lanes (#161 · #162 · #168) all live and green. The big open questions are the
owner's. **Recommend:** invite the owner to playtest THE RISE (rank-up → buy a cannon → bigger ship → the world
fears you → bounty board → grow your port) and pick the next major frontier from the parked big epics —
**#137 nations/allegiance · #141 shipyards · #140 maps · #136 pirate leaderboard · #142 named persons.** Default
until he steers: run this cheap post-RISE polish lane (no big commitment) and hold the big epics for his call.

**[OWNER-DECISION] — #145 preview-ops lane, now that THE RISE is done.** #145 (curated releases: preview→public
promote split + release notes) is release **infra**, not game FUN — earlier owner-named as a candidate "next."
**Recommend:** run it as a **parallel ops track alongside** this fun-polish lane (non-competing); do not let it
displace fun work. Surface over the owner channel; the polish lane is buildable regardless.

**[OWNER-DECISION] — Close the finished battle epics (#135).** #161 is already CLOSED; #135's Option-2 + Option-4
core (all phase-couplings + the reactive surrender out + per-phase HUD + arena-spawn) is complete and only non-core
art polish remains. **Recommend:** owner closes **#135** (or hands it to the loop to close) so the board reflects
reality. Question, not a blocker.

**[OWNER-DECISION] — Player-ship / NPC-ship art (#144/#143).** #171 (bigger ship) made the class-scale change
visible but NPC hulls still out-dress the player's. **Recommend:** queue the **CC0 ship-class set (#144)** as a
**parallel art follow-up** (under the standing visual-quality order #143), NOT a blocker to the polish lane.

**[OWNER-DECISION] — Port-view redesign #147.** Still parked: pick a direction (A/B/C) for less-scroll /
more-navigation. Owner's pick; unchanged this cycle.

---

## ✅ THE RISE (epic #168) — LANE COMPLETE (all 6 slices shipped, #168 CLOSED 2026-07-02)

_**🎉 THE RISE is DONE — all 6 slices shipped, epic #168 CLOSED (Loop 131, v0.0.20260702062846).** The
reward→progression→mastery loop is now closed: rank-up milestone (#169) → buy a cannon (#170) → buy a
bigger ship (#171) → the world fears you (#172) → the bounty board (#173) → governor-pole port growth
(#174). Both poles now have a visible power fantasy — the pirate grows a bigger ship, the governor grows a
prospering port. **Refill the roadmap (PRODUCT) before the next DELIVERY cycle** — the lane is drained._

## 🧭 (was) TOP OF QUEUE — PRODUCT REFILL (2026-07-02) — **THE RISE** (epic #168) — BUILD IN ORDER

_**UPDATE 2026-07-02 — PRODUCT cycle at an inflection point (roadmap change, report-worthy).** Battle is now
rich/varied/fair/juicy (#161 + #162/#163–167 + #158/#159/#80/#70 all shipped tonight). Per
`docs/design/what-makes-it-fun.md` the fun loop is action→feedback→**progression**→mastery — the
action→feedback arrow is now strong, and this cycle finds the honest gap: **progression is the broken
arrow.** Verified against the source: (a) **no ship upgrades exist** — the player's a fixed 4-cannon sloop,
the sloop→man-o'-war class system is NPC-only, and the owner's canonical "buy a cannon → see it on the deck"
fantasy is ABSENT; (b) **rank-ups don't announce** (8 ranks exist in `renown.js`, nothing celebrates them);
(c) **the world never flees/surrenders a feared captain**; (d) **no "one more voyage" goal.** Frontier =
**THE RISE**: make spoils visibly grow your ship+power, mark the climb, make the world escalate, give a goal.
**Inspiration:** WebSearch (Rogue Waters / Rise of Piracy / SoT critiques — the one-more-voyage hook lives in
*visible persistent upgrades* + *word-of-mouth dread*) + the vision's own core loops #4/#5. Epic **#168** +
brief [`docs/briefs/2026-07-02-next-fun-frontier.md`](https://github.com/cakuki/tidewake/blob/main/docs/briefs/2026-07-02-next-fun-frontier.md).
Six original, vision-aligned, FUN-FIRST slices, sequenced value·complexity·deps; **only #170 bumps the save
(v17→v18, and its schema reserves #171's ship-class field so the lane bumps ONCE — #122 rule).**_

- ✅ **#169 — Rank-up milestone: the felt "you rose" — SHIPPED (Loop 126, v0.0.20260702033359, #169 CLOSED).**
  Crossing into a new `renown.js` rung now announces itself: a title card naming the new rank with
  pole-appropriate tone (dread — "You are now feared as a **Corsair**"; respect — "The council names you
  **Magistrate**") + a triumphant sting, so the rise finally has a heartbeat. New PURE core
  `src/systems/rank-milestone.js` (pole-aware copy + forward-crossing detector + a "highest rung seen"
  once-only guard) reading the EXISTING ladder — no new economy. **SAVE-FREE (stays v17):** the guard is a
  TRANSIENT in-session baseline seeded from the already-persisted rep on load, so a high-rank load never
  re-announces and a rung dropped after a defeat (#164) then re-climbed never re-fires. SEE the title · HEAR
  the sting (`playDuelHit('win')`) · FEEL the climb; DOM card + audio = 0 draws. Playtest asserts
  crossing→fires-once, non-crossing→silent, drop-then-re-climb→no re-fire. Gallery `rankup-milestone-169.png`.
- ✅ **#170 — Buy a cannon at the Gunner's Workshop: SEE it on your deck — SHIPPED (Loop 127, v0.0.20260702041455, #170 CLOSED).**
  The owner's canonical broken-arrow fix landed: at the town ⚒ Gunner's Workshop you now **spend coin to buy a
  PERSISTENT extra cannon** (up to a small cap of +3). All three payoffs land — you **SEE** a new bronze gun
  bolted to your deck the instant you buy it (`src/deck-guns.js`, mesh-conserving InstancedMesh-free pool of
  ONE shared barrel/carriage geometry, #121), **HEAR** a boom as she's run out, and **FEEL** foes fold sooner
  (owned cannons feed a `broadsideMult` into `cannons.resolveBroadside`/`resolveExchange` — base ×1 → full
  ×1.48). PURE core `src/systems/gun-upgrade.js` (cost curve 180/340/560c · clamp · buy math · damage map ·
  deck slots), TDD'd. **SAVE v17→v18 (the lane's ONE bump):** persists `extraCannons` **AND reserves #171's
  `shipClass`** (defaulting to the starting sloop) so the lane bumps ONCE — migrates every prior version
  forward + a frozen v18 corpus blob + coverage guard green (#122). Playtest asserts buy→coin-deducted +
  owned+1 + deck-gun-shown + heavier-bite + capped + **survives a reload (v18 round-trip)**. Gallery
  `buy-a-cannon-170.png`. **#171 BUILD NEXT** (rides this v18 — no further bump).
- ✅ **#171 — Buy a bigger ship: the hull visibly grows — SHIPPED (Loop 128, v0.0.20260702043931, #171 CLOSED).**
  At the town ⚓ Shipwright you now **spend coin to step UP a ship class** (sloop → brig → frigate; the
  warship man-o'-war deferred to a follow-up). All three payoffs land — you **SEE** the hull grow to dwarf
  the sloop you started in (the mesh scales by the REUSED `ship-classes.js` `sizeScale`, ~1.74× at frigate,
  multiplied onto the base normalising scale — no new geometry, #121), **HEAR** a triumphant launch sting,
  and **FEEL** the class combat stats now apply to YOU: a heavier broadside (offence flows through #170's
  `getBroadsideMult` seam, composing with owned cannons) and a tougher hull (a new default-1 `playerArmor`
  divisor on `resolveBroadside`/`resolveExchange` — byte-identical legacy). PURE core
  `src/systems/ship-class-upgrade.js` (ladder + escalating cost 600/1400c + pure buy math + class→player-stat
  map; sloop is the exact pre-#171 ×1.0 baseline so a fresh voyage is byte-identical), TDD'd. **NO save bump:**
  persists in the v18 `shipClass` field #170 already RESERVED (default sloop) — just wired (persist on buy,
  apply on load). Playtest asserts buy→coin-deducted + class-up + hull-scales + heavier-bite + soaks-more +
  **survives a v18 reload** + combat reflects. Gallery `buy-a-bigger-ship-171.png` (a frigate dwarfing a
  sloop at identical framing). **#172 BUILD NEXT** (no bump). Art follow-up #144 (a CC0 ship-class set) noted,
  NOT a blocker — the class scale is a real visible change now.
- ✅ **#172 — The world fears you: weak ships flee / strike early — SHIPPED (Loop 129, v0.0.20260702052934, #172 CLOSED).**
  Now that a captain can grow notorious (#169) and BIG (#171), the world NOTICES. A much-outclassed,
  much-feared captain makes WEAK prey blink — a merchant sloop turns tail and **flees on sight** before you
  engage (npc.js reuses its existing flee steering, per-hull by her class tier vs yours), and a broken foe
  **strikes her colours EARLIER** (battle.js feeds a dread `yielded` reason into the EXISTING
  `board.offersSurrender` white-flag path — no new combat system; accept/press/board/refuse compose
  unchanged). Scaled by the GAP (notoriety + hull class vs hers): a peer holds, and the apex warship
  man-o'-war NEVER breaks to dread (**protects #167** — real fights still exist); dread is WITHHELD under a
  false-colours disguise (#79 bluff intact). New PURE core `src/systems/dread.js` (notoriety ramp + class
  advantage + foe firmness → dread pressure → flee threshold + early-strike morale lift), TDD'd (15 cases).
  **Derived from persisted infamy/class — NO save change (stays v18).** SEE the sea part as your notorious
  sails crest · FEEL your reputation has weight. Playtest asserts big-gap→flee+early-strike, peer/apex→stand,
  and the dread strike opens+ACCEPTs the surrender flag cleanly (no soft-lock). Gallery
  `world-fears-you-172.png` (before/after of the rise).
- **#173 — The bounty board: a named target + scaled reward. ✅ SHIPPED.** The "one more voyage" hook.
  A port board posts a NAMED wanted vessel (`the Grey Gull`…) with a tier-scaled purse (#167-symmetric:
  tier-4 warship frigate = 400c). Accept → she rides the EXISTING `state.objective` slot as a NEW KIND
  (`bounty`, NOT a new system) so the chart marker pins her hunt for free; run her down + DEFEAT her
  (sink/capture) → the board pays the purse ONCE into coin (+ fame in renown), which funds the
  Workshop/Shipwright (#170/#171) — the earn→spend loop CLOSES. New target kind `ship`; pure model in
  `src/objectives.js` (`makeBounty`/`bountyReward`/`resolvesOnDefeat`/`bountyPayoff`/`pickBounty`), TDD'd
  (28 objective cases); board UI in `src/ui/town.js`; foe-dressing hook in `battle.js`; Ballad verse in
  `voyage-log.js`. **Rides the existing objective persistence — NO save change (stays v18).** SEE the
  wanted poster · chase the marker · claim the purse → spend it on the next cannon. Playtest asserts
  accept→marker, defeat-target→claim-once (into coin +469c/+615 renown), wrong-target→no-claim,
  claim-once (no re-hunt). Gallery `bounty-board-173.png`. **#174 BUILD NEXT (last of the lane).**
- ✅ **#174 — Governor-pole symmetry: invest spoils to grow your port VISIBLY — SHIPPED (Loop 131, v0.0.20260702062846, #174 CLOSED). THE RISE FINALE.**
  The governor road's mirror of buying a bigger ship: pour your takings into your home port and SEE it PROSPER —
  new warehouses rise on the shore, more boats ride at anchor, more masts crowd the quay — in tiers driven off
  the already-persisted `harbour.level`. PURE tier→dressing model in `src/systems/port-growth.js` (`growthTier`/
  `revealCounts`/`piecesOfKind`/`pieceWorldPlacement`), TDD'd (11 cases); MAX_TIER mirrors home-port MAX_LEVEL so
  the visible tier DERIVES from state already persisted — **NO save change (stays v18)**. Three.js reveal in
  `src/port-growth-view.js` (deck-guns.js pattern): ONE InstancedMesh per kind (warehouse · moored-boat hull ·
  mast), placed once at the home port in tier order + revealed by `.count`, distance-culled wholesale when away
  (#121) — at most three instanced draws, only near home, 0 at sea/unclaimed. main.js wires applyGrowth on
  claim/invest/stand-firm-demote/load/newVoyage + a cull system + the `tw.portGrowth` QA surface. SEE the quay
  grow · FEEL both poles complete. Playtest asserts invest→tier-up, port-view-reflects-tier, gated-by-spend,
  capped, reload re-grows DERIVED from persisted harbour.level (v18, no bump). Perf 29/130 draws · 92780 tris;
  leak +0. Gallery `port-growth-174.png` (a claimed berth beside a jewel of the lanes). **CLOSES epic #168.**

**[OWNER-DECISION] — Lane sequencing: THE RISE (fun frontier) vs. the previously-queued #145 `/preview/`
release-ops lane.** The owner earlier named #145 as next, but that's release infra, not game FUN; the
standing fun-first direction points to The Rise. **Recommend:** The Rise leads the fun lane; the cheap #145
preview slice can ride alongside (non-competing ops). Surface over the owner channel; the lane is buildable
regardless (slices don't depend on this).

**[OWNER-DECISION] — Player-ship art (#144/#143).** #171 exposes that NPC ships look better than the
player's. Recommend shipping the class-scaled *visible* change now (no new art) and queuing the CC0
ship-class set as a parallel art follow-up — not a blocker.

**Sequencing note:** #169 + #170 + #171 + #172 + #173 + #174 all SHIPPED — **THE RISE lane is COMPLETE and epic
#168 is CLOSED.** The queue now has NO READY build slice for this lane → the next cycle runs **PRODUCT** to
refill the roadmap from external inspiration (never idle — the low-water-mark is empty). The two [OWNER-DECISION]s
above remain questions to surface, NOT build blockers. Also still standing: **#145 `/preview/` release-ops lane**
(owner-named earlier; a candidate for the next lane alongside a fresh fun frontier from PRODUCT).

---

## ✅ FROM-OWNER P1 — #161 Make Battle FUN — LANE COMPLETE (all 6 slices shipped, #161 CLOSED)
The owner playtested battle (#135) and it's **NOT fun** (2026-07-01): occluding center popups cover the
ship · no target lock among traffic · an **isolation BUG** (#125 rescue + `f`/`g` hails leak into the
fight) · **NO cannonball visuals** (broadside is pure math). Per the **PREEMPTION RULE** this from-owner
P1 **preempts the PRODUCT-refill slices below** (#156–159). Build #161's slices in order — progress:
- ✅ **1) Hard battle isolation (S, the BUG) — SHIPPED (Loop 111, v0.0.20260701204942).** In the deliberate
  BATTLE stance ALL non-battle world interactions are now suppressed — the #125 rescue offer is DEFERRED
  (spawn gate), the open-sea `f`/`g` hail/open-fire verbs + a pre-existing founderer's `1`/`2` choice + its
  HUD panel are all no-ops mid-fight; a pure `interactionsSuppressed` predicate is the single source of truth
  (`src/systems/battle-isolation.js`). Felt payoff = the fight no longer feels janky/broken (proven by the
  gate: playtest asserts rescue + f/g are no-ops in the stance, world returns on flee). No save change (v17).
- ✅ **2) Non-occluding battle UI (S) — SHIPPED (Loop 112, v0.0.20260701210637).** The center-modal fight
  prompts (`#battle`/`#cannons`/`#duel`) are now DOCKED to a lower band (`bottom:18px`) with a `max-height:38vh`
  guardrail, so the battle camera's centre-framed ship + the action stay VISIBLE the whole fight — the UI frames
  the action instead of covering it. A pure central-safe-zone predicate (`src/ui/safe-zone.js`) drives a
  `tw.battleUICentreClear()` QA hook; the playtest asserts every shown battle strip clears the centre on BOTH
  desktop and a phone-portrait viewport (#146), so occlusion can't regress. Felt payoff = you can SEE your ship
  fight (gallery `battle-ui-161-non-occluding.png`). No save change (v17).
- ✅ **3) Target lock (M) — SHIPPED (Loop 113, v0.0.20260701212549).** The instant battle starts the engaged foe
  carries an unmistakable world-anchored **target RING** (a projected DOM/CSS billboard above her mast — 0 draws)
  and the non-combatant traffic **RECEDES** to a faint opacity (per-mesh material opacity off `foeIndex`), so you
  always know who you're fighting; it clears on flee (the sea returns). Built the **reusable OVER-SHIP BILLBOARD
  module** (`src/ui/over-ship-billboard.js`) — a generic marker/label anchored above a ship in world space,
  projected to screen; carries the highlight ring (wired now) AND a text-label slot (`setLabel`). **This module
  is now available for #165 over-ship threat labels — the SAME billboard, second consumer (#165-ready).** PURE,
  TDD'd cores (`projectToScreen`, `shipEmphasis`, `DIM_OPACITY`); `tw.targetLock()` QA hook; playtest §2b3-lock
  asserts the foe is ring-marked + the only un-dimmed hull, clears on flee. Gallery `target-lock-161.png`. No save change (v17).
- ✅ **4) Rendered cannonballs (M) — SHIPPED (Loop 114, v0.0.20260701215515).** The broadside was pure math +
  a camera kick; now a fired volley SPAWNS a visible fistful of round-shot that arcs from the guns to the foe,
  a muzzle PUFF barks at the gunports, and each ball CRACKS into a spark on a clean beam hit or SPLASHES pale
  in open water on a wide shot — a good angle and a bad one read completely differently. Driven off the SAME
  resolved shot (`broadsideAim.inArc` + `resolveBroadside.enemyHit`); combat maths untouched. POOLED + INSTANCED
  for perf: a pure TDD'd trajectory/hit-vs-miss controller (`src/systems/projectiles.js`) over a fixed pool that
  never allocates a mesh, rendered by exactly TWO reused InstancedMeshes (iron balls + tinted muzzle/spark/splash
  puffs) created ONCE — **+2 draws (27→29/130), +~2.7k tris (~93k/150k), 0 geometry growth across mode cycles
  (#121).** Audible report already rings via battle.fire's 'cut' sting. `tw.battleProjectiles()` QA hook; playtest
  asserts a broadside spawns iron + a muzzle bark and that a wide shot SPLASHES while a clean beam shot SPARKS
  (hit ≠ miss). Gallery `cannonballs-161.png`. No save change (transient VFX, stays v17).
- ✅ **5) Aim-angle feedback (S) — SHIPPED (Loop 115, v0.0.20260701220930).** The angle now VISIBLY matters
  before you fire: a read-only **AIM LINE** runs from your ship to the engaged foe and **colours + tightens** as
  she comes abeam — green **ON TARGET** (tight cone) when your broadside will bite, amber closing, faint red
  (wide cone) when your guns can't bear — so lining up the broadside is a skill you can watch improving. Pure
  presentation off `broadsideAim` (via `battle.snapshot()`); the aim maths is untouched. DOM/CSS overlay reusing
  the slice-3 over-ship VP projection — **0 added draws (still 29/130)**. PURE TDD'd cores (`aimReadout`
  on-target classification + firing-cone spread, `beamGeometry` bar layout) in `src/ui/aim-indicator.js`;
  `tw.aimIndicator()` QA hook; playtest §2b5-aim asserts an ABEAM foe reads ON TARGET (tight) vs a BOW-ON foe OFF
  (wide) and the line clears on flee. **#166-COORDINATE-READY:** the aim chip carries a reserved `.aim-odds` slot
  + `setOdds()` so #166 legible-odds ("skill sets the odds, luck sets the margin") can sit beside the aim
  indicator with NO redo — this aim line is the *skill* half of that readout. Gallery `aim-line-161.png`. No save change (v17).
- ✅ **6) Hover-to-interact (M) — SHIPPED (Loop 116, v0.0.20260701224039).** Interacting with ships is now
  DIEGETIC, not a hidden keymap: POINT at a hull (a THREE.Raycaster picks the ship under the cursor) and it
  lights up with what you can DO — a projected cyan ring + a **"Give battle / Hail / Board"** label over her
  mast — and a CLICK routes to the SAME existing verb handlers (engage / hail / board), no new combat
  mechanics. The keyboard verbs stay live (additive) and a touch TAP routes through the same click path (the
  #146 mobile guard — hover is never the only path). Respects hard isolation (#161 s1: no hailing a
  non-combatant mid-fight — only the engaged foe is pickable, and only to BOARD when she's battered), s3
  dimming, s2 non-occlusion. Reuses the slice-3 OVER-SHIP BILLBOARD + VP projection (**0 added draws — still
  29/130**, ~92.8k/150k tris; CPU raycast, no per-frame allocations). PURE TDD'd cores
  (`src/systems/ship-picker.js`: `shipIndexFromObject` raycast-hit→index, `pickShipAction` contextual verb,
  `actionLabel`); the three.js raycast is a thin shell in `main.js`. Generalized `battle.engage(index)` +
  `duel.tryChallenge({targetIndex})` so a click acts on THAT ship, not "nearest". `tw.qaPickAt/qaHoverAt/
  qaClickAt` QA hooks; playtest §2b6-hover asserts a raycast under a screen point resolves to that ship + the
  right action AND a click routes to the handler. Gallery `hover-interact-161.png`. No save change (v17).

**🎉 #161 "Make Battle FUN" LANE COMPLETE — all 6 slices shipped (isolation · non-occluding UI · target lock
· rendered cannonballs · aim-angle feedback · hover-to-interact). #161 CLOSED.** The marquee fight now
isolates cleanly, keeps the ship visible, names the foe, shows the balls fly with the angle mattering, and is
pointed-at rather than keymap-guessed — every owner complaint from `2026-07-01` addressed. The
PRODUCT-refill slices (#156–159) below resume as the next lane.

Plan: **#161** + [`docs/briefs/2026-07-01-battle-fun-fixes.md`](https://github.com/cakuki/tidewake/blob/main/docs/briefs/2026-07-01-battle-fun-fixes.md).
This IS the **Fun & Working > fast** doctrine (`docs/design/what-makes-it-fun.md`) — a mechanic with no
visible feedback is INCOMPLETE. _(The loop's onboarding work #156/#157 aids legibility but does NOT cover
these gaps.) Owner's finer call — whether to also FREEZE new battle mechanics — pending over Telegram; the
fix is P1 regardless. **Next build: slice 6 (hover-to-interact — raycast the ship under the cursor → hail/board/target; the diegetic-interaction beat the owner asked for, "hovering on the ship in the view, not like a HUD element"). This is the LAST #161 slice.** The reusable over-ship billboard module (`src/ui/over-ship-billboard.js`, shipped in slice 3) is now available for **#165 over-ship threat labels** (same billboard, second consumer); the slice-5 aim indicator (`src/ui/aim-indicator.js`) left a `.aim-odds`/`setOdds()` slot so **#166 legible-odds** can dock beside it with no redo._

## ✅ FROM-OWNER — Difficulty, Stakes & Ship Variety lane (epic #162) — COMPLETE (Loop 121, all 5 slices shipped)
_**Epic #162 CLOSED 2026-07-02** — the whole lane landed: #163 ship classes → #164 loss stings → #165 threat labels → #166 legible odds → #167 challenge on demand. The sea now has a pecking order you SEE, fights you can LOSE (and it stings), danger you can READ, odds you can weigh, and a hard fight you can SEEK for a scaled reward — all on the owner's fixed-by-region model, no rubber-band, no save bump (stays v17). Kept below as the shipped record._
_Owner steering 2026-07-01: "games are too easy — the player must be able to LOSE when playing badly, and a loss should COST points + fame; fair = clear consistent rules WITH a bounded luck element; a player who wants a hard fight (a big/armed ship) can seek one; ships should VARY, with over-ship displays hinting what they are." Epic **#162** + brief [`docs/briefs/2026-07-01-difficulty-stakes-variety.md`](https://github.com/cakuki/tidewake/blob/main/docs/briefs/2026-07-01-difficulty-stakes-variety.md). **Complements #161** — build ONE shared over-ship billboard module (used by #161 s3 target-lock AND #165 threat-labels) and coordinate odds/aim readouts (#166 ↔ #161 s5)._

**OWNER DECISIONS (2026-07-01, recorded on #162 — these are the build constraints):** loss penalty = **MEDIUM** (coin+fame deduction scaled by foe tier, no death-spiral) · **you KEEP your ship** on a loss (fame/coin only) → **NO save bump, stays v17** · fame loss is **CONTEXT-BASED** (raid loss→Infamy, governor loss→Standing) · difficulty = **FIXED BY REGION/TIER** (sail toward danger; **no rubber-band**).

1. **[#163] Ship classes — ✅ SHIPPED & CLOSED (Loop 117).** New PURE `src/ship-classes.js`: sloop→brig→frigate→man-o'-war × merchant/warship → hull (on the shared 0..100 scale) / gunnery / gun-count / crew / a visible `sizeScale` + a threat tier (1–5). NPCs spawn a deterministic MIX (`spawnMix`, seeded off its OWN rng so spawn positions/movement are byte-identical to before — the class only scales the mesh + carries stats). The engaged foe's class flows into the EXISTING battle math: `makeFoe(rng, shipClass)` seeds her hull+gunnery, which `battle.js`/`cannons.js` read off the npc snapshot → a frigate genuinely threatens, a merchant sloop folds. Man-o'-war is scale 1.6 vs sloop 0.72 (visible dwarfing), **0 extra draws/tris** (scale-only, perf 29/130 · ~93k tris). **This is the FOUNDATION #164/#165/#166/#167 build on:** #165 reads `shipClass.{label,tier}` for threat labels; #166 reads `{hull,gunnery,crew}` for the matchup odds; #167 reads `{tier}` + the withheld warship-man-o'-war (kept out of `SPAWN_POOL`) for challenge-on-demand; #164 scales its loss ledger by `shipClass.tier`. **No save bump — transient spawn props, stays v17.** FUN: SEE a man-o'-war dwarf a darting sloop; FEEL a frigate's broadside threaten you.
2. **[#164] Loss stings — ✅ SHIPPED & CLOSED (Loop 118).** Two things now true: (a) **you can ACTUALLY lose** — `isDefeat({playerHull})` (a legible, tested single-source rule in `battle.js`: hull ≤ 0 → `finish('lose')`) is the clear player-defeat condition; and (b) **losing STINGS** via `defeatLedger(tier, context, ledger)` — the FIRST-ever *decrement* path in `src/renown.js`: MEDIUM (base + tier × per-tier), **tier-scaled by the foe's class** (`ship-classes.js` threat tier via `foe.tier`), **CONTEXT-BASED** (`defeatContext` off the dominant pole → a raiding loss dents **Infamy**, a governor-road loss dents **Standing**), **coin dented too**, **floored at 0** (no negative, no death-spiral — one loss never wipes a run). Surfaced by a red **"⚑ Colours Struck"** defeat card (`hud.showDefeat`) that **NAMES the cost** ("−N Infamy, −C coin"); reuses the shared toast (already clear of the #161-s2 centre safe-zone) = **0 extra draws** (perf 29/130 · ~93k tris). **NO save bump — deducts from already-persisted coin/infamy/standing, stays v17.** **For #166/#167 to read:** the loss condition (`isDefeat`) + the ledger (`defeatLedger`/`defeatContext` + `DEFEAT_*` constants) now exist in `battle.js`/`renown.js`; #166 legible-odds can show the stake a loss carries, #167 challenge-on-demand scales its risk off the same tier→sting. +11 renown unit tests + 6 battle unit tests + a playtest loss gate (real defeat → ledger fires; raid→Infamy, governor→Standing; floor at 0; card names cost). Gallery `colours-struck-164.png`. FUN: SEE fame/coin visibly DROP on the red card; FEEL that picking reckless fights now carries real risk (caution becomes a decision).
3. **[#165] Over-ship threat labels — ✅ SHIPPED & CLOSED (Loop 119).** Every classed NPC hull now floats a class + threat label — "Merchant Sloop ·" (green prey) up to "Warship Man-o'-War ☠☠☠☠" (red deadly) — so you read danger at a glance and **pick your fight before committing**. **ONE module, two consumers (as planned):** reuses the SAME `src/ui/over-ship-billboard.js` from #161 s3 via its `setLabel()` slot — **NO second billboard system**; the labels are **pooled** (one element per hull, reused every frame: 0 DOM churn) + DOM/CSS = **0 draws** (perf 50/130 · 93k/150k tris). New PURE `src/systems/threat-label.js` (unit-tested): `threatLabelFor` (class→text+glyph), `threatGlyphs` (skulls escalate strictly with tier), `dangerLevel` (green prey→red deadly colour band), `labelFade`/`selectLabels`/`maxLabelsForViewport` (the declutter rule — fade with distance, cap the count, **lower cap on a phone = #146 guard**). In a fight the traffic's labels **recede** so the engaged foe's label + ring read clean together on the **SAME anchor**. **NO save bump — pure presentation, stays v17.** +16 unit tests (1171 total) + a playtest gate (live label text+glyph match class/tier · man-o'-war reads STRICTLY deadlier than a sloop · far hull culled · phone caps 3<6 · foe ring+label coexist while traffic recedes). Gallery `threat-labels-165.png`. FUN: SEE a fat merchant prize vs a deadly warship at a glance; FEEL the agency — you CHOOSE your fight. **The visible payoff for the variety epic.**
4. **[#166] Legible odds — ✅ SHIPPED & CLOSED (Loop 120, SALVAGED after a 529).** The fair-fight contract, made READABLE. New PURE `src/systems/odds.js` (`combatOdds`/`oddsReadout`, DOM+THREE-free, unit-tested) turns the deterministic inputs — class matchup (her hull + gunnery from `ship-classes.js`) + your live aim GEOMETRY + your loaded shot (`ammo`) + both hulls — into a plain-language verdict ("You outclass her" / "An even match" / "She outguns you — reckless"), a legible ~dmg-vs-dmg/volley + bounded ±20% margin sub-line, and a visual **margin BAND** (a bar whose lit segment = the luck swing, its side of the even-tick = favoured-from-doomed). **SKILL sets the odds, LUCK sets only the margin** — the model MIRRORS `resolveBroadside`'s coefficients (cross-checked in tests so the shown band == the real ±20% luck bound and can't drift), and a 'dominant' verdict is EXACTLY "even max-adverse luck still wins" (`worstEdge ≥ 1`) so **luck can never flip a strongly-favoured fight** (proven ≥99% over 2000 real sims). Docks into the aim indicator's reserved `.aim-odds` slot (`setOdds()` extended to a structured `{text,sub,tier,bar}`) — beside the #161-s5 aim line, coexists with target-lock + threat labels (#165) + the non-occlusion safe-zone (#161 s2) + the #146 mobile guard. **No combat-math / luck-bound change; NO save bump (stays v17).** +21 unit tests + a playtest §2b3-odds gate (matchup reads right, band == ±20%, luck can't flip, live read docked in the slot). Perf 29/130 draws · ~93k/150k tris (DOM readout +0 draws). FUN: SEE whether you're favoured before you commit; FEEL the Sid-Meier decision — fair = you could read it coming.
5. **[#167] Challenge on demand — ✅ SHIPPED & CLOSED (Loop 121). EPIC #162 COMPLETE.** Danger is now **FIXED BY REGION** (owner decision — no rubber-band): the safe home coast breeds gentle prey; the deep sea breeds frigates and, out past the points, the **withheld WARSHIP man-o'-war** (tier 5), now reachable if you sail out to meet her. Reward **scales by foe TIER** (`spoils({…, tier})` in `cannons.js`/`battle.js` — `+15c/tier`, Infamy follows), the symmetric mirror of #164's tier-scaled loss sting. New PURE `src/systems/danger.js` (`regionDanger` maps position → danger cap; `regionalSpec` picks a region-appropriate class×role, deep = the apex man-o'-war; DOM/THREE-free, unit-tested). `npc.js` fixes each hull's class by its **spawn region** + guarantees one deep-water man-o'-war hunter that patrols the deep (coasts stay gentle; a beaten one respawns from the deep). `tier` defaults to 0 so legacy spoils callers/tests are byte-identical. **No new meshes** (man-o'-war reuses the #163 scaled mesh — #121 conservation honoured; perf 29/130 · ~93k/150k tris). **NO save bump — positional/transient, stays v17.** +9 danger unit tests + a spoils tier-scaling test (1200 total) + a playtest §1b-challenge gate (FIXED rule out-classes deep vs coast · warship man-o'-war roams the tier-5 deep, reachable · reward climbs monotonically with tier · no rubber-band · save v17). Gallery `challenge-on-demand-167.png`. FUN: point the bow at deadly water and FEEL the stakes rise — a tier-5 terror worth real Infamy; mastery finally has somewhere to aim.

## 🧭 TOP OF QUEUE — PRODUCT REFILL (Loop 107, 2026-07-01) — BUILD IN ORDER

_**UPDATE Loop 107 (2026-07-01) — PRODUCT cycle: roadmap refilled from external inspiration + the R2
deep-reading shortlist.** The battle epic #135 shipped end-to-end and the reactive/charm reservoir
drained → the never-idle rule triggered a PRODUCT run. Per the Constitution bias — **make the arc
REACHABLE before deepening it** (onboarding/legibility/first-session) + **reactive-verb depth-over-
breadth** — this batch teaches & juices the deep combat a new captain otherwise hits as a wall.
**Inspiration:** WebSearch on game onboarding (just-in-time / scaffolding / "first enemy is a Goomba" —
God of War & BOTW contextual prompts, progressive disclosure, the first-5-minutes bar) + the PM-triaged
R2 deep-reading shortlist (`studio/feedback/inbox/2026-07-01-deep-reading.md`, whose flagship #153
already shipped). Six original, vision-aligned slices, sequenced value·complexity·deps; **#154 shipped
(Loop 107); #155 reactive-verb juice shipped (Loop 108, v0.0.20260701190242); #156 cold-start FTUE
discoverability gate shipped (Loop 109, v0.0.20260701194714); #157 Bosun's First Duel shipped (Loop 110, v0.0.20260701201752) — build #158 next.** #145 preview-subpath (ops track) + the owner-decision items (#147/#135-close/#152) stay parked
below — untouched. No save/schema change except where flagged (#157)._

- **#156 — Cold-start FTUE discoverability check — ✅ SHIPPED & CLOSED (Loop 109, v0.0.20260701194714).** A headless
  "fresh captain" gate (cleared save) walks sail→give-battle→fire→board→strike-colours and **fails CI on
  any reachable-but-un-signified verb**, written against the `src/keymap.js` source-of-truth so new verbs
  auto-cover (union of signified == exactly the keymap). PURE `signifiedVerbs` + `tw.signifiers` QA surface;
  +7 unit tests + FTUE playtest section (also locks the sail/steer help bar + town Set Sail plank). No
  undiscoverable verb on the current build. Test/gate only, no save change (v16). *"An un-taught verb can never ship again."*

- **#157 — The Bosun's First Duel — ✅ SHIPPED & CLOSED (Loop 110, v0.0.20260701201752).** A cold save's FIRST
  engagement is now a one-shot **scaffolded SOFT debut**: a forgiving, already-battered foe (gunnery 0.4× ·
  hull 55%, morale left intact so the taught arc stays maneuver→board→duel) + the **bosun calling each phase's
  verb aloud in-world** (maneuver→FIRE, BOARD, surrender) via a banner driver over the live battle snapshot —
  theatre, not a pop-up; the #153 prompts + #154 earcons fire alongside as the audio/visual half. The raid
  stays **fully player-driven** (softens + narrates, never auto-plays). PURE, TDD'd logic in
  `src/systems/debut-battle.js`; battle.js gains a `softenFoe` hook (backward-compatible). **One-shot** save
  flag (v17) retires it — a returning captain is never re-scaffolded. **Save-schema v16→v17: migrated all prior
  versions + added the frozen v16 corpus blob (#122).** Gallery `bosun-first-duel-157.png`. **Remaining (polish,
  PM triage):** a dedicated bosun line for the verbal-duel phase + an optional spoken rumour/ballad audio clip
  for the cue. *"My first fight is winnable and legible."*

- **✅ #158 — Per-phase battle musical signatures (M · musician + software-developer). SHIPPED
  (v0.0.20260702020352).** Each raid act (⚔ Maneuver / 🪝 Boarding / 🗣 Duel — the shipped phase model) now
  wears a distinct musical *layer* (a different mode + register + drive, not just louder): ⚔ a driving
  mixolydian roll, 🪝 a dark freygish bite, 🗣 a sharp lydian a register up — cross-fading in on the phase
  transition via the bar-clock (equal-power, no percussive-bed trap, no `loadTrack`; recolours the lead like
  #132). The score becomes the tutorial timer. New pure `src/systems/battle-score.js` (phase→layer +
  constant-power crossfade + bar-quantised planner, 14 unit tests); no new mechanics; save stays v17.
  *"I hear when to act before I know which key."*

- **✅ #159 — Diegetic age-of-sail keycap skin (S · graphic-designer + software-developer). SHIPPED &
  CLOSED (Loop 123, v0.0.20260702021440).** The #153 prompts are re-dressed as the world speaking:
  **ink-on-parchment verb ribbons carrying rope-bound brass keycaps**, not a modern debug overlay — the
  SAME DOM component, a pure CSS re-skin (0 markup change, 0 draws). Labels stay 100% keymap-driven
  (`src/keymap.js`); a new render drift-lock (`tests/unit/key-prompts-render.test.mjs`, +4 tests) asserts
  the glyph+verb text rendered ON the brass keycap == the keymap, so a hard-coded skin label fails loudly.
  Contrast survives the sea haze — near-opaque cream parchment keeps dark ink legible over both bright
  water AND a dark hull; reactive tone kept diegetic (BOARD = verdigris sea-patinated brass, SURRENDER =
  deeper gilt edge); reduced-motion honoured; **no gameplay/save change (stays v17).** Gallery
  `diegetic-keycaps-159.png` (the brass SPACE/X keycaps on parchment ribbons, legible over bright teal
  water in a live broadside). **This DRAINS the deep-reading PRODUCT batch #153–#159 — all shipped.**
  *"The tutorial reads as the world speaking."*

**Sequencing note (updated Loop 109 — #156 SHIPPED & CLOSED):** #157/#158/#159 are all unblocked &
buildable (their soft deps #153 + #154 + the #156 legibility guard are shipped) → **3 unblocked
non-owner-decision slices → loop stays in DELIVERY.** #157 is the biggest first-session reachability win
but is M + carries the only save-schema change, so it now leads the queue over the cheap legibility/juice
wins it leans on (#154 earcons, #153 prompts, #156 gate). #158/#159
are depth/polish that compound the above. **No owner-decision surfaced** — all three remaining are
original, in-vision, buildable. Owner-decision items **#147 · #135-close · #152** stay parked below,
NOT counted as READY.

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

_**UPDATE Loop 106 (2026-07-01, v0.0.20260701124406): #153 — CONTEXTUAL JUST-IN-TIME KEY-PROMPTS — SHIPPED & CLOSED.** The R2 deep-reading flagship (5-role convergence): the now-complete battle arc (#135) had NO onboarding for its many keys. This teaches each in-battle verb the instant it becomes possible — maneuver → `SPACE Fire` (+`X Change shot` with a 2+ locker) · boardable → `F Board her` · struck colours → `1 Accept / 2 Press` — and **fades each once used**. READ-ONLY off the battle+duel snapshots (invents no mechanics); a **single keymap source-of-truth** (`src/keymap.js`) feeds the prompts AND the #battle help so labels can't drift. PURE logic TDD'd (14 tests, 1022 green); playtest ✓, perf 27/130 draws · 89.7k/150k tris; save stays v16; gallery `key-prompts-board.png`. **Left for PM triage (deep-reading shortlist #3-8):** verb earcons · reactive-verb juice pass · cold-start FTUE checklist · diegetic keycap skin._

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

_**UPDATE Loop 100 (2026-07-01, v0.0.20260701054217): Option 4 slice 1 — SINK-OR-SPARE — SHIPPED.** The
FIRST phase-coupling beat of the "Three-Act Raid": a won boarding duel no longer auto-decides the prize;
it HOLDS OPEN a deliberate fork — **1 = SPARE & ransom** (governor road: `+round(coins×0.5)` ransom +
`+max(8, round(infamy×0.5))` Standing, captured) or **2 = SINK** (pirate road: `+round(infamy×0.5)` bonus
Infamy, no coin/Standing). The won-duel base is already banked, so pure `prizeFork` lays only the DELTA on
top (unknown/absent choice → SPARE, ledger-safe; junk clamped ≥0); TDD'd first (6 tests). `main.js` thin:
`pendingPrize` + a 1/2 key handler that claims the keys ahead of hail/fire (mirrors #125); `resolvePrize`
writes ONE deed to the Ballad + port memory; QA `tw.prizeChoice`/`tw.choosePrize`. **No save change — transient
choice (stays v16).** 959 unit tests; playtest ✓ PASSED (27/130 draws · 89.7k/150k tris, zero errors);
gallery `sink-or-spare-135.png`. **#135 stays OPEN** — remaining Option 4 work: couple the phases into the
full arc (hull damage → boarding odds; crew casualties → duel confidence), per-phase UI, early-surrender
short-circuits (M6 act 1 done, M7 acts 2–3). Closing #135 is the owner's call. (Finished from a prior
session-limited cycle-runner's uncommitted work; committed the 5 real slice paths race-safe.)_

_**UPDATE Loop 101 (2026-07-01, v0.0.20260701090808): Option 4 slice 2 — HULL DAMAGE → BOARDING ODDS —
SHIPPED.** The SECOND phase-coupling beat: act 1 (broadside/positioning) now **mechanically feeds** the
boarding brawl (act 2) — a foe you battered before you grappled boards like a wreck. New pure
`boardingEdge({foeHull, maxHull})` maps her hull-at-grapple to a brawl-margin bonus, **normalised across
the boardable window [0..30% hull]** so gunnery PAST the boarding line is what pays: grapple on the ~30%
line → **0** edge; pound her to splinters → up to **+`MAX_BOARDING_EDGE`=0.35** (monotone, clamped,
fail-safe). Folded into `resolveBrawl`'s margin, so it flows on into the captain-duel opening dent
(`brawlMoraleDent`, wired slice 4) — the full chain **gunnery→hull→brawl odds→duel confidence** now runs,
WITHOUT touching the still-queued crew-casualties coupling. Live `snapshot().boardEdge` + `battleWeaken(frac)`
QA hook. TDD'd first. **No save change — transient combat state (stays v16).** 966 unit tests (+7); playtest
✓ PASSED (48/130 draws · 90.4k/150k tris, zero errors); **no gallery** (mechanical + QA-surfaced, no visible
change). **#135 stays OPEN** — remaining Option 4 work: crew casualties → duel confidence, early-surrender
short-circuit, per-phase UI, dedicated arena-spawn (M6 act 1 done, M7 acts 2–3). Closing #135 is the owner's
call. (NB: the active build lane is now **#145 preview subpath** below — this #135 slice was the queued
Option-4 increment; per-slice value keeps landing while the lane switches.)_

_**UPDATE Loop 102 (2026-07-01, v0.0.20260701100407): Option 4 slice 3 — CREW CASUALTIES → DUEL
CONFIDENCE — SHIPPED.** The THIRD phase-coupling beat: act 2 (the boarding brawl) now **mechanically
feeds** the captain's verbal duel (act 3), mirroring how slice 2 fed act 1→act 2. The brawl no longer
only shakes HER captain (`brawlMoraleDent`, slice 4) — a boarding that **cost you crew** opens the duel
with YOUR captain rattled too, shifting the opening footing. Two new pure fns in `src/systems/board.js`:
`brawlCasualties({won, margin})` → severity [0,1] (a clean runaway bleeds ~nothing; a whisker-thin win
OR a lost/even brawl is bloodiest) and `duelConfidenceDent(casualties)` → a **player-side** opening dent
[0, `MAX_CONFIDENCE_DENT`=22], kept BELOW the enemy ceiling (`MAX_BOARD_DENT`=30) so a decisive boarding
still nets in your favour and wit stays the decider. `duel.tryChallenge` gains a `playerDent` option
(mirror of `openingDent`) denting YOUR opening morale; `snapshot().confidenceDent` surfaces it for QA.
`main.js` wires `duelConfidenceDent(brawlCasualties(brawl))` into the boarding hand-off; open-sea hails
stay byte-identical. TDD'd first. **No save change — transient combat state (stays v16).** 978 unit
tests (+12); playtest ✓ PASSED (27/130 draws · 89.7k/150k tris, zero errors) + a live assertion that the
opening footing reflects the casualty dent; **no gallery** (mechanical + QA-surfaced, no visible change).
**#135 stays OPEN** — remaining Option 4 work: early-surrender / strike-colours short-circuit, per-phase
UI, dedicated arena-spawn (M6 act 1 done, M7 acts 2–3). Closing #135 is the owner's call. (NB: the active
build lane remains **#145 preview subpath** below — this was the queued Option-4 increment.)_

_**UPDATE Loop 103 (2026-07-01, v0.0.20260701102815): Option 4 slice 4 — EARLY-SURRENDER / STRIKE-COLOURS
SHORT-CIRCUIT — SHIPPED. The LAST CORE Option-4 slice → Option-4's CORE is now COMPLETE.** The reactive OUT
of the "Three-Act Raid": when your broadsides break a foe's nerve+hull hard enough (cannons' `strikesColours`
`yielded`, reused) — **before you ever grapple to board** — she STRIKES HER COLOURS and the offer is HELD
OPEN. You choose: **1 = ACCEPT** her surrender (a quick capture — ransom + Standing via the existing
`finish('capture')`, WITHOUT the board→brawl→duel, engagement over) or **2 = PRESS** the attack (refuse
quarter — no prize, `quarterRefused` latches so there's no second flag, she fights to the bitter end toward a
sinking or a boarding). Two new pure fns in `src/systems/board.js`: `offersSurrender({yielded, boarded,
quarterRefused})` (gates the offer) + `surrenderFork(choice)` (accept→captured / press→fight-on; unknown →
accept, ledger-safe, mirroring `prizeFork`). `battle.js` holds it in `fire()` (`openSurrender`,
`surrenderPending`/`quarterRefused`, `acceptSurrender`/`pressAttack`; fire+canBoard no-op under a flag);
`main.js` wires prompt banners + a 1/2 handler ahead of fire/board + QA hooks. TDD'd first. **No save change —
transient combat state (stays v16).** 989 unit tests (+11); playtest ✓ PASSED (new step 2b7; perf 48/130 draws ·
90.4k/150k tris, zero errors); gallery `early-surrender-135.png` (the strike-colours/quarter prompt, visible
UI). **#135 stays OPEN — closing it is the OWNER's call.** Commented on #135: Option-4 CORE (all phase-couplings
+ the reactive surrender out) is complete for owner review; what REMAINS is NON-core polish — per-phase UI + a
dedicated arena-spawn. (NB: the active build lane is **#145 preview subpath** below — this was the queued
Option-4 increment; per-slice value keeps landing.)_

_**UPDATE Loop 104 (2026-07-01, v0.0.20260701104405): Option 4 polish — PER-PHASE RAID HUD — SHIPPED.** The
mechanically-rich raid was OPAQUE; this makes it LEGIBLE. A compact **read-only** HUD strip names which act
you're in — **⚔ Maneuver › 🪝 Boarding › 🗣 Duel** (acts won lit, current highlighted, next dimmed) — and
surfaces the coupling the player EARNED by name: Boarding → *"Hull battered → boarding advantage +NN%"*
(`boardEdge`), Duel → *"Bloodied boarding → shaken footing −NN"* / *"Clean boarding → steady footing"*
(`confidenceDent`), Maneuver → the *"🏳 She strikes her colours"* beat. Invents NO mechanics — reads flags
already on the battle + duel snapshots; only shows in a real raid (a plain hailed duel shows nothing).
Self-contained #53 component: new `src/ui/raid-phases.js` with PURE `raidPhaseModel(battle, duel)` TDD'd
first (12 cases) + a thin DOM-guarded `createRaidPhases()` factory; wired via `hud.renderRaidPhases` +
a `hud-raid-phases` `main.js` system. 1001 unit tests (+12); playtest ✓ PASSED, zero errors; perf 27/130
draws · 89.7k/150k tris — a DOM/CSS overlay, **~0 draws**. **No save change (stays v16.)** Gallery
`raid-phases-135.png` (the strip mid-battle in the Boarding act, +18% earned advantage). **#135 stays
OPEN — closing it is the OWNER's call.** Option-4 polish now leaves only the dedicated **arena-spawn**
(a bespoke maneuvering target) queued._

_**UPDATE Loop 105 (2026-07-01, v0.0.20260701110959): Option 4 polish — DEDICATED ARENA-SPAWN — SHIPPED.
The LAST queued Option-4 item → Option-4 polish is now COMPLETE.** Entering BATTLE reused whatever open-sea
NPC triggered it, so the foe drifted on her waypoint AI — inert during the maneuver phase. The engaged foe
now runs a dedicated DUEL brain and actively SAILS TO FIGHT: **close** when out of broadside range · **open**
when fouling-close · **beam** in the fighting band (seek a station off YOUR beam → a real circling duel of
positioning) · **flee** when her nerve breaks. PURE, TDD'd `arenaHelm(relative pos + morale)` →
`{state, desiredHeading, throttle}` in `src/npc-ai.js` (`ARENA_FLEE_MORALE`=0.2 sits BELOW the 0.25
strike-colours line, so a foe you're beating STRIKES before she'd ever flee — surrender/board couplings
untouched). `npc.js` drives the foe index via the helm during battle, REUSING her existing mesh → **zero new
draws**; **all couplings preserved** (aim → broadside → boarding → surrender flow through `foePos()`, which now
returns the maneuvering foe). `battle.snapshot()` adds `foePos`/`foeHelm`, npc snapshot adds `helm`, for the
headless gate. **No save change (stays v16).** 1008 unit tests (+7 in `tests/unit/arena-helm.test.mjs`);
playtest ✓ PASSED (new deterministic step 2b6b); perf 48/130 draws · 90.4k/150k tris. Gallery
`arena-duel-135.png` (the Maneuver-phase HUD with the foe maneuvering off to starboard). **#135 stays OPEN —
Option-4 is COMPLETE end-to-end; NOTHING remains in the build queue for #135, only the OWNER's close-call.**
(NB: the active build lane remains **#145 preview subpath** below.)_

## Top of queue (do in order) — re-sorted by DL #5 (loop ~71): finish engine de-risk, drain DL #4

### 🔴 FROM-OWNER P1 — #161 **Make Battle FUN** (presentation hardening) — recommended next lane
The owner playtested battle (#135) and it's **NOT fun**: occluding center popups, no target lock, an
**isolation BUG** (rescue/#125 + hails leak into the fight), and **no cannonball visuals**. GD+TL slice
plan in **#161** + [`docs/briefs/2026-07-01-battle-fun-fixes.md`](https://github.com/cakuki/tidewake/blob/main/docs/briefs/2026-07-01-battle-fun-fixes.md).
Per the **PREEMPTION RULE** this from-owner P1 sits at the TOP. **First slice = hard mode isolation (S, the
bug)**, then non-occluding UI → target lock → **rendered cannonballs** → aim-angle feedback → hover-interact.
**Recommend this presentation-hardening lane PREEMPTS new battle MECHANICS** (freeze Option-4 deepening/new
ammo) until slices 1–5 land — this is the **Fun & Working > fast** doctrine in action. Owner's final
lane-order confirm pending over Telegram; the #145 `/preview/` slice rides alongside.

### ⛴️ NEXT LANE (owner, 2026-07-01) — **#145 slice 1: remotely-viewable `/preview/` subpath** — BUILD THIS NEXT
Battle's lane-switch gate is CLEARED (Loop 100); the owner chose the **release channels** (#145) as the
next lane, **starting with the preview subpath** so he can watch builds remotely (incl. phone). This is the
active build lane now (ahead of the reservoir below; #147 stays an owner-decision, not build work).
- **Slice 1 — `/preview/` (S · `tech`):** split `release.yml` so continuous `src/**`/`index.html` commits
  **also deploy to a `/preview/` Pages subpath**, stamped with **commit + datetime**. Root/live behaviour
  **unchanged for now** (later slices flip root → landing page). **Acceptance:** after a commit,
  `https://cakuki.github.io/tidewake/preview/` shows the latest build with its commit+datetime; root still
  serves as today. Guard the Actions budget (one deploy per commit, as now). Runner: `software-developer` +
  `tech-lead`.
- Then #145 slices 2–5 (P2, sequence after): landing page at `/` · `/daily/` promote + list notes ·
  `/weekly/` promote + tag + Release + **Marketing-Manager** notes (Monkey Island × Black Isle) · wire
  R4/R4w. Full scope: issue **#145** + `docs/superpowers/specs/2026-06-29-loop-rituals-and-release-cadence-design.md`.

_**UPDATE Loop 86 (2026-06-30): from-owner P1 #146 — port-view mobile clipping — SHIPPED.** The
town/port view clipped on phone viewports; fixed with a scrollable `.town-scroll` body + a PINNED
"⚓ Set Sail" footer + responsive sizing, and a **standing mobile-viewport guard** added to
`tests/playtest.mjs` (390×844 · 360×640 · 844×390 — asserts the panel fits, the body scrolls to its
end, Set Sail stays on screen). **#146 CLOSED.** The owner's larger "less scroll, MORE navigation"
ask is now an **[OWNER-DECISION]** below._

- **#147 — Port-view redesign → Option C: quayside hub + drill-in cards (owner DECIDED 2026-07-01).**
  Follow-up to #146 (stopgap shipped). No longer owner-held — **ready to build, P2 UX**, sequenced by
  PM+TL **after the #145 `/preview/` slice**. Sliceable: **quayside hub shell → drill-in cards
  (Market·Tavern·Harbour) → transitions/polish**; inherits the #146 mobile-viewport guard. Model +
  tradeoffs in issue #147.


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
8. **#70 [STANDING-RULE] — ocean sail-over curios.** _**SLICE 1 SHIPPED (Loop 125, v0.0.20260702025543):**
   a BOTTLE + a TURTLE drift in ahead of the bow while under way; sailing over one plays a soft cue + a
   wry line (anti-repeat pool, never twice in a row). Deterministic + distance-culled + one reused mesh
   per kind (≤1 draw, honours #121); ambient open-sea only, no save change (v17). `src/curio-math.js` +
   `src/curios.js` + `audio.playCurio`._ **Remains (deferred follow-ups):** more curio kinds/variety,
   **tap-picking** a curio (new raycaster in `input.js`), a "seen" set across sessions, + **#113**
   bow-spray flourish + **#114** sea-colour variation / current streaks. **#70 stays OPEN deliberately**
   as the home of the "1–2 sea-delight beats per loop" rule — do NOT close it. P2 from-owner.
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
    _**PARTIAL, OPEN** (Loop 124, v0.0.20260702023718): the impact "juice" pass that makes a hit LAND._
    **SHIPPED** — generalised the existing #155 broadside camera kick (same shake stack + 0-draw
    cameraOffset, NOT a second effect) so **hit-landed** (your clean bite on her) + **hit-taken** (her
    reply raking you) now ROCK the view scaled by the hull bite; added a bounded **HIT-STOP** (a
    few-frame sim freeze on a solid strike, drains on real time → auto-resumes, can't stall the loop /
    desync the world clock; deterministic `tw.step()` never freezes so #121 mesh-conservation stays
    pristine) + a **SINK** punctuation. Toggle-able ("Combat feel", default ON) + prefers-reduced-motion
    aware (off = fully playable, zero residual motion). No save change (v17). Pure curves TDD'd; playtest
    §2b4c asserts event→shake/hit-stop, decay-to-zero, toggle-off suppression. Gallery
    `combat-juice-80.png`. **REMAINS (deferred follow-ups):** a boarding-specific screenshake (boarding
    already LUNGES via #155 but could add a shake on the rail-clash), a surrender/strike-colours beat,
    a **harbour docking ease/settle** juice, and the pitched **time-dilation** on a kill. Pairs with
    #102's landfall punch + any #100 battle.
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
