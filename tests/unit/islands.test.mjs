// Unit: the island naming + approach-introduction PURE logic (#19; #53 self-tested standard).
// No browser / three.js — islands.js maps each island (by index) to a stable, original,
// in-tone name + comedic flavour line, and decides WHEN to fire the one-time "you're
// approaching <Name>" beat. We assert: names are stable & unique, never clash with a port
// name, the approach detector fires inside range, and the "already introduced" once-only
// guard means a given island greets you exactly once per session.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ISLAND_LORE, APPROACH_RANGE, assignIslandNames, detectApproach,
  nearestIsland, createIslandNamer,
} from '../../src/islands.js';
import { PORT_NAMES } from '../../src/economy.js';

test('the authored lore pool is generous, original and well-formed', () => {
  assert.ok(ISLAND_LORE.length >= 8, `want >=8 authored isles, got ${ISLAND_LORE.length}`);
  for (const e of ISLAND_LORE) {
    assert.ok(typeof e.name === 'string' && e.name.length > 0, 'every isle has a name');
    assert.ok(typeof e.flavour === 'string' && e.flavour.length > 0, 'every isle has flavour');
  }
  // Names are unique within the pool.
  const names = ISLAND_LORE.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, 'pool names are unique');
});

test('assignIslandNames is stable, deterministic and collision-free', () => {
  const a = assignIslandNames(6);
  const b = assignIslandNames(6);
  assert.equal(a.length, 6);
  // Same index → same name every call (stable across reloads).
  for (let i = 0; i < a.length; i++) assert.equal(a[i].name, b[i].name);
  // No two islands share a name.
  const names = a.map((x) => x.name);
  assert.equal(new Set(names).size, names.length, 'assigned names are unique');
});

test('assigned names stay unique even when more islands than lore (wrap with a suffix)', () => {
  const n = ISLAND_LORE.length + 3;
  const a = assignIslandNames(n);
  const names = a.map((x) => x.name);
  assert.equal(new Set(names).size, n, 'wrapped names remain unique');
});

test('no island name collides with a harbour/port name', () => {
  const ports = new Set(PORT_NAMES);
  for (const e of ISLAND_LORE) assert.ok(!ports.has(e.name), `island "${e.name}" must not duplicate a port name`);
  for (const a of assignIslandNames(20)) assert.ok(!ports.has(a.name), `assigned "${a.name}" must not duplicate a port name`);
});

const ISLES = [
  { index: 0, x: 300, z: 0, r: 60 },
  { index: 1, x: -800, z: 800, r: 90 },
];

test('detectApproach fires only inside an island\'s approach range', () => {
  const introduced = new Set();
  // Far away → nobody greets.
  assert.equal(detectApproach({ x: 0, z: 0 }, ISLES, introduced), -1);
  // Just outside the range of isle 0 (r=60, range adds APPROACH_RANGE) → still nothing.
  const justOutside = { x: 300 - (60 + APPROACH_RANGE) - 5, z: 0 };
  assert.equal(detectApproach(justOutside, ISLES, introduced), -1);
  // Just inside → isle 0 is picked.
  const justInside = { x: 300 - (60 + APPROACH_RANGE) + 5, z: 0 };
  assert.equal(detectApproach(justInside, ISLES, introduced), 0);
});

test('detectApproach respects the already-introduced set (once-only)', () => {
  const introduced = new Set();
  const onIt = { x: 300, z: 0 };          // sitting right on isle 0
  assert.equal(detectApproach(onIt, ISLES, introduced), 0);
  introduced.add(0);
  // Same spot, now introduced → no repeat.
  assert.equal(detectApproach(onIt, ISLES, introduced), -1);
});

test('detectApproach picks the NEAREST eligible island when two are in range', () => {
  const close = [
    { index: 0, x: 100, z: 0, r: 50 },
    { index: 1, x: 140, z: 0, r: 50 },
  ];
  // Standing at x=120: both within range, isle 0 (dist 20) is nearer than isle 1 (dist 20)...
  // place the ship clearly nearer to isle 1.
  assert.equal(detectApproach({ x: 135, z: 0 }, close, new Set()), 1);
  assert.equal(detectApproach({ x: 105, z: 0 }, close, new Set()), 0);
});

test('detectApproach reads both {x,z} and [x,y,z] position shapes', () => {
  assert.equal(detectApproach([300, 5, 0], ISLES, new Set()), 0);
});

test('nearestIsland returns the closest island with its distance', () => {
  const n = nearestIsland({ x: 0, z: 0 }, ISLES);
  assert.equal(n.index, 0);
  assert.ok(Math.abs(n.dist - 300) < 1e-9);
});

// --- the factory: drives a fake world of island groups ---
function fakeWorld(spots) {
  return { islands: { children: spots.map(([x, z, r]) => ({ position: { x, z }, userData: { radius: r } })) } };
}

test('createIslandNamer names every island and exposes a serialisable list', () => {
  const namer = createIslandNamer({ world: fakeWorld([[300, 0, 60], [-800, 800, 90]]) });
  assert.equal(namer.list.length, 2);
  assert.ok(namer.list.every((i) => i.name && i.flavour));
  assert.notEqual(namer.list[0].name, namer.list[1].name);
});

test('createIslandNamer fires onApproach EXACTLY once per island as you sail in', () => {
  const namer = createIslandNamer({ world: fakeWorld([[300, 0, 60]]) });
  const calls = [];
  // Far out → no greeting.
  namer.update({ x: 0, z: 0 }, (name, flavour) => calls.push([name, flavour]));
  assert.equal(calls.length, 0);
  // Sail onto it → one greeting.
  namer.update({ x: 300, z: 0 }, (name, flavour) => calls.push([name, flavour]));
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], namer.list[0].name);
  assert.ok(calls[0][1].length > 0);
  // Linger → no repeat (once per session).
  namer.update({ x: 300, z: 0 }, (name, flavour) => calls.push([name, flavour]));
  assert.equal(calls.length, 1);
  assert.deepEqual(namer.introduced, [0]);
});

test('reset re-arms every greeting (a fresh voyage discovers the isles anew)', () => {
  const namer = createIslandNamer({ world: fakeWorld([[300, 0, 60]]) });
  const calls = [];
  const cb = (name) => calls.push(name);
  namer.update({ x: 300, z: 0 }, cb);
  assert.equal(calls.length, 1);
  namer.update({ x: 300, z: 0 }, cb);   // already introduced → silent
  assert.equal(calls.length, 1);
  namer.reset();
  assert.deepEqual(namer.introduced, []);
  namer.update({ x: 300, z: 0 }, cb);   // greets again after reset
  assert.equal(calls.length, 2);
});
