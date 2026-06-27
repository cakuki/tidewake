import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HULL, AIMS,
  clampHull, isSunk, resolveExchange, spoils, repairToll, makeFoe, fireQuip,
} from '../../src/cannons.js';

const half = () => 0.5;   // deterministic rng → jitter multiplier == 1.0
const lo = () => 0;       // worst rolls (jitter floor 0.8)
const hi = () => 0.999;   // best rolls (jitter ceiling ~1.2)

test('content: two original aim options, both known', () => {
  assert.deepEqual(AIMS, ['broadside', 'chain']);
  assert.equal(MAX_HULL, 100);
});

test('clampHull: bounds stay within [0, max]', () => {
  assert.equal(clampHull(-30, 100), 0);
  assert.equal(clampHull(130, 100), 100);
  assert.equal(clampHull(42, 100), 42);
});

test('isSunk: triggers at or below zero, not above', () => {
  assert.equal(isSunk(0), true);
  assert.equal(isSunk(-1), true);
  assert.equal(isSunk(0.5), false);
  assert.equal(isSunk(100), false);
});

test('resolveExchange: a broadside hits the enemy hull harder than chain-shot', () => {
  const bs = resolveExchange({ aim: 'broadside', enemyHull: 100, playerHull: 100 }, half);
  const ch = resolveExchange({ aim: 'chain', enemyHull: 100, playerHull: 100 }, half);
  assert.equal(bs.outcome, 'broadside');
  assert.equal(ch.outcome, 'rigging');
  assert.ok(bs.enemyHit > ch.enemyHit, 'broadside should deal more hull damage');
});

test('resolveExchange: chain-shot shreds rigging so the enemy fires back weaker', () => {
  const bs = resolveExchange({ aim: 'broadside', enemyHull: 100, playerHull: 100 }, half);
  const ch = resolveExchange({ aim: 'chain', enemyHull: 100, playerHull: 100 }, half);
  assert.ok(ch.playerHit < bs.playerHit, 'chain-shot reduces the return volley');
  assert.ok(ch.playerHit >= 0);
});

test('resolveExchange: a foe sunk by your volley never fires back', () => {
  const r = resolveExchange({ aim: 'broadside', enemyHull: 5, playerHull: 100 }, half);
  assert.equal(r.sunkEnemy, true);
  assert.equal(r.playerHit, 0, 'a sunk foe cannot return fire');
  assert.equal(r.enemyHull, 0);
});

test('resolveExchange: hull values are clamped and report sinking', () => {
  const r = resolveExchange({ aim: 'broadside', enemyHull: 100, playerHull: 4 }, hi);
  assert.ok(r.playerHull >= 0 && r.playerHull <= MAX_HULL);
  assert.ok(r.enemyHull >= 0 && r.enemyHull <= MAX_HULL);
  assert.equal(r.sunkPlayer, isSunk(r.playerHull));
});

test('full engagement: firing broadsides always sinks the foe and the player survives', () => {
  // The player has the initiative (fires first each exchange), so a broadside-spam is a
  // guaranteed win — the headless playtest relies on exactly this. Bracket the RNG.
  for (const rng of [lo, half, hi]) {
    let enemyHull = MAX_HULL, playerHull = MAX_HULL, rounds = 0;
    while (!isSunk(enemyHull) && !isSunk(playerHull) && rounds < 20) {
      const r = resolveExchange({ aim: 'broadside', enemyHull, playerHull, gunnery: 1.1 }, rng);
      enemyHull = r.enemyHull; playerHull = r.playerHull; rounds++;
    }
    assert.ok(isSunk(enemyHull), `enemy should sink (rng floor/ceil), hull=${enemyHull}`);
    assert.ok(!isSunk(playerHull), `player should survive a broadside-spam, hull=${playerHull}`);
    assert.ok(rounds <= 4, `should resolve within 4 exchanges, took ${rounds}`);
  }
});

test('loss path exists: a foe still afloat can sink a badly-wounded player', () => {
  const r = resolveExchange({ aim: 'broadside', enemyHull: 100, playerHull: 3, gunnery: 1.1 }, hi);
  assert.equal(r.sunkEnemy, false);
  assert.equal(r.sunkPlayer, true, 'a wounded player can be sunk by the return volley');
});

test('spoils: positive, scales with the fight, teeth-y infamy, stays bounded', () => {
  const small = spoils({ playerHull: 10, enemyMaxHull: 80 });
  const big = spoils({ playerHull: 100, enemyMaxHull: 100 });
  assert.ok(small.coins > 0 && small.infamy > 0);
  assert.ok(big.coins >= small.coins, 'a cleaner win on a tougher foe pays more');
  assert.ok(big.infamy > big.coins, 'infamy is the teeth-y pirate reward');
  assert.ok(big.coins <= 140, 'reward stays modest (not free riches)');
});

test('repairToll: a comic-but-real setback for limping home — small, positive', () => {
  const t = repairToll();
  assert.ok(t.coins > 0 && t.coins <= 25);
});

test('makeFoe: full hull, a name, plausible gunnery in [0.9, 1.1]', () => {
  const foe = makeFoe(half);
  assert.equal(foe.hull, MAX_HULL);
  assert.equal(foe.maxHull, MAX_HULL);
  assert.ok(typeof foe.name === 'string' && foe.name.length > 0);
  assert.ok(foe.gunnery >= 0.9 && foe.gunnery <= 1.1);
});

test('fireQuip: returns a non-empty original line for a given outcome', () => {
  for (const outcome of ['broadside', 'rigging']) {
    const q = fireQuip(outcome, half);
    assert.ok(typeof q === 'string' && q.length > 0);
  }
});
