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

---

_Set by **Retro 9** (2026-06-28). State: the game is a genuinely rich sandbox — complete collision +
atmosphere + named world + shareable Ballad + deception on both renown poles (#79/#91) + a CC0 glTF
hero carrack (#32) + eased helm (#20). 411 tests, perf **30/130 draws · 84k/150k tris** (the glTF
swap freed headroom). Latest `v0.0.20260628000955`._

_**Major pivot (owner, via the live PM desk during the loop stop):** the next direction is STRUCTURE,
not more sandbox charm — a **mode system** (sailing / town / battle, world continues underneath), a
real **town/market mode** entered by **auto-harbouring**, and a **unified mode-aware sound system**.
These are from-owner **P1s** and preempt everything previously queued. Battle-mode scenario (#100) is
HELD for an 08:00 2026-06-28 Game-Designer owner brief — its mode-switch infra is #95._

## Top of queue (do in order) — owner-directed MODE SYSTEM (from-owner P1)

1. **#95 — Mode system scaffold** (sailing / town / battle; sailing **pauses**, world continues).
   from-owner **P1**, the keystone enabler. Smallest always-working increment: a tiny mode state
   machine with **sailing as default** + one clean transition seam (enter/leave, pause-vs-continue
   semantics), exposed on `window.__tidewake` for QA; no new mode content yet. — _why: value very high
   (the owner's explicit new spine); complexity medium; deps none — **unblocks #96 town, #67 approach,
   #100 battle**. Do this first so the modes plug in without reworking the spine. CREATIVE SPARK: the
   cannon-smoke / sail-furl transition feel._

2. **#67 + #96 — auto-harbour into a real town/market mode** (from-owner **P1**). With the #95 seam:
   approach a harbour → **announce + slow** (reuse the #76c slow-to-stop easing) → switch to a **town
   /market MODE** (the existing trade panel becomes the mode's view) → **"Leave Harbour"** button
   returns to sailing. **Fold in #66** (iPhone touch buttons overlap the town/trade panel — #96 scopes
   this fix; hide sailing controls while in town). — _why: makes the first new mode real and closes
   two P1s + a P1 bug at once; complexity medium-high; deps #95. CREATIVE SPARK: a harbour bell + a
   market barker's first line._

3. **#94 — Unified mode-aware sound & music system** (from-owner **P1**). Multiple tracks
   (sailing / town / battle) selected by the #95 mode + a **proximity "port nearby" crossfade cue**;
   **absorbs #69** (per-town music, transposition-first). First slice can be the proximity crossfade
   cue alone (ships independently of full mode wiring). — _why: each mode should *sound* distinct;
   complexity medium; deps lighter with #95 (mode→track map). CREATIVE SPARK: the swell of a town
   theme as the harbour resolves out of the haze._

## Owner backlog — charm/atmosphere fillers (from-owner; slot in once the mode spine exists)

4. **#97 — living sea fauna** (gulls / dolphins / ambient animals, instanced + culled). P2 from-owner.
5. **#93 — ship's-wheel touch steering** (rotatable HUD widget for mobile). P2 from-owner.
6. **#101 — CC0 Pirate Kit props** (dress ports/islands/decks, Quaternius/Kenney). P2 from-owner.
7. **#71 — islands TLC** (palette/variety/props, coordinate with the #61 Caribbean sea). P2 from-owner.
8. **#70 — ocean micro-details & sail-over delight** (+ the standing "1–2 delight beats per loop"
   rule). P2 from-owner.
9. **#68 — seagulls: louder calls near the coast** (SFX exists) + visual flock. P2 from-owner.

## [OWNER-DECISION] — ask, don't build

- **#100 — arcade battle-modes** (combat/loadouts/boarding). **HELD for the 08:00 2026-06-28
  Game-Designer owner brief**; scenario blocked pending the owner's steer. Its mode-switch infra is
  #95 (build that regardless). — surface the brief over the owner channel.

## Depth / DL #2 reservoir (between-mode fillers; prefer depth over breadth)

- **DL #3 research loop is DUE** (~11 cycles since DL #2, cadence ~10) — run it as the next
  **non-from-owner-P1** dispatch, i.e. once the P1 mode batch (#95/#96/#67/#94) drains or as the first
  free non-P1 slot.
10. **#72 — cannon-combat depth follow-ups** (hull-damage visuals, tougher foes/gunnery spread, more
    aims, fleeing chase, cannon audio, foe initiative). Advanced in Loop 47; remainder open.
11. **#80 — combat/harbour game-feel "juice" pass** (hit-stop, screenshake, camera punch; toggle-able).
12. **#90 — Ballad richer composition** (more deed types · share-as-image) — deepens the #78 lever.
13. **#40 / #35 — adaptive Klezmer 'freygish' combat tension layer + procedural cannon SFX** (pairs
    with #94's battle track). DL reservoir: **#82 crew chorus**, **#81 hull creak**, **#83 watercolour
    chart**.

## Polish (cheap, charming, compounds shareability — natural fillers)

14. **#15 — comedic loading-tip line pool.** — _humour surface, near-zero cost._
15. **#21 — HUD coins placeholder + cleaner layout.** — _legibility; sets up future HUD work._
16. **#88 — full weather (rain/storm/clouds), optional behind the #73 toggle.** — _extends day-night._

## Enablers / tech debt (schedule, don't let them perpetually lose)

17. **#38 — lightweight PR-validation CI gate** (tests + headless playtest, no deploy). — _Retro 8's
    allow-list means script/test-only pushes no longer run unit tests at all; this is the proper home._
18. **#37 — tolerance-based deterministic visual diff.** Open since cycle 10. — _automates the last
    manual visual-QA step._
19. **#36 — fixed-timestep accumulator loop.** — _determinism unlocks record/replay golden traces._
20. **#74 — PWA service worker (offline caching).** · **#75 — mobile safe-area/landscape/low-end
    polish.** · **#84/#85 — WebGPU / OffscreenCanvas spikes** (DL #2 tech reservoir).

## Blocked / held
- **#99 — sail zones** (invisible regions driving music; later hostility/weather) — P3, naturally
  rides #94 + the #95 mode/zone seam; revisit after the mode spine exists.

---

_SHIPPED & CLOSED this block (Retro 8 roadmap, drained): **#79** False Colours · **#91** Letters of
Marque · **#55** art research · **#20** eased steering · **#65** hull bilge cap · **#32** CC0 glTF
hull. **#72** advanced (follow-ups open). EPICs #1–#9 are umbrellas, not slices._
</content>
