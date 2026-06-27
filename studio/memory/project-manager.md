# Project Manager — long-term memory

Durable lessons about the loop, flow, and process. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: Loop 0 bootstrapped v0 (playable build + auto-release).
  Studio structure (agents, comms, retros) now in place. Loop 1 plans from GitHub issues.
- 2026-06-27 — **Cadence set**: lean loop, several releases/hour; retro every 3–4 loops via
  `retros/TEMPLATE.md`; runbook lives at `docs/runbook/LOOP.md`.
- 2026-06-27 — **GHA budget reminder**: releases skip on `studio/**`, `docs/**`, `**/*.md`
  changes. Keep loops efficient; don't burn Actions minutes on docs.
- 2026-06-27 — **First priorities**: stand up `board.md` as the live mirror; ensure issue
  labels/priorities exist before Loop 1 planning.
- 2026-06-27 (Retro 1) — **First retro held** (loops 0–3): runbook updated with thin-`main.js`,
  visual-gallery-diff, gameplay-verb-first, and CI-version guardrails. Watch items: `main.js`
  contention (#24), Actions Node-20 deprecation, the no-gameplay-verb product gap.
- 2026-06-27 (Deep-learning research) — **No parallel dispatch across a shared seam without a
  contract artifact both slices assert** (name·shape·owner·consumers recorded before dispatch,
  tiny shared fixture). Lightweight consumer-driven contract testing — directly prevents the
  state-contract integration bug two parallel devs hit. Cap WIP tightest on review/integrate and
  swarm-to-merge before starting new code (Little's Law). Never cancel the retro; cap to 1–2
  experiment-shaped actions with a next-loop check. Wildcard: a `Contracts` board lane.
