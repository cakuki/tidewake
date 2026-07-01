# Tidewake — Loop Runbook (lean entry, interactive `/loop`)

The operating spec for the **never-stopping** studio loop. This entry file is **orchestration + the
never-idle rule only**; the *how* lives in two sub-runbooks the orchestrator passes by REFERENCE:
- **`docs/runbook/PRODUCT.md`** — PM + TL + Game Designer fill the queue from external inspiration.
- **`docs/runbook/DELIVERY.md`** — the full cycle-runner contract (build → gates → ship → bookkeep).

Both are **FUN-FIRST** (CONSTITUTION → FUN-FIRST): PRODUCT filters every slice by the fun it delivers;
DELIVERY ships only if it's playable **AND** more fun. Working-but-not-fun is not Done.

<!-- BEGIN owner-doctrine 2026-07-01: Definition of Done — ship the FUN beat (additive; do not remove) -->
> **Definition of Done — Working ≠ done — ship the FUN beat (owner, 2026-07-01).** Every slice delivers
> a **visible/felt player payoff** — you can **see it** (projectiles, VFX, the purchased thing actually
> appears/changes), **hear it** (an audible cue), and **feel the progression** (a purchase visibly
> changes something). A mechanic with **no visible feedback is INCOMPLETE** — a green gate alone is not
> done. Cross-check every slice against [`docs/design/what-makes-it-fun.md`](../design/what-makes-it-fun.md)
> (its per-slice FUN checklist). This is **additive** to the existing DoD — do not drop any existing item.
<!-- END owner-doctrine 2026-07-01 -->

**Companion files carry the rest — passed by REFERENCE, never inlined:** `studio/CONSTITUTION.md`
(vision · roles · tone), `studio/comms/OWNER-CHANNEL.md` (release reporting OUT only; inbound
owner/PM input is a SEPARATE session, not the loop), `studio/comms/queue.md` (next-slice queue),
`studio/comms/rituals.md` (daily ritual clock), `studio/comms/loop-state.md` (resume brain),
`studio/agents/<role>.md` (role identities). **History → `docs/runbook/CHANGELOG.md` +
`studio/retros/*` + `studio/comms/decisions.md`.**

## THE ONE RULE — orchestrate, don't execute (this is why the loop stays lean)
The **orchestrator never does loop work in its own context.** Planning, building, QA, triage, retros,
research — **all of it runs inside subagents** (the `Agent` tool). The orchestrator only: checks the
queue, **dispatches a subagent**, reads a **<10-line summary**, repeats.
- **Knowledge goes by REFERENCE, never inlined.** A dispatch brief is ~6–10 lines of *pointers* (issue
  #, files to read, "follow PRODUCT.md / DELIVERY.md"). The **subagent reads the deep detail itself**.
- **Red flags you're breaking the rule (STOP if you catch any):** reading an issue body, source, a
  screenshot, or an `agents/*.md` file *in the main thread*; a brief longer than ~10 lines; doing a
  commit / playtest / build / WebSearch yourself. All of that belongs in a subagent.
- **Always dispatch via `Agent`** — even a "small" change is still a subagent; main stays clean.

## THE NEVER-IDLE RULE (read this twice)
**The loop NEVER holds, no-ops, or idles. If there is nothing to DELIVER, it does PRODUCT work.**
Owner decisions are **surfaced via the owner channel but NEVER block the loop** — the loop keeps
building everything that *isn't* waiting on the owner. An empty or thin queue is not a stopping
condition; it is a trigger to **generate roadmap from external inspiration**.
> _What went wrong once (2026-07-01):_ the loop finished all decided work and **idled ~2h** because the
> runbook had a delivery-consumer model with no product-generation function. Encoded away here — see
> `docs/runbook/CHANGELOG.md` + the latest retro. Holding is never a valid state.

**LOW-WATER-MARK = 3 READY build slices.** A "READY" slice is buildable now: unblocked, **not**
`[OWNER-DECISION]` / `Blocked`. Refill *before* zero, not at it.

## Per-cycle protocol (the orchestrator's WHOLE job — keep it tiny)
0. **Ritual check** — read local Berlin time + `studio/comms/rituals.md`. A ritual **due today** (day
   matches, **Last ran ≠ today**) **preempts** this cycle → dispatch that ritual, update **Last ran**,
   done. (Run-late not skip; one ritual/cycle; a `from-owner` P1 atop `queue.md` preempts even a ritual.)
1. **Queue check → DELIVER or PRODUCT:**
   - **IF `queue.md` has a READY build slice AND the READY count ≥ 3** → **run DELIVERY**: dispatch ONE
     cycle-runner per `docs/runbook/DELIVERY.md` (its dispatch template + cycle-runner contract).
   - **IF the queue is EMPTY or the READY count is < 3** → **run PRODUCT**: dispatch PM + TL (+ Game
     Designer) per `docs/runbook/PRODUCT.md` to refill the roadmap from external inspiration. **The next
     cycle builds what PRODUCT just queued.** (Never idle — this branch is why.)
2. **Read the subagent's <10-line summary and move on** — don't hold the transcript; don't edit
   `loop-state.md` (the runner appends its own loop-log row). Repeat.

Stop **only** when the owner says stop. Survives compaction via `loop-state.md` + `queue.md`. Self-paced
via `/loop`: check → dispatch (DELIVER or PRODUCT) → read → schedule next.

## Comms (detail in `OWNER-CHANNEL.md`)
Report OUT on every release + roadmap change (a PRODUCT refill is a roadmap change — report it); the
hourly heartbeat is a **skippable digest**; quiet hours **01:00–07:00** suppress both; captions < 1024
chars. **Video:** ~16–24 *real* frames @1280px q90, `ffmpeg -framerate 12 … libx264 -crf 18 -pix_fmt
yuv420p +faststart`, **no `minterpolate=mci`**, < 15 MB. The loop never polls Telegram for input — a
separate PM session handles inbound and writes `from-owner` P1s to the top of `queue.md`.

## The two sub-runbooks (don't inline them here)
- **`docs/runbook/PRODUCT.md`** — RUNS WHEN the queue is empty or below the low-water-mark: PM + TL +
  Game Designer pull external inspiration (WebSearch + notebooks + inbox + VISION/ROADMAP + retros) →
  synthesize original, vision-aligned slices → sequence → write to the top of `queue.md` + file issues.
- **`docs/runbook/DELIVERY.md`** — the cycle-runner contract (clean-tree, smallest increment, creative
  spark, TDD, gates, `git commit -o`, CI + live 200, bookkeeping, self-QA, report out), concurrency &
  isolation, the dispatch template, and the role-file picker.
