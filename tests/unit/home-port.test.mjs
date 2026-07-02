import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  freshHarbour, sanitizeHarbour, isHome, harbourLevelName, investCost, investStanding,
  canClaim, claim, canInvest, invest, harbourGreeting,
  earnedGovernorship, governorTitle, governorshipBeat, demoteHarbour,
  salvagePlank, bankSalvage,
  CLAIM_STANDING, CLAIM_REWARD, MAX_LEVEL, GOVERNOR_STANDING,
  SALVAGE_BASE, SALVAGE_PER_TIER,
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

// ---- Governorship endgame (#119, DL #4) — the lawful arc's NAMED capstone -------------------
test('earnedGovernorship needs BOTH a top-tier home port AND the Standing gate', () => {
  const max = { name: 'P', level: MAX_LEVEL, invested: 1200 };
  // no harbour → never
  assert.equal(earnedGovernorship({ harbour: null, standing: 99999 }), false);
  // top tier but standing below the gate → not yet
  assert.equal(earnedGovernorship({ harbour: max, standing: GOVERNOR_STANDING - 1 }), false);
  // standing met but the port isn't fully grown → not yet
  assert.equal(earnedGovernorship({ harbour: { name: 'P', level: MAX_LEVEL - 1, invested: 0 }, standing: GOVERNOR_STANDING + 50 }), false);
  // both conditions met → earned
  assert.equal(earnedGovernorship({ harbour: max, standing: GOVERNOR_STANDING }), true);
});

test('earnedGovernorship is junk-safe and reachable below the legend summit', () => {
  for (const junk of [undefined, {}, { harbour: 'x', standing: 'y' }, { harbour: {}, standing: NaN }]) {
    assert.equal(earnedGovernorship(junk), false);
  }
  // The named home crown lands well before the Tidewake-wide legend (renown 2400) — a nearer goal.
  assert.ok(GOVERNOR_STANDING < 2400);
});

test('governorTitle reads "Governor of [home isle]" (and null with no claim)', () => {
  assert.equal(governorTitle({ name: "Gullet's Rest", level: MAX_LEVEL, invested: 0 }), "Governor of Gullet's Rest");
  assert.equal(governorTitle(null), null);
  assert.equal(governorTitle({ name: '' }), null);
});

test('governorshipBeat is the named mirror of a legend crown (or null with no claim)', () => {
  assert.equal(governorshipBeat(null), null);
  const beat = governorshipBeat({ name: 'Saltpurse Quay', level: MAX_LEVEL, invested: 0 });
  assert.equal(beat.title, 'Governor of Saltpurse Quay');
  assert.ok(beat.icon && beat.kicker && beat.proclaim && beat.flourish, 'carries the fanfare fields the HUD reads');
  assert.ok(beat.proclaim.includes('Saltpurse Quay'), 'the proclamation names the isle');
});

// ---- demoteHarbour (#134) — a threat that sacks the home port one level ------------------------

test('demoteHarbour drops a grown port one level and writes off that tier\'s invested coin', () => {
  // a level-3 port: invested 150 (lvl1→2) + 350 (lvl2→3) = 500; a drop to lvl2 loses the 350 tier.
  const { harbour, coinLost } = demoteHarbour({ name: 'Home', level: 3, invested: 500 });
  assert.equal(harbour.level, 2);
  assert.equal(harbour.name, 'Home');
  assert.equal(coinLost, 350);
  assert.equal(harbour.invested, 150);
});

test('demoteHarbour overruns a claimed berth (level 1) outright → null', () => {
  const { harbour, coinLost } = demoteHarbour({ name: 'Berth', level: 1, invested: 0 });
  assert.equal(harbour, null);
  assert.equal(coinLost, 0);
});

test('demoteHarbour on no/junk harbour → null, never throws, never mutates', () => {
  assert.deepEqual(demoteHarbour(null), { harbour: null, coinLost: 0 });
  const h = { name: 'H', level: 2, invested: 150 };
  const snap = JSON.stringify(h);
  demoteHarbour(h);
  assert.equal(JSON.stringify(h), snap, 'input untouched (pure)');
});

// ---- Never close the tab empty-handed (#176): the consolation salvage plank ------------------
// A LOST voyage still banks a small, honest scrap on a DIFFERENT axis (the home-port fund) so the
// player leans into "one more voyage" — WITHOUT ever refunding the #164 sting. The plank is bounded,
// tier-scaled, never touches a fame pole or coin, and never jumps a growth tier.

test('salvagePlank: a scrap, monotonic non-decreasing in foe tier, always positive', () => {
  const p1 = salvagePlank(1), p3 = salvagePlank(3), p5 = salvagePlank(5);
  assert.equal(p1, SALVAGE_BASE + 1 * SALVAGE_PER_TIER); // tier 1 → 7
  assert.equal(p5, SALVAGE_BASE + 5 * SALVAGE_PER_TIER); // tier 5 → 19
  assert.ok(p1 > 0 && p3 > p1 && p5 > p3, 'a deadlier foe lays a bigger plank, always positive');
  // A plank is always a SCRAP — a whisker of a real paid investment (the cheapest grow is 150 coin).
  assert.ok(p5 < 150, 'even the biggest plank is far under a paid investment (150c) — caution still matters');
});

test('salvagePlank: junk / out-of-range tier reads as the gentlest tier (1), never throws', () => {
  for (const bad of [NaN, Infinity, -3, 0, undefined, null, 'x', 99]) {
    const p = salvagePlank(bad);
    assert.ok(Number.isFinite(p) && p >= salvagePlank(1) && p <= salvagePlank(5));
  }
});

test('bankSalvage: grows the home-port fund by exactly the plank — LEVEL + name untouched', () => {
  const before = { name: 'Rumhaven', level: 2, invested: 350 };
  const { harbour, plank } = bankSalvage(before, 4);
  assert.equal(plank, salvagePlank(4));
  assert.equal(harbour.invested, 350 + plank, 'the fund grows by exactly the plank');
  assert.equal(harbour.level, 2, 'a plank NEVER jumps a growth tier — only invest() climbs the level');
  assert.equal(harbour.name, 'Rumhaven');
});

test('bankSalvage: no home port → null harbour + plank 0 (an un-homed defeat banks no plank)', () => {
  assert.deepEqual(bankSalvage(null, 5), { harbour: null, plank: 0 });
  assert.deepEqual(bankSalvage(undefined, 3), { harbour: null, plank: 0 });
  assert.deepEqual(bankSalvage({ name: '' }, 3), { harbour: null, plank: 0 }); // junk sanitises to no-claim
});

test('bankSalvage: PURE — never mutates the input harbour', () => {
  const h = { name: 'Home', level: 1, invested: 0 };
  const snap = JSON.stringify(h);
  bankSalvage(h, 5);
  assert.equal(JSON.stringify(h), snap, 'input untouched');
});

test('bankSalvage: coexists with the #164 sting — a plank is NOT a refund (different axis)', () => {
  // The plank only ever grows harbour.invested; it returns NO coin/infamy/standing, so the caller's
  // #164 deduction on those poles can never be undone by banking a plank. Repeated losses only add
  // scraps to the fund — a slow, honest climb, never a wash of the fame the losses cost.
  let h = { name: 'Home', level: 1, invested: 0 };
  let total = 0;
  for (let i = 0; i < 5; i++) { const r = bankSalvage(h, 3); h = r.harbour; total += r.plank; }
  assert.equal(h.invested, total, 'the fund is exactly the sum of the planks — no phantom fame/coin');
  assert.equal(h.level, 1, 'five defeats still never climbed a tier');
});
