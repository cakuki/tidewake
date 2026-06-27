---
id: 2026-06-27-art-asset-sourcing
date: 2026-06-27
type: idea            # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Directly answers a praised feature ('the fights are fun!') — portraits for the 8 duel captains land the comedy pole (warm swashbuckling) right where the owner is already delighted; textures/skybox advance 🌊 realism. The research deliverable is cheap and unblocks a graphic-designer budget decision the owner is ready to make."
feasibility: "TL: report S; act-on S→M per asset class. Game ships ZERO image assets today (all procedural). Options: (a) procedural/CanvasTexture $0; (b) CC0 libs — Poly Haven (HDRI skybox+envMap), ambientCG (PBR surfaces), Kenney (UI), Quaternius (glTF) $0; (c) AI gen (~$10–30/mo seat) best for duel portraits+UI art, paid 3D rough. Hard rule: prefer CC0, original only, never imitate a franchise (incl. AI prompts). First step: S spike — add /assets/, load one CC0 wood texture + HDRI skybox to prove the loader path on the no-build/Pages stack."
decision: "ACCEPT RESEARCH ONLY — owner chose research. PM to deliver cost/effectiveness sourcing report via Telegram; the build (loader spike + assets) follows the owner's budget decision."
issue: "https://github.com/cakuki/tidewake/issues/55"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

The fights are fun! It'd be great to have more images. Let's find a way to generate or source additional images that can be used for the game. We can explore procedural generation techniques or use existing assets from free or paid libraries, ensuring they fit the game's aesthetic and theme. Tell me (over telegram) which sources we can use and how to integrate them into the game (with cost and effectiveness comparison), so I can allocate some more budget for our graphic designer to use external tools.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (bulk dump, paragraph 1 of 5). status: raw. Owner praise noted
  ("the fights are fun!"). Research+delivery ask: source/generate more art assets; deliverable is a
  Telegram report comparing sources (procedural vs free/paid libraries) on cost + effectiveness, to
  inform a graphic-designer tooling budget. Awaiting owner go-ahead before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT as a research deliverable** — PM drafts the
  cost/effectiveness sourcing report and sends it via Telegram for the owner's budget call; the build
  (the S spike + first assets) follows the owner's budget decision. Awaiting owner decision. PM does
  not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept research only**. Issue #55 created
  (https://github.com/cakuki/tidewake/issues/55). status → accepted (research scope). Added to ROADMAP
  (Art & Audio direction). Proposed priority P2 logged for loop PM+TL sign-off. PM to send the sourcing
  report to the owner via Telegram for the budget call.
