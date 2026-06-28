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

_Set by **Retro 11** (2026-06-28). State: the **mode spine now MATTERS.** Town is a **destination,
not a menu** — a tavern *listen-for-word* verb spins live state into **rumours that name a real
target** (#103), and the harbourmaster **remembers your face** across visits (#104, save v9).
Landfall is a **crafted multi-sensory moment** — eased camera + golden grade + glassy moored swell +
on-beat "made port" stinger, skippable, reversed on leave (#102, done for now). The world between
ports filled out: **every isle wears its own face** (#71) and the **sunny sea drifts with whitecaps**
(#70 slice 1). The gate hardened to the exploding mode state-space and caught a **real perf race**
(#107). **542 tests**, perf **29/130 draws · 89k/150k tris**. Latest `v0.0.20260628043637`._

_**The next leverage is to make the verbs PAY OFF and fill the one empty room.** The rumour verb
points the bow but has no reward yet → **close the loop** (#112 payoff + #111 marker). Battle-mode
**#100 is HELD for the ~08:00 2026-06-28 Game-Designer owner brief (now ~07:00 — IMMINENT)** — it is
the obvious next big slice but it is the owner's to steer/sequence; do **NOT** auto-promote it above
where the owner wants it._

## Top of queue (do in order) — CLOSE THE REACTIVE LOOP, then fill the empty room

**PM/TL: the build top is the rumour-payoff loop (#112 + #111).** It's the highest-value depth slice
that does NOT depend on the battle brief — a good single dispatch to run now, around the ~08:00 brief.
Re-sort if the owner steers #100 to the top after the brief.

1. **#112 — Rumours that pay off** (+ **#111 — chased-heading map marker**) (design; reactive-verb
   payoff, closes the #103 loop). A rumour you choose to chase gets a **map marker for its heading**
   (#111, cheap legibility) and **arriving / acting on it pays off** via economy or bounty hooks
   (#112) — turning "a tip that points the bow" into a full **town → rumour → sail there → reward**
   loop. — _why: value **high** (a verb with no payoff is a town with no destination, one layer up);
   complexity **medium**; deps #103 (done). CREATIVE SPARK: the regular's tip cashes out — chase the
   word, claim the prize. Lead with the cheap #111 marker, then the #112 payoff._

2. **#105 — "While you were ashore…" digest** (design; living-world legibility). A one-line
   consequence shown on Leave Harbour — cheap legibility of the "world keeps living underneath"
   promise the #95 seam already delivers mechanically but never tells the player; pairs with the #104
   memory just shipped. — _why: value **medium**; complexity **low**; deps #67 + #104 (done)._

3. **#69 — Per-town music identities** (#94 phase 3) (audio). Each port now has a *character* (a
   memory, its own rumours, its own dressing) — give it its own sound via modal recolour/timbre over
   raw transposition. — _why: value **medium**; complexity **medium**; deps #94 ph1 + #67 (done).
   The town depth shipped this block finally gives the score something distinct to say per port._

## [OWNER-DECISION / HELD — IMMINENT] — ask, don't auto-promote

- **#100 — arcade battle-modes** (combat/loadouts/boarding). **HELD for the ~08:00 2026-06-28
  Game-Designer owner brief (now ~07:00 — IMMINENT).** Its mode-switch infra (#95) + seam hardening
  (#106 ph1) + QA (#107) are already built; battle is the one empty room. The owner steers WHAT and
  sequences WHEN — surface the brief over the owner channel; do **NOT** promote above where the owner
  wants it. (When it lands it likely jumps the top; until then the build top is #112/#111.)

## Charm / atmosphere fillers (from-owner; slot in around the depth slices)

4. **#104b — Port-memory depth** (per-port **last deed recalled by name**; the "Your Harbour"
   home-port stretch; familiarity decay). Cheap town-depth follow-on to the just-shipped #104; slot
   alongside #105. _Park the home-port stretch until the rumour loop (#112) closes._
5. **#106 — Mode-seam hardening, slice 1** (declarative `{[mode]:{onEnter,onLeave}}` registry — sugar
   over the bus). Cheap; rides alongside any new mode work. _(slice 4 per-mode disposal PARKED —
   blocked on #100 battle meshes.)_
6. **#110 — Living fauna phase 2: jumping dolphins** (#97 continues; gulls shipped). P2 from-owner.
7. **#101 — props phase 3: loose props** (lanterns/market stalls **feed the town mode** #96/#103).
   P2 from-owner. _(island dressing shipped via #71; texture-embed + extra variety PARKED.)_
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
15. **#90 — Ballad richer composition** (more deed types · share-as-image) — deepens the #78 lever. P3.
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

_SHIPPED & CLOSED this block (Retro 11, loops 55–61): **#103** tavern "listen for word" (rumours) ·
**#102** landfall phase 1+2 (crafted multi-sensory transition — CLOSED) · **#107** mode-transition QA
+ a **real perf-counter race fix** (CLOSED) · **#104** the port remembers you (save v9, CLOSED) ·
**#71** islands TLC (CLOSED). **#70** ocean whitecaps (phase 1; **#70 STAYS OPEN [STANDING-RULE]**).
Filed follow-ups: **#111/#112** rumour marker+payoff, **#104b** port-memory depth, **#113/#114** sea
flourishes. Earlier (Retro 10, loops 48–54): #95/#67/#96/#66/#94-ph1/#106-ph1/#97-ph1/#93/#101-ph1+2
+ the DL #3 research loop. EPICs #1–#9 are umbrellas, not slices._
</content>
