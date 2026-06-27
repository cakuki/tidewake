# Software Developer — long-term memory

Durable implementation lessons and gotchas. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: v0 source in `src/` (main/ocean/ship/world/version).
  Ship is built from three.js primitives — placeholder for real art later.
- 2026-06-27 — **Workflow**: small branches, tiny PRs, gated by `npm run playtest`
  (puppeteer). Don't hand-edit `version.js` or the version div — CI stamps them.
- 2026-06-27 — **Playtest**: `tests/playtest.mjs` boots a static server + headless Chrome,
  asserts the game renders/sails with no console errors; can keep a screenshot.
- 2026-06-27 — **First priorities**: extend the playtest as behaviour grows; keep modules
  cohesive; eyeball the screenshot for tone, not just "no error".
- 2026-06-27 — **Determinism unlocks tests**: a fixed-timestep accumulator loop (rAF delta →
  accumulator → N×update(DT) → render with alpha) makes the sim hardware-independent and lets
  unit tests assert exact state from a fixed DT/intent sequence. Use Command-pattern intents in a
  thin `input.js` boundary so logic is driven by data, not DOM. (See agents/ Research log.)
- 2026-06-27 (Retro 5 / session wrap) — **As a cycle-runner I now own the whole cycle.** Self-ship:
  `git add <named files ONLY>` (NEVER `git add -A` — it swept a concurrent docs subagent's files into
  a slice commit), push, `gh run watch` green, live URL 200; then self-close the issue, append my own
  loop-log row to `loop-state.md`, self-QA (headless playtest + perf gate; gallery shot only for real
  visual changes), report <10 lines. Latest build: 229 tests; `src/ui/compass.js` is the first
  self-tested UI component — mirror it for new UI. Perf budget asserted by the gate (don't blow
  draws/tris without re-measuring `src/perf.js` ceilings).
- 2026-06-27 — **Scaling levers when needed**: keep three.js objects "humble" (draw-only, no
  branching); push spawn/collision/score into pure modules. For many identical props use one
  InstancedMesh (1 draw call, cull via `.count`, share materials); watch `renderer.info.render.calls`.
