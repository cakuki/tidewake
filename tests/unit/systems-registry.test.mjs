// Systems-registry pure-logic tests (#120, DL #4). The registry is the self-registering per-frame
// update backbone that lets main.js stay thin and lets a future slice (battle #100, fixed-timestep
// #36) plug a system in without hand-editing the update loop. The ONE behaviour that must never rot
// is DETERMINISTIC DISPATCH ORDER — a refactor that quietly reorders systems changes the game. These
// tests pin register/order/dispatch with no THREE and no DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSystemsRegistry } from '../../src/systems/registry.js';

test('run dispatches registered systems and passes the SAME ctx to each', () => {
  const r = createSystemsRegistry();
  const seen = [];
  r.register({ name: 'a', update: (ctx) => seen.push(['a', ctx]) });
  r.register({ name: 'b', update: (ctx) => seen.push(['b', ctx]) });
  const ctx = { dt: 0.016, t: 1 };
  const returned = r.run(ctx);
  assert.deepEqual(seen.map((s) => s[0]), ['a', 'b']);
  assert.equal(seen[0][1], ctx, 'first system gets the exact ctx object');
  assert.equal(seen[1][1], ctx, 'second system gets the SAME ctx object');
  assert.equal(returned, ctx, 'run returns the ctx for chaining');
});

test('equal order preserves registration order (stable dispatch)', () => {
  const r = createSystemsRegistry();
  const order = [];
  r.register({ name: 'first', order: 0, update: () => order.push('first') });
  r.register({ name: 'second', order: 0, update: () => order.push('second') });
  r.register({ name: 'third', order: 0, update: () => order.push('third') });
  r.run({});
  assert.deepEqual(order, ['first', 'second', 'third']);
});

test('lower order runs first regardless of registration order', () => {
  const r = createSystemsRegistry();
  const order = [];
  r.register({ name: 'late', order: 40, update: () => order.push('late') });
  r.register({ name: 'early', order: 10, update: () => order.push('early') });
  r.register({ name: 'mid', order: 20, update: () => order.push('mid') });
  r.run({});
  assert.deepEqual(order, ['early', 'mid', 'late']);
});

test('a system slotted between two existing ones lands in the gap (spaced orders)', () => {
  const r = createSystemsRegistry();
  const order = [];
  r.register({ name: 'a', order: 10, update: () => order.push('a') });
  r.register({ name: 'c', order: 30, update: () => order.push('c') });
  r.register({ name: 'b', order: 20, update: () => order.push('b') }); // slots between, no renumber
  r.run({});
  assert.deepEqual(order, ['a', 'b', 'c']);
});

test('order defaults to 0 and ties break by registration order', () => {
  const r = createSystemsRegistry();
  const order = [];
  r.register({ name: 'z', update: () => order.push('z') });           // default 0
  r.register({ name: 'neg', order: -5, update: () => order.push('neg') });
  r.register({ name: 'y', update: () => order.push('y') });           // default 0, after z
  r.run({});
  assert.deepEqual(order, ['neg', 'z', 'y']);
});

test('names reflects the deterministic dispatch order; count tracks size', () => {
  const r = createSystemsRegistry();
  r.register({ name: 'hud', order: 40, update: () => {} });
  r.register({ name: 'wake', order: 10, update: () => {} });
  assert.deepEqual(r.names, ['wake', 'hud']);
  assert.equal(r.count, 2);
});

test('register guards: a missing name, a non-function update, and a duplicate name all throw', () => {
  const r = createSystemsRegistry();
  assert.throws(() => r.register({ update: () => {} }), /name/);
  assert.throws(() => r.register({ name: 'x' }), /function/);
  r.register({ name: 'dup', update: () => {} });
  assert.throws(() => r.register({ name: 'dup', update: () => {} }), /already/);
});

test('clear empties the registry', () => {
  const r = createSystemsRegistry();
  r.register({ name: 'a', update: () => {} });
  r.clear();
  assert.equal(r.count, 0);
  assert.deepEqual(r.names, []);
});

test('run is repeatable and deterministic across frames', () => {
  const r = createSystemsRegistry();
  const calls = [];
  r.register({ name: 'b', order: 20, update: (c) => calls.push(`b${c.f}`) });
  r.register({ name: 'a', order: 10, update: (c) => calls.push(`a${c.f}`) });
  r.run({ f: 1 });
  r.run({ f: 2 });
  assert.deepEqual(calls, ['a1', 'b1', 'a2', 'b2']);
});
