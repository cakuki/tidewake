import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProjectiles, timeOfFlight, apexHeight, arcPoint, classifyShot, missLanding, popEnvelope,
  BALL_POOL, FX_POOL, BALLS_PER_VOLLEY, MIN_TOF, MAX_TOF, SHOT_SPEED,
} from '../../src/systems/projectiles.js';

// A cheap deterministic rng for the pool tests (a fixed sequence, wrapped).
function seq(values) { let i = 0; return () => values[(i++) % values.length]; }

// ---- PURE trajectory maths --------------------------------------------------

test('timeOfFlight: scales with distance but is clamped to a readable band', () => {
  assert.equal(timeOfFlight(0), MIN_TOF, 'point-blank still reads as a shot');
  assert.equal(timeOfFlight(-50), MIN_TOF, 'negative distance is floored, never negative time');
  assert.equal(timeOfFlight(1e6), MAX_TOF, 'a very long shot is capped, never dawdles');
  const mid = timeOfFlight(SHOT_SPEED * 0.7); // 0.7s of flight, inside the band
  assert.ok(mid > MIN_TOF && mid < MAX_TOF, 'a mid-range shot lands between the bounds');
  assert.ok(timeOfFlight(400) > timeOfFlight(120), 'a farther foe takes longer to reach');
});

test('apexHeight: lifts with range, bounded so the arc never balloons', () => {
  assert.ok(apexHeight(0) >= 6, 'even a close shot has a little lift');
  assert.ok(apexHeight(1e6) <= 46, 'a long shot arc is capped');
  assert.ok(apexHeight(300) > apexHeight(80), 'more range → a higher arc');
});

test('arcPoint: a parabola that starts at the muzzle, ends at the target, peaks mid-flight', () => {
  const from = [0, 5, 0], to = [100, 5, 0];
  assert.deepEqual(arcPoint(from, to, 0, 20), [0, 5, 0], 'at t=0 it is at the muzzle');
  assert.deepEqual(arcPoint(from, to, 1, 20), [100, 5, 0], 'at t=1 it is at the target');
  const mid = arcPoint(from, to, 0.5, 20);
  assert.equal(mid[0], 50, 'halfway across in x');
  assert.equal(mid[1], 5 + 20, 'apex lift is full at mid-flight');
  // Monotone rise then fall in y across the flight.
  const q1 = arcPoint(from, to, 0.25, 20)[1];
  const q3 = arcPoint(from, to, 0.75, 20)[1];
  assert.ok(q1 > 5 && q3 > 5 && q1 === q3, 'symmetric parabola, above the line either side of the apex');
  // t is clamped so an over-run never flies past the target.
  assert.deepEqual(arcPoint(from, to, 1.5, 20), [100, 5, 0], 't>1 is clamped to the landing');
});

test('classifyShot: a clean beam bite is a HIT; wide or no-damage is a MISS (off the resolved shot)', () => {
  assert.equal(classifyShot({ inArc: true, enemyHit: 22 }), 'hit', 'abeam + damage = a hit');
  assert.equal(classifyShot({ inArc: false, enemyHit: 22 }), 'miss', 'out of arc = a miss even if it somehow scored');
  assert.equal(classifyShot({ inArc: true, enemyHit: 0 }), 'miss', 'abeam but no damage = a miss');
  assert.equal(classifyShot({}), 'miss', 'nothing resolved = a miss');
});

test('missLanding: a wide shot lands clear of the foe (sails past into open water)', () => {
  const from = [0, 5, 0], to = [0, 5, 200];
  const land = missLanding(from, to, seq([0.2, 0.5, 0.5])); // sign<0.5 → one side; mid leads
  const offFoe = Math.hypot(land[0] - to[0], land[2] - to[2]);
  assert.ok(offFoe > 20, `the splash is clearly off the foe (got ${offFoe.toFixed(1)}u away)`);
  assert.equal(land[1], to[1], 'it splashes at the foe waterline height');
});

test('popEnvelope: rises to full then eases to 0, dead at the ends', () => {
  assert.equal(popEnvelope(0, 0.4), 0, 'starts at nothing');
  assert.equal(popEnvelope(0.4, 0.4), 0, 'spent at its life');
  assert.equal(popEnvelope(0.5, 0.4), 0, 'past its life');
  assert.equal(popEnvelope(0.1, 0), 0, 'zero life never pops');
  const peak = popEnvelope(0.4 * 0.28, 0.4); // the rise→fade seam is fullest
  assert.ok(peak > 0.99, 'reaches full at the seam');
  const rising = popEnvelope(0.02, 0.4), fading = popEnvelope(0.30, 0.4);
  assert.ok(rising > 0 && rising < 1 && fading > 0 && fading < peak, 'rise then fall');
});

// ---- Controller: pooled, leak-free, driven by the resolution ----------------

test('fire: a volley spawns a fistful of balls + a muzzle puff', () => {
  const p = createProjectiles();
  assert.equal(p.active(), false, 'idle to begin with');
  const shot = p.fire({ from: [0, 5, 0], to: [0, 5, 200], hit: true });
  assert.ok(shot && shot.hit === true, 'the shot marker reports a hit');
  assert.equal(p.activeBalls(), BALLS_PER_VOLLEY, 'a broadside is a fistful of iron');
  assert.ok(p.activeFx() >= 1, 'a muzzle puff barked at the guns');
  assert.equal(p.snapshot().spawned.muzzles, 1);
});

test('update: balls fly, then LAND — a hit sparks, a miss splashes (visibly different)', () => {
  const p = createProjectiles();
  // A clean HIT volley.
  p.fire({ from: [0, 5, 0], to: [0, 5, 200], hit: true });
  // Fly them the whole way (max time-of-flight covers any distance).
  p.update(MAX_TOF + 0.01);
  const afterHit = p.snapshot().spawned;
  assert.ok(afterHit.hits >= 1, 'a landed hit spawned a spark');
  assert.equal(afterHit.splashes, 0, 'a hit made no splash');
  assert.equal(p.activeBalls(), 0, 'the balls are spent once they land');
  // A WIDE miss volley.
  p.fire({ from: [0, 5, 0], to: [0, 5, 200], hit: false });
  p.update(MAX_TOF + 0.01);
  const afterMiss = p.snapshot().spawned;
  assert.ok(afterMiss.splashes >= 1, 'a landed miss spawned a splash');
  assert.equal(afterMiss.hits, afterHit.hits, 'the miss added no hit sparks — hit and miss read differently');
});

test('update: ignores a non-positive dt (deterministic, headless-safe)', () => {
  const p = createProjectiles();
  p.fire({ from: [0, 5, 0], to: [0, 5, 100], hit: true });
  const before = p.activeBalls();
  p.update(0); p.update(-1);
  assert.equal(p.activeBalls(), before, 'no time passed → nothing aged');
});

test('pool is BOUNDED — a fire-spam never grows past the fixed pool (leak-free)', () => {
  const p = createProjectiles();
  for (let i = 0; i < 100; i++) p.fire({ from: [0, 5, 0], to: [0, 5, 50], hit: i % 2 === 0 });
  assert.ok(p.activeBalls() <= BALL_POOL, 'balls never exceed the pool');
  assert.ok(p.activeFx() <= FX_POOL, 'puffs never exceed the pool');
});

test('eachBall / eachFx: walk the WHOLE pool in stable slot order (for the InstancedMesh write)', () => {
  const p = createProjectiles();
  p.fire({ from: [0, 5, 0], to: [0, 5, 120], hit: true });
  p.update(0.05); // a frame in — balls are mid-flight
  let ballSlots = 0, livePos = 0;
  p.eachBall((i, pos) => { ballSlots++; if (pos) { livePos++; assert.equal(pos.length, 3); } });
  assert.equal(ballSlots, BALL_POOL, 'every ball slot is visited (idle ones as null)');
  assert.equal(livePos, BALLS_PER_VOLLEY, 'exactly the fired balls report a live position');
  let fxSlots = 0, liveFx = 0;
  p.eachFx((i, pos, scale, kind) => { fxSlots++; if (pos) { liveFx++; assert.ok(scale >= 0 && scale <= 1); assert.ok(kind); } });
  assert.equal(fxSlots, FX_POOL, 'every fx slot is visited');
  assert.ok(liveFx >= 1, 'the muzzle puff is live');
});

test('reduce-motion: fire is a clean no-op (accessibility)', () => {
  const p = createProjectiles({ reducedMotion: true });
  const shot = p.fire({ from: [0, 5, 0], to: [0, 5, 100], hit: true });
  assert.equal(shot, null, 'nothing discharged');
  assert.equal(p.active(), false, 'no balls, no puffs');
});

test('fire: guards a missing from/to (never throws mid-fight)', () => {
  const p = createProjectiles();
  assert.equal(p.fire({ to: [0, 0, 0], hit: true }), null, 'no muzzle → no-op');
  assert.equal(p.fire({ from: [0, 0, 0], hit: true }), null, 'no target → no-op');
  assert.equal(p.active(), false);
});

test('clear: drops the whole pool (new voyage / fight ends) without freeing meshes', () => {
  const p = createProjectiles();
  p.fire({ from: [0, 5, 0], to: [0, 5, 100], hit: true });
  assert.ok(p.active());
  p.clear();
  assert.equal(p.active(), false, 'the pool is quiet again');
});
