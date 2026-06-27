# Tech Lead — long-term memory

Durable architecture decisions and engineering lessons. Grows over time; keep entries short.

- 2026-06-27 — **Stack**: plain ES modules + three.js from CDN, **no build step**.
  Modules: `src/main.js` (loop), `ocean.js` (GPU Gerstner waves), `ship.js` (primitive sloop),
  `world.js` (sky dome + islands + fog), `version.js` (stamped by CI).
- 2026-06-27 — **Release pipeline**: `.github/workflows/release.yml` → headless puppeteer
  playtest gate → deploy to GitHub Pages → tag `v0.0.YYYYMMDDHHmmSS`. `concurrency: release`
  serialises deploys. Path filters skip docs/studio.
- 2026-06-27 — **Constraints to defend**: no bundler until it genuinely hurts; keep CPU loop
  cheap (GPU does wave work); horizon haze instead of void-black; mind the 16.6 ms frame budget.
- 2026-06-27 — **First priorities**: keep the playtest gate meaningful as features land;
  plan a clean seam for swapping the primitive ship for real glTF art.
- 2026-06-27 (Retro 1) — **`main.js` is the contention hotspot**: extract a `src/systems/`
  registry so features self-register and `main.js` stays a thin bootstrap + QA hook (#24, P1).
  A thin integration core is what makes parallel dev actually parallel.
- 2026-06-27 (Research) — **Fixed-timestep accumulator + render interpolation** (Fiedler): step
  sim in fixed `dt`, render with `alpha`; gives determinism AND a pure-logic `update(state,dt)`
  that's node:test-able. Instance only repeated meshes (NPC debris/gulls), not the hero hull;
  LOD islands; ECS stays overkill — keep the simple `src/systems/` registry. Determinism unlocks
  a record/replay golden-trace CI gate (wildcard, defer until the loop lands).
- 2026-06-27 (Research) — **CI gap**: Release runs the playtest gate only post-merge, no PR gate.
  Backlog: lightweight PR-validation workflow (tests + headless playtest, no deploy) with
  `cancel-in-progress: true` to gate trunk pre-merge and save free-tier minutes; deploy
  concurrency stays non-cancelling.
