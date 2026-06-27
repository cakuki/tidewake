---
id: 2026-06-28-use-cc0-pirate-kit-assets
date: 2026-06-28
type: feature        # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Replaces fully-procedural placeholder art with license-clean CC0 models that already MATCH the sunny low-poly look — raises fidelity with no style break, $0, no new dependency. Ships AND props make the world look made, not prototyped. High value."
feasibility: "Already researched in docs/art-sourcing.md (#55): GLTFLoader is in the import map (no new dep), perf budget has huge headroom (77/130 draws · 85.2k/150k tris), Quaternius + Kenney Pirate Kits are CC0/glTF rated 'Excellent' style fit. Integration contract for the ship is documented (#32: scale ~16, bow→+Z, re-attach userData.flag, procedural fallback). Props are even simpler (static dressing, no flag contract). Add assets/ + CREDITS.md. Effort S–M per asset; QA verifies tone/readability in-engine (art, no TDD)."
decision: "ACCEPT (owner GO 2026-06-28: 'let's start using these models around… start using ships and props'). Ship = existing #32 (greenlit, owner-prioritized). Props = new #—. CC0-only, original silhouettes, CREDITS.md — per CONSTITUTION (public repo)."
issue: "https://github.com/cakuki/tidewake/issues/32 (hero ship, greenlit + from-owner/P2) + https://github.com/cakuki/tidewake/issues/101 (Pirate Kit props)"
assets: []
---

## Raw (owner's words — verbatim, never edited)

> "There are great usable assets sourced in docs/art-sourcing.md let's start using these models around! Create ticket(s) to start using high & excellent fit in style models."

> "Pirate kit has great props we can use. Not only ships. But let's start using ships and props."

## Triage log (newest at the bottom)

- 2026-06-28 — Captured at PM desk. Owner directs us to **start using the CC0 Pirate Kit assets**
  surveyed in `docs/art-sourcing.md` (the #55 research) — specifically the ones rated **high /
  "Excellent" style fit**: **Quaternius Pirate Kit** and **Kenney Pirate Kit** (both **CC0**, glTF).
  Scope is **ships AND props**, not ships alone.
- 2026-06-28 — **PM value + feasibility** (recorded above; feasibility leans on the completed #55
  research, so no fresh TL subagent needed — the loader path, perf headroom, integration contract and
  licensing rules are already documented). **Two work items:**
  1. **Hero ship swap — #32** (already filed, unblocked by #55). Owner has now **greenlit** it →
     treat as owner-prioritized; bump priority. Procedural ship stays as the fallback.
  2. **Pirate Kit props — new issue.** Dress ports/islands/decks with CC0 kit props (jetty/dock,
     barrels, crates, palms, rocks, lanterns, market stalls, flags…). Builds on #32's GLTFLoader +
     `assets/` + `CREDITS.md` pipeline; phased "a few props per loop."
  **Guardrails (CONSTITUTION, public repo):** CC0 (or self-made) only, original silhouettes, never a
  named-franchise lookalike, `CREDITS.md` even though CC0 needs no attribution. status → accepted.
