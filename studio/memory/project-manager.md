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
- 2026-06-27 (Retro 5 / session wrap) — **Owner ask = keep the orchestrator LEAN so loops after a
  compact are cheap.** Adopted the **Lean orchestrator protocol** (`LOOP.md`): per cycle = read
  `studio/comms/queue.md` top → dispatch ONE self-sufficient cycle-runner → read its <10-line report.
  **Cycle-runners own ALL bookkeeping** (commit *specific files* — never `git add -A` — push, verify
  CI, close the issue, append their own loop-log row, self-QA). New `queue.md` is the post-compact
  starting point. Session lessons baked in: no docs-subagent concurrent with a `git add -A` runner;
  re-dispatch 0-tool-use glitches; live QA only for owner visuals (cache-bust, park tab on
  about:blank); rituals run as scheduled subagents. **DL loop #2 is ~18 cycles overdue** — schedule
  it. Block 20–26: 7 clean slices, all owner P1/P2s same-session, 229 tests.
- 2026-06-27 (Retro 4) — **The core fantasy arc is COMPLETE** (two poles #45 → crowned a legend
  #46). Priorities flip with a finished spine: **tune it to be reachable before deepening it,
  prefer depth over breadth** (the ~12,800 legend grind is unreachable in a ~4.45-min web session).
  Three process fixes: (1) the **cycle-runner's QA step owns the Chrome-MCP gallery capture + diff**
  — keep visual QA out of the orchestrator's context; (2) the **Game Designer owns a per-block
  balance/tuning pass** — the arc shipped un-tuned because no one owned the fun-numbers; (3)
  **from-owner P1 bugs jump the feature queue**. PM Desk (#44) works — owner filed 8 issues
  immediately. Deep-learning loop #2 is due. Next: #57 tune curve → #58 weather → #59 cannon combat.
- 2026-06-27 (DL#2) — **AI amplifies what you already are (DORA 2025)**: AI lifts throughput but raises
  instability where foundations are brittle. For an AI-run studio, process IS the moat — keep the headless
  gate, perf budget, clean-tree rule, and serialised merges strong; they turn cheap codegen into safe
  delivery.
- 2026-06-27 (DL#2) — **"Rework rate" is the metric we lacked**: DORA's new 5th metric = unplanned fixes
  to prod. Our proxy = from-owner bugs / fix-forwards shortly after a release; a spike means we're
  outrunning the gate. The integration queue (Ready-for-review/Integrating, cap ~1–2) is still the
  constraint — protect serialised merges + push the #38 pre-merge gate.
- 2026-06-27 (DL#2) 🧩 **Wildcard — a "rework-rate" tile in the loop log**: per release, note whether a
  from-owner bug / fix-forward followed within ~N cycles. A rising count is the DORA AI-era early-warning
  that throughput is outrunning quality — one-glance health, zero new tooling. → noted (process).
- 2026-06-28 (DL#3) — **The mode system (#95) is a 1→N keystone enabler, not a peer slice — flow-manage
  it like a Thinnest Viable Platform (Team Topologies).** Five concrete rules: (1) freeze #95's mode
  contract (enum · enter/leave API · pause-vs-continue · `__tidewake.mode`) as a one-line board entry +
  shared assertion, and **gate #67/#96/#94/#100 on #95 being merged** (DL#1's shared-contract rule
  generalised 2-peer→1→N — the batch's top collision risk). (2) Add a **mode-transition coverage gate**
  to the headless playtest (sailing→town→sailing→battle→sailing, zero console errors, `mode` resolves
  each hop) — instability hides in seams the gate never visits. (3) **Cap modes-in-flight at ONE** —
  ship a mode end-to-end+tuned before opening the next (Little's Law on the mode axis; a half-built mode
  is the costliest WIP). (4) **Return-to-sailing restore check** in the mode visual DoD (leaving restores
  prior view/HUD/audio bed, the #58 byte-for-byte trick) — guards cross-mode state leak (#66/#96 class).
  (5) **Fire rituals at mode boundaries, not mid-keystone.** 🧩 Wildcard: **mode-tagged rework tile** —
  tag from-owner bugs by mode; the rising one is the next hardening target.
