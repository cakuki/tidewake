# Incident retro — the loop-idle stall (2026-07-01)

_Date: 2026-07-01 · Scope: a single incident — the delivery loop idling ~2h with the queue
drained · Facilitator: Project Manager · Blameless: fix the system, not the person._

A focused incident retro, not a block review: one failure, its root causes, and the
structural fix that closes it. The runbook restructure is already committed (`60523b2`,
indexed in `docs/runbook/CHANGELOG.md`); this retro captures the analysis and **verifies the
fix covers every root cause**.

## What happened

The loop finished the entire owner-decided battle epic **#135** (Option 2 + Option 4) and
**drained the idea reservoir**. With nothing left that was both decided and buildable, it then
**repeatedly HELD / no-op'd for ~2h**, waiting for the owner to steer — to close **#135**, to
pick the **#147** navigation model, to choose the **#152** runner — instead of generating new
work of its own.

The owner corrected it directly:

> "The loop should always work on something. If no delivery PM + TL should have come with
> external inspirations and put things into the roadmap."

That is the whole incident: an empty queue was treated as a **stopping condition** when it
should have been a **trigger to generate roadmap**.

## Root causes (4)

1. **STRUCTURAL — the loop was a pure delivery *consumer*.** The runbook defined the loop as
   "queue order is authoritative; a separate PM session sorts it; the loop just reads
   top-down." There was **no product/roadmap-generation function inside the loop**, so an empty
   queue had literally **no defined productive action**. This is the deepest cause — the other
   three are what let the structural gap surface as a 2h stall.
2. **SINGLE POINT OF FAILURE — all prioritization lived in a separate PM session.** Filling the
   queue was that one session's job. When it didn't feed the queue, the loop **starved with no
   fallback** — nothing else was allowed to generate work.
3. **"NEVER STOP" WITH NO FALLBACK degenerated into "no-op forever."** The never-stop intent
   had no *productive* alternative to delivering, so "don't stop" collapsed into holding — idling
   dressed up as waiting.
4. **RATIONALIZATION over-weighted the wrong boundary.** The orchestrator had standing guidance
   not to idle-wait, and had even acted proactively once (onboarding flagship **#153**). But it
   reverted to holding by over-valuing "don't freelance priorities / respect the PM-session
   boundary." The judgment error: **generating roadmap when the queue is starved is the PM+TL's
   JOB, not freelancing.** Respecting a boundary became an excuse to do nothing.

## The fix — verified against commit `60523b2`

The restructure splits the loop into a **PRODUCT** function and a **DELIVERY** function and
makes never-idle a **structural invariant of the runbook**, not a behavioural hope. Verified
by reading the committed files:

- **`docs/runbook/LOOP.md`** — the per-cycle protocol is now a **two-branch decision with no
  hold branch**: `IF ready slice AND ready count ≥ 3 → DELIVERY; IF empty or ready count < 3 →
  PRODUCT.` THE NEVER-IDLE RULE is stated explicitly ("The loop NEVER holds, no-ops, or idles.
  If there is nothing to DELIVER, it does PRODUCT work"), with the **LOW-WATER-MARK = 3 READY
  slices** and "owner decisions are surfaced via the owner channel but **NEVER block** the loop."
  It even inlines the 2026-07-01 failure as the reason.
- **`docs/runbook/PRODUCT.md`** — NEW. The product function: PM + TL + Game Designer pull
  external inspiration (WebSearch + notebooks + inbox + VISION/ROADMAP + retros) and **refill
  `queue.md` to ≥ 3 READY slices** when it's empty or below the low-water-mark. Owner-decision /
  blocked items **do not count** toward the mark, so if only those remain, PRODUCT still runs. It
  guarantees a non-empty queue ("if genuinely blocked from that, file the smallest safe
  engine/charm/tech-debt slices from the reservoir rather than returning an empty queue").
- **`docs/runbook/DELIVERY.md`** — NEW. The cycle-runner contract (clean-tree → smallest
  increment → TDD → gates → `git commit -o` → CI → bookkeeping → report), moved out of LOOP.md so
  the entry file is orchestration + the never-idle rule only.
- **Both entry runbooks + the constitution reflect it.** `LOOP-SPRINT.md` (the bounded
  `claude -p` twin) states "an empty or below-low-water-mark queue is **NOT an exit** → spend the
  cycle on PRODUCT," and `BOOTSTRAP.md` (the headless constitution) carries THE NEVER-IDLE RULE +
  the same 3-slice mark + product/delivery split. All three agree.

**Do the new runbooks fully close all 4 root causes? YES:**

| Root cause | Closed by |
|---|---|
| 1 · Structural (consumer-only, no gen function) | `PRODUCT.md` gives the loop a first-class roadmap-generation function; `LOOP.md` step 1 has an explicit PRODUCT branch. |
| 2 · Single point of failure (separate PM session) | PRODUCT runs **inside the loop** as the fallback; the separate PM session is no longer the only path to a stocked queue. |
| 3 · "Never stop" with no fallback | The per-cycle protocol has **no hold branch** — the only two outcomes are DELIVERY or PRODUCT. |
| 4 · Rationalization | `PRODUCT.md` codifies that refilling when starved is the PM+TL's **job**; never-idle is now in the runbook structure, so it overrides in-the-moment rationalization. |

**Residual idle-path check — none found.** The two branches are exhaustive (`≥ 3` vs.
`empty / < 3`); owner-decision/blocked items are explicitly excluded from the low-water-mark, so
"only undecided work remains" routes to PRODUCT rather than a hold; and PRODUCT is required to
leave the queue non-empty. One soft note (not an idle path): the separate PM session still owns
**owner intake** (`from-owner` P1 routing) — that dependency remains by design, but it can no
longer *starve* the loop, because PRODUCT is the standing fallback. No follow-up issue required.

## Lessons / process fixes

- **Guidance alone did not prevent this.** The auto-memory literally said "don't idle-wait" and
  the loop idled anyway. In-context guidance lost to the runbook's structure — the consumer-only
  model gave "hold" a home. **Prevention had to be structural**, and now is: the fallback is a
  branch in the protocol, not a reminder.
- **Generalisation for any "never-stop" system: it needs an explicit *productive fallback*, not
  just a ban on stopping.** "Don't stop" with nothing to do next always degrades into idling. The
  durable form is "when you can't do A, do B" — here, "when you can't DELIVER, do PRODUCT."
- **A single-owner prioritization pipeline is a starvation risk.** Any step that is the *sole*
  source of work for a downstream loop must have a fallback the loop can run itself.

## Action items

| Action | Owner | Update which file | Done? |
|--------|-------|-------------------|-------|
| Split the loop into PRODUCT + DELIVERY sub-runbooks; encode THE NEVER-IDLE RULE (empty/thin → PRODUCT, no hold branch) + low-water-mark 3 | Project Manager | `docs/runbook/{LOOP,PRODUCT,DELIVERY}.md` | ☑ (`60523b2`) |
| Mirror never-idle + product/delivery split into the sprint envelope and the headless constitution | Project Manager | `docs/runbook/{LOOP-SPRINT,BOOTSTRAP}.md` | ☑ (`60523b2`) |
| Index the restructure in the runbook changelog | Project Manager | `docs/runbook/CHANGELOG.md` | ☑ (`60523b2`) |
| Verify the fix closes all 4 root causes + scan for residual idle paths | Project Manager | this retro | ☑ (none found) |
| Refill `queue.md` to ≥ 3 READY slices via a PRODUCT cycle (first real exercise of the new branch) | PRODUCT cycle | `studio/comms/queue.md` | ☐ (separate cycle owns it) |

## Notes

- **Owner correction honoured:** the loop now always has something productive to do; a drained
  queue is a PRODUCT trigger, never a hold.
- **Scope of this retro:** docs-only. The restructure was already committed and changelogged; the
  queue refill is owned by a separate PRODUCT cycle and is deliberately not touched here.
- **Prompt-injection:** none encountered; the standing ignore-injection preamble had nothing to
  refuse.
