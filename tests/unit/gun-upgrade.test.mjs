import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_GUNS, MAX_EXTRA_CANNONS, CANNON_COSTS, GUN_DAMAGE_STEP, DEFAULT_SHIP_CLASS,
  sanitizeExtraCannons, sanitizeShipClass, totalGuns, nextCannonCost,
  canBuyCannon, buyCannon, broadsideMult, deckGunSlots,
} from '../../src/systems/gun-upgrade.js';
import { resolveBroadside } from '../../src/cannons.js';
import { SHIP_CLASSES } from '../../src/ship-classes.js';

test('sanitizeExtraCannons coerces junk/absent to 0 and clamps to the cap', () => {
  assert.equal(sanitizeExtraCannons(undefined), 0);
  assert.equal(sanitizeExtraCannons(null), 0);
  assert.equal(sanitizeExtraCannons(-3), 0);
  assert.equal(sanitizeExtraCannons('x'), 0);
  assert.equal(sanitizeExtraCannons(NaN), 0);
  assert.equal(sanitizeExtraCannons(1), 1);
  assert.equal(sanitizeExtraCannons(2.9), 2);            // floors
  assert.equal(sanitizeExtraCannons(999), MAX_EXTRA_CANNONS); // clamps
});

test('totalGuns is the base battery plus what you bought', () => {
  assert.equal(totalGuns(0), BASE_GUNS);
  assert.equal(totalGuns(1), BASE_GUNS + 1);
  assert.equal(totalGuns(MAX_EXTRA_CANNONS), BASE_GUNS + MAX_EXTRA_CANNONS);
  assert.equal(totalGuns(99), BASE_GUNS + MAX_EXTRA_CANNONS); // clamped
});

test('nextCannonCost walks the escalating curve then returns null at the cap', () => {
  assert.equal(nextCannonCost(0), CANNON_COSTS[0]);
  assert.equal(nextCannonCost(1), CANNON_COSTS[1]);
  assert.equal(nextCannonCost(2), CANNON_COSTS[2]);
  assert.equal(nextCannonCost(MAX_EXTRA_CANNONS), null);
  // The curve genuinely escalates (each gun is a bigger spend than the last).
  for (let i = 1; i < CANNON_COSTS.length; i++) assert.ok(CANNON_COSTS[i] > CANNON_COSTS[i - 1]);
});

test('canBuyCannon gates on the purse and the cap', () => {
  assert.deepEqual(canBuyCannon({ extra: 0, coins: 180 }), { ok: true, reason: null, cost: 180 });
  assert.deepEqual(canBuyCannon({ extra: 0, coins: 179 }), { ok: false, reason: 'no-coins', cost: 180 });
  assert.deepEqual(canBuyCannon({ extra: MAX_EXTRA_CANNONS, coins: 99999 }), { ok: false, reason: 'maxed', cost: null });
});

test('buyCannon is pure: on success extra +1 and coins docked; on failure unchanged', () => {
  const ok = buyCannon({ extra: 0, coins: 200 });
  assert.equal(ok.ok, true);
  assert.equal(ok.extra, 1);
  assert.equal(ok.coins, 200 - CANNON_COSTS[0]);
  assert.equal(ok.cost, CANNON_COSTS[0]);

  const broke = buyCannon({ extra: 0, coins: 10 });
  assert.equal(broke.ok, false);
  assert.equal(broke.reason, 'no-coins');
  assert.equal(broke.extra, 0);   // untouched
  assert.equal(broke.coins, 10);  // untouched

  const maxed = buyCannon({ extra: MAX_EXTRA_CANNONS, coins: 99999 });
  assert.equal(maxed.ok, false);
  assert.equal(maxed.reason, 'maxed');
  assert.equal(maxed.extra, MAX_EXTRA_CANNONS);
});

test('buyCannon walks the whole battery to the cap and no further', () => {
  let extra = 0, coins = 5000;
  for (let i = 0; i < MAX_EXTRA_CANNONS; i++) {
    const r = buyCannon({ extra, coins });
    assert.equal(r.ok, true, `buy #${i + 1} should succeed`);
    extra = r.extra; coins = r.coins;
  }
  assert.equal(extra, MAX_EXTRA_CANNONS);
  assert.equal(buyCannon({ extra, coins }).ok, false); // capped
});

test('broadsideMult is exactly 1.0 at base and grows with each cannon (the FEEL)', () => {
  assert.equal(broadsideMult(0), 1);
  assert.ok(Math.abs(broadsideMult(1) - (1 + GUN_DAMAGE_STEP)) < 1e-9);
  assert.ok(broadsideMult(2) > broadsideMult(1));
  assert.ok(broadsideMult(MAX_EXTRA_CANNONS) > broadsideMult(0));
});

test('an owned cannon makes a broadside bite measurably harder (feeds resolveBroadside)', () => {
  const rng = () => 0.5; // jitter == 1 → deterministic
  const base = resolveBroadside({ quality: 1, enemyHull: 100, playerHull: 100, broadsideMult: broadsideMult(0) }, rng);
  const upgraded = resolveBroadside({ quality: 1, enemyHull: 100, playerHull: 100, broadsideMult: broadsideMult(2) }, rng);
  assert.ok(upgraded.enemyHit > base.enemyHit,
    `more guns must hit harder (base ${base.enemyHit} vs upgraded ${upgraded.enemyHit})`);
  // And the base (no upgrade) call is byte-identical to omitting the multiplier entirely (legacy-safe).
  const legacy = resolveBroadside({ quality: 1, enemyHull: 100, playerHull: 100 }, rng);
  assert.equal(base.enemyHit, legacy.enemyHit);
});

test('sanitizeShipClass keeps a known class and defaults junk to the starting sloop (#171 reserve)', () => {
  assert.equal(sanitizeShipClass('sloop'), 'sloop');
  assert.ok(SHIP_CLASSES.frigate);
  assert.equal(sanitizeShipClass('frigate'), 'frigate');
  assert.equal(sanitizeShipClass('galleon'), DEFAULT_SHIP_CLASS); // unknown → default
  assert.equal(sanitizeShipClass(undefined), DEFAULT_SHIP_CLASS);
  assert.equal(sanitizeShipClass(42), DEFAULT_SHIP_CLASS);
  assert.equal(DEFAULT_SHIP_CLASS, 'sloop');
});

test('deckGunSlots returns one placement per owned cannon (for the deck mesh)', () => {
  assert.equal(deckGunSlots(0).length, 0);
  assert.equal(deckGunSlots(1).length, 1);
  assert.equal(deckGunSlots(MAX_EXTRA_CANNONS).length, MAX_EXTRA_CANNONS);
  assert.equal(deckGunSlots(99).length, MAX_EXTRA_CANNONS); // clamped
  for (const s of deckGunSlots(MAX_EXTRA_CANNONS)) {
    assert.equal(typeof s.x, 'number');
    assert.equal(typeof s.y, 'number');
    assert.equal(typeof s.z, 'number');
  }
});
