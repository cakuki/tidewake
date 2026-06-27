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

Set by Retro 5 (2026-06-27). State: arc complete + tuned reachable (`LEGEND_AT 2400`) + onboarded +
sunny Caribbean look; 28 releases, 229 tests, perf gate live. Latest `v0.0.20260627115834`.

---

_Updated 2026-06-27 14:55: #56 & #58 owner-decisions ANSWERED via Telegram (mobile GO now; weather GO
as an **optional toggle**, sunny stays default). #59 cannon combat SHIPPED (Loop 27, v…130215). New
owner-steered work un-gated below._

_Updated 2026-06-27 15:45: #63 mobile, #73 toggles UI both SHIPPED (Loops 28, 30). #76 priority
delegated by owner to PM+TL → set **P1, next** (high value, low complexity, no deps)._

_Updated 2026-06-27 21:30 (Retro 8): #76 (all 4 phases), #58 (optional day-night), #19 (island names),
#78 (Ballad of Your Voyage) all SHIPPED & CLOSED. DL #2 ran. #89 release-trigger debt CLOSED (allow-list).
Game crossed from "landable arc" to **genuinely rich** (complete collision + atmosphere + named world +
shareable stories). Recommended next direction below._

## Top of queue (do in order)

1. ~~**#76 collision system**~~ ✅ CLOSED (Loop 38) · ~~**#58 day-night**~~ ✅ CLOSED (Loop 36) ·
   ~~**#19 island names**~~ ✅ CLOSED (Loop 39) · ~~**#78 Ballad of Your Voyage**~~ ✅ CLOSED (Loop 40,
   `v0.0.20260627210918`). The DL #2 charm well is now feeding the game. Pick the next item below.

2. **#79 — False Colours & Letters of Marque (deception-as-a-verb). RECOMMENDED NEXT (Retro 8).**
   The DL #2 headline verb the world still can't do: fly false colours / run letters of marque, feeding
   both renown poles (Infamy ↔ Standing). Pure-logic, asset-free, fits the existing combat/reputation
   seams — and it gives the just-shipped #78 Ballad *richer deeds to record*. — _why: charm + reactivity
   that compound the systems just finished, where another engineering-grade system wouldn't._

3. **#55 — art-asset sourcing strategy + budget (research).** The last open owner P2 that is *not* a
   decision. Research-only: CC0/glTF sources, licensing, cost-vs-effectiveness, a recommendation.
   Writes to backlog/docs; no game code. — _why: owner P2; the hero-asset VISUAL leap — unblocks #32
   glTF hull, the boat that anchors every screenshot/clip (Retro 8: do after #79)._

4. **#32 — CC0 low-poly glTF hull** (pairs with #55 research). — _why: the biggest charm upgrade to the
   hero asset once #55 names the sources; clean ship seam already exists._

## Depth (a thin layer, gated by perf budget — prefer over breadth)

- ~~**#59 — ship-vs-ship cannon combat.**~~ ✅ **SHIPPED Loop 27** (v0.0.20260627130215): "Open fire"
  (G) choice alongside the Insult Broadside, seedable cannon resolution, Infamy reward. Depth
  follow-up filed as **#72** (hull-damage visuals, multi-round tactics, fleeing, cannon audio).
6. **#72 — cannon-combat depth follow-up** (hull visuals, multi-round, fleeing, audio). — _why: turns
   the MVP exchange into a richer fight; sequence after the owner-steered mobile/toggles/weather run._
7. **#79 → see top of queue** (DL #2 deception-as-a-verb — recommended next).
8. **#40 — adaptive music tension layer** (Klezmer 'freygish' for combat/menace). — _why: deepens
   the duel/cannon mood; asset-free; from the deep-learning backlog._
- DL #2 charm reservoir (file as fillers): **#82 crew chorus**, **#80 combat/harbour juice**,
  **#81 hull creak**, **#83 watercolour chart**.

## Polish (cheap, charming, compounds shareability — natural between-depth fillers)

- ~~**#19 — island names + landfall text.**~~ ✅ **SHIPPED Loop 39** (v0.0.20260627204815) + bigmap labels.
9. **#15 — comedic loading-tip line pool.** — _why: humour surface, near-zero cost._
10. **#20 — smooth steering & input polish.** — _why: feel; every session benefits._
11. **#21 — HUD coins placeholder + cleaner layout.** — _why: legibility; sets up future HUD work._
12. **#66 — docked-button / touch overlap polish.** — _why: cheap mobile-feel fix; tracked since #63._
13. **#90 — Ballad richer composition** (more deed types · share-as-image). — _why: deepens the #78
    shareability lever once #79 starts feeding it more deeds._

## Enablers / tech debt (schedule, don't let them perpetually lose)

14. **#38 — lightweight PR-validation CI gate** (tests + headless playtest, no deploy). — _why: catch
    breakage pre-merge, save Actions minutes — **now more important:** Retro 8's allow-list means
    script/test-only pushes no longer run unit tests at all (they only ran inside the release job)._
15. **#37 — tolerance-based deterministic visual diff.** Open since cycle 10; turns the eyeball
    gallery pass into a real automated gate. — _why: removes the last manual visual-QA step._
16. **#36 — fixed-timestep accumulator loop.** — _why: determinism unlocks record/replay golden-
    trace testing; foundational but not urgent._

---

_Owner P2 still open: **#55** (do — art research). #56 (mobile) + #58 (weather) were ANSWERED and
SHIPPED. #89 release-trigger debt CLOSED (Retro 8 allow-list). EPICs #1–#9 are umbrellas, not slices._
</content>
