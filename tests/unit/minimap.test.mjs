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

// ---- Big route-planning map (#54) -----------------------------------------
// The big chart reuses these very helpers at a larger canvas + radius so the whole
// archipelago fits. These tests pin the scale + that every island/port lands inside.
const BIG_SIZE = 720;
const BIG_RADIUS = 4000;                 // world units shown from centre to edge
const BIG_SCALE = minimapScale(BIG_SIZE, BIG_RADIUS);

// The archipelago anchors from world.js: [x, z, radius]. Ports sit just off island edges.
const ISLANDS = [
  [320, -260, 60], [-480, 220, 90], [180, 640, 75],
  [-700, -520, 110], [820, 380, 85], [-260, -780, 70],
];

test('big map scale: pixels-per-unit = half-size / big radius', () => {
  assert.equal(BIG_SCALE, 360 / 4000);
});

test('big map covers every island (whole disc) within the canvas', () => {
  for (const [x, z, r] of ISLANDS) {
    const p = worldToMinimap(x, z, 0, 0, BIG_SCALE, BIG_SIZE);
    assert.ok(p.onRadar, `island (${x},${z}) is on the big map`);
    const rr = r * BIG_SCALE;
    assert.ok(p.x - rr >= 0 && p.x + rr <= BIG_SIZE, 'island disc within canvas (x)');
    assert.ok(p.y - rr >= 0 && p.y + rr <= BIG_SIZE, 'island disc within canvas (y)');
  }
});

test('a port at the far edge of the archipelago still maps inside the big map', () => {
  // Just off the furthest island (-700,-520, r110): a port ~ (-810, -600).
  const r = worldToMinimap(-810, -600, 0, 0, BIG_SCALE, BIG_SIZE);
  assert.ok(r.onRadar, 'edge port is on the chart');
  assert.ok(r.x >= 0 && r.x <= BIG_SIZE && r.y >= 0 && r.y <= BIG_SIZE, 'edge port within canvas');
});

test('the big map shows much more sea than the corner radar', () => {
  // A point 2500u out is beyond the 1200u radar but well within the 4000u chart.
  const onRadar = worldToMinimap(2500, 0, 0, 0, SCALE, SIZE);
  const onChart = worldToMinimap(2500, 0, 0, 0, BIG_SCALE, BIG_SIZE);
  assert.ok(!onRadar.onRadar, 'beyond the small radar');
  assert.ok(onChart.onRadar, 'within the big chart');
});
