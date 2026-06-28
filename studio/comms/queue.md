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

**PHASE-LABEL RULE (Retro 10):** several umbrellas (#94/#97/#101/#106) shipped a phase and stay OPEN.
"OPEN" ≠ "untouched" — each line states **what shipped vs. what remains** so priority tracks
*delivered* value, not the issue's open/closed flag. A from-owner P1 whose headline acceptance is
already met (e.g. #94 phase 1) does NOT auto-sit at the top.

---

_Set by **Retro 10** (2026-06-28). State: the owner **MODE-SYSTEM pivot is built** — a sailing/town/
battle state machine (#95), a real auto-harbour **town/market mode** (#67/#96/#66), a **mode-aware
sound bed** with a port proximity cue (#94 ph1), and a **hardened transition seam** (#106 ph1) — plus
the first charm back on top: a living **gull flock** (#97 ph1), a **ship's-wheel touch helm** (#93),
and **dressed CC0 harbours** (#101 ph1+2). **482 tests**, perf **35/130 draws · 85k/150k tris**.
Latest `v0.0.20260628022029`._

_**The next leverage is depth, not more rooms (DL #3):** the spine exists but the **town must become a
destination, not a menu**, and the **mode transition is the drama**. Lead with a reactive **verb
ashore** (#103), then **sell the transition** (#102), then **harden the gate** (#107). Battle-mode
#100 is HELD for the 08:00 2026-06-28 Game-Designer owner brief — do NOT promote it above where the
owner wants it._

## Top of queue (do in order) — make the modes MATTER (DL #3 depth; reactive-verbs-first)

1. **#103 — Town tavern "listen for word"** (design). Procedural rumours from world-state + reputation
   → **soft sea objectives** you sail back to town for. — _why: value **very high** (DL #3's single
   strongest signal — turns the town from a menu into a **destination**, fixes ashore aimlessness);
   complexity **medium**; deps #67 town (done). CREATIVE SPARK: a hunched regular in the corner who
   "heard a thing" — a rumour that points the bow somewhere worth going._

2. **#102 — Landfall: the mode transition as a crafted multi-sensory gesture** (design + art + audio).
   Eased camera to a moored framing · `townBlend` warm grade · calmed glassy swell · music swell +
   on-beat stinger · a "made port" punch — reversed on Leave. — _why: value **high** (DL #3 theme 2 —
   the transition *is* the drama; makes the snap a moment); complexity **medium**; deps #95/#67 (done),
   pairs with #94. CREATIVE SPARK: the world exhales as the wheel goes still and the harbour resolves._

3. **#107 — Mode-transition QA coverage** (tech + qa). N×N transition matrix · cross-mode pause
   invariant · mode-aware audio assertion · golden mode-trace. — _why: value **medium** (enabler —
   keeps the gate trustworthy as town depth + battle multiply the states); complexity **low–medium**;
   deps #106 (done). Rides the #106 contract directly._

## Charm / atmosphere fillers (from-owner; slot in around the depth slices)

4. **#106 — Mode-seam hardening, slice 1** (declarative `{[mode]:{onEnter,onLeave}}` registry — sugar
   over the bus). Cheap; rides alongside #107. _(slice 4 per-mode disposal PARKED — blocked on #100
   battle meshes.)_
5. **#110 — Living fauna phase 2: jumping dolphins** (#97 continues; gulls shipped). P2 from-owner.
6. **#101 — props phase 3: loose props + island dressing** (lanterns/market stalls **feed the town
   mode**; palms/rocks/huts on islands — pairs with #71). P2 from-owner. _(texture-embed + extra
   variety PARKED.)_
7. **#71 — islands TLC** (palette/variety/props, coordinate with the #61 Caribbean sea + #101 island
   dressing). P2 from-owner.
8. **#70 — ocean micro-details & sail-over delight** (+ the standing "1–2 delight beats per loop"
   rule). P2 from-owner.
9. **#68 — seagulls: louder calls near the coast** (SFX exists) + tie to the #97 visual flock. P2 from-owner.

## Town-depth follow-ons (DL #3 — slot in after #103/#102 prove the town is a place)

10. **#104 — The port remembers you** (persistent per-town reputation; "Your Harbour" home-port
    stretch). P2 design. _The pirate↔governor branch made spatial across visits._
11. **#105 — "While you were ashore…" digest** (one-line living-world consequence on Leave Harbour).
    P2 design. _Cheap legibility of the world-continues-underneath promise._
12. **#69 — per-town music identities** (modal recolour/timbre over raw transposition) — the **#94
    phase-3** slice; ships once town depth gives each port a character to score. P2 audio from-owner.

## #94 remaining phases (P1 OPEN — but phase-1 headline acceptance is MET; not top-of-queue)

13. **#94 — rotating sea themes** (phase 2) + **real battle cue** (phase 4, rides #100) + **real audio
    files behind `loadTrack`** (phase 5 — **PARKED on an asset/owner decision**). #69 above is phase 3.
    _Proximity crossfade + mode-aware bed already shipped (Loop 50)._
14. **#109 — mode-aware audio craft** (constant-power crossfade · bar-clock transitions · procedural
    per-mode reverb · modal recolour). P3 audio. _Rides #94._
15. **#108 — per-mode perf budget + throttle world work in town** (gate ocean/wake + DPR by mode).
    P2 tech. _Promote **#36 fixed-timestep** above #84 (DL #3)._

## [OWNER-DECISION] — ask, don't build

- **#100 — arcade battle-modes** (combat/loadouts/boarding). **HELD for the 08:00 2026-06-28
  Game-Designer owner brief**; scenario blocked pending the owner's steer. Its mode-switch infra
  (#95) + seam hardening (#106 ph1) are already built. — surface the brief over the owner channel; do
  NOT promote above where the owner wants it.

## Depth / DL #2 reservoir (between-mode fillers; prefer depth over breadth)

16. **#72 — cannon-combat depth follow-ups** (hull-damage visuals, tougher foes/gunnery spread, more
    aims, fleeing chase, cannon audio, foe initiative). Advanced Loop 47; much of it **feeds #100
    battle** — revisit after the owner brief.
17. **#80 — combat/harbour game-feel "juice" pass** (hit-stop, screenshake, camera punch; toggle-able).
    Pairs with #102's landfall punch.
18. **#90 — Ballad richer composition** (more deed types · share-as-image) — deepens the #78 lever. P3.
19. **#92 — richer privateering** (faction/bounty + persisted Letter-of-Marque commission + more false
    ensigns). DL reservoir: **#82 crew chorus**, **#81 hull creak**, **#83 watercolour chart**,
    **#40/#35 Klezmer 'freygish' + procedural cannon SFX** (pairs with the #94 battle cue).

## Polish (cheap, charming, compounds shareability — natural fillers)

20. **#15 — comedic loading-tip line pool.** — _humour surface, near-zero cost._
21. **#21 — HUD coins placeholder + cleaner layout.** — _legibility; sets up future HUD work._
22. **#88 — full weather (rain/storm/clouds), optional behind the #73 toggle.** — _extends day-night._

## Enablers / tech debt (schedule, don't let them perpetually lose)

23. **#36 — fixed-timestep accumulator loop.** — _**DL #3 promotes this above #84**: "the world lives
    under a paused helm" wants a sim that steps independently of input/render; `playerPaused` is its
    natural seam. Unlocks #108 + record/replay golden traces (#107)._
24. **#38 — lightweight PR-validation CI gate** (tests + headless playtest, no deploy). — _Retro 8's
    allow-list means script/test-only pushes no longer run unit tests at all; this is the proper home._
25. **#37 — tolerance-based deterministic visual diff.** Open since cycle 10. — _automates the last
    manual visual-QA step._
26. **#74 — PWA service worker (offline caching).** · **#75 — mobile safe-area/landscape/low-end
    polish.** · **#84/#85 — WebGPU / OffscreenCanvas spikes** (DL #2 tech reservoir; #84 below #36).

## Blocked / held
- **#99 — sail zones** (invisible regions driving music; later hostility/weather) — P3, naturally
  rides #94 + the #95 mode/zone seam; revisit after the town-depth verbs land.

## ⏳ iOS — batch the next owner re-test (Retro 10)
- Three device-dependent slices are shipped **best-effort, UNCONFIRMED** pending one owner iPhone
  re-test: **#77** audio unlock · **#87** no-text-select · **#93** ship's-wheel touch. Don't stack
  dependent work; ask the owner to confirm all three on the latest build in one pass.

---

_SHIPPED & CLOSED / advanced this block (Retro 10, loops 48–54): **#95** mode scaffold · **#67/#96/#66**
auto-harbour town/market · **#94 phase 1** proximity crossfade (#94 OPEN, phases 2–5) · **#106 phase 1**
seam hardening (#106 OPEN, slices 1+4) · **#97 phase 1** gull flock (#97 OPEN → #110 dolphins) ·
**#93** ship's-wheel (CLOSED; #98 dup) · **#101 phase 1+2** port dressing (#101 OPEN, phase 3). Plus
the **DL #3** research loop (filed #102–#109). Earlier (Retro 9): #79/#91/#55/#20/#65/#32 drained;
#72 advanced. EPICs #1–#9 are umbrellas, not slices._
</content>
