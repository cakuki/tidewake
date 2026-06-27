# Studio comms — the file-based agent bus

Tidewake's agents coordinate through plain files in this folder. No chat history to replay,
no shared mutable state to fight over: each role reads what's addressed to it, writes concrete
data down, and moves on. This keeps every agent's context **lean** between cycles — a role
loads its agent definition, its memory, its inbox, and the board, and that's enough to act.

## The files

| File | Purpose | Who writes |
|------|---------|-----------|
| `board.md` | The current loop's kanban — mirrors GitHub issues. | Project Manager (others read) |
| `decisions.md` | Append-only log of cross-role decisions, newest first, dated. | Any role, on a real decision |
| `inbox/<role>.md` | Messages and asks addressed to one role. | Any role → that role |
| `../feedback/` | Owner feedback intake + PM-desk triage pipeline (separate session). | Owner + PM desk |
| `../memory/<role>.md` | A role's durable long-term memory. | That role only |

GitHub Issues remain the source of truth for *work items*; `board.md` is the loop-local mirror.
`decisions.md` is the source of truth for *why* we did things.

## How roles pass data (so context stays lean)

- **Hand off concrete data, not conversation.** Put the numbers, file paths, acceptance
  criteria, and decisions *in the message* — the receiver shouldn't need to reconstruct context.
- **One concern per message.** Keep it skimmable; link to the issue/PR for detail.
- **Decisions go to `decisions.md`, not buried in an inbox.** Inboxes are transient; decisions persist.
- **Durable lessons go to your `memory/<role>.md`.** Inboxes are for *this* loop.
- **Reference repo files as full `github.com/cakuki/tidewake/blob/main/...` links** when they
  need to be portable; local paths are fine for in-repo agents.

## Inbox message format

Append messages to `inbox/<role>.md` as entries, newest at the bottom of the current loop:

```
### 2026-06-27T14:30Z — from: tech-lead — to: software-developer
**Subject:** Wind-vector API for the sailing slice
Use `world.getWind()` returning a normalised THREE.Vector2. Throttle scales 0–1.
Acceptance: downwind speed ≥ 1.6× upwind. Files: src/ship.js, src/main.js.
Links: #42 (issue), docs/runbook/LOOP.md
```

Fields: **timestamp** (UTC), **from**, **to**, **subject**, **body** (the concrete data),
and **optional links** (issues, PRs, files). Mark handled items `✅ done` or clear them at
loop close; keep inboxes short.
