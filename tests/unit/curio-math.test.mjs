// Unit: the ocean sail-over curio PURE logic (#70 slice 1; #53 self-tested standard). No three.js,
// no DOM — curio-math.js schedules irregular curio appearances, spawns one ahead of the bow off a
// random beam, decides when the ship has sailed OVER it (a once-on-entry distance check), distance-
// culls it off-stage, retires it once well astern, bobs it on the swell, and — the charm guarantee —
// picks a witty line that is NEVER the same one twice in a row. We assert each of those in isolation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURIO_SPAWN_MIN, CURIO_SPAWN_MAX, CURIO_AHEAD, CURIO_BEAM, SAILOVER_RADIUS,
  CURIO_CULL_RADIUS, CURIO_DESPAWN_RADIUS, CURIO_TYPES, CURIO_LINES, CURIO_SURFACE,
  nextCurioDelay, pickCurioType, curioSpawnOrigin, sailedOver, shouldCull,
  curioDespawned, curioBob, pickLine,
} from '../../src/curio-math.js';

test('nextCurioDelay: maps 0..1 into [min,max] and clamps out-of-range', () => {
  assert.equal(nextCurioDelay(0), CURIO_SPAWN_MIN, '0 → shortest gap');
  assert.equal(nextCurioDelay(1), CURIO_SPAWN_MAX, '1 → longest gap');
  assert.equal(nextCurioDelay(0.5), (CURIO_SPAWN_MIN + CURIO_SPAWN_MAX) / 2, 'mid → midpoint');
  assert.equal(nextCurioDelay(-2), CURIO_SPAWN_MIN, 'clamps below 0');
  assert.equal(nextCurioDelay(5), CURIO_SPAWN_MAX, 'clamps above 1');
  assert.ok(CURIO_SPAWN_MAX > CURIO_SPAWN_MIN, 'the gap is a real range, not a constant');
});

test('pickCurioType: deterministic, spans every kind, clamps the edges', () => {
  assert.equal(pickCurioType(0.3), pickCurioType(0.3), 'same random → same kind (deterministic)');
  const seen = new Set();
  for (let r = 0; r <= 1.0001; r += 0.02) seen.add(pickCurioType(r));
  for (const t of CURIO_TYPES) assert.ok(seen.has(t), `kind '${t}' is reachable`);
  assert.equal(pickCurioType(0), CURIO_TYPES[0], '0 → first kind');
  assert.equal(pickCurioType(1), CURIO_TYPES[CURIO_TYPES.length - 1], '1 → last kind (clamped in-range)');
  assert.equal(pickCurioType(9), CURIO_TYPES[CURIO_TYPES.length - 1], 'above 1 clamps to the last kind');
});

test('curioSpawnOrigin: surfaces ahead of the bow and off the chosen beam', () => {
  const ship = { x: 0, z: 0 };
  // Heading 0 (+Z): ahead is +Z, starboard (+1) is +X.
  const star = curioSpawnOrigin(ship, 0, 1, 0);
  assert.ok(Math.abs(star.z - CURIO_AHEAD) < 1e-9, 'CURIO_AHEAD ahead of the bow');
  assert.ok(Math.abs(star.x - CURIO_BEAM) < 1e-9, 'CURIO_BEAM off to starboard');
  const port = curioSpawnOrigin(ship, 0, -1, 0);
  assert.ok(port.x < 0, 'the other side surfaces to port');
  assert.equal(star.y, 0, 'sits at the given sea level');
  // It surfaces ahead in your path, never on top of the hull.
  assert.ok(Math.hypot(star.x, star.z) > 30, 'never spawns on top of the player');
});

test('sailedOver: fires only once the ship is within the sail-over radius', () => {
  const curio = { x: 100, z: 100 };
  assert.equal(sailedOver(curio, { x: 100, z: 100 }), true, 'right on top → sailed over');
  assert.equal(sailedOver(curio, { x: 100 + SAILOVER_RADIUS - 1, z: 100 }), true, 'just inside → over');
  assert.equal(sailedOver(curio, { x: 100 + SAILOVER_RADIUS + 1, z: 100 }), false, 'just outside → not yet');
});

test('shouldCull: hidden only beyond the cull radius (0 draws off-stage)', () => {
  const focus = { x: 0, z: 0 };
  assert.equal(shouldCull({ x: 0, z: 0 }, focus), false, 'right on top → visible');
  assert.equal(shouldCull({ x: CURIO_CULL_RADIUS - 1, z: 0 }, focus), false, 'just inside → visible');
  assert.equal(shouldCull({ x: CURIO_CULL_RADIUS + 1, z: 0 }, focus), true, 'just outside → culled');
});

test('curioDespawned: retires only when the ship is well past — after the cull window opens', () => {
  const curio = { x: 0, z: 0 };
  assert.equal(curioDespawned(curio, { x: CURIO_DESPAWN_RADIUS - 1, z: 0 }), false, 'still in play');
  assert.equal(curioDespawned(curio, { x: CURIO_DESPAWN_RADIUS + 1, z: 0 }), true, 'well astern → retire');
  // A curio can be CULLED (0 draws) yet still LIVE — the despawn radius sits beyond the cull radius.
  assert.ok(CURIO_DESPAWN_RADIUS > CURIO_CULL_RADIUS, 'despawn is farther than cull, so a culled-but-live window exists');
});

test('curioBob: a gentle bounded bob that actually moves', () => {
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 8; t += 0.05) {
    const y = curioBob(t, 0.7, 0.4);
    assert.ok(y >= -0.4 - 1e-9 && y <= 0.4 + 1e-9, 'bob stays within [-amp, +amp]');
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  assert.ok(hi - lo > 0.4, 'the curio genuinely bobs over time');
});

test('pickLine: NEVER repeats the last line, spans the whole pool, handles edges', () => {
  const n = 8;
  // (1) The core guarantee: no immediate repeat across a long deterministic-ish walk.
  let last = -1;
  const hits = new Set();
  for (let k = 0; k < 400; k++) {
    const idx = pickLine(n, last, (k * 0.6180339887) % 1); // spread the randoms across [0,1)
    assert.ok(idx >= 0 && idx < n, 'index stays inside the pool');
    assert.notEqual(idx, last, 'never the same line twice in a row');
    hits.add(idx);
    last = idx;
  }
  assert.equal(hits.size, n, 'every line in the pool is reachable over time');

  // (2) Edges: an empty pool → -1; a single-line pool → 0 (even though that "repeats").
  assert.equal(pickLine(0, -1, 0.5), -1, 'empty pool → -1');
  assert.equal(pickLine(1, -1, 0.5), 0, 'single line → 0');
  assert.equal(pickLine(1, 0, 0.9), 0, 'single line → 0 even if it was last (nothing else to pick)');

  // (3) The skip covers the boundary: with lastIndex at each slot, the top of the range still lands.
  for (let li = 0; li < n; li++) {
    const top = pickLine(n, li, 0.999999);
    assert.notEqual(top, li, `top-of-range pick skips the last index (li=${li})`);
    assert.ok(top >= 0 && top < n, 'and stays in range');
  }
});

test('CURIO_LINES: healthy, deduplicated witty-line pools for every kind', () => {
  for (const kind of CURIO_TYPES) {
    const pool = CURIO_LINES[kind];
    assert.ok(Array.isArray(pool), `${kind} has a line pool`);
    assert.ok(pool.length >= 5, `${kind} pool is large enough for real variety (${pool.length})`);
    assert.ok(pool.every((l) => typeof l === 'string' && l.trim().length > 0), `${kind} lines are all non-empty strings`);
    assert.equal(new Set(pool).size, pool.length, `${kind} lines are all distinct (no dupes)`);
    assert.ok(CURIO_SURFACE[kind], `${kind} has surface behaviour`);
  }
});
