// Unit: the typed world-target objective model (#115, DL#4 keystone; #53 self-tested-component
// standard). No browser, no THREE — objectives.js turns a chosen rumour's typed target into a
// tracked sea objective and resolves it on arrival, DETERMINISTICALLY, so the marker (#111),
// arrival-payoff (#112) and the save round-trip all read one source of truth instead of
// re-parsing rumour prose. These tests pin accept / track / resolve / payoff + the save shape.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeTarget, makeObjective, resolvesAt, payoffFor, resolveObjective, sanitizeObjective,
  RUMOUR_REWARD_COINS, TARGET_KINDS,
} from '../../src/objectives.js';

const PORT = 'Saltpurse Quay';

// ---- sanitizeTarget: only clean typed targets survive ---------------------------------

test('sanitizeTarget keeps a clean port target (with optional coords)', () => {
  assert.deepEqual(sanitizeTarget({ kind: 'port', name: PORT }), { kind: 'port', name: PORT });
  assert.deepEqual(sanitizeTarget({ kind: 'port', name: PORT, x: 12, z: -3 }),
    { kind: 'port', name: PORT, x: 12, z: -3 });
});

test('sanitizeTarget rejects junk (bad kind, empty name, non-object, partial coords)', () => {
  assert.equal(sanitizeTarget(null), null);
  assert.equal(sanitizeTarget({}), null);
  assert.equal(sanitizeTarget({ kind: 'wormhole', name: PORT }), null);
  assert.equal(sanitizeTarget({ kind: 'port', name: '   ' }), null);
  // partial / non-finite coords are simply dropped, not fatal
  const t = sanitizeTarget({ kind: 'port', name: PORT, x: 5, z: NaN });
  assert.deepEqual(t, { kind: 'port', name: PORT });
  assert.ok(TARGET_KINDS.has('port') && TARGET_KINDS.has('isle') && TARGET_KINDS.has('sea'));
});

// ---- makeObjective: accept a chosen rumour as a tracked objective ----------------------

test('makeObjective builds an active rumour objective with the default payoff', () => {
  const o = makeObjective({ kind: 'port', name: PORT, x: 1, z: 2 });
  assert.equal(o.kind, 'rumour');
  assert.equal(o.status, 'active');
  assert.deepEqual(o.target, { kind: 'port', name: PORT, x: 1, z: 2 });
  assert.equal(o.payoff.coins, RUMOUR_REWARD_COINS);
});

test('makeObjective honours a payoff override and rejects a junk target', () => {
  assert.equal(makeObjective({ kind: 'port', name: PORT }, { coins: 25 }).payoff.coins, 25);
  assert.equal(makeObjective(null), null);
  assert.equal(makeObjective({ kind: 'nope', name: PORT }), null);
});

test('makeObjective does not mutate its input target', () => {
  const input = { kind: 'port', name: PORT, x: 1, z: 2 };
  const snapshot = JSON.stringify(input);
  makeObjective(input);
  assert.equal(JSON.stringify(input), snapshot);
});

// ---- resolvesAt: arrival detection reads the typed target -----------------------------

test('resolvesAt is true only at the matching port while active', () => {
  const o = makeObjective({ kind: 'port', name: PORT });
  assert.equal(resolvesAt(o, PORT), true);
  assert.equal(resolvesAt(o, 'Barnacle Bottom'), false);
  assert.equal(resolvesAt(o, null), false);
  assert.equal(resolvesAt(null, PORT), false);
});

test('a resolved (done) objective never resolves again — no double-pay', () => {
  const o = makeObjective({ kind: 'port', name: PORT });
  const done = resolveObjective(o);
  assert.equal(done.status, 'done');
  assert.equal(o.status, 'active', 'resolveObjective must not mutate the input');
  assert.equal(resolvesAt(done, PORT), false);
  assert.deepEqual(payoffFor(done), { coins: 0 });
});

// ---- payoffFor: the deterministic reward ----------------------------------------------

test('payoffFor returns the objective payoff while active, zero otherwise', () => {
  assert.deepEqual(payoffFor(makeObjective({ kind: 'port', name: PORT }, { coins: 80 })), { coins: 80 });
  assert.deepEqual(payoffFor(null), { coins: 0 });
});

// ---- sanitizeObjective: the save round-trip (fail open) --------------------------------

test('sanitizeObjective round-trips a clean active objective', () => {
  const o = makeObjective({ kind: 'port', name: PORT, x: 9, z: 4 }, { coins: 60 });
  assert.deepEqual(sanitizeObjective(o), o);
});

test('sanitizeObjective drops junk / done / non-active to null (fail open)', () => {
  assert.equal(sanitizeObjective(null), null);
  assert.equal(sanitizeObjective({}), null);
  assert.equal(sanitizeObjective({ status: 'done', target: { kind: 'port', name: PORT } }), null);
  assert.equal(sanitizeObjective({ status: 'active', target: { kind: 'port', name: '' } }), null);
  // a corrupt payoff is coerced, not fatal
  const o = sanitizeObjective({ status: 'active', target: { kind: 'port', name: PORT }, payoff: { coins: -5 } });
  assert.deepEqual(o, { kind: 'rumour', target: { kind: 'port', name: PORT }, payoff: { coins: 0 }, status: 'active' });
});
