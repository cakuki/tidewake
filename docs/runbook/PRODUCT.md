# Tidewake — PRODUCT sub-runbook (never let the queue run dry)

The studio's **product function**, dispatched as a subagent by the entry loop (`LOOP.md` /
`LOOP-SPRINT.md`). Its one job: **keep `studio/comms/queue.md` stocked with ready-to-build
slices** so the delivery loop never idles. This is the fix for the failure that spawned it —
the loop once finished all decided work and *held for ~2h* because nothing generated new roadmap
(see `docs/runbook/CHANGELOG.md` → 2026-07-01 restructure).

**Roles:** Product Manager (value) + Tech Lead (feasibility/sequencing) + Game Designer (fun shape).
Act as `studio/agents/{product-manager,tech-lead,game-designer}.md`; `studio/CONSTITUTION.md` +
`docs/VISION.md` are canon (north-star: one boat → **feared pirate** or **beloved governor**).

## FUN IS THE FIRST FILTER (PM + GD co-own — see CONSTITUTION → FUN-FIRST)
Before value/complexity/deps, every proposed slice must answer **"what FUN does this deliver?"** —
the concrete player-felt payoff (a beat that's more satisfying, tense, funny, or juicy to *play*),
**signed off by the Game Designer**. No fun answer → don't queue it. **Reject / deprioritise
feature-count-for-its-own-sake** (breadth of new systems that doesn't move the felt experience).
**Bias the batch toward** deepening / juicing / tightening what's *already* fun and toward
**first-session fun** (the opening ~5 min feels good fast). More-features vs. more-fun → **fun.**

## RUNS WHEN (the entry loop decides this — see LOOP.md step 1)
- The queue has **no READY build slice**, OR
- the **READY-slice count is below the LOW-WATER-MARK of 3**, OR
- a light product cadence turn (the loop may run PRODUCT proactively when idle-adjacent).

**A "READY build slice"** = a `queue.md` item that is **buildable right now**: unblocked, **not**
`[OWNER-DECISION]` / `Blocked / held`, with clear acceptance and a named role. Owner-decision and
blocked items **do not count** toward the low-water-mark — the loop can't build them, so if only
those remain, PRODUCT still runs. Refilling **before** the queue empties is the point: cross the
low-water-mark → refill, don't wait for zero.

## What the dispatched PRODUCT subagent DOES
1. **Pull external inspiration** — `WebSearch` current **naval/pirate, age-of-sail, roguelite-sandbox,
   3D-web-game, and competitor/genre** trends + design/retention writing; note 2–4 concrete hooks.
2. **Mine in-repo sources** — `studio/agents/notebooks/*` (R2 deep-reading), `studio/feedback/inbox/*`,
   `docs/VISION.md` + `docs/ROADMAP.md`, the recent `studio/retros/*`, and the reservoir already in
   `queue.md`. These are a rich, under-drained backlog — prefer promoting a strong existing candidate
   over inventing when one already fits.
3. **Synthesize a SMALL batch** (aim 3–5) of **concrete, ORIGINAL, vision-aligned** slices — each the
   *smallest always-working increment* that grows the fantasy, with a one-line player-value +
   a **FUN line (the felt payoff, GD-signed)** + acceptance ("I can now …") and a named runner role.
4. **Sequence** by **value · complexity · dependencies** (TL sizes S/M/L + flags deps; GD names the fun
   beat). Put the highest-leverage unblocked slice on top.
5. **Write them to the TOP of `studio/comms/queue.md`** as READY build slices (in queue format, with an
   `_UPDATE …_` provenance line), and **file GitHub issues** where a slice deserves a tracked ticket
   (`gh issue create`; add acceptance + labels). Keep the queue's existing rules intact (preemption,
   owner-decision, phase-label, standing-rule).

## Guardrails
- **Original work only** — never a named franchise; keep the public surface clean (`VISION.md` pillars).
- **Depth over breadth**; **make the arc reachable before deepening it** — favour reactive verbs (a world
  that responds) over inert content.
- **Strategy / branding / architecture / spend → surface as `[OWNER-DECISION]` options, never auto-adopt**
  (report out via the owner channel; the loop keeps building the rest).
- **Keep the queue always non-empty.** PRODUCT must leave **≥ the low-water-mark of READY slices** on
  top; if genuinely blocked from that, file the smallest safe engine/charm/tech-debt slices from the
  reservoir rather than returning an empty queue.
- Don't build here — PRODUCT **plans and fills**; DELIVERY (`docs/runbook/DELIVERY.md`) builds next cycle.

## Output
A **refilled `queue.md`** (≥3 ready slices on top) + any new issues, and a **<10-line summary** to the
orchestrator: what inspiration was pulled · the slices added (with sizes) · any owner-decision surfaced.
