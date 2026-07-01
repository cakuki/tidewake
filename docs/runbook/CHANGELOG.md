# Loop runbook — changelog (index)

Terse history of how `LOOP.md` (and the studio process) evolved. **Full detail lives in the retro
files** `studio/retros/<date>-retro-N.md` and `studio/comms/decisions.md` — this is just the index so
`LOOP.md` itself stays lean.

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
