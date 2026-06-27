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
  resolveCircleCollision,
  sweepIslandCollision,
  SHIP_RADIUS,
  ISLAND_HITBOX,
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

// ---- Arcade island collision (#76 a1) -------------------------------------
// A forgiving circle-hitbox resolver: islands stop you, but soft — push the hull
// out to the coast and let it slide, never a brick wall, never tunnelling.

const ISLE = { x: 0, z: 0, r: 100 };
// The solid radius a ship centre is held outside of (slightly-under footprint + hull).
const solidR = (c) => c.r * ISLAND_HITBOX + SHIP_RADIUS;

test('resolveCircleCollision: a ship in open water is untouched', () => {
  const far = { x: 500, z: -300 };
  const r = resolveCircleCollision(far, [ISLE]);
  assert.equal(r.hit, false, 'no contact out at sea');
  assert.equal(r.x, far.x);
  assert.equal(r.z, far.z);
});

test('resolveCircleCollision: a ship driven into an island is pushed to the coast (not past, not stuck)', () => {
  // Drive the hull centre deep inside the island.
  const inside = { x: 10, z: 5 };
  const r = resolveCircleCollision(inside, [ISLE]);
  assert.equal(r.hit, true, 'land was touched');
  const d = Math.hypot(r.x - ISLE.x, r.z - ISLE.z);
  // Sits exactly on the solid boundary — pushed OUT (not left buried), but not flung past it.
  assert.ok(Math.abs(d - solidR(ISLE)) < 1e-6, `expected boundary ${solidR(ISLE)}, got ${d}`);
  // Pushed radially: stays on the same bearing it came in on (no teleport across the isle).
  assert.ok(r.x > 0 && r.z > 0, 'pushed out along the approach bearing');
});

test('resolveCircleCollision: a glancing approach slides out radially along the coast', () => {
  // A point just inside the rim, off to one side — should pop straight out along its bearing,
  // preserving its angle (the basis of sliding along the shoreline frame-to-frame).
  const R = solidR(ISLE);
  const angle = 0.6;
  const p = { x: Math.cos(angle) * (R - 3), z: Math.sin(angle) * (R - 3) };
  const r = resolveCircleCollision(p, [ISLE]);
  assert.equal(r.hit, true);
  const outAngle = Math.atan2(r.z, r.x);
  assert.ok(Math.abs(outAngle - angle) < 1e-9, 'bearing preserved → it slides, not bounces');
  assert.ok(Math.abs(Math.hypot(r.x, r.z) - R) < 1e-6, 'lands on the coast boundary');
});

test('resolveCircleCollision: a hull dead-centre is still ejected (no divide-by-zero)', () => {
  const r = resolveCircleCollision({ x: 0, z: 0 }, [ISLE]);
  assert.equal(r.hit, true);
  const d = Math.hypot(r.x, r.z);
  assert.ok(Number.isFinite(d) && Math.abs(d - solidR(ISLE)) < 1e-6, 'ejected cleanly to the boundary');
});

test('sweepIslandCollision: open-water motion passes through unchanged', () => {
  const prev = { x: 400, z: 400 }, next = { x: 420, z: 410 };
  const r = sweepIslandCollision(prev, next, [ISLE]);
  assert.equal(r.hit, false);
  assert.ok(Math.abs(r.x - next.x) < 1e-9 && Math.abs(r.z - next.z) < 1e-9);
});

test('sweepIslandCollision: a fast ship cannot tunnel through a small island', () => {
  // A tiny island and a single huge step that would skip clean across it in one frame.
  const small = { x: 0, z: 0, r: 40 };
  const prev = { x: -300, z: 0 };
  const next = { x: 300, z: 0 };   // straight through the middle, far side
  const r = sweepIslandCollision(prev, next, [small]);
  assert.equal(r.hit, true, 'the island was hit, not skipped');
  const d = Math.hypot(r.x - small.x, r.z - small.z);
  assert.ok(d >= solidR(small) - 1e-6, `ended outside the coast, got d=${d}`);
  // Stopped on the NEAR side — did not come out the far side of the island.
  assert.ok(r.x < 0, `should be held on the approach side, got x=${r.x}`);
});

test('sweepIslandCollision: a glancing pass keeps most of its way on (slides, not stops)', () => {
  // Skim the rim of the island; the ship should keep moving forward, not dead-stop.
  const prev = { x: -200, z: solidR(ISLE) - 6 };
  const next = { x: 200, z: solidR(ISLE) - 6 };
  const r = sweepIslandCollision(prev, next, [ISLE]);
  assert.equal(r.hit, true, 'grazed the coast');
  // Advanced a long way along the shore rather than halting at first contact.
  assert.ok(r.x > 100, `should slide along the coast, got x=${r.x}`);
  // Never buried in the island.
  assert.ok(Math.hypot(r.x, r.z) >= solidR(ISLE) - 1e-6, 'stayed outside the coast');
});

test('island collision never blocks docking: the port point sits outside its isle\'s hitbox', () => {
  // Ports are placed at island-radius + 6 on the seaward face (src/ports.js). A ship can
  // reach the dock so long as that point lies outside the solid collision boundary.
  for (const r of [60, 75, 85, 90, 110]) {
    const isle = { x: 0, z: 0, r };
    const portDist = r + 6;            // ports.js: ip + dir*(r+6)
    assert.ok(portDist > solidR(isle), `port at ${portDist} must clear hitbox ${solidR(isle)} (r=${r})`);
  }
});
