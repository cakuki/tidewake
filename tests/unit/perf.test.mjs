import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUDGET, checkBudget, formatPerf } from '../../src/perf.js';

test('BUDGET ceilings sit above the measured current scene cost', () => {
  // Measured 2026-06-27: 77 draw calls, ~85.2k triangles. Ceilings must leave headroom.
  assert.ok(BUDGET.drawCalls > 77, 'draw-call ceiling should clear the measured 77');
  assert.ok(BUDGET.triangles > 85200, 'triangle ceiling should clear the measured ~85.2k');
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
