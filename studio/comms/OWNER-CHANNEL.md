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

## 3. Taking input IN — routing the owner's messages (read it like a person would)

The orchestrator **polls the owner inbox at the start of every cycle** (`owner-channel.sh peek`).
**Don't cold-triage every message into PM-desk** — read each one *in the context of the recent
thread* and route it the way a thoughtful chief-of-staff would. Walk this decision tree top-down and
take the **first** branch that fits:

### 3a. It answers a pending question → route to the asker, execute
If a question is open under **## Pending questions** (asked by the orchestrator or a named agent —
TL / PM / PjM / Game Designer) and this reply answers it, that reply **is** the answer. Route it to
the asker and **execute the consequence now**:
- a decision (e.g. #56 mobile, #58 weather scope) → record it in `studio/comms/decisions.md`, update
  the issue / `queue.md`, queue the now-unblocked work;
- an answer to a PM-desk clarifying question → hand it back to that triage thread and advance it.

Then **clear the row**.

### 3b. It's a reaction / contextual reply to a recent thread → match it and act in that context
Telegram is conversational: a message is often a **reaction, correction, confirmation, or follow-up**
to something the studio *just sent or did* ("yes do that", "no, the other one", "👍", "actually make
it bigger", "that screenshot looks dark"). **Resolve the referent against the recent thread first**
— which release / question / request / screenshot it's reacting to — and act inside that context
(adjust the thing, confirm, continue). Only fall through to 3c/3d if it introduces genuinely new
intent. *Never* treat a clear reply as a brand-new cold ticket.

### 3c. It's an ad-hoc small request → act on it right away (orchestrator does it inline)
A small, clear, low-risk, do-it-now request — a read/inspection, a quick capture, a status check, a
one-step file/git/Chrome action, a tiny reversible tweak — the orchestrator **just does it** and
reports back. **No PM-desk, no issue, no funnel** — that ceremony would be slower than the task.
*Rule of thumb for "small":* reversible, no roadmap/design impact, finishable in one step right now,
and unambiguous. (e.g. "show last 5 commits", "screenshot the live game", "what's the current
version", "bump that copy".) When in genuine doubt about scope or intent, ask one quick clarifying
question over Telegram rather than guessing big.

### 3d. It needs planning → summon the PM and run PM-desk
Anything that **shapes the game or the roadmap** — a feature, a design idea, a non-trivial bug, a
"what if we…", a scope/priority question — needs value + feasibility thinking, so the orchestrator
**dispatches a PM-desk-triage subagent** (briefed with `studio/feedback/PM-DESK.md`); it never
triages this inline. That subagent:
1. **Captures verbatim** to `studio/feedback/inbox/<YYYY-MM-DD-slug>.md`, `status: raw`, adds a
   `REGISTER.md` row, and **confirms capture** over Telegram ("logged as `<id>`").
2. Runs the funnel (clarify → value → **TL-subagent feasibility** → recommend). Needs the owner to
   clarify/decide? It **asks over Telegram** and logs the open question under **## Pending
   questions** — it does **not** block the loop while waiting (momentum: service the interrupt, then
   resume the agenda).
3. On owner acceptance, files the GitHub issue with the **`from-owner` provenance footer** + labels.
   Updates `REGISTER.md` + `docs/ROADMAP.md`.
4. Reports a one-line outcome to the owner and a <10-line summary to the orchestrator.

**Preemption (now also fed by Telegram):** a `from-owner` **P1** that triage files **jumps to the
top of `studio/comms/queue.md`** — owner P1s preempt, then the agenda resumes.

> **The spirit:** be a smart chief-of-staff, not a ticket robot. Pending answer → route it. A reply
> in an ongoing thread → continue that thread. A quick ask → just do it. Something that needs
> planning → summon the PM. Match intent to the lightest path that handles it well.

### Intent cues (help pick the branch)
- *"it sails wrong / it looks broken"* → **bug**. A small visible glitch can be a 3c quick-fix; a
  non-trivial one is a 3d PM-desk item, fast-laned (likely `from-owner` P1).
- *"can it also… / what if…"* → **feature/idea** → 3d PM-desk.
- *"is X on the roadmap / what's next"* → **roadmap Q&A** — answer inline from `ROADMAP.md` + issues +
  `REGISTER.md` (3c), no issue filed.
- *"do X next / stop doing Y / re-prioritise Z"* → **owner steering** — authoritative; act on it and
  confirm. If it just re-orders existing work, do it inline (3c); if it introduces new scope, PM-desk
  it (3d).

---

## 4. The orchestrator's per-cycle comms step (fits the Lean protocol)

Adds **one cheap move** to the front of the lean per-cycle loop (`docs/runbook/LOOP.md` → Lean
orchestrator protocol):

```
0. owner-channel.sh peek                  # any new owner message? route by §3 decision tree:
   ├─ none                                → proceed to the normal cycle
   ├─ answers a pending question          → route to the asker, execute, clear it      (§3a)
   ├─ reaction/reply to a recent thread   → match the referent, act in that context    (§3b)
   ├─ small ad-hoc request                → orchestrator does it inline, reports back   (§3c)
   └─ needs planning (feature/idea/bug)   → dispatch a PM-desk-triage subagent          (§3d)
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
| 2026-06-27 14:46 | Orchestrator/PM | **#56 mobile** — ship the mobile build now or defer? | go / defer |
| 2026-06-27 14:46 | Orchestrator/PM | **#58 weather/day-night** — gentle time-of-day keeping sunny default, or hold off? | gentle-tod / hold |
