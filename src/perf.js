// Performance budget (#52) — measurement-first.
//
// The GPU in CI is swiftshader (software), so raw FPS there is meaningless. The reliable,
// GPU-independent signals are the renderer's own bookkeeping: how many draw calls and
// triangles the scene costs per frame, plus geometry/texture/program counts. Those are
// DETERMINISTIC — identical on a software rasteriser and a real GPU — so they make a
// trustworthy CI gate. FPS/ms are still surfaced for on-device measurement by the owner.
//
// BUDGETS are ceilings, not targets: set just above the *measured* current scene cost with
// headroom, so today's scene passes comfortably while a future change that explodes the
// cost (un-instanced islands, a runaway particle system, a fat new fleet) trips the gate.
//
// Measured current scene (2026-06-27, headless 1280x800, sailing): 77 draw calls,
// ~85,200 triangles. Ceilings below sit ~70% above that, leaving room for a few more
// systems before we must reach for the optimisations (InstancedMesh / LOD / lean shaders)
// this issue defers — while still tripping on a change that genuinely explodes the cost.
export const BUDGET = {
  drawCalls: 130,    // measured 77 → ~69% headroom before instancing is forced
  triangles: 150000, // measured ~85k → ~76% headroom for a denser archipelago / more vessels
};

// Pure budget check (unit-tested): given a perf snapshot and a budget, report whether every
// metric is within its ceiling and list any that aren't. Order-independent, side-effect free.
export function checkBudget(perf, budget = BUDGET) {
  const violations = [];
  for (const key of Object.keys(budget)) {
    const value = perf?.[key];
    if (typeof value === 'number' && value > budget[key]) {
      violations.push({ metric: key, value, ceiling: budget[key] });
    }
  }
  return { ok: violations.length === 0, violations };
}

// Heat-aware device-pixel-ratio cap (#63, mobile). Rendering a per-vertex Gerstner ocean at
// full 3x retina cooks a phone (the #62 device-spike / #56 feasibility finding: "pixelRatio
// cap 2 heavy on 3x phones"). On a coarse-pointer (touch) device we cap the backing-store
// resolution lower so the GPU draws far fewer fragments — visibly identical on a small screen,
// dramatically cooler. Desktop keeps the crisp 2x cap. Pure + unit-tested: no DOM, no globals;
// main.js passes it `window.devicePixelRatio` and whether the device is coarse-pointer.
export const DPR_CAP_DESKTOP = 2;
export const DPR_CAP_TOUCH = 1.5;
export function pixelRatioCap(dpr, coarse = false) {
  const ratio = typeof dpr === 'number' && dpr > 0 ? dpr : 1;
  return Math.min(ratio, coarse ? DPR_CAP_TOUCH : DPR_CAP_DESKTOP);
}

// Pure formatter (unit-tested): one-line overlay text from a perf snapshot. Kept here so the
// overlay and any logging share one phrasing, and so it's testable without a DOM.
export function formatPerf(perf) {
  const n = (v) => (typeof v === 'number' ? v : 0);
  return `${n(perf.fps)} fps · ${n(perf.ms).toFixed(1)} ms · ${n(perf.drawCalls)} draws · ${n(perf.triangles).toLocaleString()} tris`;
}
