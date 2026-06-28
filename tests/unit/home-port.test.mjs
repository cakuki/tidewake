import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHarbour, sanitizeHarbour, isHome, harbourLevelName, investCost, investStanding,
  canClaim, claim, canInvest, invest, harbourGreeting,
  CLAIM_STANDING, CLAIM_REWARD, MAX_LEVEL,
} from '../../src/systems/home-port.js';

// ---- freshHarbour / sanitizeHarbour (fail-open save round-trip) -----------------------------
test('freshHarbour is null — you have claimed nowhere yet', () => {
  assert.equal(freshHarbour(), null);
});

test('sanitizeHarbour fails open: junk → null, never throws', () => {
  for (const junk of [null, undefined, 0, 'x', [], {}, { name: '' }, { name: 42 }, { level: 2 }]) {
    assert.equal(sanitizeHarbour(junk), null);
  }
});

test('sanitizeHarbour cleans a well-formed record and clamps the level', () => {
  assert.deepEqual(sanitizeHarbour({ name: "Gullet's Rest", level: 2, invested: 150 }),
    { name: "Gullet's Rest", level: 2, invested: 150 });
  // level clamps into [1, MAX_LEVEL]; a claimed harbour is at least level 1
  assert.equal(sanitizeHarbour({ name: 'X', level: 0 }).level, 1);
  assert.equal(sanitizeHarbour({ name: 'X', level: 99 }).level, MAX_LEVEL);
  assert.equal(sanitizeHarbour({ name: 'X', level: 2, invested: -5 }).invested, 0);
});

test('sanitizeHarbour round-trips a live harbour unchanged', () => {
  const h = { name: 'Saltpurse Quay', level: 3, invested: 500 };
  assert.deepEqual(sanitizeHarbour(JSON.parse(JSON.stringify(h))), h);
});

// ---- isHome / labels -----------------------------------------------------------------------
test('isHome only true for the claimed port', () => {
  const h = { name: 'Barnacle Bottom', level: 1, invested: 0 };
  assert.equal(isHome(h, 'Barnacle Bottom'), true);
  assert.equal(isHome(h, 'Gullet\'s Rest'), false);
  assert.equal(isHome(null, 'Barnacle Bottom'), false);
});

test('harbourLevelName gives a tier label', () => {
  assert.equal(harbourLevelName(1), 'Claimed berth');
  assert.equal(harbourLevelName(MAX_LEVEL), 'Jewel of the lanes');
});

// ---- claim: the gate (sufficient Standing) -------------------------------------------------
test('canClaim refuses below the Standing gate', () => {
  const r = canClaim({ harbour: null, port: 'P', standing: CLAIM_STANDING - 1 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'low-standing');
});

test('canClaim allows a respected captain to claim a fresh port', () => {
  assert.deepEqual(canClaim({ harbour: null, port: 'P', standing: CLAIM_STANDING }), { ok: true });
});

test('canClaim refuses claiming your existing home / a second home', () => {
  const h = { name: 'P', level: 1, invested: 0 };
  assert.equal(canClaim({ harbour: h, port: 'P', standing: 999 }).reason, 'already-home');
  assert.equal(canClaim({ harbour: h, port: 'Q', standing: 999 }).reason, 'has-home');
});

test('canClaim refuses with no docked port', () => {
  assert.equal(canClaim({ harbour: null, port: '', standing: 999 }).reason, 'no-port');
});

test('claim mints a level-1 harbour and earns Standing', () => {
  const r = claim({ harbour: null, port: "Gullet's Rest", standing: CLAIM_STANDING });
  assert.equal(r.ok, true);
  assert.deepEqual(r.harbour, { name: "Gullet's Rest", level: 1, invested: 0 });
  assert.equal(r.standingGain, CLAIM_REWARD);
});

test('claim is a pure no-op when the gate fails', () => {
  assert.equal(claim({ harbour: null, port: 'P', standing: 0 }).ok, false);
});

// ---- invest: spend coin → grow one level + earn Standing -----------------------------------
test('investCost is null with no harbour or at max level', () => {
  assert.equal(investCost(null), null);
  assert.equal(investCost({ name: 'P', level: MAX_LEVEL, invested: 0 }), null);
  assert.equal(typeof investCost({ name: 'P', level: 1, invested: 0 }), 'number');
});

test('canInvest refuses when not at your home port', () => {
  const h = { name: 'P', level: 1, invested: 0 };
  assert.equal(canInvest({ harbour: h, port: 'Q', coins: 9999 }).reason, 'not-home');
  assert.equal(canInvest({ harbour: null, port: 'P', coins: 9999 }).reason, 'not-home');
});

test('canInvest refuses without enough coin (and reports the cost)', () => {
  const h = { name: 'P', level: 1, invested: 0 };
  const r = canInvest({ harbour: h, port: 'P', coins: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-coins');
  assert.equal(r.cost, investCost(h));
});

test('canInvest refuses a fully-grown harbour', () => {
  const h = { name: 'P', level: MAX_LEVEL, invested: 0 };
  assert.equal(canInvest({ harbour: h, port: 'P', coins: 99999 }).reason, 'maxed');
});

test('invest grows the harbour one level, returns spent + Standing, is pure', () => {
  const h = { name: 'P', level: 1, invested: 0 };
  const cost = investCost(h);
  const stand = investStanding(h);
  const r = invest({ harbour: h, port: 'P', coins: cost });
  assert.equal(r.ok, true);
  assert.equal(r.level, 2);
  assert.equal(r.spent, cost);
  assert.equal(r.standingGain, stand);
  assert.deepEqual(r.harbour, { name: 'P', level: 2, invested: cost });
  // input untouched (pure)
  assert.deepEqual(h, { name: 'P', level: 1, invested: 0 });
});

test('invest climbs all the way to MAX_LEVEL then refuses', () => {
  let h = { name: 'P', level: 1, invested: 0 };
  let guard = 0;
  while (investCost(h) !== null && guard++ < 20) {
    const r = invest({ harbour: h, port: 'P', coins: investCost(h) });
    assert.equal(r.ok, true);
    h = r.harbour;
  }
  assert.equal(h.level, MAX_LEVEL);
  assert.equal(invest({ harbour: h, port: 'P', coins: 99999 }).ok, false);
});

// ---- the homecoming greeting (the reactive, warming "your harbour" identity) ----------------
test('harbourGreeting is null when the port is not your home', () => {
  assert.equal(harbourGreeting(null, 'P'), null);
  assert.equal(harbourGreeting({ name: 'P', level: 1, invested: 0 }, 'Q'), null);
});

test('harbourGreeting names the port and changes as the harbour grows', () => {
  const l1 = harbourGreeting({ name: "Gullet's Rest", level: 1, invested: 0 }, "Gullet's Rest");
  const l4 = harbourGreeting({ name: "Gullet's Rest", level: 4, invested: 0 }, "Gullet's Rest");
  assert.ok(l1.includes("Gullet's Rest") && !l1.includes('{port}'));
  assert.ok(l4.includes("Gullet's Rest"));
  assert.notEqual(l1, l4, 'the greeting warms as the harbour grows');
});
