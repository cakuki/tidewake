# Tidewake Studio — Constitution

The shared brief every studio agent reads first. Keep it short; link out for detail.

## What we're building

**Tidewake** — an experimental, open **3D age-of-sail pirate adventure** in the browser.
Original work; **never** reference or imitate any specific commercial game/franchise by name.

**North-star fantasy.** You start with a single small boat and rise — by your own choices —
to become either a **feared pirate** or a respected **mayor/governor of an island or city**.
Open-ended; the player carves their own legend.

**Tone & art direction.** Aim for **believable, atmospheric realism** in sailing, sea, light
and world — but keep a **warm, witty, swashbuckling comedy** in characters, dialogue, and
visual charm (expressive, slightly exaggerated, hand-crafted feel). Adventure-game humour
over grim simulation. Fun first.

## FUN-FIRST — our top value (read this before feature-count)

**Tidewake is a GAME. The point is FUN.** Every slice must make the game *more fun to play* —
the felt player experience — not merely add capability. **Playable AND fun are BOTH must-haves:
a feature that works but isn't fun is NOT done.** The **Game Designer owns the fun bar** and can
send a working slice back for lacking it. PM + GD justify every roadmap item by the *fun it
delivers*, never the feature it ships. Prefer **deepening / juicing / tightening what's already
fun** over more new systems. When it's more-features vs. more-fun, **choose fun.**

## How we work (lean delivery loop)

1. **Always shippable.** Every change keeps the game playable. Tiny increments.
2. **Plan on GitHub Issues.** Product Manager + Project Manager + Tech Lead refine,
   prioritise, and resolve dependencies **every loop** before building.
3. **Build the top slice.** Smallest valuable change that moves the roadmap.
4. **TDD for testable logic.** For pure game logic (physics, economy, util), write a failing
   unit test first → implement → green; keep it in small testable modules (`tests/unit/*.test.mjs`,
   `npm test`). The headless playtest stays the integration gate; UI/art/feel are verified by QA.
5. **Play-test every build** in a real browser (headless gate in CI + Chrome MCP QA).
6. **Release often** — several times/hour — via GitHub Actions. Tag `v0.0.YYYYMMDDHHmmSS`.
7. **Retrospective every 3–4 loops.** Keep what works, improve what doesn't, together.
   Project Manager updates the loop runbook with the inputs.
8. **Self-improve continuously.** Each role studies industry leaders and adopts their best
   practices into its own agent definition. Genuine craft, never manipulative.
9. **Deep-learning research loop every 10 cycles.** Each role steps off the line into its **own
   isolated subagent**, does internet research and deep reading in its discipline (new **and**
   classic), and writes what it learned — plus one wildcard idea — back into its own agent and
   memory files. Research only; any resulting build goes through a normal cycle. See `LOOP.md`.
10. **Stay lean (context optimization).** Cycles, retros, and the research loop run **as
    subagents**; the orchestrator persists state to `studio/comms/loop-state.md` and keeps only
    concise summaries in main context.

## Roles (see `studio/agents/`)

| Role | Owns |
|------|------|
| Product Manager | Vision, roadmap priorities, what's valuable, release notes |
| Project Manager | The loop, issue hygiene, dependencies, runbook, retros |
| Tech Lead | Architecture, technical plan per slice, code quality, CI |
| Software Developer | Implements slices, tests, keeps it shippable |
| Game Designer | Fun, mechanics, scenarios, levels, progression, humour |
| Graphic Designer | Art direction, open-source/AI art, models, shaders, UI |
| Sound Engineer | Audio system & SFX: sea ambience, UI/spatial sound, WebAudio mix |
| Musician | Music & adaptive score: shanty-flavoured themes, moods, comic motifs |
| QA | Play-tests builds, files bugs, guards the release gate |

## Communication (file-based bus — see `studio/comms/`)

- `studio/comms/board.md` — current loop's plan (To do / Doing / Done), mirrors issues.
- `studio/comms/decisions.md` — append-only log of cross-role decisions (dated).
- `studio/comms/inbox/<role>.md` — messages/asks addressed to a role.
- `studio/comms/OWNER-CHANNEL.md` — the **two-way owner link over Telegram** (the protocol);
  `scripts/owner-channel.sh` is its entrypoint. The studio **reports out** on every release and
  roadmap change, and **takes input in** each cycle, routed smartly by intent (`OWNER-CHANNEL.md`
  §3): a reply to a pending question → routed to the asker + executed; a reaction/reply in a thread →
  continue that thread; a small ad-hoc request → done inline; **anything needing planning → triaged
  by the PM desk** (`PM-DESK.md`). The owner (**@cakuki**, id `347889561`) is authorized to
  direct/decide over it.
- Each role keeps long-term learning in `studio/memory/<role>.md`.
- Agents pass concrete data through these files so context stays lean between cycles.

## Conventions

- **Releases** trigger only on game-code changes (`src/`, `index.html`); docs/studio
  edits don't burn Actions minutes. Mind free GHA limits — keep cycles efficient.
- **Issues**: labels `epic`, `feature`, `bug`, `art`, `design`, `tech`, `chore`;
  priority `P0`–`P3`. Link slices to their epic.
- **Done** = merged, play-tested, released, and user-facing behaviour documented.
- **Owner decisions** (branding/strategy/big architecture) → an issue labelled
  `owner-decision` with options; surface over the owner channel (Telegram) and **never auto-adopt**.
