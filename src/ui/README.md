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

## Settings panel — registering a feature toggle (`settings.js`, #73)

The settings panel (`src/ui/settings.js`) is the early-phase home for **feature toggles**. It
follows the same standard — pure registry/persistence logic (`resolveOptions` / `serializeOptions`
/ `parseOptions` / `withOption`, unit-tested in `tests/unit/settings.test.mjs`) plus a thin
`createSettings()` factory that owns the ⚙ button + the brass control plate (`#settings-toggle` /
`#settings-panel` in `index.html`) and persists stored toggles to `localStorage` (`tidewake.options`).

**A new toggle is one `register(...)` line in `main.js`, before `settings.init()`:**

```js
// STORED toggle — the panel owns + persists it. Visual/experimental features default OFF so
// the current look stays the default. This is exactly the seam weather/day-night (#58) plugs into:
settings.register({
  id: 'weather',
  label: 'Weather & day-night',
  hint: 'clouds, rain, a passing night — off by default',
  default: false,                       // OFF → the sunny look is the default
  apply: (on) => world.setWeather(on),  // your feature reads this to switch on/off
});
```

Toggle definition fields:

- `id` — stable key used in the save and the `window.__tidewake` hook.
- `label` / `hint` — the row's text (a touch of charm is welcome).
- `default` — value when nothing is saved. **Visual toggles default `false`** (sunny stays default).
- `apply(value)` — called on change **and** at `init()`; drives the wired behaviour.
- `read()` *(optional)* — a **LIVE** toggle whose source of truth lives elsewhere (e.g. `Sound`
  reads `audio.isMuted()`). Presence sets `persist:false` (the home system stores it; we never
  double-store). Omit `read` for a normal **STORED** toggle that the panel persists itself.

The panel opens with the **⚙ button** or the **O** key (Esc closes it). The QA hook exposes
`tw.options`, `tw.setOption(id, bool)`, `tw.openSettings()` / `tw.closeSettings()` so the headless
playtest can drive it. Defaults preserve the current experience: sound as-is, perf overlay hidden.
