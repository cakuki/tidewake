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
  makeContestedObjective, tickContest, isContested, isClaimed, rivalName, contestRemaining,
  pickRival, contestBudget, shouldContest, sanitizeContest, RIVAL_NAMES,
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

// ---- Contested rumours (#133): the rival + soft clock --------------------------------------

test('pickRival is deterministic + seeded — the same target always names the same rival', () => {
  const a = pickRival(PORT);
  assert.equal(pickRival(PORT), a, 'same seed → same rival (a recurring antagonist)');
  assert.ok(RIVAL_NAMES.includes(a), 'the rival is drawn from the named pool');
  // a different target can name a different rival (the pool has > 1 name)
  assert.ok(RIVAL_NAMES.includes(pickRival('Barnacle Bottom')));
});

test('contestBudget grows with distance, clamped to a fair range', () => {
  const near = contestBudget(0);
  const far = contestBudget(100000);
  assert.ok(far > near, 'a farther target is allotted more time');
  assert.ok(near >= 24, 'a doorstep target still gets a fair minimum');
  assert.ok(far <= 420, 'a far target is capped so the race still matters');
  assert.equal(contestBudget(-5), contestBudget(0), 'junk distance treated as zero');
});

test('shouldContest is deterministic (and not every rumour is contested)', () => {
  assert.equal(typeof shouldContest(PORT), 'boolean');
  assert.equal(shouldContest(PORT), shouldContest(PORT));
  // across a spread of seeds, both outcomes occur — contested is notable, not universal
  let contested = 0, plain = 0;
  for (let i = 0; i < 30; i++) (shouldContest(i) ? contested++ : plain++);
  assert.ok(contested > 0 && plain > 0, 'a healthy mix of contested + uncontested rumours');
});

test('makeContestedObjective builds an active objective with a seeded rival + soft clock', () => {
  const o = makeContestedObjective({ kind: 'port', name: PORT, x: 300, z: 0 }, { fromX: 0, fromZ: 0 });
  assert.equal(o.status, 'active');
  assert.equal(o.payoff.coins, RUMOUR_REWARD_COINS, 'the bounty is the normal reward — the race adds tension, not extra coin');
  assert.ok(isContested(o));
  assert.equal(o.contest.rival, pickRival(PORT), 'rival seeded off the target name');
  assert.equal(o.contest.elapsed, 0);
  assert.equal(o.contest.claimed, false);
  assert.equal(o.contest.budget, contestBudget(300), 'budget keyed to the chase distance');
  assert.equal(makeContestedObjective(null), null, 'a junk target makes no contest');
});

test('tickContest advances the clock and the rival CLAIMS it when the budget runs out', () => {
  const o = makeContestedObjective({ kind: 'port', name: PORT }, { budget: 10 });
  const t1 = tickContest(o, 4);
  assert.equal(t1.contest.elapsed, 4);
  assert.equal(isClaimed(t1), false, 'still time on the clock');
  assert.equal(o.contest.elapsed, 0, 'tickContest must not mutate the input');
  const t2 = tickContest(t1, 7); // 4 + 7 = 11 >= 10
  assert.equal(isClaimed(t2), true, 'the rival claims it once the clock runs out');
  // once claimed, the clock is frozen — a later tick is a no-op (no double-claim churn)
  assert.equal(tickContest(t2, 100), t2, 'a claimed contest stops ticking');
});

test('tickContest is a no-op for an uncontested / non-positive-dt objective', () => {
  const plain = makeObjective({ kind: 'port', name: PORT });
  assert.equal(tickContest(plain, 5), plain, 'no contest → nothing to tick');
  const o = makeContestedObjective({ kind: 'port', name: PORT }, { budget: 10 });
  assert.equal(tickContest(o, 0), o, 'a zero dt is a no-op (same object)');
  assert.equal(tickContest(null, 5), null);
});

test('payoffFor: a won race pays the full bounty, a claimed race pays nothing (the prize is gone)', () => {
  const won = makeContestedObjective({ kind: 'port', name: PORT }, { budget: 10 });
  assert.deepEqual(payoffFor(won), { coins: RUMOUR_REWARD_COINS }, 'arriving in time wins it as normal');
  const claimed = tickContest(won, 20);
  assert.deepEqual(payoffFor(claimed), { coins: 0 }, 'the rival took it — no reward');
  // resolvesAt still fires at the port regardless — the arrival branch decides win vs lose
  assert.equal(resolvesAt(claimed, PORT), true);
});

test('contestRemaining + rivalName read the live race state', () => {
  const o = makeContestedObjective({ kind: 'port', name: PORT }, { budget: 30, rival: 'Silas Thorne' });
  assert.equal(rivalName(o), 'Silas Thorne');
  assert.equal(contestRemaining(o), 30);
  assert.equal(contestRemaining(tickContest(o, 10)), 20);
  assert.equal(contestRemaining(tickContest(o, 999)), 0, 'never negative');
  assert.equal(rivalName(makeObjective({ kind: 'port', name: PORT })), null, 'uncontested → no rival');
  assert.equal(contestRemaining(null), null);
});

test('sanitizeContest / sanitizeObjective round-trip a contested objective (fail open)', () => {
  const o = makeContestedObjective({ kind: 'port', name: PORT, x: 9, z: 4 }, { budget: 50, rival: 'Silas Thorne' });
  const ticked = tickContest(o, 12);
  assert.deepEqual(sanitizeObjective(ticked), ticked, 'a clean contested objective round-trips intact');
  // a run-out clock re-derives claimed even if the stored flag lies (no reload-reset exploit)
  const lying = { ...o, contest: { ...o.contest, elapsed: 999, claimed: false } };
  assert.equal(isClaimed(sanitizeObjective(lying)), true, 'a run-out clock is claimed regardless of a tampered flag');
  // junk contest fails open to a plain (uncontested) chase, never rejecting the objective
  assert.equal(sanitizeContest(null), null);
  assert.equal(sanitizeContest({ budget: 10 }), null, 'no rival → no contest');
  const plain = sanitizeObjective({ ...makeObjective({ kind: 'port', name: PORT }), contest: 'junk' });
  assert.equal(isContested(plain), false, 'a junk contest degrades to a normal chase');
  assert.ok(plain, 'and the objective itself still loads');
});
