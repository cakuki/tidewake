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
- 2026-06-27 (DL#2) — **WebGPU is shippable as an opt-in, fallback-guarded renderer, not a rewrite**:
  r171 `three/webgpu` auto-falls back to WebGL2; Safari 26 (Sep 2025) closed the gap. Wins 2–10× only in
  draw-call/compute-heavy scenes — at our ~77-draw scale it can be *slower*. Keep the render path
  renderer-agnostic; treat WebGPU as a future spike behind a capability check.
- 2026-06-27 (DL#2) — **Batching isn't free; the main thread is the real mobile budget**: BatchedMesh
  can regress (mixed/unbatched, Android/WebGPU) — profile vs #52 before adopting. OffscreenCanvas + a
  Web Worker (render or sim off main thread) is the structural fix for mobile jank/heat that #63's DPR
  cap only softens; pairs with fixed-timestep #36.
- 2026-06-27 (DL#2) — **DORA 2025: AI amplifies throughput AND instability** (new "rework rate" metric)
  where foundations are weak. Our gate + perf budget + clean-tree are the moat; push #38 (pre-merge gate).
- 2026-06-27 (DL#2) ⚙️ **Wildcard — a renderer-adapter seam + OffscreenCanvas spike**: a tiny boundary
  so nothing imports a concrete renderer makes both a WebGPU A/B and a worker render-move mechanical;
  free to design now while the engine is small. → filed (WebGPU spike + OffscreenCanvas spike).
- 2026-06-28 — **Battle system #135 is the focused M6 lane (owner-chosen): Option 2 → then Option 4,
  small slices.** Engineering shape: it **rides the #95 mode-switch infra** (enter/leave battle, NPCs
  keep sailing); **reuse `cannons.js` (damage/morale) and `duel.js` (insults)** — don't rebuild. The
  *new surface* is the **real-time battle camera + in-combat steering arena** (Option 2 slice 2):
  keep it **behind the mode switch and perf-budgeted (#52)** — it's the riskiest perf addition. Keep
  `cannons.js`'s turn-exchange as the **NPC-vs-NPC auto-resolver** (no rewrite). Slice order: shell →
  broadside → workshop loadouts/ammo cycle → boarding→brawl→duel → 50+ insults. Option 4 later =
  phase-coupling state (hull→boarding odds, casualties→duel confidence) + per-phase UI across M6/M7.
- 2026-06-28 — **Delivery doctrine (owner) binds engineering:** every slice needs a **machine-testable
  outcome or a human-in-the-loop** gate (only the owner for now) — extend the play-test gate to assert
  each battle slice; and a standing duty to **improve the loop/process itself**, not just code. BAU
  bug/UI fixes continue. **Lane-switch gate:** don't pivot off battle to another lane until it ships
  something impressive + gamer-testable (PM calls it).
