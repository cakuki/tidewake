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

## Top of queue (do in order)

1. ~~**#76 — collision + arcade harbour/fight slow-to-stop (P1, owner-steered).**~~ ✅ **COMPLETE & CLOSED**
   (Loop 38, `v0.0.20260627202808`). All four phases shipped: **(a1) island push-out** (Loop 31) →
   **(c) harbour/fight slow-to-stop** (Loop 32) → **(b) ship-vs-ship collision** (Loop 35) →
   **(a2) tangential slide polish** (Loop 38). The sea now has edges & consequence — soft graze, slide
   along coasts & hulls, no brick wall, no phasing. Pick the next unblocked work item below.

2. **#58 — weather & day-night, OPTIONAL & toggle-off (sunny default).** Plugs into the #73 panel's
   toggle registry (one `register({id:'weather',default:false,apply})` line; see `src/ui/README.md`).
   Never undo the sunny vibe. — _why: owner GO; biggest charm-depth, now safely optional._

3. **#55 — art-asset sourcing strategy + budget (research).** The last open owner P2 that is *not* a
   decision. Research-only: CC0/glTF sources, licensing, cost-vs-effectiveness, a recommendation.
   Writes to backlog/docs; no game code. — _why: owner P2, unblocks #32 glTF hull and the art path._

4. **Deep-learning research loop #2 (ritual, ~22 cycles overdue) — RUN THIS NEXT (HARD trigger).**
   Per the new HARD ritual trigger in `LOOP.md`, with the DL counter past 10 the **next non-`from-owner`-P1
   dispatch IS this ritual**, ahead of the work items below. Fan out role subagents (web research →
   takeaways + wildcard → `agents/`+`memory/`, file ideas; never touches `src/`). — _why: the
   creativity well has been mined ~22 cycles and is dry; this is the studio's refill._
   _(✅ Retro 6 DONE — covered loops 27–32; see `studio/retros/2026-06-27-retro-6.md`.)_

   After DL #2, the top work item is **#76 remaining phases** — (b) ship-vs-ship collision, (a2)
   slide polish (a1 island push-out + c harbour/fight slow-to-stop already SHIPPED Loops 31/32).

## Depth (a thin layer, gated by perf budget — prefer over breadth)

- ~~**#59 — ship-vs-ship cannon combat.**~~ ✅ **SHIPPED Loop 27** (v0.0.20260627130215): "Open fire"
  (G) choice alongside the Insult Broadside, seedable cannon resolution, Infamy reward. Depth
  follow-up filed as **#72** (hull-damage visuals, multi-round tactics, fleeing, cannon audio).
6. **#72 — cannon-combat depth follow-up** (hull visuals, multi-round, fleeing, audio). — _why: turns
   the MVP exchange into a richer fight; sequence after the owner-steered mobile/toggles/weather run._
7. **#32 — CC0 low-poly glTF hull** (pairs with #55 research and the now-firing ship). — _why:
   the biggest charm upgrade to the hero asset; clean ship seam already exists._
8. **#40 — adaptive music tension layer** (Klezmer 'freygish' for combat/menace). — _why: deepens
   the duel/cannon mood; asset-free; from the deep-learning backlog._

## Polish (cheap, charming, compounds shareability — natural between-depth fillers)

9. **#19 — name the islands with flavour text on approach.** — _why: world gains character per
   capture; tiny._
10. **#15 — comedic loading-tip line pool.** — _why: humour surface, near-zero cost._
11. **#20 — smooth steering & input polish.** — _why: feel; every session benefits._
12. **#21 — HUD coins placeholder + cleaner layout.** — _why: legibility; sets up future HUD work._

## Enablers / tech debt (schedule, don't let them perpetually lose)

13. **#37 — tolerance-based deterministic visual diff.** Open since cycle 10; turns the eyeball
    gallery pass into a real automated gate. — _why: removes the last manual visual-QA step._
14. **#38 — lightweight PR-validation CI gate** (tests + headless playtest, no deploy). — _why:
    catch breakage pre-merge, save Actions minutes._
15. **#36 — fixed-timestep accumulator loop.** — _why: determinism unlocks record/replay golden-
    trace testing; foundational but not urgent._

---

_Owner P2 still open and tracked above: #55 (do), #56 + #58 (ask). All other owner P1/P2s shipped
this session. EPICs #1–#9 are umbrellas, not slices. Process chores #34/#44 are landed._
</content>
