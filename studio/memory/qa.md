# QA — long-term memory

Durable testing lessons, known issues, and regression notes. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: release gate = headless puppeteer playtest
  (`tests/playtest.mjs`) asserting render/sail + no console errors. Live play-test via Chrome MCP.
- 2026-06-27 — **Two-axis verdict**: every build judged on **works** (boots, sails, no errors,
  frame budget) **and** **good** (intended fun + tone present). Both must pass to ship.
- 2026-06-27 — **Gate discipline**: a slice ships only if playtest is green and acceptance met;
  bugs need repro steps + screenshot; smoke-test the live URL after deploy.
- 2026-06-27 — **First priorities**: keep playtest coverage growing with features; build a
  short manual smoke checklist (boot, sail upwind/downwind, orbit camera, version shows).
- 2026-06-27 (Retro 1) — **Headless gate can't see visuals** (swiftshader renders dark; it
  passed the invisible sail #23). The real-browser pass is the visual gate; diff every release's
  gallery shot against the previous one — visual regression is caught by eyes, not by CI.
- 2026-06-27 (Research) — **Diff stable, not strict**: gallery shots flake on AA/DPI, so pin
  viewport + `--force-device-scale-factor=1`, seed RNG/time, shoot a fixed pose, and compare
  with a tolerance (`maxDiffPixelRatio`), not pixel-exact. CSS animations need real-time waits
  (await `transitionend`, or `animations:'disabled'`); `stable` misses fades.
- 2026-06-27 (Research) — **Perf budget = 16.6 ms/frame; judge the 1% low (p99 frame time), not
  average FPS** — micro-stutters hide behind a healthy mean. Sample rAF deltas, assert p99.
- 2026-06-27 (Retro 5 / session wrap) — **Live-QA hygiene (owner's machine + lean context).** ES
  modules cache → a live-browser QA reload **must cache-bust (`ignoreCache`)** or it tests a stale
  bundle. After any live QA, **park the tab on `about:blank`** — a running WebGL render loop heats
  the owner's machine; lean on headless/puppeteer + the perf gate where possible, touch live Chrome
  only for owner-facing *visual* changes. The perf gate (#52) now asserts draw/triangle budgets in
  the playtest — a perf regression fails CI like a functional one. Visual QA + the gallery shot live
  inside the cycle-runner, not the orchestrator (Retro 4 still holds). #37 deterministic visual-diff
  still unbuilt — schedule it.
- 2026-06-27 (Retro 3) — **Coordinate spaces differ**: `port.pos = [x, z]` (2D ground plane),
  ship `state.pos = [x, y, z]` (3D). Autopilot maps `port.pos[0]→x`, `port.pos[1]→z`, ignores `y`.
  Mis-indexing the axis sails to nowhere — use a shared `sailToPort(name)` helper, don't re-derive.
- 2026-06-27 (Retro 3) — **`step()` ≠ wall-clock → CSS fades need real time**: synchronous
  `tw.step()` advances the sim, not the clock, so `#trade.show` opacity reads mid-transition.
  Wait ~600 ms (or `transitionend`) before asserting fade visibility. This produced false bug #30
  (a timing artifact, not a defect) — settle before filing.
- 2026-06-27 (DL#2) — **The deterministic gallery diff (#37) is a solved recipe — stop deferring**:
  Playwright/Pixelmatch 2025 consensus = control time/RNG/input, render a known stable tick, diff with
  a tolerance (`maxDiffPixelRatio` ≈ 0.01–0.02 + small `maxDiffPixels`). Blocker was determinism (#36),
  not tooling (Pixelmatch ≈ one file). Push #36→#37 as a paired enabler.
- 2026-06-27 (DL#2) — **Measure time-to-first-sail; add a real-device pass**: web games die on the
  opening seconds (load < 3 s even on 3G) — gate the boot-to-playable budget like the 16.6 ms frame
  budget. The mobile PWA (#63) needs a device tour (iOS audio unlock, notch/safe-area, touch overlap,
  thermal) the headless gate can't see; owner already caught #66/#75/#77 by phone.
- 2026-06-27 (DL#2) 🔎 **Wildcard — a "golden replay" smoke gate**: once deterministic (#36)+seeded,
  replay a ~30 s `(seed, intent-log)` run in CI asserting final state-trace (flake-free, no GPU) AND the
  end-pose pixel baseline (#37). One fixture catches gameplay + visual regressions; every bug ships as a
  repro replay. → folds into #36/#37.
