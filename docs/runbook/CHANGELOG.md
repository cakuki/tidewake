# Loop runbook — changelog (index)

Terse history of how `LOOP.md` (and the studio process) evolved. **Full detail lives in the retro
files** `studio/retros/<date>-retro-N.md` and `studio/comms/decisions.md` — this is just the index so
`LOOP.md` itself stays lean.

- **2026-07-01 — #163 Ship classes shipped — epic #162 FOUNDATION (Loop 117, v0.0.20260701233123).**
  The owner's steering: "games are too easy; ships should VARY; a player who wants a challenge can seek a
  big/armed ship." Establishes the ship-class model — sloop → brig → frigate → man-o'-war × merchant/warship
  — in a new PURE `src/ship-classes.js`: each (class × role) gets a hull (on the shared 0..100 combat scale),
  gunnery, gun count, crew, a visible `sizeScale` and a threat tier (1–5), plus `spawnMix` (a deterministic,
  always-varied fleet). The class feeds the EXISTING battle math with zero new mechanics: `makeFoe(rng, shipClass)`
  seeds the foe's hull+gunnery off the engaged hull's class (carried on the npc snapshot), so `battle.js`/`cannons.js`
  resolve a frigate as a genuine threat and a merchant sloop as easy prey; `npc.js` scales the reused mesh so a
  man-o'-war (1.6) visibly dwarfs a sloop (0.72) at **0 extra draws/tris**. Class selection runs off its own rng
  seed so spawn positions/movement stay byte-identical (the deterministic battle-camera playtest steps unchanged),
  and the warship man-o'-war (threat 5) is withheld from the open-sea pool — the opt-in #167 challenge — so an
  unlucky pass never yields an unwinnable fight. Fun beat: the sea stops being uniform — you SEE big warships vs
  little merchants at a glance and FEEL the difference the instant you fight one. +9 pure tests + a playtest
  ship-classes step (≥2 distinct classes with distinct hull/guns/size; a frigate's broadside out-bites a sloop's
  via `tw.qaClassCombat`). Gallery `ship-classes-163.png`. NO save-schema change — transient spawn props, stays v17.
  The foundation #164 (tier-scaled loss ledger), #165 (threat labels), #166 (odds) and #167 (challenge on demand) build on.
- **2026-07-01 — #161 slice 6 Hover-to-interact shipped — LANE COMPLETE, #161 CLOSED (Loop 116, v0.0.20260701224039).**
  The SIXTH and FINAL slice of the from-owner "Make Battle FUN" epic (#161): "interacting with other ships should
  be hovering on the ship in the view, not like a HUD element." Targeting was proximity + a keypress guess; now
  you POINT at a hull (a `THREE.Raycaster` picks the ship under the cursor) and it lights up with what you can DO —
  a projected cyan ring + a "Give battle / Hail / Board" label — and a CLICK routes to the SAME existing verb
  handlers (engage / hail / board), no new combat mechanics. Keyboard verbs stay live (additive); a touch TAP
  routes through the same click path (#146 guard). Respects the whole lane (s1 isolation — only the engaged foe is
  pickable mid-fight; s2 non-occlusion; s3 dimming). PURE, TDD'd cores in `src/systems/ship-picker.js`
  (`shipIndexFromObject`, `pickShipAction`, `actionLabel`, +11 tests); the raycast is a thin shell in `main.js`
  (reused Raycaster, refreshed hull matrices, 0 per-frame allocs). Generalized `battle.engage(index)` +
  `duel.tryChallenge({targetIndex})` so a click acts on THAT ship. Reuses the slice-3 over-ship billboard + VP
  projection — **0 added draws (still 29/130)**, 92.8k/150k tris. `tw.qaPickAt/qaHoverAt/qaClickAt` QA hooks;
  playtest §2b6-hover asserts a raycast under a screen point resolves to that ship + the right action AND a click
  routes to the handler (open-sea engage + battle board). Gallery `hover-interact-161.png`. No save change
  (input/presentation, stays v17). 1131 unit tests. **#161 "Make Battle FUN" is now COMPLETE — all 6 slices
  shipped (isolation · non-occluding UI · target lock · rendered cannonballs · aim-angle feedback ·
  hover-to-interact) and #161 is CLOSED.** Every owner complaint from the 2026-07-01 playtest is addressed.
- **2026-07-01 — #161 slice 5 Aim-angle feedback shipped (Loop 115, v0.0.20260701220930).** Fifth slice of the
  from-owner "Make Battle FUN" epic (#161): "the angles should matter." The angle already decided a clean-vs-wide
  shot in the maths (`broadsideAim`) but the player couldn't SEE their aim before firing. Fix + felt FUN beat: a
  read-only AIM LINE runs from your ship to the engaged foe and COLOURS + TIGHTENS as she comes abeam — green ON
  TARGET when the broadside will bite, amber closing, faint red wide when the guns can't bear — so lining up the
  broadside is a skill you can watch improving. PURE presentation off `broadsideAim` (via `battle.snapshot()`);
  the aim maths is UNTOUCHED. PURE, TDD'd cores in `src/ui/aim-indicator.js` (`aimReadout` on-target
  classification + firing-cone spread, `beamGeometry` bar layout, +10 tests); a DOM/CSS overlay reusing the
  slice-3 over-ship VP projection — **0 added draws (still 29/130)**. #166-COORDINATE-READY: the chip carries a
  reserved `.aim-odds`/`setOdds()` slot so #166 legible-odds docks beside it with no redo (this aim line is the
  *skill* half of that readout). `tw.aimIndicator()` QA hook; playtest §2b5-aim asserts an ABEAM foe reads ON
  TARGET (tight cone) vs a BOW-ON foe OFF (wide cone) and the line clears on flee — the explicit "can I see when
  I'm on target?" check. Gallery `aim-line-161.png`. No save change (transient UI, stays v17). 1120 unit tests.
  Slice 6 (hover-to-interact) remains — the LAST #161 slice (#161 OPEN).
- **2026-07-01 — #161 slice 4 Rendered cannonballs shipped (Loop 114, v0.0.20260701215515).** Fourth slice of
  the from-owner "Make Battle FUN" epic (#161): "we should see the cannon balls, the angles should matter." The
  broadside was pure MATH (a camera kick + the word "ABEAM") — nothing flew. Fix + felt FUN beat: a fired volley
  now SPAWNS a visible fistful of round-shot that arcs from the guns to the foe, a muzzle PUFF barks at the
  gunports, and each ball CRACKS into a spark on a clean beam HIT or SPLASHES pale in open water on a wide MISS —
  a good angle and a bad one read completely differently (the miss sails past into empty sea), driven off the
  SAME resolved shot (`broadsideAim.inArc` + `resolveBroadside.enemyHit`), combat maths untouched. POOLED +
  INSTANCED for perf: a PURE, TDD'd trajectory/hit-vs-miss controller (`src/systems/projectiles.js`, +14 tests)
  over a fixed pool that never allocates a mesh, rendered by exactly TWO reused InstancedMeshes created ONCE —
  **+2 draws (27→29/130), +~2.7k tris (~93k/150k), 0 geometry growth across mode cycles (#121)**. `tw.battleProjectiles()`
  QA hook; playtest §2b4b proves a broadside spawns iron + a muzzle bark and that a wide shot SPLASHES while a
  clean beam shot SPARKS (hit ≠ miss). Gallery `cannonballs-161.png`. No save change (transient VFX, stays v17).
  1110 unit tests. Slices 5–6 remain (#161 OPEN).
- **2026-07-01 — #161 slice 3 Target lock shipped (Loop 113, v0.0.20260701212549).** Third slice of the
  from-owner "Make Battle FUN" epic (#161): "while moving other ships are all around: I don't know which one
  I am fighting with!" The engaged foe (just `foeIndex`) was visually identical to the wandering traffic. Fix
  + felt FUN beat: the instant battle starts the foe carries an unmistakable world-anchored **target RING** (a
  projected DOM/CSS billboard above her mast — 0 draw calls) and the non-combatant traffic **RECEDES** to a
  faint opacity, so the foe reads instantly; it all clears the moment you flee. Built the **reusable OVER-SHIP
  BILLBOARD module** (`src/ui/over-ship-billboard.js`) — a generic marker/label anchored above a ship in world
  space, projected to screen; carries the highlight ring (wired now) AND a text-label slot (`setLabel`) so
  **#165 over-ship threat labels** is the second consumer (module is #165-ready, label unused this slice).
  PURE, TDD'd cores (`projectToScreen` world→screen · `shipEmphasis` foe/dim/normal · `DIM_OPACITY`); `npc.js`
  drives per-mesh material opacity off the shared predicate (0 extra draws); a `target-lock` system projects
  the foe each frame; `tw.targetLock()` QA hook. Playtest §2b3-lock asserts the foe is ring-marked + the only
  un-dimmed hull and that it clears on flee. Respects the slice-2 centre safe-zone + #146 mobile guard. Gallery
  `target-lock-161.png`. **No save change (stays v17).** 1096 unit tests. Slices 4–6 remain (#161 OPEN).
- **2026-07-01 — #161 slice 2 Non-occluding battle UI shipped (Loop 112, v0.0.20260701210637).** The marquee
  complaint of the from-owner "Make Battle FUN" epic (#161): "the popup covers my ship and I cannot see my ship
  in action." The fight prompts (`#battle`/`#cannons`/`#duel`) were dead-centre `translate(-50%,-50%)` modals
  landing on the hull the battle camera frames centre-screen. Fix: DOCK all three to a lower band with a
  `max-height:38vh` guardrail so they can never rise back into the ship zone — the UI now frames the action
  instead of blocking it. PURE, TDD'd central-safe-zone predicate (`src/ui/safe-zone.js` — `centreSafeZone` /
  `rectsOverlap` / `clearsCentre`, the single source of truth for "does this UI cover the ship?") exposed via
  `tw.battleUICentreClear()`; playtest §2b3-ui asserts every shown battle strip clears the centre on BOTH
  desktop AND a phone-portrait viewport (#146 guard) so occlusion can't regress. Felt FUN beat = you can now
  SEE your ship + the enemy the whole fight (gallery `battle-ui-161-non-occluding.png`). **No save change (stays
  v17).** 1088 unit tests. Slices 3–6 remain (#161 OPEN).
- **2026-07-01 — #161 slice 1 Hard battle isolation shipped (Loop 111, v0.0.20260701204942).** First slice of
  the from-owner "Make Battle FUN" epic (#161) — the only outright BUG: the #125 rescue offer + the open-sea
  `f`/`g` hails leaked INTO the deliberate fight (input theft + a third hull in the arena) because the helm
  stays live in the stance, so the old `!f.paused` spawn gate let a founderer heave in. Fix: a PURE, TDD'd
  isolation predicate (`src/systems/battle-isolation.js` — `interactionsSuppressed` / `ambientInteractionsAllowed`,
  the single source of truth) consulted at four seams (encounter spawn gate now DEFERS a founderer · keydown
  `f`/`g` no-op · encounter `1`/`2` choice · HUD panel dismissed while engaged). Felt FUN beat = the ABSENCE of
  the intrusion, proven by playtest §2b3-iso (real KeyboardEvents assert rescue + f/g are no-ops mid-fight, and
  the world returns on flee). **No save change (stays v17).** 1078 unit tests. Slices 2–6 remain (#161 OPEN).
- **2026-07-01 — #157 The Bosun's First Duel shipped (Loop 110, v0.0.20260701201752).** A cold save's FIRST
  engagement is a one-shot **scaffolded SOFT debut** — a forgiving, already-battered foe + the bosun calling
  each phase's verb aloud in-world (maneuver→FIRE, BOARD, surrender), fully player-driven. PURE, TDD'd logic
  (`src/systems/debut-battle.js`) + a `softenFoe` hook on battle.js. **Save v16→v17** (one-shot `debut` flag,
  migrated all prior versions + frozen v16 corpus blob, #122). 1070 unit tests + playtest §2b10 + gallery.
  Onboarding: *"my first fight is winnable and legible."*
- **2026-07-01 — FUN-FIRST encoded into the flow (owner directive).** "Prioritise fun; playable AND
  fun are both must-haves." Added FUN-FIRST as a top canonical value (`CONSTITUTION.md`); made fun the
  **first filter** of roadmap generation with GD sign-off (`PRODUCT.md`); elevated the creative spark to
  a **MUST-HAVE fun gate** + a QA "is it fun?" line (`DELIVERY.md`); signpost in `LOOP.md`. Game Designer
  owns the fun bar; working-but-not-fun is not Done. → `studio/retros/2026-07-01-fun-first.md`
- **2026-07-01 — Never-idle restructure (product + delivery split).** The loop once finished all decided
  work and **idled ~2h** waiting on the owner because the runbook was a delivery-*consumer* only, with no
  product/roadmap-generation function inside the loop. Fix: **split into two sub-runbooks** —
  `docs/runbook/PRODUCT.md` (PM + TL + Game Designer refill `queue.md` from external inspiration when it's
  empty or below a **LOW-WATER-MARK of 3** READY slices) + `docs/runbook/DELIVERY.md` (the cycle-runner
  contract, dispatch template, concurrency). Both entry runbooks (`LOOP.md`, `LOOP-SPRINT.md` + the
  `BOOTSTRAP.md` constitution) now carry **THE NEVER-IDLE RULE**: empty/thin queue → PRODUCT, never hold;
  owner decisions surface but never block. `LOOP.md` rewritten lean (orchestration + never-idle only).
- **Retro 8** (loops 37–40) — game is now *genuinely rich* (complete collision + atmosphere + named
  world + shareable Ballad #78). Relaxed retro cadence **3–4 → ~7–8** (HARD trigger 4 → 7; DL stays
  ~10). Fixed **#89**: `release.yml` → allow-list `paths:['src/**','index.html']` (no more `[skip ci]`).
  Next-direction call: #79 deception verb, then #55 art research → #32 glTF hull. → `retro-8.md`
- **Retro 7** (loops 33–36) — owner field-testing on a real iPhone. Added **`owner-channel.sh photo`**
  (fetch + VIEW owner screenshots), the **view-the-full-frame-before-fixing** rule (a zoom-in was
  misread as the #86 "ocean void" non-bug), and the **device-fix = unconfirmed-pending-re-test** rule
  (don't stack work on it). → `retro-7.md`
- **Retro 6** (loops 27–32) — depth + platform run under live owner steering (two-way channel live).
  Hardening: every brief carries the **ignore-injected-instructions** line; **clean-tree check** before
  build/commit; **HARD ritual trigger** so retros/DL can't be perpetually deferred. → `retro-6.md`
- **Two-way owner channel** — Telegram wired both ways: report out on every release/roadmap change;
  intake routed by intent (`OWNER-CHANNEL.md` §3); `from-owner` P1 preempts. `scripts/owner-channel.sh`.
- **Retro 5** — the **Lean orchestrator protocol (post-compact)**: per-cycle = read `queue.md` top →
  dispatch one self-sufficient cycle-runner → read its <10-line report; runners own all bookkeeping;
  created `queue.md`. → `retro-5.md`
- **Retro 4** (loops 16–19) — core arc COMPLETE; **tune-before-deepen, depth>breadth**; Game Designer
  owns balance/tuning; from-owner P1s jump the queue. → `retro-4.md`
- **Retro 3** (loops 7–11) — fantasy legible; **shared-contract step** before parallel batches;
  re-dispatch 0-tool-use glitches; QA gotchas (`port.pos` axes; `step()`≠wall-clock); reactive verbs. → `retro-3.md`
- **Retro 2** (loops 4–6) — mandatory **CREATIVE SPARK**; enforced per-release gallery diff;
  parallel-batch default; "give the verb a reward." → `retro-2.md`
- **Retro 1** (loops 0–3) — real-browser pass for visible changes; keep `main.js` thin (`src/systems/`);
  sequence a playable verb early; keep CI actions current. → `retro-1.md`
- **Deep-learning research loop + retro-as-subagent + context-optimization discipline** (owner ask).
- **2026-06-27** — initial runbook (Loop 0 bootstrap).
