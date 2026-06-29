import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessThreat, sanitizeThreat, isActiveThreat, threatDemand, standFirmOdds,
  canPayTribute, payTribute, resolveStandFirm, threatWarning, threatBlurb, threatTitle,
  THREAT_TIER, DEMAND_PER_LEVEL, TIER_SURCHARGE, STAND_FIRM_BASE_ODDS, STAND_FIRM_ODDS_PER_LEVEL,
  STAND_FIRM_MAX_ODDS, REPEL_STANDING, FALL_STANDING,
} from '../../src/systems/harbour-threat.js';
import { TIER_STIR, TIER_KNOWN } from '../../src/systems/reputation-needle.js';

const HOME = { name: "Gullet's Rest", level: 2, invested: 150 };

// ---- assessThreat: triggers off the needle + home-port state ----------------------------------

test('no claimed harbour → no threat, whatever the needle reads', () => {
  assert.equal(assessThreat({ harbour: null, infamy: 1000, standing: 0 }), null);
  assert.equal(assessThreat({ infamy: 1000, standing: 0 }), null);
  assert.equal(assessThreat({ harbour: { name: '', level: 1 }, infamy: 1000, standing: 0 }), null);
});

test('a balanced captain with a home port draws no threat (the straddle is safe at centre)', () => {
  // equal poles → needle centred → tier 0 → below THREAT_TIER
  assert.equal(assessThreat({ harbour: HOME, infamy: 500, standing: 500 }), null);
});

test('a hard INFAMY lean over a claimed port → a navy BLOCKADE', () => {
  const t = assessThreat({ harbour: HOME, infamy: 1000, standing: 0 });
  assert.ok(t, 'a committed pirate with a home port is threatened');
  assert.equal(t.kind, 'blockade');
  assert.equal(t.pole, 'pirate');
  assert.equal(t.port, "Gullet's Rest");
  assert.ok(t.tier >= THREAT_TIER);
});

test('a hard STANDING lean over a claimed port → a pirate RAID', () => {
  const t = assessThreat({ harbour: HOME, infamy: 0, standing: 1000 });
  assert.ok(t);
  assert.equal(t.kind, 'raid');
  assert.equal(t.pole, 'governor');
  assert.equal(t.port, "Gullet's Rest");
});

test('a slight lean inside the balance band does NOT trigger (commitment is required)', () => {
  // 55/45 split is inside the needle deadzone → tier 0 → no threat
  assert.equal(assessThreat({ harbour: HOME, infamy: 55, standing: 45 }), null);
});

test('the demand scales with harbour level and surcharges a tier-2 (owns-you) threat', () => {
  const lo = assessThreat({ harbour: { name: 'Aye', level: 1 }, infamy: 1000, standing: 0 });
  const hi = assessThreat({ harbour: { name: 'Aye', level: 4 }, infamy: 1000, standing: 0 });
  assert.ok(hi.demand > lo.demand, 'a grander port is a fatter prize');
  // a maximal lean is tier 2 → surcharged
  assert.equal(hi.tier, 2);
  assert.equal(hi.demand, threatDemand(4, 2));
});

// ---- threatDemand maths -----------------------------------------------------------------------

test('threatDemand: per-level base, tier-2 surcharge, junk-safe floor', () => {
  assert.equal(threatDemand(1, 1), DEMAND_PER_LEVEL);
  assert.equal(threatDemand(3, 1), DEMAND_PER_LEVEL * 3);
  assert.equal(threatDemand(2, 2), Math.round(DEMAND_PER_LEVEL * 2 * (1 + TIER_SURCHARGE)));
  assert.equal(threatDemand(0, 1), DEMAND_PER_LEVEL, 'level floors at 1');
  assert.equal(threatDemand(NaN, NaN), DEMAND_PER_LEVEL);
});

// ---- sanitizeThreat: fail-open save hygiene ---------------------------------------------------

test('sanitizeThreat accepts a clean record and derives the pole from the kind', () => {
  const t = sanitizeThreat({ kind: 'blockade', port: 'Home', tier: 1, demand: 90 });
  assert.deepEqual(t, { kind: 'blockade', pole: 'pirate', port: 'Home', tier: 1, demand: 90 });
  assert.equal(sanitizeThreat({ kind: 'raid', port: 'Home', tier: 2, demand: 300 }).pole, 'governor');
});

test('sanitizeThreat rejects junk → null (fail-open, never throws)', () => {
  for (const junk of [null, undefined, 42, 'x', [], {}, { kind: 'siege', port: 'X' }, { kind: 'raid', port: '' }, { kind: 'raid', port: '   ' }]) {
    assert.equal(sanitizeThreat(junk), null, `junk ${JSON.stringify(junk)} → null`);
  }
  assert.equal(isActiveThreat({ kind: 'raid', port: 'X', tier: 1, demand: 10 }), true);
  assert.equal(isActiveThreat(null), false);
});

test('sanitizeThreat coerces tier to 1|2 and demand to a non-negative int', () => {
  assert.equal(sanitizeThreat({ kind: 'raid', port: 'X', tier: 9, demand: 5 }).tier, 2);
  assert.equal(sanitizeThreat({ kind: 'raid', port: 'X', tier: -3, demand: 5 }).tier, 1);
  assert.equal(sanitizeThreat({ kind: 'raid', port: 'X', tier: 1, demand: -5 }).demand, 0);
  assert.equal(sanitizeThreat({ kind: 'raid', port: 'X', tier: 1, demand: 9.9 }).demand, 9);
});

// ---- standFirmOdds ----------------------------------------------------------------------------

test('standFirmOdds climbs with harbour level and caps', () => {
  assert.equal(standFirmOdds({ level: 1 }), STAND_FIRM_BASE_ODDS + STAND_FIRM_ODDS_PER_LEVEL);
  assert.ok(standFirmOdds({ level: 4 }) > standFirmOdds({ level: 1 }), 'a grander port defends better');
  assert.ok(standFirmOdds({ level: 99 }) <= STAND_FIRM_MAX_ODDS, 'odds are capped');
  assert.equal(standFirmOdds(null), STAND_FIRM_BASE_ODDS + STAND_FIRM_ODDS_PER_LEVEL, 'junk → level-1 odds');
});

// ---- payTribute -------------------------------------------------------------------------------

const THREAT = { kind: 'blockade', port: "Gullet's Rest", tier: 1, demand: 180 };

test('payTribute clears the threat for the demanded coin when affordable', () => {
  const r = payTribute({ threat: THREAT, coins: 500 });
  assert.equal(r.ok, true);
  assert.equal(r.spent, 180);
  assert.equal(r.cleared, true);
});

test('payTribute refuses when the purse is short (and names the cost)', () => {
  const r = payTribute({ threat: THREAT, coins: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-coins');
  assert.equal(r.cost, 180);
});

test('payTribute / canPayTribute on no threat → no-threat', () => {
  assert.equal(payTribute({ threat: null, coins: 999 }).reason, 'no-threat');
  assert.equal(canPayTribute({ threat: {}, coins: 999 }).reason, 'no-threat');
});

// ---- resolveStandFirm: the dice beat ----------------------------------------------------------

test('standing firm and WINNING repels the threat for Standing, harbour untouched', () => {
  const r = resolveStandFirm({ threat: THREAT, harbour: HOME, roll: 0 }); // roll 0 always wins
  assert.equal(r.ok, true);
  assert.equal(r.won, true);
  assert.equal(r.cleared, true);
  assert.equal(r.standingGain, REPEL_STANDING);
  assert.deepEqual(r.harbour, HOME, 'a won defence leaves the port intact');
});

test('standing firm and LOSING sacks the harbour a level and costs Standing', () => {
  const r = resolveStandFirm({ threat: THREAT, harbour: HOME, roll: 0.999 }); // roll ~1 always loses
  assert.equal(r.won, false);
  assert.equal(r.cleared, true);
  assert.equal(r.standingLoss, FALL_STANDING);
  assert.equal(r.harbour.level, 1, 'a level-2 port drops to level 1');
  assert.equal(r.coinLost, 150, "the dropped tier's invested coin is destroyed");
  assert.equal(r.lostPort, false);
});

test('losing a defence of a CLAIMED BERTH (level 1) loses the port outright', () => {
  const berth = { name: 'New Berth', level: 1, invested: 0 };
  const r = resolveStandFirm({ threat: { ...THREAT, port: 'New Berth' }, harbour: berth, roll: 0.999 });
  assert.equal(r.won, false);
  assert.equal(r.harbour, null, 'the berth is overrun outright');
  assert.equal(r.lostPort, true);
});

test('a missing/junk roll is treated as a LOSS (never a free win on a dead RNG)', () => {
  const r = resolveStandFirm({ threat: THREAT, harbour: HOME }); // no roll
  assert.equal(r.won, false);
  const r2 = resolveStandFirm({ threat: THREAT, harbour: HOME, roll: NaN });
  assert.equal(r2.won, false);
});

test('the win/lose boundary sits exactly at standFirmOdds', () => {
  const odds = standFirmOdds(HOME); // level 2 → 0.6
  assert.equal(resolveStandFirm({ threat: THREAT, harbour: HOME, roll: odds - 1e-9 }).won, true);
  assert.equal(resolveStandFirm({ threat: THREAT, harbour: HOME, roll: odds }).won, false, 'roll == odds loses (strict <)');
});

test('resolveStandFirm on no threat → no-threat, never throws', () => {
  assert.equal(resolveStandFirm({ threat: null, harbour: HOME, roll: 0 }).reason, 'no-threat');
});

test('resolveStandFirm never mutates the input harbour', () => {
  const h = { name: 'X', level: 3, invested: 500 };
  const snap = JSON.stringify(h);
  resolveStandFirm({ threat: { ...THREAT, port: 'X' }, harbour: h, roll: 0.999 });
  assert.equal(JSON.stringify(h), snap, 'the input harbour is untouched (pure)');
});

// ---- the voice --------------------------------------------------------------------------------

test('threatWarning / threatBlurb / threatTitle fill the port and differ by kind', () => {
  const block = { kind: 'blockade', port: 'Home', tier: 1, demand: 90 };
  const raid = { kind: 'raid', port: 'Home', tier: 1, demand: 90 };
  assert.ok(threatWarning(block).includes('Home'));
  assert.ok(/blockade/i.test(threatWarning(block)));
  assert.ok(/raid|freebooters/i.test(threatWarning(raid)));
  assert.notEqual(threatBlurb(block), threatBlurb(raid));
  assert.notEqual(threatTitle(block), threatTitle(raid));
  // no threat → empty strings, never throws
  assert.equal(threatWarning(null), '');
  assert.equal(threatBlurb(null), '');
  assert.equal(threatTitle(null), '');
});

// ---- the tier constants line up with the needle's commitment bands -----------------------------

test('THREAT_TIER aligns with the needle commitment tiers (sanity)', () => {
  assert.ok(TIER_STIR > 0 && TIER_KNOWN > TIER_STIR);
  assert.equal(THREAT_TIER, 1);
});
