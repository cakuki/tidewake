# Loop runbook — changelog (index)

Terse history of how `LOOP.md` (and the studio process) evolved. **Full detail lives in the retro
files** `studio/retros/<date>-retro-N.md` and `studio/comms/decisions.md` — this is just the index so
`LOOP.md` itself stays lean.

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
