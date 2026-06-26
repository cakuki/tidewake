# Tidewake Studio

Tidewake is built and operated by an autonomous **studio** of seven role-agents. They plan
on GitHub Issues, build in small always-working increments, play-test each build in a real
browser, ship several releases per hour, and improve themselves through self-study and
periodic retrospectives. This folder is the studio's operating system.

Start with the **[Constitution](CONSTITUTION.md)** — the shared brief every agent reads first
(vision, tone, roles, conventions).

## How a loop runs

1. **Plan** — Product Manager prioritises the roadmap; Project Manager + Tech Lead refine the
   top slice on GitHub Issues and resolve dependencies.
2. **Build** — Game Designer shapes the fun, Graphic Designer the look, Software Developer
   implements the smallest valuable change, always keeping the game shippable.
3. **Play-test** — QA verifies it on two axes (works + is fun/in-tone) via the headless gate
   and a real browser, and guards the release gate.
4. **Release** — GitHub Actions deploys to Pages and tags `v0.0.YYYYMMDDHHmmSS`.
5. **Improve** — each role studies industry leaders and adopts practices into its own
   definition. Every 3–4 loops, the studio holds a retrospective.

Full step-by-step: **[`docs/runbook/LOOP.md`](../docs/runbook/LOOP.md)**.

## Map

- **[agents/](agents/)** — the seven role definitions (responsibilities, procedure,
  self-improvement, interfaces, Definition of Done):
  [product-manager](agents/product-manager.md) ·
  [project-manager](agents/project-manager.md) ·
  [tech-lead](agents/tech-lead.md) ·
  [software-developer](agents/software-developer.md) ·
  [game-designer](agents/game-designer.md) ·
  [graphic-designer](agents/graphic-designer.md) ·
  [qa](agents/qa.md)
- **[comms/](comms/)** — the file-based agent bus: [board](comms/board.md),
  [decisions](comms/decisions.md), [inbox/](comms/inbox/), and the
  [protocol](comms/README.md).
- **[memory/](memory/)** — each role's durable long-term memory.
- **[retros/](retros/)** — retrospectives and the [template](retros/TEMPLATE.md).

## Principles (from the Constitution)

- **Fun first.** Realistic world; warm, witty, swashbuckling characters.
- **Always shippable.** Tiny increments, frequent releases, never a broken `main`.
- **Original work.** Never reference or imitate a named commercial franchise.
- **Genuine craft.** Self-improvement sharpens the work; it is never manipulative.
- **Owner decisions** (branding/strategy/big architecture) → an `owner-decision` issue,
  never auto-adopted.
