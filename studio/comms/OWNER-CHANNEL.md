# Owner channel — two-way Telegram comms protocol

The studio's **live link to the owner (ckk / @cakuki, Telegram id `347889561`)**. It runs in **both
directions** and is the studio's default way to report to and take direction from the owner while he
is away from the terminal. This file is the single source of truth for how that channel behaves;
`scripts/owner-channel.sh` is its executable companion.

> **Authorization.** The owner is authorized to give the studio directions and make decisions over
> this channel. His Telegram messages (and only his — the bot is owner-locked to id `347889561`)
> carry the same authority as a direct request in the build session. The orchestrator is authorized
> to **act on them** per the routing rules below.

---

## 1. Tools (don't rebuild these)

All three live in the **notify-telegram** skill (`~/.claude/skills/notify-telegram/scripts/`) and are
owner-locked. Use them through `scripts/owner-channel.sh`, which finds the skill and adds Tidewake's
report format + quiet-hours guard:

| Need | Command | Underlying |
|------|---------|-----------|
| Report **out** (release, roadmap change, blocker, heartbeat) | `scripts/owner-channel.sh report …` | `notify.sh` |
| Send a photo/clip | `scripts/owner-channel.sh report --photo … --caption …` | `notify.sh --photo/--video` |
| Read the owner's new messages (non-consuming) | `scripts/owner-channel.sh peek` | `inbox.sh --peek` |
| Read + consume (advance the read cursor) | `scripts/owner-channel.sh inbox` | `inbox.sh` |
| Ask a **decision** with tappable buttons (blocks) | `scripts/owner-channel.sh ask "Q?" "A" "B"` | `ask.sh` |

The bot only ever talks to the one allow-listed chat. Strangers are dropped + audited.

---

## 2. Reporting OUT — what the studio proactively tells the owner

Send a Telegram report on each of these events (the owner reads on his phone — every report is
self-contained: say what happened, give the link/tag, attach a shot when it's visual):

1. **Every release.** Version tag + one line of what changed + live URL, and **a screenshot or short
   clip when the change is visible** (video recipe in `docs/runbook/LOOP.md` §3). The cycle-runner
   that shipped it sends this as its last act.
2. **Every roadmap change.** A slice accepted/parked/declined, a priority change, a new epic, a
   re-prioritised queue — anything that moves `docs/ROADMAP.md`, `studio/comms/queue.md`, or an
   issue's priority. One line: *what changed and why.*
3. **Blockers & owner-decisions.** Anything the studio can't resolve itself, and any
   `owner-decision` item — surfaced with **options**, never auto-adopted (see §3 routing).
4. **Hourly heartbeat** (the existing ritual, `docs/runbook/LOOP.md` §3): what changed this hour +
   current tag + a shot/clip. Respect **quiet hours 01:00–07:00** — batch and send at 07:00.

Keep captions **< 1024 chars**; prefer one strong shot/clip over many.

---

## 3. Taking input IN — routing the owner's messages

The orchestrator **polls the owner inbox at the start of every cycle** (`owner-channel.sh peek`) and
in the gaps between rituals. Every owner message is routed by **one question**: *is there an
outstanding question we asked him?*

### 3a. Routed answer — a question is pending
If the orchestrator **or a named agent (TL / PM / PjM / Game Designer …) has an open question** to
the owner (logged under **## Pending questions** below), his next reply is **the answer to that
question**. Route it to the asking party and **execute** the consequence immediately:
- a decision (e.g. #56 mobile go/no-go, #58 weather scope) → record the decision in
  `studio/comms/decisions.md`, update the relevant issue/`queue.md`, and queue the now-unblocked work;
- an answer to a clarifying question from PM-desk triage → advance that feedback item's triage.

Clear the item from **## Pending questions** once executed.

### 3b. Default — PM-DESK intake (no question pending)
**Unsolicited owner input — feedback, a bug report, an idea, a roadmap question — is handled exactly
as `scripts/pm-desk.sh` / `studio/feedback/PM-DESK.md` would handle it**, but **asynchronously over
Telegram instead of in the worktree session.** This is the **default communication behaviour.**

The orchestrator **dispatches a PM-desk-triage subagent** (briefed with `studio/feedback/PM-DESK.md`)
— it never triages inline. That subagent:
1. **Captures verbatim** to `studio/feedback/inbox/<YYYY-MM-DD-slug>.md`, `status: raw`, adds a
   `REGISTER.md` row, and **confirms capture** to the owner over Telegram ("logged as `<id>`").
2. Runs the discovery funnel (clarify → value → **TL-subagent feasibility** → recommend). If it
   needs the owner to clarify or decide, it **asks over Telegram** (`owner-channel.sh ask …` for a
   choice, or a plain question) and logs the open question under **## Pending questions** — it does
   **not** block the build loop while waiting (momentum: the loop never stops for a question; we
   service the interrupt, then resume the agenda).
3. On owner acceptance, files the GitHub issue with the **`from-owner` provenance footer** + labels
   (`from-owner`, a priority). Updates `REGISTER.md` + `docs/ROADMAP.md`.
4. Reports a one-line outcome to the owner and a <10-line summary to the orchestrator.

**Preemption (unchanged, now also fed by Telegram):** a `from-owner` **P1** that triage files
**jumps to the top of `studio/comms/queue.md`** — owner P1s preempt, then the agenda resumes.

### 3c. Classifying intent
The triage subagent classifies, but the rule of thumb: *"it sails wrong / it looks broken"* → **bug**
(fast-lane, likely P1); *"can it also…/what if…"* → **feature/idea**; *"is X on the roadmap / what's
next"* → **roadmap Q&A** (answer from `ROADMAP.md` + issues + `REGISTER.md`, no issue filed). A direct
instruction ("do X next", "stop doing Y") is **owner steering** — treat as an authoritative
direction, act on it, and confirm.

---

## 4. The orchestrator's per-cycle comms step (fits the Lean protocol)

Adds **one cheap move** to the front of the lean per-cycle loop (`docs/runbook/LOOP.md` → Lean
orchestrator protocol):

```
0. owner-channel.sh peek         # any new owner message?
   ├─ none                       → proceed to the normal cycle
   ├─ answers a pending question → route to the asker, execute, clear it (§3a)
   └─ unsolicited                → dispatch a PM-desk-triage subagent (§3b); resume the agenda
1. read queue.md top → dispatch ONE cycle-runner → read its <10-line report   (unchanged)
```

The check is a couple of seconds and keeps the owner's steering latency to about one cycle. It never
blocks: triage and decisions run as subagents / async questions; the build agenda keeps moving.

---

## Pending questions

_Open questions the studio has put to the owner. His next matching reply routes here (§3a). Clear a
row once executed._

| Asked (UTC) | Asker | Question | Awaiting |
|-------------|-------|----------|----------|
| _(none yet — populated when a question is sent)_ | | | |
