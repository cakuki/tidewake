import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slideVelocity,
  resolveCircleCollision,
  sweepIslandCollision,
  sweepShipCollision,
  shipCircles,
  SHIP_RADIUS,
  NPC_RADIUS,
  ISLAND_HITBOX,
} from '../../src/physics.js';

// #76 phase (a2) — tangential slide polish. On contact the hull keeps the part of its velocity
// skimming ALONG the surface (tangential) and loses only the part pressing INTO it (normal):
// graze a coast/hull at an angle → slide on and keep your way; hit it head-on → bleed to a stop.
// One shared rule (`slideVelocity` + the resolvers' contact normal) feeds BOTH the island and the
// ship-vs-ship resolvers, so coasts and hulls feel identical underfoot.

const ISLE = { x: 0, z: 0, r: 100 };
const solidR = (c) => c.r * ISLAND_HITBOX + SHIP_RADIUS; // circle: == 125 for r=100

// ---- slideVelocity: the pure projection ------------------------------------------------

test('slideVelocity: head-on (velocity straight into the surface) is fully killed', () => {
  // Sailing +x, the coast normal points back along -x → all speed bleeds.
  const v = slideVelocity(10, 0, -1, 0);
  assert.ok(Math.hypot(v.vx, v.vz) < 1e-9, `head-on must stop dead, got speed ${Math.hypot(v.vx, v.vz)}`);
});

test('slideVelocity: pure tangential (velocity along the surface) is untouched — full glide', () => {
  // Velocity +z, outward normal +x (perpendicular) → no into-surface part, keep everything.
  const v = slideVelocity(0, 12, 1, 0);
  assert.equal(v.vx, 0);
  assert.equal(v.vz, 12);
});

test('slideVelocity: a glancing angle keeps the tangential component, drops only the normal one', () => {
  // Velocity heading into a +x-facing wall at 30° off the wall: v = (-into, +along).
  // Decompose against outward normal (1,0): tangential = the z part, normal-in = the x part.
  const vx = -4, vz = 10;                 // pressing a little into the wall while skimming along it
  const v = slideVelocity(vx, vz, 1, 0);  // outward normal +x
  assert.ok(Math.abs(v.vx) < 1e-9, 'into-surface (x) component removed');
  assert.equal(v.vz, 10, 'tangential (z) component preserved exactly');
  assert.ok(Math.hypot(v.vx, v.vz) < Math.hypot(vx, vz), 'speed bled (lost the normal part)');
});

test('slideVelocity: velocity heading AWAY from the surface is never resisted', () => {
  // Already leaving the coast (velocity along +x, outward normal +x) → contact must not brake it.
  const v = slideVelocity(9, 2, 1, 0);
  assert.equal(v.vx, 9);
  assert.equal(v.vz, 2);
});

test('slideVelocity: a zero / degenerate normal (no real contact) is a no-op', () => {
  const v = slideVelocity(7, -3, 0, 0);
  assert.equal(v.vx, 7);
  assert.equal(v.vz, -3);
});

test('slideVelocity: a non-unit normal is normalised (magnitude of the normal does not matter)', () => {
  const unit = slideVelocity(-4, 10, 1, 0);
  const scaled = slideVelocity(-4, 10, 37, 0); // same direction, longer
  assert.ok(Math.abs(unit.vx - scaled.vx) < 1e-12 && Math.abs(unit.vz - scaled.vz) < 1e-12);
});

// ---- resolvers expose a usable outward contact normal ---------------------------------

test('resolveCircleCollision: head-on contact returns an outward normal opposite the approach', () => {
  // Drive deep along +x into the island → pushed out along +x, so the outward normal is +x.
  const r = resolveCircleCollision({ x: 1, z: 0 }, [ISLE]);
  assert.equal(r.hit, true);
  assert.ok(r.nx > 0.999 && Math.abs(r.nz) < 1e-9, `outward normal should be +x, got (${r.nx}, ${r.nz})`);
  // …and ramming this +x-facing coast (travelling -x, straight into it) bleeds to a stop.
  const v = slideVelocity(-20, 0, r.nx, r.nz);
  assert.ok(Math.hypot(v.vx, v.vz) < 1e-6, 'head-on velocity into this contact is killed');
});

test('resolveCircleCollision: no contact → zero normal', () => {
  const r = resolveCircleCollision({ x: 800, z: 0 }, [ISLE]);
  assert.equal(r.hit, false);
  assert.equal(r.nx, 0); assert.equal(r.nz, 0);
});

// ---- end-to-end feel: ISLANDS ---------------------------------------------------------
// Mirror exactly what sailing.js does: velocity vector = travel (dx,dz) at dt=1; the contact
// normal comes from the resolver; slideVelocity gives the post-contact speed.

function speedThroughSweep(prev, next, circles, sweepFn = sweepIslandCollision) {
  const r = sweepFn(prev, next, circles);
  const vx = next.x - prev.x, vz = next.z - prev.z; // dt = 1 → velocity == displacement
  const oldSpeed = Math.hypot(vx, vz);
  const slid = slideVelocity(vx, vz, r.nx, r.nz);
  return { hit: r.hit, oldSpeed, newSpeed: Math.hypot(slid.vx, slid.vz), r };
}

test('island slide: a glancing graze keeps MOST of its way on (slides along the coast)', () => {
  // Skim the rim travelling in +x; the hull presses only slightly into the coast.
  const R = solidR(ISLE);
  const prev = { x: -40, z: R - 6 };
  const next = { x: 40, z: R - 6 };
  const s = speedThroughSweep(prev, next, [ISLE]);
  assert.equal(s.hit, true, 'grazed the coast');
  assert.ok(s.newSpeed >= 0.7 * s.oldSpeed, `glance should keep most speed, kept ${(s.newSpeed / s.oldSpeed * 100).toFixed(0)}%`);
});

test('island slide: a head-on charge bleeds its speed (stops dead at the coast)', () => {
  const prev = { x: 0, z: -200 };
  const next = { x: 0, z: 0 }; // dead at the island centre
  const s = speedThroughSweep(prev, next, [ISLE]);
  assert.equal(s.hit, true, 'rammed the coast');
  assert.ok(s.newSpeed < 0.1 * s.oldSpeed, `head-on should bleed to ~0, kept ${(s.newSpeed / s.oldSpeed * 100).toFixed(0)}%`);
});

test('island slide: open-water travel keeps full speed (no phantom braking)', () => {
  const s = speedThroughSweep({ x: 400, z: 400 }, { x: 430, z: 420 }, [ISLE]);
  assert.equal(s.hit, false);
  assert.ok(Math.abs(s.newSpeed - s.oldSpeed) < 1e-9, 'untouched in open water');
});

test('island slide: non-penetration still holds (a2 must not regress a1/beach fix)', () => {
  const prev = { x: 0, z: -200 }, next = { x: 0, z: 0 };
  const r = sweepIslandCollision(prev, next, [ISLE]);
  assert.ok(Math.hypot(r.x, r.z) >= solidR(ISLE) - 1e-6, 'hull never ends up inside the coast');
});

// ---- end-to-end feel: SHIP-VS-SHIP (same shared rule) ---------------------------------

test('ship slide: a glancing bump past another hull keeps most of its way on', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  const BOUND = SHIP_RADIUS + NPC_RADIUS;
  const prev = { x: -40, z: BOUND - 3 };
  const next = { x: 40, z: BOUND - 3 };
  const s = speedThroughSweep(prev, next, [npc], sweepShipCollision);
  assert.equal(s.hit, true, 'grazed the other hull');
  assert.ok(s.newSpeed >= 0.7 * s.oldSpeed, `bump-past should keep most speed, kept ${(s.newSpeed / s.oldSpeed * 100).toFixed(0)}%`);
});

test('ship slide: a head-on ram into another hull bleeds speed (soft pile-up, not phasing)', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  const prev = { x: -200, z: 0 };
  const next = { x: 0, z: 0 };
  const s = speedThroughSweep(prev, next, [npc], sweepShipCollision);
  assert.equal(s.hit, true);
  assert.ok(s.newSpeed < 0.1 * s.oldSpeed, `head-on bump should bleed to ~0, kept ${(s.newSpeed / s.oldSpeed * 100).toFixed(0)}%`);
});

test('ship slide: islands and hulls share ONE rule — same approach geometry, same speed outcome', () => {
  // Identical glancing geometry against an island vs a vessel of equal solid radius → equal slide.
  const R = 40;
  const isle = { x: 0, z: 0, r: (R - SHIP_RADIUS) / ISLAND_HITBOX }; // solidR(isle) == R
  const ship = { x: 0, z: 0, r: R - SHIP_RADIUS };                   // r + shipR == R
  const prev = { x: -30, z: R - 4 }, next = { x: 30, z: R - 4 };
  const a = speedThroughSweep(prev, next, [isle], sweepIslandCollision);
  const b = speedThroughSweep(prev, next, [ship], sweepShipCollision);
  assert.ok(a.hit && b.hit, 'both contacts registered');
  assert.ok(Math.abs(a.newSpeed - b.newSpeed) < 1e-6, `coast and hull slide identically (${a.newSpeed} vs ${b.newSpeed})`);
});

test('ship slide: built from a live snapshot via shipCircles (no overlap, slides past)', () => {
  const BOUND = SHIP_RADIUS + NPC_RADIUS;
  const ships = shipCircles([{ pos: [0, 0], heading: 0 }]);
  const s = speedThroughSweep({ x: -40, z: BOUND - 3 }, { x: 40, z: BOUND - 3 }, ships, sweepShipCollision);
  assert.equal(s.hit, true);
  assert.ok(s.newSpeed >= 0.7 * s.oldSpeed, 'glance off a snapshotted vessel keeps most way');
});
