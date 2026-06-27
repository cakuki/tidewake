import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToMinimap, minimapScale } from '../../src/minimap.js';

const SIZE = 150;
const RADIUS = 1200;            // world units shown from centre to edge
const SCALE = minimapScale(SIZE, RADIUS); // px per world unit

test('minimapScale: pixels-per-unit = half-size / radius', () => {
  assert.equal(minimapScale(150, 1200), 75 / 1200);
  assert.equal(minimapScale(200, 1000), 100 / 1000);
});

test('player position maps to the exact centre', () => {
  const r = worldToMinimap(500, -300, 500, -300, SCALE, SIZE);
  assert.equal(r.x, SIZE / 2);
  assert.equal(r.y, SIZE / 2);
  assert.ok(r.onRadar);
  assert.equal(r.dist, 0);
});

test('scale is correct: a point d units east plots d*scale px to the right', () => {
  const d = 600;
  const r = worldToMinimap(d, 0, 0, 0, SCALE, SIZE);
  assert.ok(Math.abs((r.x - SIZE / 2) - d * SCALE) < 1e-9);
  assert.ok(Math.abs(r.y - SIZE / 2) < 1e-9); // no north/south offset
  assert.ok(r.onRadar);
});

test('world +z maps downward on the radar (north-up)', () => {
  const r = worldToMinimap(0, 400, 0, 0, SCALE, SIZE);
  assert.ok(r.y > SIZE / 2, '+z is south / below centre');
  assert.ok(Math.abs(r.x - SIZE / 2) < 1e-9);
});

test('a point exactly at the range edge sits on the rim and counts as on-radar', () => {
  const r = worldToMinimap(RADIUS, 0, 0, 0, SCALE, SIZE);
  assert.ok(r.onRadar);
  assert.ok(Math.abs(Math.hypot(r.x - SIZE / 2, r.y - SIZE / 2) - SIZE / 2) < 1e-9);
});

test('a point beyond range is culled (onRadar false) and clamped to the rim', () => {
  const r = worldToMinimap(5000, 0, 0, 0, SCALE, SIZE);
  assert.ok(!r.onRadar, 'far point is off-radar');
  const fromCentre = Math.hypot(r.x - SIZE / 2, r.y - SIZE / 2);
  assert.ok(Math.abs(fromCentre - SIZE / 2) < 1e-9, 'clamped onto the rim');
});

test('clamping preserves bearing (a NE point stays NE on the rim)', () => {
  const r = worldToMinimap(9000, 9000, 0, 0, SCALE, SIZE);
  assert.ok(!r.onRadar);
  // equal +x and +z -> 45° down-right; x and y offsets stay equal
  assert.ok(Math.abs((r.x - SIZE / 2) - (r.y - SIZE / 2)) < 1e-9);
});
