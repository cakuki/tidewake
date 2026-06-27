import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  shipCircles,
  sweepShipCollision,
  resolveCircleCollision,
  SHIP_RADIUS,
  NPC_RADIUS,
} from '../../src/physics.js';

// #76 phase (b): the player ship BUMPS other vessels instead of sailing through them — the same
// forgiving circle-hitbox push-out/slide the island resolver uses, with the boundary set to the
// two hulls' radii summed so they rest gunwale-to-gunwale. Player-only resolution, arcade-soft.

const BOUND = SHIP_RADIUS + NPC_RADIUS; // solid boundary between the two hull centres

test('shipCircles: maps NPC snapshots to flat {x,z,r} circles', () => {
  const npcs = [{ pos: [100, -50], heading: 0.3 }, { pos: [0, 0], heading: 1 }];
  const circles = shipCircles(npcs);
  assert.equal(circles.length, 2);
  assert.deepEqual(circles[0], { x: 100, z: -50, r: NPC_RADIUS });
  assert.deepEqual(circles[1], { x: 0, z: 0, r: NPC_RADIUS });
});

test('shipCircles: skips malformed entries and tolerates null', () => {
  assert.deepEqual(shipCircles(null), []);
  assert.deepEqual(shipCircles(undefined), []);
  const circles = shipCircles([{ pos: [1, 2] }, {}, { pos: [3] }, null]);
  assert.equal(circles.length, 1);
  assert.deepEqual(circles[0], { x: 1, z: 2, r: NPC_RADIUS });
});

test('resolveCircleCollision (hitbox 1): an NPC vessel is solid — player pushed to the boundary, not stuck inside', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  const inside = { x: 3, z: 0 }; // deep inside the combined hull boundary
  const r = resolveCircleCollision(inside, [npc], { hitbox: 1 });
  assert.equal(r.hit, true, 'hulls touched');
  const dist = Math.hypot(r.x - npc.x, r.z - npc.z);
  assert.ok(Math.abs(dist - BOUND) < 1e-6, `pushed exactly to the boundary, got ${dist}`);
});

test('resolveCircleCollision (hitbox 1): a player clear of the vessel is untouched', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  const far = { x: BOUND + 50, z: 0 };
  const r = resolveCircleCollision(far, [npc], { hitbox: 1 });
  assert.equal(r.hit, false, 'no contact in open water');
  assert.equal(r.x, far.x); assert.equal(r.z, far.z);
});

test('sweepShipCollision: a head-on drive into a vessel ends at the boundary (not overlapping, not stuck)', () => {
  const npc = { x: 200, z: 0, r: NPC_RADIUS };
  const prev = { x: 100, z: 0 };
  const next = { x: 200, z: 0 }; // aimed dead at the vessel's centre
  const r = sweepShipCollision(prev, next, [npc]);
  assert.equal(r.hit, true, 'the other hull stopped it');
  const dist = Math.hypot(r.x - npc.x, r.z - npc.z);
  assert.ok(dist >= BOUND - 1e-6, `must not be inside the other hull, got ${dist} < ${BOUND}`);
  // and it piled up on the NEAR side — never popped out the far side.
  assert.ok(r.x <= npc.x + 1e-6, `should rest on the approach side, got x=${r.x}`);
});

test('sweepShipCollision: a glancing approach slides past and keeps most of its way on', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  // skim along just inside the boundary on the +x side, travelling in +z
  const prev = { x: BOUND - 3, z: -60 };
  const next = { x: BOUND - 3, z: 60 };
  const r = sweepShipCollision(prev, next, [npc]);
  assert.equal(r.hit, true, 'grazed the other hull');
  assert.ok(r.z > 30, `should slide on past in +z, got z=${r.z}`);
  const dist = Math.hypot(r.x - npc.x, r.z - npc.z);
  assert.ok(dist >= BOUND - 1e-6, `slid along the boundary, not through it (dist=${dist})`);
});

test('sweepShipCollision: a fast ship cannot tunnel clean through a vessel', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  const prev = { x: -400, z: 0 };
  const next = { x: 400, z: 0 }; // a huge single step straight through the vessel
  const r = sweepShipCollision(prev, next, [npc]);
  assert.equal(r.hit, true, 'the vessel was hit, not skipped');
  const dist = Math.hypot(r.x - npc.x, r.z - npc.z);
  assert.ok(dist >= BOUND - 1e-6, `must not end up inside the hull (dist=${dist})`);
  assert.ok(r.x <= npc.x + 1e-6, `must not have popped out the far side, got x=${r.x}`);
});

test('sweepShipCollision: open-water motion passes through unchanged', () => {
  const npc = { x: 0, z: 0, r: NPC_RADIUS };
  const prev = { x: 300, z: 300 }, next = { x: 320, z: 280 };
  const r = sweepShipCollision(prev, next, [npc]);
  assert.equal(r.hit, false);
  assert.equal(r.x, next.x); assert.equal(r.z, next.z);
});

test('sweepShipCollision: no other vessels → motion is a no-op pass-through', () => {
  const prev = { x: 0, z: 0 }, next = { x: 50, z: 50 };
  const r = sweepShipCollision(prev, next, []);
  assert.equal(r.hit, false);
  assert.equal(r.x, 50); assert.equal(r.z, 50);
});
