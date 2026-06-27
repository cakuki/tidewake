# UI components — house standard

Each HUD piece is a **self-contained, self-tested component**: a module under `src/ui/`
that owns its own DOM and update logic, with the tricky maths split out as pure functions
so it is verifiable without a browser. The wind compass (`compass.js`) is the pattern-setter
(#53); new HUD pieces follow it, and reviews enforce it.

## The pattern

A component module exports two things:

1. **Pure presentation helpers** — plain functions of explicit inputs → outputs (no DOM,
   no globals). These hold the bearing/threshold/format logic and are unit-tested under
   `node:test` in `tests/unit/<name>.test.mjs`. Example: `windArrowDeg(heading, windDir)`,
   `pointOfSailLabel(heading, windDir)`.

2. **A thin factory** `create<Name>(root)` → `{ update(state) }`:
   - finds/creates its own DOM within `root` (defaults to `document`),
   - returns no-ops if its elements are absent (headless/test-safe),
   - exposes a single `update(state)` called each frame; it just maps state → DOM via the
     pure helpers, and may cache so the hot path only touches the DOM on real changes.

`hud.js` (or `main.js`) constructs the component once and calls `update(state)` per frame —
it does not reach for the component's elements directly.

## Why

The HUD was a ~240-line blob reaching ~20 elements by id off the global state, with no
per-element tests — the class of bug behind the wind-indicator drift (#50). Splitting the
maths out makes each piece independently verifiable and keeps the DOM wiring thin.

## Checklist for a new component

- [ ] `src/ui/<name>.js` with exported **pure** helpers (no DOM/globals).
- [ ] `create<Name>(root) → { update(state) }`; thin DOM wiring, headless-safe.
- [ ] `tests/unit/<name>.test.mjs` covering the pure helpers across states/edges.
- [ ] `npm test` green; `node tests/playtest.mjs` still ✓ (behaviour unchanged).

Future slices (per #53): ledger → trade → duel → arrival toast.
