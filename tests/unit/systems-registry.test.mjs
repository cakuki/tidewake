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

test('when(ctx)=>false skips a system; when(ctx)=>true runs it (mode-eligibility as a declaration)', () => {
  const r = createSystemsRegistry();
  const ran = [];
  r.register({ name: 'always', order: 10, update: () => ran.push('always') });
  r.register({ name: 'gated-off', order: 20, when: () => false, update: () => ran.push('gated-off') });
  r.register({ name: 'gated-on', order: 30, when: () => true, update: () => ran.push('gated-on') });
  r.run({});
  assert.deepEqual(ran, ['always', 'gated-on'], 'the false-gated system is skipped, order otherwise preserved');
});

test('when receives the SAME frame ctx as update (predicate reads live frame state)', () => {
  const r = createSystemsRegistry();
  let seenInWhen = null;
  const ctx = { paused: true };
  r.register({
    name: 'mode-aware', order: 10,
    when: (c) => { seenInWhen = c; return !c.paused; },
    update: () => { throw new Error('must not run while paused'); },
  });
  r.run(ctx);
  assert.equal(seenInWhen, ctx, 'when is handed the exact frame ctx object');
});

test('when is re-evaluated every frame (a system gates in and out as ctx changes)', () => {
  const r = createSystemsRegistry();
  const ran = [];
  r.register({ name: 'only-when-sailing', order: 10, when: (c) => c.mode === 'sailing', update: (c) => ran.push(c.mode) });
  r.run({ mode: 'town' });    // skipped
  r.run({ mode: 'sailing' }); // runs
  r.run({ mode: 'battle' });  // skipped
  r.run({ mode: 'sailing' }); // runs
  assert.deepEqual(ran, ['sailing', 'sailing']);
});

test('a when that is present but not a function throws (a bad predicate is a bug, not silent)', () => {
  const r = createSystemsRegistry();
  assert.throws(() => r.register({ name: 'bad', when: 'nope', update: () => {} }), /when/);
});

test('names lists every registered system regardless of its when gate (wiring view, not run view)', () => {
  const r = createSystemsRegistry();
  r.register({ name: 'a', order: 10, when: () => false, update: () => {} });
  r.register({ name: 'b', order: 20, update: () => {} });
  assert.deepEqual(r.names, ['a', 'b'], 'a gated-off system is still wired and visible to QA');
  assert.equal(r.count, 2);
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
