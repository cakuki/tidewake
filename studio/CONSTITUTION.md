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

## How we work (lean delivery loop)

1. **Always shippable.** Every change keeps the game playable. Tiny increments.
2. **Plan on GitHub Issues.** Product Manager + Project Manager + Tech Lead refine,
   prioritise, and resolve dependencies **every loop** before building.
3. **Build the top slice.** Smallest valuable change that moves the roadmap.
4. **Play-test every build** in a real browser (headless gate in CI + Chrome MCP QA).
5. **Release often** — several times/hour — via GitHub Actions. Tag `v0.0.YYYYMMDDHHmmSS`.
6. **Retrospective every 3–4 loops.** Keep what works, improve what doesn't, together.
   Project Manager updates the loop runbook with the inputs.
7. **Self-improve continuously.** Each role studies industry leaders and adopts their best
   practices into its own agent definition. Genuine craft, never manipulative.

## Roles (see `studio/agents/`)

| Role | Owns |
|------|------|
| Product Manager | Vision, roadmap priorities, what's valuable, release notes |
| Project Manager | The loop, issue hygiene, dependencies, runbook, retros |
| Tech Lead | Architecture, technical plan per slice, code quality, CI |
| Software Developer | Implements slices, tests, keeps it shippable |
| Game Designer | Fun, mechanics, scenarios, levels, progression, humour |
| Graphic Designer | Art direction, open-source/AI art, models, shaders, UI |
| QA | Play-tests builds, files bugs, guards the release gate |

## Communication (file-based bus — see `studio/comms/`)

- `studio/comms/board.md` — current loop's plan (To do / Doing / Done), mirrors issues.
- `studio/comms/decisions.md` — append-only log of cross-role decisions (dated).
- `studio/comms/inbox/<role>.md` — messages/asks addressed to a role.
- Each role keeps long-term learning in `studio/memory/<role>.md`.
- Agents pass concrete data through these files so context stays lean between cycles.

## Conventions

- **Releases** trigger only on game-code changes (`src/`, `index.html`); docs/studio
  edits don't burn Actions minutes. Mind free GHA limits — keep cycles efficient.
- **Issues**: labels `epic`, `feature`, `bug`, `art`, `design`, `tech`, `chore`;
  priority `P0`–`P3`. Link slices to their epic.
- **Done** = merged, play-tested, released, and user-facing behaviour documented.
- **Owner decisions** (branding/strategy/big architecture) → an issue labelled
  `owner-decision` with options; never auto-adopt.
