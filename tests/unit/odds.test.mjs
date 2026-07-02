import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  combatOdds, oddsReadout, LUCK_LO, LUCK_HI, LUCK_MARGIN_PCT,
} from '../../src/systems/odds.js';
import { resolveBroadside } from '../../src/cannons.js';
import { shipStats } from '../../src/ship-classes.js';

// Legible odds — SKILL sets the odds, LUCK swings the margin (#166, epic #162's fair-fight READ).
// This is where "fair = clear, consistent rules WITH a bounded luck element" is PROVEN: the odds model is
// a pure, deterministic function of (aim geometry, class matchup, ammo); the margin band equals the EXACT
// ±20% luck bounds; and luck can NEVER flip a strongly-favoured verdict. Cross-checked against the real
// resolveBroadside math so the read can never silently drift from the fight it describes.

const ROUND = { hullMult: 1, returnMult: 1, aimForgive: 0 }; // plain round shot (the neutral profile)

// ---- odds reflect the deterministic CLASS MATCHUP (skill=odds) -------------------------------

test('odds: outclassing a merchant sloop reads FAVOURABLE (you outclass her)', () => {
  const her = shipStats('sloop', 'merchant'); // hull 55, feeble guns (gunnery ~0.33)
  const o = combatOdds({ playerHull: 100, enemyHull: her.hull, gunnery: her.gunnery, ammo: ROUND });
  assert.ok(o.favoured, 'a fresh hull vs a merchant sloop must read favoured');
  assert.equal(o.tier, 'dominant');
  assert.equal(o.verdict, 'You outclass her');
  assert.ok(o.edge > 1, `edge must exceed 1 (got ${o.edge})`);
});

test('odds: a man-o\'-war vs your SLOOP reads DIRE (she outguns you)', () => {
  const her = shipStats('manowar', 'warship'); // hull 100, heavy guns (gunnery 1.5)
  const me = shipStats('sloop', 'warship');     // you, in a small toothy sloop (hull 55)
  const o = combatOdds({ playerHull: me.hull, enemyHull: her.hull, gunnery: her.gunnery, ammo: ROUND });
  assert.ok(!o.favoured, 'a sloop vs a warship man-o\'-war must NOT read favoured');
  assert.equal(o.tier, 'dire');
  assert.equal(o.verdict, 'She outguns you — reckless');
  assert.ok(o.edge < 1, `edge must be below 1 (got ${o.edge})`);
});

test('odds: a toe-to-toe hull+gunnery match reads EVEN — the margin is the drama', () => {
  // Same hull, same effective firepower: your clean broadside (33) vs her reply (33 ⇒ gunnery = 33/19.8).
  const o = combatOdds({ playerHull: 88, enemyHull: 88, gunnery: 33 / (22 * 0.9), ammo: ROUND });
  assert.equal(o.tier, 'even');
  assert.equal(o.verdict, 'An even match');
  assert.ok(o.couldLuckFlip, 'an even match is exactly where luck (the margin) decides');
  assert.ok(!o.stronglyFavoured && !o.hopeless);
});

test('odds: verdict is MONOTONE in the foe\'s gunnery — a tougher-gunned foe never reads safer', () => {
  const weak = combatOdds({ playerHull: 100, enemyHull: 90, gunnery: 0.4, ammo: ROUND });
  const mid = combatOdds({ playerHull: 100, enemyHull: 90, gunnery: 1.0, ammo: ROUND });
  const heavy = combatOdds({ playerHull: 100, enemyHull: 90, gunnery: 1.6, ammo: ROUND });
  assert.ok(weak.edge > mid.edge, 'weaker guns must read a better edge');
  assert.ok(mid.edge > heavy.edge, 'heavier guns must read a worse edge');
});

// ---- aim GEOMETRY is skill: it shifts the odds you can READ ----------------------------------

test('odds: coming abeam (better aim quality) visibly RAISES the edge — skill sets the odds', () => {
  const her = { playerHull: 100, enemyHull: 88, gunnery: 1.0, ammo: ROUND };
  const bowOn = combatOdds({ ...her, aimQuality: 0.1 });  // guns barely bear
  const abeam = combatOdds({ ...her, aimQuality: 1.0 });  // dead abeam — a clean line
  assert.ok(abeam.edge > bowOn.edge, 'a cleaner aim must read a better edge — the skill is visible');
  assert.ok(abeam.yourDamage > bowOn.yourDamage, 'a cleaner line lands a heavier volley');
});

test('odds: null aimQuality reads the matchup at full bearing (potential), not zero', () => {
  const o = combatOdds({ playerHull: 100, enemyHull: 88, gunnery: 1.0, ammo: ROUND });
  const abeam = combatOdds({ playerHull: 100, enemyHull: 88, gunnery: 1.0, ammo: ROUND, aimQuality: 1 });
  assert.equal(o.edge, abeam.edge);
});

// ---- the margin BAND equals the ACTUAL ±20% luck bounds --------------------------------------

test('odds: the reported luck band IS the ±20% jitter bound (0.8 / 1.2 / ±20%)', () => {
  const o = combatOdds({ playerHull: 100, enemyHull: 88, gunnery: 1.0, ammo: ROUND });
  assert.equal(o.luck.lo, 0.8);
  assert.equal(o.luck.hi, 1.2);
  assert.equal(o.luck.marginPct, 20);
  assert.equal(LUCK_LO, 0.8);
  assert.equal(LUCK_HI, 1.2);
  assert.equal(LUCK_MARGIN_PCT, 20);
});

test('odds: the shown band == the REAL luck swing of resolveBroadside (cross-checked, no drift)', () => {
  // The model claims luck swings damage within [0.8, 1.2] of the mean. Prove it against the ACTUAL math:
  // resolveBroadside at rng=0.5 is the mean; at rng=0 it must be ×0.8; at rng=1 it must be ×1.2.
  const args = { quality: 1, enemyHull: 100, playerHull: 100, gunnery: 1.0, ammo: ROUND };
  const mean = resolveBroadside(args, () => 0.5).enemyHit; // jitter == 1.0
  const low = resolveBroadside(args, () => 0).enemyHit;    // jitter == 0.8
  const high = resolveBroadside(args, () => 1).enemyHit;   // jitter == 1.2
  // within a rounding whisker of the model's declared bounds
  assert.ok(Math.abs(low / mean - LUCK_LO) < 0.02, `real low swing ${low / mean} != ${LUCK_LO}`);
  assert.ok(Math.abs(high / mean - LUCK_HI) < 0.02, `real high swing ${high / mean} != ${LUCK_HI}`);
});

test('odds: the band segment sits fully on the favoured side for a dominant matchup', () => {
  const her = shipStats('sloop', 'merchant');
  const o = combatOdds({ playerHull: 100, enemyHull: her.hull, gunnery: her.gunnery, ammo: ROUND });
  assert.ok(o.band.worst > 1, 'even the worst-luck edge stays above 1 for a dominant matchup');
  assert.ok(o.bar.lo > 0.5, 'the whole band renders right of the even line');
});

// ---- expected damage MATCHES the real math (cross-checked) -----------------------------------

test('odds: yourDamage / herDamage equal resolveBroadside\'s mean-luck volley (no drift)', () => {
  const gunnery = 1.1, quality = 1;
  const o = combatOdds({ playerHull: 100, enemyHull: 100, gunnery, ammo: ROUND, aimQuality: quality });
  const r = resolveBroadside({ quality, enemyHull: 100, playerHull: 100, gunnery, ammo: ROUND }, () => 0.5);
  assert.equal(o.yourDamage, r.enemyHit, 'model expected YOUR volley must equal the real mean volley');
  assert.equal(o.herDamage, r.playerHit, 'model expected HER volley must equal the real mean reply');
});

// ---- luck NEVER flips a strongly-favoured verdict --------------------------------------------

test('odds: a strongly-favoured fight is won even at MAX-adverse luck (luck can\'t flip it)', () => {
  const her = shipStats('sloop', 'merchant');
  const o = combatOdds({ playerHull: 100, enemyHull: her.hull, gunnery: her.gunnery, ammo: ROUND });
  assert.ok(o.stronglyFavoured, 'a merchant sloop must read strongly-favoured');
  // The deterministic worst case: YOUR damage floored (×0.8) EVERY volley, HERS ceilinged (×1.2) EVERY
  // volley. Even then you sink her in no more volleys than she needs to sink you ⇒ luck cannot flip it.
  const yourFloor = 22 * 1.5 * 1 * ROUND.hullMult * LUCK_LO;   // your weakest possible volley
  const herCeil = 22 * 0.9 * her.gunnery * ROUND.returnMult * LUCK_HI; // her strongest possible reply
  const volleysToSinkHer = Math.ceil(her.hull / yourFloor);
  const volleysToSinkYou = Math.ceil(100 / herCeil);
  assert.ok(volleysToSinkHer <= volleysToSinkYou,
    `even at worst luck you sink her (${volleysToSinkHer}) no slower than she sinks you (${volleysToSinkYou})`);
});

test('odds: strongly-favoured wins ≥ 99% over N real simulated fights (adversarial luck can\'t invert it)', () => {
  const her = shipStats('sloop', 'merchant');
  let wins = 0;
  const N = 2000;
  let seed = 12345;
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let n = 0; n < N; n++) {
    let ph = 100, eh = her.hull, morale = 100, won = null;
    for (let v = 0; v < 40 && won === null; v++) {
      const r = resolveBroadside({ quality: 1, enemyHull: eh, playerHull: ph, gunnery: her.gunnery, morale, ammo: ROUND }, rng);
      eh = r.enemyHull; ph = r.playerHull; morale = r.enemyMorale;
      if (r.sunkEnemy || r.yielded) won = true;
      else if (r.sunkPlayer) won = false;
    }
    if (won) wins++;
  }
  assert.ok(wins / N >= 0.99, `strongly-favoured win rate ${(wins / N * 100).toFixed(1)}% must be ≥ 99% — luck cannot flip it`);
});

test('odds: a hopeless matchup is LOST even at max-lucky rolls (the mirror bound)', () => {
  const her = shipStats('manowar', 'warship');
  const me = shipStats('sloop', 'warship');
  const o = combatOdds({ playerHull: me.hull, enemyHull: her.hull, gunnery: her.gunnery, ammo: ROUND });
  assert.ok(o.hopeless, 'a sloop vs a warship man-o\'-war reads hopeless (luck can\'t save you)');
  assert.ok(o.band.best <= 1, 'even the best-luck edge stays at/below 1');
});

// ---- ammo (loadout) is part of the SKILL that sets the odds -----------------------------------

test('odds: a heavier-hitting shot (higher hullMult) improves your edge', () => {
  const base = combatOdds({ playerHull: 100, enemyHull: 90, gunnery: 1.0, ammo: ROUND, aimQuality: 1 });
  const heavy = combatOdds({ playerHull: 100, enemyHull: 90, gunnery: 1.0, ammo: { hullMult: 1.4, returnMult: 1, aimForgive: 0 }, aimQuality: 1 });
  assert.ok(heavy.edge > base.edge, 'heavier shot must read a better edge');
  assert.ok(heavy.yourDamage > base.yourDamage);
});

test('odds: aimForgive lifts a glancing angle toward a clean one (mirrors resolveBroadside)', () => {
  const glancing = { playerHull: 100, enemyHull: 90, gunnery: 1.0, aimQuality: 0.2 };
  const round = combatOdds({ ...glancing, ammo: { hullMult: 1, returnMult: 1, aimForgive: 0 } });
  const light = combatOdds({ ...glancing, ammo: { hullMult: 1, returnMult: 1, aimForgive: 0.6 } });
  assert.ok(light.yourDamage > round.yourDamage, 'a forgiving shot reaches a glancing target better');
});

// ---- guards + the readout composer -----------------------------------------------------------

test('odds: a bow-on round shot (zero bite) reads a safe, sane worst-case, not NaN', () => {
  const o = combatOdds({ playerHull: 100, enemyHull: 90, gunnery: 1.0, ammo: ROUND, aimQuality: 0 });
  assert.equal(o.edge, 0);
  assert.equal(o.tier, 'dire');
  assert.ok(Number.isFinite(o.bar.lo) && Number.isFinite(o.bar.hi));
});

test('odds: garbage inputs degrade to a finite, legible read (never throws / NaN)', () => {
  const o = combatOdds({ playerHull: NaN, enemyHull: undefined, gunnery: 'x', ammo: null });
  assert.ok(typeof o.verdict === 'string' && o.verdict.length > 0);
  assert.ok(Number.isFinite(o.bar.lo) && Number.isFinite(o.bar.hi));
});

test('oddsReadout: composes verdict + legible damage-per-volley + the ±20% margin', () => {
  const o = combatOdds({ playerHull: 100, enemyHull: 88, gunnery: 1.0, ammo: ROUND, aimQuality: 1 });
  const r = oddsReadout(o);
  assert.equal(r.text, o.verdict);
  assert.match(r.sub, /\/volley/);
  assert.match(r.sub, /±20%/);
  assert.equal(r.tier, o.tier);
});

test('oddsReadout: an optional stake hint names what a loss would cost (#164 legibility)', () => {
  const o = combatOdds({ playerHull: 30, enemyHull: 100, gunnery: 1.5, ammo: ROUND, aimQuality: 1 });
  const r = oddsReadout(o, { stakeCoin: 48, stakeFame: 56 });
  assert.match(r.sub, /a loss costs ~48c, 56 fame/);
});

test('oddsReadout: no stake hint when the stake is zero/omitted', () => {
  const o = combatOdds({ playerHull: 100, enemyHull: 88, gunnery: 1.0, ammo: ROUND });
  assert.ok(!oddsReadout(o).sub.includes('a loss costs'));
  assert.ok(!oddsReadout(o, { stakeCoin: 0, stakeFame: 0 }).sub.includes('a loss costs'));
});
