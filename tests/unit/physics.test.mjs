import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  windFactor,
  targetSpeed,
  approach,
  steerRate,
  wakeIntensity,
  relativeWindAngle,
  pointOfSail,
} from '../../src/physics.js';

const PI = Math.PI;

test('windFactor: downwind is faster than upwind', () => {
  const wind = PI * 0.25;
  const downwind = windFactor(wind, wind);          // heading == windDir
  const upwind = windFactor(wind + PI, wind);        // heading opposite wind
  assert.ok(downwind > upwind, 'downwind should beat upwind');
});

test('windFactor: stays within [0.55, 1.0] across all angles', () => {
  for (let a = 0; a < 2 * PI; a += PI / 12) {
    const f = windFactor(a, 0);
    assert.ok(f >= 0.55 - 1e-9 && f <= 1.0 + 1e-9, `out of range at ${a}: ${f}`);
  }
  // exact endpoints
  assert.ok(Math.abs(windFactor(0, 0) - 1.0) < 1e-9, 'downwind == 1.0');
  assert.ok(Math.abs(windFactor(PI, 0) - 0.55) < 1e-9, 'upwind == 0.55');
});

test('targetSpeed: scales linearly with throttle', () => {
  const max = 55, h = 0, w = 0;
  const half = targetSpeed(0.5, max, h, w);
  const full = targetSpeed(1.0, max, h, w);
  assert.ok(Math.abs(full - 2 * half) < 1e-9, 'full should be twice half');
});

test('targetSpeed: zero throttle gives zero speed', () => {
  assert.equal(targetSpeed(0, 55, 1.23, 0.4), 0);
});

test('targetSpeed: respects windFactor (downwind faster than upwind)', () => {
  const max = 55, w = PI * 0.25;
  const down = targetSpeed(1, max, w, w);
  const up = targetSpeed(1, max, w + PI, w);
  assert.ok(down > up, 'downwind target should exceed upwind');
  // and equals throttle*max*windFactor exactly
  assert.ok(Math.abs(down - 1 * max * windFactor(w, w)) < 1e-9);
});

test('approach: moves toward target without overshoot (dt*rate <= 1)', () => {
  const next = approach(0, 10, 0.1, 1.5); // dt*rate = 0.15
  assert.ok(next > 0 && next < 10, `expected between 0 and 10, got ${next}`);
  // exact easing value
  assert.ok(Math.abs(next - 10 * 0.15) < 1e-9);
});

test('approach: clamps to target when dt*rate >= 1', () => {
  assert.equal(approach(3, 10, 1, 1.5), 10); // dt*rate = 1.5 -> clamped
});

test('approach: returns target when already at target', () => {
  assert.equal(approach(7, 7, 0.016, 1.5), 7);
});

test('steerRate: increases with speed', () => {
  assert.ok(steerRate(20) > steerRate(5), 'faster ships turn quicker (until cap)');
});

test('steerRate: has a floor at rest (still steerable)', () => {
  const atRest = steerRate(0);
  assert.ok(atRest > 0, 'should be able to nudge bow at rest');
  assert.ok(Math.abs(atRest - 0.9 * 0.15) < 1e-9, 'floor == 0.9 * 0.15');
});

test('steerRate: caps at high speed', () => {
  const capped = steerRate(1000);
  assert.ok(Math.abs(capped - 0.9) < 1e-9, 'cap == 0.9');
  assert.ok(steerRate(1000) >= steerRate(100) - 1e-9, 'monotone non-decreasing');
});

test('wakeIntensity: zero at rest', () => {
  assert.equal(wakeIntensity(0, 55), 0);
});

test('wakeIntensity: monotonically increases with speed', () => {
  let prev = -1;
  for (let s = 0; s <= 55; s += 5) {
    const i = wakeIntensity(s, 55);
    assert.ok(i >= prev, `not monotonic at speed ${s}`);
    prev = i;
  }
});

test('wakeIntensity: stays within [0,1] and clamps above max', () => {
  assert.equal(wakeIntensity(55, 55), 1);
  assert.equal(wakeIntensity(100, 55), 1, 'clamped at 1');
  assert.equal(wakeIntensity(-5, 55), 0, 'clamped at 0');
});

test('relativeWindAngle: dead downwind (heading == windDir) is 0', () => {
  assert.ok(Math.abs(relativeWindAngle(PI * 0.25, PI * 0.25)) < 1e-9, 'running == 0');
  assert.ok(Math.abs(relativeWindAngle(1.7, 1.7)) < 1e-9);
});

test('relativeWindAngle: dead upwind (heading opposite windDir) is PI', () => {
  assert.ok(Math.abs(relativeWindAngle(PI * 0.25 + PI, PI * 0.25) - PI) < 1e-9, 'irons == PI');
});

test('relativeWindAngle: beam (90° off) is PI/2', () => {
  assert.ok(Math.abs(relativeWindAngle(PI / 2, 0) - PI / 2) < 1e-9);
  assert.ok(Math.abs(relativeWindAngle(-PI / 2, 0) - PI / 2) < 1e-9);
});

test('relativeWindAngle: always in [0, PI] and wraps cleanly', () => {
  for (let h = -4 * PI; h < 4 * PI; h += PI / 13) {
    for (let w = -PI; w < PI; w += PI / 7) {
      const a = relativeWindAngle(h, w);
      assert.ok(a >= -1e-9 && a <= PI + 1e-9, `out of range: ${a} (h=${h}, w=${w})`);
    }
  }
});

test('relativeWindAngle: symmetric port vs starboard', () => {
  const w = 0.4;
  for (let off = 0; off <= PI; off += PI / 9) {
    const port = relativeWindAngle(w + off, w);
    const starboard = relativeWindAngle(w - off, w);
    assert.ok(Math.abs(port - starboard) < 1e-9, `asymmetric at off=${off}`);
  }
});

test('pointOfSail: dead downwind is Running', () => {
  assert.equal(pointOfSail(PI * 0.25, PI * 0.25).label, 'Running');
});

test('pointOfSail: dead upwind is In irons', () => {
  assert.equal(pointOfSail(PI * 0.25 + PI, PI * 0.25).label, 'In irons');
});

test('pointOfSail: beam reach is Reaching', () => {
  assert.equal(pointOfSail(PI / 2, 0).label, 'Reaching');
  assert.equal(pointOfSail(-PI / 2, 0).label, 'Reaching');
});

test('pointOfSail: near-upwind (but not dead) is Close-hauled', () => {
  // ~150° off downwind => ~30° off the wind source: hard on the wind, not yet stalled
  assert.equal(pointOfSail(PI * 0.7, 0).label, 'Close-hauled');
});

test('pointOfSail: symmetric port vs starboard', () => {
  const w = 0.4;
  for (let off = 0; off <= PI; off += PI / 12) {
    assert.equal(pointOfSail(w + off, w).label, pointOfSail(w - off, w).label, `asymmetric at off=${off}`);
  }
});

test('pointOfSail: efficiency matches windFactor and is best running, worst in irons', () => {
  const w = 1.1;
  const running = pointOfSail(w, w);
  const irons = pointOfSail(w + PI, w);
  assert.ok(Math.abs(running.efficiency - windFactor(w, w)) < 1e-9, 'efficiency == windFactor');
  assert.ok(running.efficiency > irons.efficiency, 'running beats irons');
});

test('pointOfSail: band degrades from good (running) to poor (in irons)', () => {
  assert.equal(pointOfSail(0, 0).band, 'good');
  assert.equal(pointOfSail(PI, 0).band, 'poor');
});
