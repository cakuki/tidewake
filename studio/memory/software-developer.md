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
- 2026-06-27 — **Scaling levers when needed**: keep three.js objects "humble" (draw-only, no
  branching); push spawn/collision/score into pure modules. For many identical props use one
  InstancedMesh (1 draw call, cull via `.count`, share materials); watch `renderer.info.render.calls`.
