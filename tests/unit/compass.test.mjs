// Unit: the wind-compass component's PURE helpers (#53 standard; #50 drift fix).
// No browser — these are plain functions of (heading, windDir). The dial is ship-relative
// (bow up), so the arrow's angle is the wind bearing RELATIVE to heading, normalised to
// (-180, 180] so it stays bounded — and therefore centred — however far `heading` grows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { windArrowDeg, pointOfSailLabel } from '../../src/ui/compass.js';

const TAU = Math.PI * 2;

test('aligned wind reads 0° (arrow up the dial, over the bow)', () => {
  assert.equal(windArrowDeg(0, 0), 0);
});

test('wind off the bow is the wind bearing minus the heading', () => {
  assert.ok(Math.abs(windArrowDeg(0, Math.PI / 2) - 90) < 1e-9);   // wind to starboard
  assert.ok(Math.abs(windArrowDeg(Math.PI / 2, 0) - -90) < 1e-9);  // heading turned, wind now to port
});

test('angle is always normalised to (-180, 180]', () => {
  for (let i = 0; i < 400; i++) {
    const h = (i / 400) * 6 * TAU - 3 * TAU; // sweep far past ±360° of accumulated heading
    const w = (i * 0.137) % TAU;
    const d = windArrowDeg(h, w);
    assert.ok(d > -180 && d <= 180, `out of range: ${d}`);
  }
});

test('does not drift as heading accumulates: full turns are equivalent (#50)', () => {
  const base = windArrowDeg(0.3, 1.0);
  for (const k of [1, 2, 5, -3]) {
    const same = windArrowDeg(0.3 + k * TAU, 1.0);
    assert.ok(Math.abs(same - base) < 1e-6, `k=${k} drifted: ${same} vs ${base}`);
  }
});

test('point-of-sail label/band/colour follow the relative wind angle', () => {
  const running = pointOfSailLabel(0, 0);           // dead downwind
  assert.equal(running.label, 'Running');
  assert.equal(running.band, 'good');
  assert.equal(running.cls, 'pos-good');

  const irons = pointOfSailLabel(0, Math.PI);        // dead upwind
  assert.equal(irons.label, 'In irons');
  assert.equal(irons.band, 'poor');
  assert.equal(irons.cls, 'pos-poor');

  const close = pointOfSailLabel(0, 0.7 * Math.PI);   // near the no-go zone
  assert.equal(close.label, 'Close-hauled');
  assert.equal(close.band, 'fair');
});

test('point-of-sail thresholds are heading-wrap invariant (#50)', () => {
  const base = pointOfSailLabel(0.4, 1.3);
  for (const k of [1, -2, 4]) {
    const same = pointOfSailLabel(0.4 + k * TAU, 1.3);
    assert.equal(same.label, base.label);
    assert.equal(same.cls, base.cls);
  }
});
