# Loop runbook — changelog (index)

Terse history of how `LOOP.md` (and the studio process) evolved. **Full detail lives in the retro
files** `studio/retros/<date>-retro-N.md` and `studio/comms/decisions.md` — this is just the index so
`LOOP.md` itself stays lean.

- **2026-07-02 — #167 Challenge on demand shipped — epic #162 COMPLETE (Loop 121, v0.0.20260702014146).**
  The payoff of the whole difficulty/stakes/variety lane: a player who WANTS a hard fight can now SEEK one
  and get it. Danger is **FIXED BY REGION** (owner decision #162 — NO rubber-band): the safe home coast
  breeds gentle prey; the deep sea breeds frigates and — out past the points — the withheld **WARSHIP
  man-o'-war** (tier 5), now reachable if you sail out to meet her. A kill out there pays real fame:
  **spoils scale by foe TIER**, the symmetric mirror of #164's tier-scaled loss sting (high risk, high
  reward, both legible). The pure brain is new **`src/systems/danger.js`** (`regionDanger` maps a world
  position → the region's danger cap; `regionalSpec` picks a region-appropriate class×role — deep = the
  apex man-o'-war; DOM/THREE-free, unit-tested). `npc.js` now fixes each hull's class by its **spawn
  region** and guarantees one deep-water man-o'-war hunter that patrols the deep (so the coasts stay
  gentle); `spoils({…, tier})` in `cannons.js` adds a per-tier purse (`+15c/tier`, Infamy follows), with
  `tier` defaulting to 0 so every legacy caller/test is byte-identical. **No new meshes** (the man-o'-war
  reuses the #163 scaled mesh — perf 29/130 draws · ~93k/150k tris). Transient/positional — **NO save
  bump (stays v17)**. +9 danger unit tests + a spoils tier-scaling test (1200 total); a playtest
  §1b-challenge gate proves the FIXED rule out-classes the deep vs the coast, the warship man-o'-war roams
  the tier-5 deep (reachable), reward climbs monotonically with tier, no rubber-band, save v17. Gallery
  `challenge-on-demand-167.png`. **This CLOSES epic #162 — all 5 slices shipped: #163 ship classes →
  #164 loss stings → #165 threat labels → #166 legible odds → #167 challenge on demand.** FUN: point the
  bow at deadly water and FEEL the stakes rise (a bigger silhouette, redder skulls, a dire odds read) —
  a tier-5 terror worth real Infamy; mastery finally has somewhere to aim.

- **2026-07-02 — #166 Legible odds shipped — epic #162 "read whether you're favoured" (Loop 120, v0.0.20260702004439; salvaged after a 529).**
  The owner's fair-fight contract, made READABLE: "fair = clear, consistent rules WITH a bounded luck
  element — SKILL shifts the odds, LUCK swings the margin, and luck can't flip a strongly-favoured fight."
  A read-only odds/matchup readout now docks into the aim indicator's reserved `.aim-odds` slot during an
  engagement — a plain-language verdict ("You outclass her" / "An even match" / "She outguns you —
  reckless"), a legible damage-per-volley + bounded ±20% margin sub-line, and a visual **margin BAND** (a
  bar whose lit segment is the luck swing and whose side of the even-tick reads favoured-from-doomed;
  straddling centre = "the margin decides"). The pure brain is new **`src/systems/odds.js`** (`combatOdds`/
  `oddsReadout`, three.js-free, DOM-free, unit-tested): SKILL sets the deterministic edge from the class
  matchup (`ship-classes.js` hull+gunnery) + live aim geometry + the loaded shot; LUCK is only the shown
  ±20% band around it. The model MIRRORS `resolveBroadside`'s coefficients and is **cross-checked against
  the real combat math in tests** so the shown band == the actual luck bound and can never silently drift;
  a 'dominant' verdict is EXACTLY "even max-adverse luck still wins" (proven ≥99% over 2000 real sims), so
  luck can't flip a favoured fight. `setOdds()` in `aim-indicator.js` grew from a bare string to a
  structured `{text,sub,tier,bar}` (legacy string still works); `battle.snapshot()` gained `foeGunnery`+
  `foeTier`; an optional stake hint reads #164's `defeatLedger` so the odds also name what a loss costs.
  Coexists with the #161-s5 aim line, target lock, #165 threat labels, the #161-s2 non-occlusion safe-zone,
  and the #146 mobile guard. **No combat-math / luck-bound change; NO save bump — stays v17.** +21 unit
  tests (1191 total); a playtest §2b3-odds gate proves the matchup reads right, the band == ±20%, luck can't
  flip a strong verdict, and the read is docked + shown in the aim slot during a real fight (then clears on
  flee). Perf within budget (DOM readout +0 draws). Salvaged after the prior runner died on a 529 with the
  build uncommitted. #166 CLOSED; epic #162 kept OPEN (only #167 challenge-on-demand remains).
- **2026-07-02 — #165 Over-ship threat labels shipped — epic #162 "pick your fight" (Loop 119, v0.0.20260702001553).**
  The owner's #7 note for the difficulty/variety epic: "over-the-ship displays telling/hinting what ships
  are, so a player can CHOOSE fights and read danger at a glance." Every classed NPC hull now floats a
  class + threat label above her — **"Merchant Sloop ·"** (a green easy prize) up to **"Warship Man-o'-War
  ☠☠☠☠"** (a red deadly foe) — so you glance across the sea and instantly read who to hunt vs who to flee
  **before committing**. **One module, two consumers (the whole point of building it reusable):** reuses the
  SAME `src/ui/over-ship-billboard.js` from #161 slice 3 (the target ring) via its `setLabel()` slot — **no
  second billboard system**; the labels are **pooled** (one element per hull, created once + reused every
  frame → 0 DOM churn) and DOM/CSS → **0 draw calls** (perf within budget, DOM labels add +0 draws/tris).
  The pure brain is new **`src/systems/threat-label.js`** (three.js-free, DOM-free, unit-tested): `threatLabelFor`
  (class→text+glyph), `threatGlyphs` (skulls escalate strictly with tier so a man-o'-war reads deadlier than
  a sloop), `dangerLevel` (green prey→red deadly colour band), and the declutter rule `labelFade`/`selectLabels`/
  `maxLabelsForViewport` (fade with distance, cap the count, **a lower cap on a phone = the #146 guard** so
  labels never smother a small screen). In a fight the traffic's labels **recede** (eligibility) so the engaged
  foe's label + ring read clean together on the **same anchor**. **NO save-schema change** — pure presentation,
  stays **v17**. +16 unit tests (1171 total); a playtest gate asserts each live label's text+glyph match its
  class/tier, a man-o'-war reads STRICTLY deadlier than a merchant sloop, a far hull is culled, a phone caps
  labels 3<6, and the foe's ring+label coexist on one anchor while traffic recedes. Gallery `threat-labels-165.png`.
  #165 CLOSED; epic #162 kept OPEN (remaining: #166 legible odds, #167 challenge on demand).
- **2026-07-02 — #164 Loss stings shipped — epic #162 stakes layer (Loop 118, v0.0.20260701235745).**
  The owner's #1 note for the difficulty/stakes epic: "games are too easy — the player must be able to
  LOSE when playing badly, and a loss should COST points + fame." Two things now hold. (1) **You can
  actually lose:** `isDefeat({playerHull})` (a legible, tested, single-source rule in `src/systems/battle.js`
  — hull ≤ 0 under her fire → `finish('lose')`) is the clear player-defeat condition; skill sets the odds,
  the existing bounded ±20% luck sets the margin. (2) **Losing stings:** `defeatLedger(tier, context, ledger)`
  — the FIRST-ever reputation-DECREMENT path in `src/renown.js` (legend used to only ever grow) — deducts
  coin + fame on a loss: **MEDIUM** magnitude, **scaled by the foe's threat tier** (`ship-classes.js` via
  `foe.tier`), **CONTEXT-BASED** (`defeatContext` off the dominant pole → a raiding loss dents **Infamy**, a
  governor-road loss dents **Standing** — the pole you were pursuing), **coin dented too**, and **floored at 0**
  (never negative, no death-spiral — one loss never wipes a run). Surfaced by a red **"⚑ Colours Struck"**
  defeat card (`hud.showDefeat`) that **NAMES the cost** ("−N Infamy, −C coin"); it reuses the shared toast
  (already docked clear of the #161-slice-2 centre safe-zone) → **0 extra draws** (perf 29/130 · ~93k tris).
  Binding owner decisions (#162): MEDIUM · you KEEP your ship (fame/coin only) · context-based fame · **no save
  bump — deducts from already-persisted coin/infamy/standing, stays v17.** Fun beat: you SEE your fame + coin
  visibly DROP on the red card and FEEL that reckless fights now carry real risk (caution becomes a decision).
  +11 renown unit tests + 6 battle unit tests (tier scaling, context routing, floor, no-death-spiral, the
  defeat condition) + a playtest loss gate (a real defeat fires the ledger; raid→Infamy / governor→Standing;
  floored at 0; the card names the cost). Gallery `colours-struck-164.png`. **For #166/#167 to read:** the loss
  condition + the ledger (`isDefeat`/`defeatLedger`/`defeatContext` + `DEFEAT_*` constants) now exist — #166
  legible-odds can show the stake a loss carries, #167 challenge-on-demand scales its risk off the same tier→sting.
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
