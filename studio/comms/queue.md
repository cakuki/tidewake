# Next-slice queue (orchestrator reads top-down)

**This is the orchestrator's per-cycle starting point after a compact.** Read the TOP unblocked
item → dispatch ONE self-sufficient cycle-runner subagent for it → read its <10-line report →
move on. The cycle-runner owns all bookkeeping (commit specific files, push, verify CI, close the
issue, append its loop-log row, QA). See `docs/runbook/LOOP.md` → **Lean orchestrator protocol
(post-compact)**. Re-prioritise only when a higher item lands or the owner files new feedback.

**PREEMPTION RULE:** an owner `from-owner` **P1** issue (filed via the PM Desk) **jumps to the top**
of this queue, ahead of everything below. Owner P1s preempt; do them first, then resume here.

**OWNER-DECISION RULE:** items marked **[OWNER-DECISION]** are *questions to ask the owner*, not work
to do. Surface them in the next Telegram update with options; never auto-adopt.

Set by Retro 5 (2026-06-27). State: arc complete + tuned reachable (`LEGEND_AT 2400`) + onboarded +
sunny Caribbean look; 28 releases, 229 tests, perf gate live. Latest `v0.0.20260627115834`.

---

## Top of queue (do in order)

1. **[OWNER-DECISION] #56 — mobile support go/no-go.** Feasibility + Phase-0 device-spike (#62) are
   done; the *build* needs the owner's go. **Ask, don't decide.** Surface with options (ship the
   PWA/WebView wrapper #63 now vs. defer). — _why: owner-decision, can't auto-adopt; cheap to ask._

2. **[OWNER-DECISION] #58 — weather & day-night.** Biggest charm-per-pixel depth, BUT the owner just
   set a deliberate **sunny** vibe (#61). **Confirm scope before any work** — e.g. "gentle time-of-
   day that keeps the sunny default" vs. full rain/storm/night. Do NOT undo the sunny look. — _why:
   high charm, but risks reversing a fresh owner decision; ask first._

3. **#55 — art-asset sourcing strategy + budget (research).** The last open owner P2 that is *not* a
   decision. Research-only: CC0/glTF sources, licensing, cost-vs-effectiveness, a recommendation.
   Writes to backlog/docs; no game code. — _why: owner P2, unblocks #32 glTF hull and the art path._

4. **Deep-learning research loop #2 (ritual, ~18 cycles overdue).** Fan out 9 role subagents (web
   research → 2–4 takeaways + 1 wildcard each → write to `agents/` + `memory/`, file backlog ideas).
   Research-only, never touches `src/`. — _why: the creativity refill; loops 11–26 all mined loop
   #1; the well is nearly dry. Run before more depth._

## Depth (a thin layer, gated by perf budget — prefer over breadth)

5. **#59 — ship-vs-ship cannon combat.** A real gun-port option alongside the Insult Broadside duel,
   so a fight is a genuine choice (talk them down OR open fire). Gives Infamy a teeth-y path. Design-
   first. — _why: the single highest-leverage depth beat; makes combat a choice, not a gimmick._
6. **#32 — CC0 low-poly glTF hull** (pairs with #55 research and #59's now-firing ship). — _why:
   the biggest charm upgrade to the hero asset; clean ship seam already exists._
7. **#40 — adaptive music tension layer** (Klezmer 'freygish' for combat/menace). — _why: deepens
   the duel/cannon mood; asset-free; from the deep-learning backlog._

## Polish (cheap, charming, compounds shareability — natural between-depth fillers)

8. **#19 — name the islands with flavour text on approach.** — _why: world gains character per
   capture; tiny._
9. **#15 — comedic loading-tip line pool.** — _why: humour surface, near-zero cost._
10. **#20 — smooth steering & input polish.** — _why: feel; every session benefits._
11. **#21 — HUD coins placeholder + cleaner layout.** — _why: legibility; sets up future HUD work._

## Enablers / tech debt (schedule, don't let them perpetually lose)

12. **#37 — tolerance-based deterministic visual diff.** Open since cycle 10; turns the eyeball
    gallery pass into a real automated gate. — _why: removes the last manual visual-QA step._
13. **#38 — lightweight PR-validation CI gate** (tests + headless playtest, no deploy). — _why:
    catch breakage pre-merge, save Actions minutes._
14. **#36 — fixed-timestep accumulator loop.** — _why: determinism unlocks record/replay golden-
    trace testing; foundational but not urgent._

---

_Owner P2 still open and tracked above: #55 (do), #56 + #58 (ask). All other owner P1/P2s shipped
this session. EPICs #1–#9 are umbrellas, not slices. Process chores #34/#44 are landed._
</content>
