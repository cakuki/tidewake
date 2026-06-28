import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshPortMemory, portRecord, recallLine, rememberArrival, sanitizePortMemory,
} from '../../src/systems/port-memory.js';

// ---- portRecord / freshPortMemory ----------------------------------------------------------
test('freshPortMemory is an empty store', () => {
  assert.deepEqual(freshPortMemory(), {});
});

test('portRecord returns a zeroed record for an unvisited port', () => {
  assert.deepEqual(portRecord({}, 'Saltpurse Quay'), { visits: 0, lastTier: 0, lastPole: 'neutral' });
  assert.deepEqual(portRecord(null, 'Anywhere'), { visits: 0, lastTier: 0, lastPole: 'neutral' });
});

// ---- recallLine: the reactive verb (the harbourmaster REMEMBERS you) ------------------------
test('recallLine is null on a genuine first visit (let the stranger greeting play)', () => {
  assert.equal(recallLine({ visits: 0, lastTier: 0, lastPole: 'neutral' }, { tier: 0, pole: 'neutral' }, 'Saltpurse Quay'), null);
  assert.equal(recallLine(undefined, { tier: 1, pole: 'pirate' }, 'Saltpurse Quay'), null);
});

test('recallLine recalls a return visit and substitutes {port} + {n}', () => {
  const line = recallLine({ visits: 2, lastTier: 0, lastPole: 'neutral' }, { tier: 0, pole: 'neutral' }, "Gullet's Rest");
  assert.equal(typeof line, 'string');
  assert.ok(line.length > 0);
  assert.ok(line.includes("Gullet's Rest"), 'substitutes the port name');
  assert.ok(!line.includes('{port}') && !line.includes('{n}'), 'leaves no template tokens');
});

test('recallLine cools when you return flying a darker flag (turned pirate)', () => {
  const line = recallLine({ visits: 1, lastTier: 1, lastPole: 'governor' }, { tier: 1, pole: 'pirate' }, 'Barnacle Bottom');
  assert.ok(/darker flag|black|worry|thin/.test(line), `expected a cooler welcome, got: ${line}`);
});

test('recallLine warms when a former rogue returns respectable (turned governor)', () => {
  const line = recallLine({ visits: 1, lastTier: 1, lastPole: 'pirate' }, { tier: 1, pole: 'governor' }, 'Barnacle Bottom');
  assert.ok(/respectable|relaxes|credit|welcome/i.test(line), `expected a warmer welcome, got: ${line}`);
});

test('recallLine notices when you have risen a tier since last call', () => {
  const line = recallLine({ visits: 1, lastTier: 0, lastPole: 'neutral' }, { tier: 2, pole: 'neutral' }, 'Saltpurse Quay');
  assert.ok(/grown|risen|smaller|noticed|places/i.test(line), `expected a "you've grown" line, got: ${line}`);
});

test('recallLine is deterministic for the same (record, current, port)', () => {
  const rec = { visits: 3, lastTier: 1, lastPole: 'neutral' };
  const cur = { tier: 1, pole: 'neutral' };
  assert.equal(recallLine(rec, cur, 'Saltpurse Quay'), recallLine(rec, cur, 'Saltpurse Quay'));
});

// ---- rememberArrival: banking a visit -------------------------------------------------------
test('rememberArrival banks the first visit and snapshots current standing', () => {
  const store = rememberArrival(freshPortMemory(), 'Saltpurse Quay', { tier: 1, pole: 'pirate' });
  assert.deepEqual(store['Saltpurse Quay'], { visits: 1, lastTier: 1, lastPole: 'pirate' });
});

test('rememberArrival increments the visit count across calls', () => {
  let store = freshPortMemory();
  store = rememberArrival(store, 'Saltpurse Quay', { tier: 0, pole: 'neutral' });
  store = rememberArrival(store, 'Saltpurse Quay', { tier: 1, pole: 'governor' });
  store = rememberArrival(store, 'Saltpurse Quay', { tier: 2, pole: 'governor' });
  assert.equal(store['Saltpurse Quay'].visits, 3);
  assert.equal(store['Saltpurse Quay'].lastPole, 'governor'); // newest snapshot wins
  assert.equal(store['Saltpurse Quay'].lastTier, 2);
});

test('rememberArrival keeps ports independent and never mutates the input', () => {
  const before = rememberArrival(freshPortMemory(), 'Saltpurse Quay', { tier: 0, pole: 'neutral' });
  const after = rememberArrival(before, 'Barnacle Bottom', { tier: 1, pole: 'pirate' });
  assert.equal(before['Barnacle Bottom'], undefined, 'input store is not mutated');
  assert.equal(after['Saltpurse Quay'].visits, 1);
  assert.equal(after['Barnacle Bottom'].visits, 1);
});

// ---- The full reactive loop: remember a visit, then RECALL it on return --------------------
test('a return visit recalls the PRIOR record, then banks the new one', () => {
  let store = freshPortMemory();
  // First landfall — no memory yet, so no recall.
  assert.equal(recallLine(portRecord(store, 'Saltpurse Quay'), { tier: 0, pole: 'neutral' }, 'Saltpurse Quay'), null);
  store = rememberArrival(store, 'Saltpurse Quay', { tier: 0, pole: 'neutral' });
  // Sail away, grow a name, come back — now the port remembers + reacts.
  const recall = recallLine(portRecord(store, 'Saltpurse Quay'), { tier: 2, pole: 'governor' }, 'Saltpurse Quay');
  assert.ok(recall && recall.includes('Saltpurse Quay'));
});

// ---- sanitizePortMemory: fail-open, like legends/onboarding/ballad --------------------------
test('sanitizePortMemory passes a clean store through', () => {
  const clean = { 'Saltpurse Quay': { visits: 2, lastTier: 1, lastPole: 'pirate' } };
  assert.deepEqual(sanitizePortMemory(clean), clean);
});

test('sanitizePortMemory fails open: junk becomes an empty store, never throws', () => {
  assert.deepEqual(sanitizePortMemory(null), {});
  assert.deepEqual(sanitizePortMemory(undefined), {});
  assert.deepEqual(sanitizePortMemory(42), {});
  assert.deepEqual(sanitizePortMemory('nope'), {});
  assert.deepEqual(sanitizePortMemory([1, 2, 3]), {});
});

test('sanitizePortMemory drops malformed / zero-visit records and coerces fields', () => {
  const dirty = {
    'Saltpurse Quay': { visits: 3, lastTier: 9, lastPole: 'kraken' }, // tier over-clamped, junk pole → neutral
    'Barnacle Bottom': { visits: 0 },                                  // never really visited → dropped
    "Gullet's Rest": 'not-an-object',                                  // junk → dropped
    'Phantom': { visits: -5 },                                         // junk visits → dropped
  };
  const out = sanitizePortMemory(dirty);
  assert.deepEqual(out, { 'Saltpurse Quay': { visits: 3, lastTier: 2, lastPole: 'neutral' } });
});
