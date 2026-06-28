// Unit: the living-sea-fauna PURE flock math (#97; #53 self-tested standard). No three.js,
// no DOM — fauna-math.js maps a gull index to deterministic flight params, wheels each bird
// around the flock centre, fakes a wing-beat, picks a roost (ship at sea / shore near land),
// eases the centre smoothly, and decides when the whole flock is culled. We assert: params
// are deterministic + varied, a gull wheels on its circle facing its travel, the wing-beat
// stays bounded, the roost flips to the coast inside range, easing converges, and the cull
// fires only beyond the radius.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GULL_COUNT, FLOCK_HEIGHT, ROOST_RANGE, CULL_RADIUS, FLAP_DEPTH, WHEEL_MIN_R,
  gullParams, gullPosition, flapScale, roostTarget, easeTowards, shouldCull,
} from '../../src/fauna-math.js';

test('gullParams: deterministic, and a loose (varied) flock', () => {
  const a = gullParams(2);
  const b = gullParams(2);
  assert.deepEqual(a, b, 'same index → identical params (deterministic)');

  const radii = new Set();
  const phases = new Set();
  for (let i = 0; i < GULL_COUNT; i++) {
    const p = gullParams(i);
    assert.ok(p.radius >= WHEEL_MIN_R, 'radius respects the minimum wheel');
    assert.ok(p.angSpeed > 0, 'all birds wheel the same way (positive)');
    radii.add(p.radius);
    phases.add(p.phase.toFixed(4));
  }
  assert.ok(radii.size > 1, 'birds spread across several wheel radii');
  assert.ok(phases.size === GULL_COUNT, 'every bird gets a distinct phase (no clumping)');
});

test('gullPosition: rides its wheel at the flock height, facing its flight direction', () => {
  const p = gullParams(0);
  const center = { x: 100, y: FLOCK_HEIGHT, z: -50 };
  const a = gullPosition(p, center, 0);
  const b = gullPosition(p, center, 1);

  // Stays on its wheel: horizontal distance from centre ≈ radius at all times.
  const r0 = Math.hypot(a.x - center.x, a.z - center.z);
  const r1 = Math.hypot(b.x - center.x, b.z - center.z);
  assert.ok(Math.abs(r0 - p.radius) < 1e-9, 'sits on the wheel radius');
  assert.ok(Math.abs(r1 - p.radius) < 1e-9, 'still on the wheel a second later');

  // Altitude hugs the flock height (± the per-bird stagger + a gentle bob).
  assert.ok(Math.abs(a.y - (center.y + p.height)) <= p.bobAmp + 1e-9, 'altitude near flock height');

  // It actually moved (it's wheeling, not parked).
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) > 0.01, 'the bird wheels over time');

  // Faces along its velocity: stepping a tiny dt forward should advance roughly toward yaw.
  const eps = gullPosition(p, center, 0.001);
  const vx = eps.x - a.x, vz = eps.z - a.z;
  const moveYaw = Math.atan2(vx, vz);
  const dyaw = Math.atan2(Math.sin(moveYaw - a.yaw), Math.cos(moveYaw - a.yaw));
  assert.ok(Math.abs(dyaw) < 0.05, 'yaw points along the direction of travel');
});

test('flapScale: a bounded wing-beat that actually beats', () => {
  const p = gullParams(1);
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 2; t += 0.02) {
    const s = flapScale(p, t);
    assert.ok(s >= 1 - FLAP_DEPTH - 1e-9 && s <= 1 + 1e-9, 'flap stays within [1-depth, 1]');
    lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  assert.ok(hi - lo > FLAP_DEPTH * 0.5, 'the wings genuinely beat over time');
});

test('roostTarget: ship at sea, the shore when an island is near', () => {
  const ship = { x: 0, z: 0 };

  // No island → wheel over the ship.
  const sea = roostTarget(ship, null);
  assert.equal(sea.nearLand, false);
  assert.deepEqual([sea.x, sea.z], [0, 0]);

  // Island within range → drift to hang over the coast.
  const near = roostTarget(ship, { x: ROOST_RANGE - 50, z: 0 });
  assert.equal(near.nearLand, true);
  assert.equal(near.x, ROOST_RANGE - 50);

  // Island out of range → stay with the ship.
  const far = roostTarget(ship, { x: ROOST_RANGE + 200, z: 0 });
  assert.equal(far.nearLand, false);
  assert.deepEqual([far.x, far.z], [0, 0]);
});

test('easeTowards: converges to the target, frame-rate independent, no overshoot', () => {
  let v = 0;
  for (let i = 0; i < 600; i++) v = easeTowards(v, 100, 1 / 60); // ~10s at the gentle drift rate
  assert.ok(Math.abs(v - 100) < 0.5, 'eases home to the target');
  assert.ok(v <= 100 + 1e-9, 'never overshoots');
  assert.equal(easeTowards(5, 100, 0), 5, 'dt=0 is a no-op');

  // Monotonic approach (each step gets closer, never past).
  let prev = 0, cur = 0;
  for (let i = 0; i < 50; i++) { prev = cur; cur = easeTowards(cur, 10, 1 / 30); assert.ok(cur >= prev && cur <= 10 + 1e-9); }
});

test('shouldCull: hidden only beyond the cull radius', () => {
  const focus = { x: 0, z: 0 };
  assert.equal(shouldCull({ x: 0, z: 0 }, focus), false, 'right on top → visible');
  assert.equal(shouldCull({ x: CULL_RADIUS - 1, z: 0 }, focus), false, 'just inside → visible');
  assert.equal(shouldCull({ x: CULL_RADIUS + 1, z: 0 }, focus), true, 'just outside → culled');
});
