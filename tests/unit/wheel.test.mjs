// #93 — ship's-wheel touch steering. TDD for the PURE drag-angle → steer mapping that the
// rotatable on-screen helm (src/ui/wheel.js) feeds into the eased-rudder model (#20). The
// widget's DOM wiring is covered by the headless playtest; the maths live here, browser-free.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ANGLE, WHEEL_DEADZONE, clampAngle, wheelSteer, shortestAngleDelta, pointerAngle,
} from '../../src/ui/wheel.js';

// ---- constants are sane -----------------------------------------------------------------
test('MAX_ANGLE / WHEEL_DEADZONE: sane positive bounds, deadzone well inside lock', () => {
  assert.ok(MAX_ANGLE > 0 && MAX_ANGLE < Math.PI, `MAX_ANGLE looks off: ${MAX_ANGLE}`);
  assert.ok(WHEEL_DEADZONE >= 0 && WHEEL_DEADZONE < MAX_ANGLE, `deadzone looks off: ${WHEEL_DEADZONE}`);
});

// ---- clampAngle: the wheel can't be spun past full lock --------------------------------
test('clampAngle: holds within [-MAX_ANGLE, MAX_ANGLE]', () => {
  assert.equal(clampAngle(0), 0);
  assert.equal(clampAngle(MAX_ANGLE * 5), MAX_ANGLE);
  assert.equal(clampAngle(-MAX_ANGLE * 5), -MAX_ANGLE);
  assert.equal(clampAngle(MAX_ANGLE * 0.5), MAX_ANGLE * 0.5);
});

// ---- wheelSteer: rotation → steer in [-1,1] with a centred deadzone --------------------
test('wheelSteer: dead-centre and within the deadzone produce no steer', () => {
  assert.equal(wheelSteer(0), 0);
  assert.equal(wheelSteer(WHEEL_DEADZONE * 0.5), 0);
  assert.equal(wheelSteer(-WHEEL_DEADZONE * 0.5), 0);
});

test('wheelSteer: full lock reaches full steer ±1 (and clamps beyond)', () => {
  assert.equal(wheelSteer(MAX_ANGLE), 1);
  assert.equal(wheelSteer(-MAX_ANGLE), -1);
  assert.equal(wheelSteer(MAX_ANGLE * 3), 1);
  assert.equal(wheelSteer(-MAX_ANGLE * 3), -1);
});

test('wheelSteer: rises monotonically from the deadzone edge to full lock', () => {
  let prev = -Infinity;
  for (let a = WHEEL_DEADZONE; a <= MAX_ANGLE + 1e-9; a += (MAX_ANGLE - WHEEL_DEADZONE) / 20) {
    const s = wheelSteer(a);
    assert.ok(s >= prev - 1e-9, `steer must rise with angle, got ${s} after ${prev}`);
    assert.ok(s >= 0 && s <= 1 + 1e-9, `steer must stay in [0,1], got ${s}`);
    prev = s;
  }
});

test('wheelSteer: just past the deadzone yields a small steer, not a jump to full', () => {
  const s = wheelSteer(WHEEL_DEADZONE + (MAX_ANGLE - WHEEL_DEADZONE) * 0.01);
  assert.ok(s > 0 && s < 0.1, `just past the deadzone should be a gentle nudge, got ${s}`);
});

test('wheelSteer: is sign-symmetric (port and starboard mirror)', () => {
  const a = (MAX_ANGLE + WHEEL_DEADZONE) / 2;
  assert.ok(Math.abs(wheelSteer(a) + wheelSteer(-a)) < 1e-9, 'opposite rotations must give opposite steer');
});

// ---- shortestAngleDelta: accumulating drag must not jump across the ±PI seam ------------
test('shortestAngleDelta: returns the small signed step within (-PI, PI]', () => {
  assert.ok(Math.abs(shortestAngleDelta(0, 0.2) - 0.2) < 1e-9);
  assert.ok(Math.abs(shortestAngleDelta(0.2, 0) + 0.2) < 1e-9);
});

test('shortestAngleDelta: wraps across the ±PI boundary the short way', () => {
  // From 3.0 rad to -3.0 rad is a short +0.283 hop across PI, NOT a -6.0 plunge.
  const d = shortestAngleDelta(3.0, -3.0);
  assert.ok(d > 0 && d < 0.4, `expected a small positive wrap, got ${d}`);
  // And the reverse is the small negative hop.
  const d2 = shortestAngleDelta(-3.0, 3.0);
  assert.ok(d2 < 0 && d2 > -0.4, `expected a small negative wrap, got ${d2}`);
});

// ---- pointerAngle: angle of a pointer about the wheel centre ----------------------------
test('pointerAngle: cardinal directions around the centre (screen y grows downward)', () => {
  const cx = 50, cy = 50;
  assert.ok(Math.abs(pointerAngle(cx, cy, 60, 50) - 0) < 1e-9, 'due right = 0');
  assert.ok(Math.abs(pointerAngle(cx, cy, 50, 60) - Math.PI / 2) < 1e-9, 'straight down = +PI/2');
  assert.ok(Math.abs(pointerAngle(cx, cy, 50, 40) + Math.PI / 2) < 1e-9, 'straight up = -PI/2');
});
