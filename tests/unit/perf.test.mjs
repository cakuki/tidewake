import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, checkBudget, formatPerf, pixelRatioCap, DPR_CAP_DESKTOP, DPR_CAP_TOUCH, isMeasuredFrame } from '../../src/perf.js';

test('BUDGET ceilings sit above the measured current scene cost', () => {
  // Measured 2026-06-27: 77 draw calls, ~85.2k triangles. Ceilings must leave headroom.
  assert.ok(BUDGET.drawCalls > 77, 'draw-call ceiling should clear the measured 77');
  assert.ok(BUDGET.triangles > 85200, 'triangle ceiling should clear the measured ~85.2k');
});

// #107 perf-flake guard: a measured frame is one that actually drew something. updatePerf
// latches counters only from measured frames so a throttled/empty headless paint (drawCalls 0)
// can't clobber a good reading down to 0 and spuriously trip the "perf counters unpopulated" gate.
test('isMeasuredFrame: a frame that drew something is a measurement', () => {
  assert.equal(isMeasuredFrame({ calls: 35, triangles: 85114 }), true);
  assert.equal(isMeasuredFrame({ calls: 1, triangles: 12 }), true);
});

test('isMeasuredFrame: an empty / throttled / missing frame is NOT a measurement', () => {
  assert.equal(isMeasuredFrame({ calls: 0, triangles: 0 }), false, 'an empty paint is not a sample');
  assert.equal(isMeasuredFrame(null), false);
  assert.equal(isMeasuredFrame(undefined), false);
  assert.equal(isMeasuredFrame({}), false, 'no calls field → not a sample');
  assert.equal(isMeasuredFrame({ calls: '35' }), false, 'non-numeric calls → not a sample');
});

test('checkBudget passes when every metric is within its ceiling', () => {
  const r = checkBudget({ drawCalls: 77, triangles: 85200 }, BUDGET);
  assert.equal(r.ok, true);
  assert.deepEqual(r.violations, []);
});

test('checkBudget reports the metric that blows its ceiling', () => {
  const r = checkBudget({ drawCalls: 500, triangles: 85200 }, BUDGET);
  assert.equal(r.ok, false);
  assert.equal(r.violations.length, 1);
  assert.deepEqual(r.violations[0], { metric: 'drawCalls', value: 500, ceiling: BUDGET.drawCalls });
});

test('checkBudget would fail if the budget were set below the current cost (sanity)', () => {
  // A ceiling beneath today's measured cost must trip — proves the gate has teeth.
  const r = checkBudget({ drawCalls: 77, triangles: 85200 }, { drawCalls: 50, triangles: 50000 });
  assert.equal(r.ok, false);
  assert.equal(r.violations.length, 2);
});

test('checkBudget ignores metrics absent from the budget and non-numeric values', () => {
  const r = checkBudget({ drawCalls: 9999, fps: 8, programs: 99 }, { triangles: 100 });
  assert.equal(r.ok, true); // drawCalls/fps/programs not in this budget → not gated
});

test('formatPerf renders a compact one-liner without a DOM', () => {
  const s = formatPerf({ fps: 60, ms: 16.6, drawCalls: 77, triangles: 85200 });
  assert.match(s, /60 fps/);
  assert.match(s, /16\.6 ms/);
  assert.match(s, /77 draws/);
  assert.match(s, /85,200 tris/);
});

test('formatPerf tolerates a partial snapshot', () => {
  assert.equal(formatPerf({}), '0 fps · 0.0 ms · 0 draws · 0 tris');
});

test('pixelRatioCap caps a 3x retina phone lower than desktop (heat guard, #63)', () => {
  // A modern 3x phone: touch path clamps to 1.5, desktop path to 2 — the touch backing
  // store is ~44% fewer fragments per axis, the whole point of the heat guard.
  assert.equal(pixelRatioCap(3, true), DPR_CAP_TOUCH);
  assert.equal(pixelRatioCap(3, false), DPR_CAP_DESKTOP);
  assert.ok(DPR_CAP_TOUCH < DPR_CAP_DESKTOP);
});

test('pixelRatioCap never upscales a low-DPR screen (only ever caps down)', () => {
  // A 1x screen stays 1x on both paths — we clamp the ceiling, never invent resolution.
  assert.equal(pixelRatioCap(1, true), 1);
  assert.equal(pixelRatioCap(1, false), 1);
  // A 1.25x touch screen is below the touch cap → untouched.
  assert.equal(pixelRatioCap(1.25, true), 1.25);
});

test('pixelRatioCap defaults a missing/0/NaN dpr to 1 (never returns 0)', () => {
  assert.equal(pixelRatioCap(undefined, true), 1);
  assert.equal(pixelRatioCap(0, false), 1);
  assert.equal(pixelRatioCap(NaN, true), 1);
});
