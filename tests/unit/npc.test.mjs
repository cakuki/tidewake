import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  wrapAngle,
  steerToward,
  headingTo,
  pickWaypoint,
  hasArrived,
  avoidObstacles,
} from '../../src/npc-ai.js';

const TAU = Math.PI * 2;

test('wrapAngle: normalises to (-PI, PI]', () => {
  assert.ok(Math.abs(wrapAngle(0)) < 1e-9);
  assert.ok(Math.abs(wrapAngle(Math.PI) - Math.PI) < 1e-9 || Math.abs(wrapAngle(Math.PI) + Math.PI) < 1e-9);
  assert.ok(Math.abs(wrapAngle(TAU)) < 1e-9, '2PI -> 0');
  assert.ok(Math.abs(wrapAngle(3 * Math.PI) - Math.PI) < 1e-9 || Math.abs(wrapAngle(3 * Math.PI) + Math.PI) < 1e-9);
  // always within range
  for (let a = -20; a <= 20; a += 0.37) {
    const w = wrapAngle(a);
    assert.ok(w > -Math.PI - 1e-9 && w <= Math.PI + 1e-9, `out of range at ${a}: ${w}`);
  }
});

test('steerToward: moves heading toward target by at most maxRate*dt', () => {
  // big gap, small step -> advances exactly maxRate*dt toward target
  const h0 = 0;
  const target = 1.0; // radians
  const maxRate = 0.5; // rad/s
  const dt = 1.0;
  const h1 = steerToward(h0, target, maxRate, dt);
  assert.ok(Math.abs(h1 - 0.5) < 1e-9, `expected 0.5 got ${h1}`);
});

test('steerToward: does not overshoot the target', () => {
  const h1 = steerToward(0, 0.1, 5.0, 1.0); // step would be 5 rad, target only 0.1 away
  assert.ok(Math.abs(wrapAngle(h1 - 0.1)) < 1e-9, `should snap to target, got ${h1}`);
});

test('steerToward: takes the shortest way around the wrap', () => {
  // from 3.0 rad toward -3.0 rad: shortest path crosses PI (+ direction), ~0.28 rad
  const h = steerToward(3.0, -3.0, 10.0, 1.0);
  assert.ok(Math.abs(wrapAngle(h - (-3.0))) < 1e-9, `should reach -3.0, got ${h}`);
  // a tiny step should move toward +PI side, not all the way back through 0
  const small = steerToward(3.0, -3.0, 0.1, 1.0);
  assert.ok(small > 3.0 || small < -Math.PI + 0.2, `should step the short way, got ${small}`);
});

test('steerToward: result is always normalised', () => {
  for (let t = 0; t < 50; t++) {
    const h = steerToward(Math.random() * 10 - 5, Math.random() * 10 - 5, 0.3, 0.5);
    assert.ok(h > -Math.PI - 1e-9 && h <= Math.PI + 1e-9, `not normalised: ${h}`);
  }
});

test('headingTo: 0 points toward +Z, +PI/2 toward +X (matches ship forward = (sin h, cos h))', () => {
  assert.ok(Math.abs(wrapAngle(headingTo(0, 0, 0, 10) - 0)) < 1e-9, '+Z -> 0');
  assert.ok(Math.abs(wrapAngle(headingTo(0, 0, 10, 0) - Math.PI / 2)) < 1e-9, '+X -> PI/2');
  assert.ok(Math.abs(wrapAngle(headingTo(0, 0, 0, -10) - Math.PI)) < 1e-9, '-Z -> PI');
});

test('pickWaypoint: stays within bounds', () => {
  let s = 12345;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const bounds = { minX: -500, maxX: 500, minZ: -300, maxZ: 800 };
  for (let i = 0; i < 200; i++) {
    const wp = pickWaypoint(rng, bounds);
    assert.ok(wp.x >= bounds.minX && wp.x <= bounds.maxX, `x out of bounds: ${wp.x}`);
    assert.ok(wp.z >= bounds.minZ && wp.z <= bounds.maxZ, `z out of bounds: ${wp.z}`);
  }
});

test('hasArrived: true within radius, false outside', () => {
  assert.equal(hasArrived(0, 0, 3, 4, 10), true, 'dist 5 within radius 10');
  assert.equal(hasArrived(0, 0, 30, 40, 10), false, 'dist 50 outside radius 10');
  assert.equal(hasArrived(0, 0, 10, 0, 10), true, 'exactly on boundary counts as arrived');
});

test('avoidObstacles: clear water returns the desired heading unchanged', () => {
  const islands = [{ x: 1000, z: 1000, r: 50 }];
  const desired = 0.3;
  const out = avoidObstacles(0, 0, desired, islands, 200);
  assert.ok(Math.abs(wrapAngle(out - desired)) < 1e-9, `should be unchanged, got ${out}`);
});

test('avoidObstacles: steers away when an island lies dead ahead', () => {
  // island straight ahead along +Z (heading 0); should deflect heading off 0
  const islands = [{ x: 0, z: 100, r: 60 }];
  const out = avoidObstacles(0, 0, 0, islands, 200);
  assert.ok(Math.abs(wrapAngle(out)) > 1e-3, `should deflect, got ${out}`);
});
