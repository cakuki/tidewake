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
- 2026-06-27 (#52) — **Performance budget gate (measurement-first)**: `src/perf.js` holds the
  ceilings (`BUDGET`) + pure `checkBudget`/`formatPerf`; `main.js` updates `window.__tidewake.perf`
  (`drawCalls, triangles, geometries, textures, programs, fps, ms`) each frame from `renderer.info`.
  An in-game overlay (`#perf`, toggle **P** / `?perf`, tap-to-dismiss) shows fps·ms·draws·tris for
  on-device measurement. The playtest gate asserts `drawCalls`/`triangles` ≤ budget — **deterministic
  counters, NOT fps** (swiftshader is too slow for an fps floor). Measured current scene: 77 draws,
  ~85.2k tris → ceilings **130 draws / 150k tris** (~70% headroom). Raise the ceiling only with a
  measurement; if a metric blows it, that's the cue for the deferred culling/LOD/instancing work.
- 2026-06-27 (Retro 5 / session wrap) — **Perf gate (#52) is live and asserted.** Playtest now fails
  on a draw/triangle regression (130 draws / 150k tris, ~70% headroom) — deterministic counters, not
  fps. First `src/ui/` component landed (self-tested wind compass, #53) — the UI-component standard
  to follow. Modules now: input/hud/sailing/persistence/ocean/ship/world/wake/ports/economy/renown/
  duel/npc/minimap/bigmap/perf/onboarding/swell + `src/ui/compass.js` + pure physics/swell. Open
  enablers to schedule: **#37** deterministic visual-diff (since cycle 10), **#38** PR-validation CI
  gate (pre-merge tests+playtest, no deploy), **#36** fixed-timestep. Engineering lesson: cycle-
  runners `git add` named paths only — a `git add -A` swept a concurrent docs subagent's files in.
- 2026-06-27 (Research) — **CI gap**: Release runs the playtest gate only post-merge, no PR gate.
  Backlog: lightweight PR-validation workflow (tests + headless playtest, no deploy) with
  `cancel-in-progress: true` to gate trunk pre-merge and save free-tier minutes; deploy
  concurrency stays non-cancelling.
