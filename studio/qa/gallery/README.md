# QA Gallery — visual regression baselines

One **representative screenshot per release**, archived here for release-over-release visual
comparison. This is QA's baseline set: each loop, QA opens the previous release's image
alongside the new build's shots and asks "**better, or at least not worse?**" (see
`../RUBRIC.md`).

## Convention
- **One image per release**, named by its version tag: `v0.0.YYYYMMDDHHmmSS.png`.
- Use the most representative shot of the set (usually **sailing at speed with wake visible**)
  so the same view is comparable across releases.
- Capture in a real browser via **Chrome DevTools MCP** (`take_screenshot`) — the headless
  renderer draws the 3D scene dark and isn't suitable for baselines.
- Don't overwrite old images; the history *is* the regression record.

## How it's used
1. QA captures the new build's screenshot set.
2. QA compares against the latest `v0.0.*.png` here and scores with `../RUBRIC.md`.
3. Any regression → a `bug` issue with both images attached; consider blocking the release.
4. On a clean release, QA adds today's representative shot as `v0.0.<tag>.png`.
