# Tidewake PM Desk — design spec

**Date:** 2026-06-27
**Status:** Approved (owner: ckk)
**Topic:** Owner/stakeholder feedback intake + PM→TL triage pipeline

## Problem

The owner (ckk) needs a durable channel to send feedback, feature requests, and bug
reports (some with screenshots) into Tidewake's autonomous studio — **without that input
being acted on immediately**. Input should be intaked by a Product Manager, evaluated with
industry discovery methods (desirability/value, plus feasibility via the Tech Lead),
refined, and only then turned into a prioritised ticket on the roadmap.

The studio already has the right shape for this: GitHub Issues are the source of truth for
work items, the PM owns `docs/ROADMAP.md`, and the PM agent already studies Cagan /
Torres / Ries discovery frameworks. The PM's interface even notes *"← everyone: ideas/risks
surface to PM inbox; PM folds them into the roadmap."* What's missing is a dedicated **front
door** that holds raw owner input *before* it is allowed to become work, and an interactive
way to triage it.

## Solution overview

A standing **"PM desk"**: a launcher script opens a separate, pre-prompted Claude session
that role-plays the Product Manager. The owner brings feedback (text + image paths); the desk
interviews them, assesses value/desirability, dispatches a **Tech Lead subagent** for a
feasibility read, and — only on the owner's explicit confirmation — refines accepted items
into GitHub issues placed on the roadmap. The owner can also ask roadmap questions
("is X planned?").

The session is the **interface**; markdown files under `studio/feedback/` are the **durable
memory**, so each launch resumes prior state and the autonomous loop's PM/TL see the results.
The desk runs in its **own git worktree** so it never collides with the running build loop.

### Key decisions (locked with owner)

1. **Front door = file-based intake → GitHub issue.** Raw feedback lives as files; only
   ACCEPTED items become refined GitHub issues. Raw input stays separate from the work
   tracker until it earns a ticket (the "don't act yet" gate).
2. **Interaction = interactive PM chat**, launched by a script, isolated from the main loop —
   not a passive drop box. It can and should ask clarifying questions.
3. **TL involvement = in-session Tech Lead subagent.** When an item needs feasibility, the
   desk dispatches a subagent briefed from `studio/agents/tech-lead.md` that reads `src/` and
   returns effort (S/M/L) + risk + approach. The owner leaves one sitting with a refined,
   feasibility-checked ticket.
4. **Isolation = dedicated git worktree** (`tidewake-pm` at sibling path `../tidewake-pm`, on
   branch `pm-desk`). Feedback/roadmap edits merge back to `main`; GitHub issues are global.
5. **Ticket output = real GitHub issues** created via `gh` on the owner's confirmation (not
   staged drafts), since Issues are already the source of truth.

## Components

| # | Artifact | Purpose | Author |
|---|----------|---------|--------|
| 1 | `scripts/pm-desk.sh` | Launcher: ensure the `../tidewake-pm` worktree exists on branch `pm-desk` synced from `main`, `cd` in, launch `claude` with an opening prompt that loads the desk manual and greets the owner. | new |
| 2 | `studio/feedback/PM-DESK.md` | The desk's operating manual (persona + protocol + guardrails). The behavioral spec the session reads on launch. | new |
| 3 | `studio/feedback/REGISTER.md` | Pipeline index of every item + current status (analogous to `comms/board.md`). | new (desk maintains) |
| 4 | `studio/feedback/inbox/<id>.md` | One file per raw item: owner's words captured verbatim + image links + triage notes. | desk |
| 5 | `studio/feedback/assets/` | Screenshots / images brought by the owner. | owner/desk |
| 6 | `studio/feedback/TEMPLATE.md` | Item template with status frontmatter. | new |
| 7 | `studio/feedback/README.md` | Short explainer of the channel + how to launch the desk. | new |
| 8 | edits to `studio/agents/product-manager.md` + `studio/comms/README.md` | Register the channel so the loop's PM knows the desk exists and reads accepted items. | edit |

## Data model

### Item file (`studio/feedback/inbox/<id>.md`)

`<id>` format: `YYYY-MM-DD-<slug>` (e.g. `2026-06-27-fog-too-thick`).

Frontmatter:

```yaml
---
id: 2026-06-27-fog-too-thick
date: 2026-06-27
type: bug | feature | idea | feedback
status: raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: ""          # PM desirability/value note, set at `assessed`
feasibility: ""     # TL subagent verdict: effort S/M/L + risk, set at `assessed`
decision: ""        # accept rationale / park reason / decline reason
issue: ""           # GitHub issue URL once `accepted`
assets: []          # paths under studio/feedback/assets/
---
```

Body: the owner's verbatim words, then an appended **triage log** (clarifying Q&A, PM
assessment, TL feasibility summary, decision) — newest at the bottom.

### Pipeline states

```
raw → triaging → needs-clarification → assessed → accepted (#issue) / parked / declined
```

- **raw** — captured, untouched. The owner's "don't act yet" guarantee.
- **triaging / needs-clarification** — PM is interviewing the owner.
- **assessed** — has a `value` note (PM) and a `feasibility` note (TL subagent).
- **accepted** — owner confirmed → GitHub issue created (labels `from-owner` + priority +
  epic), `issue` set, item added to `docs/ROADMAP.md`. The issue is the refined ticket.
- **parked / declined** — logged with a one-line `decision` reason. Nothing is silently
  dropped or deleted; raw capture is preserved, only `status` advances.

## Desk session flow

1. On launch, greet the owner and show the REGISTER (open items + statuses).
2. Owner dumps feedback (pastes text, drops image paths). Each becomes a **raw** item
   immediately, captured verbatim.
3. Per item, in order:
   a. Clarifying questions → `triaging` / `needs-clarification`.
   b. PM value/desirability assessment → write `value`.
   c. Dispatch **Tech Lead subagent** (briefed from `studio/agents/tech-lead.md`, reads
      `src/`) for feasibility → write `feasibility`. Item → `assessed`.
   d. Propose accept / park / decline with rationale.
4. On the owner's **explicit yes**, create the GitHub issue + roadmap entry; item →
   `accepted`. Final priority logged for PM+TL sign-off.
5. Roadmap Q&A available anytime ("is X planned?", "what's the next P0?").

## Guardrails (enforced by PM-DESK.md)

- **Never writes game code; never runs the build loop or CI.** The desk only touches
  `studio/feedback/`, `docs/ROADMAP.md`, and GitHub issues.
- **Nothing becomes a ticket without the owner's explicit confirmation** — the core gate.
- **Raw capture is verbatim and never deleted** — only `status` advances.
- Park/decline always carries a one-line reason.

## Isolation mechanics

- Worktree `../tidewake-pm` on branch `pm-desk`. The desk commits feedback/roadmap changes
  there and merges to `main` so the loop's PM/TL see them. GitHub issues are branch-independent.
- The desk's paths (`studio/feedback/`, `docs/ROADMAP.md`, `studio/` docs) **do not trigger
  CI** — releases fire only on `src/` + `index.html` changes — so the desk is release-minute-free.
- **Known edge:** both the loop's PM (on `main`) and the desk (on `pm-desk`) can edit
  `docs/ROADMAP.md`, risking a merge conflict. Low frequency; resolved at merge. The launcher
  rebases `pm-desk` onto `main` at startup to minimise drift.

## First run

The owner's several waiting inputs (some text, some with screenshots) are the first session's
job: bring them in, walk each through the funnel, and seed the REGISTER.

## Out of scope (YAGNI)

- No web UI / form. The chat + files are the interface.
- No automatic acceptance or auto-ticketing — confirmation is always manual.
- No changes to the autonomous loop's build/release mechanics.
- No notification/integration plumbing (Telegram, etc.) in v1.

## Testing

- `scripts/pm-desk.sh` is exercised manually: running it creates/reuses the worktree on
  `pm-desk`, syncs from `main`, and launches the session pointed at `PM-DESK.md`. A `--check`
  / dry-run path validates worktree setup without launching `claude` (asserted in a small
  shell test).
- The feedback data model is validated by a tiny check that `TEMPLATE.md` frontmatter parses
  and that REGISTER stays consistent with `inbox/` item statuses (lightweight script test).
- The desk's behavior (intake, triage, guardrails) is governed by `PM-DESK.md` prose; its
  correctness is verified by a first real session with the owner rather than automated tests.
