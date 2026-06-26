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
