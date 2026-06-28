import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HULL, AIMS, MORALE_MAX,
  clampHull, isSunk, resolveExchange, spoils, repairToll, makeFoe, fireQuip,
  crewShock, strikesColours, captureSpoils, strikeLine,
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

// ---- Crew morale & "strike the colours" (#72) -------------------------------

test('crewShock: chain-shot rattles a crew far more than a clean broadside', () => {
  const bs = crewShock({ outcome: 'broadside', enemyHull: 100 }, half);
  const ch = crewShock({ outcome: 'rigging', enemyHull: 100 }, half);
  assert.ok(ch > bs, 'shredded rigging shocks the crew more than a hull-punch');
  assert.ok(bs >= 0);
});

test('crewShock: a wounded hull frightens the crew more (fear scales as hull falls)', () => {
  const healthy = crewShock({ outcome: 'broadside', enemyHull: 90 }, half);
  const wounded = crewShock({ outcome: 'broadside', enemyHull: 10 }, half);
  assert.ok(wounded > healthy, 'a crew watching its hull cave loses its nerve faster');
});

test('strikesColours: only a wounded AND nerve-broken foe yields; a fresh ship never does', () => {
  assert.equal(strikesColours({ enemyHull: 40, morale: 10 }), true);
  assert.equal(strikesColours({ enemyHull: 90, morale: 10 }), false, 'a healthy hull holds out');
  assert.equal(strikesColours({ enemyHull: 40, morale: 80 }), false, 'steady nerve holds out');
  assert.equal(strikesColours({ enemyHull: 0, morale: 0 }), false, 'a sunk foe cannot strike');
});

test('resolveExchange: morale erodes and is reported; defaults to full nerve', () => {
  const r = resolveExchange({ aim: 'chain', enemyHull: 100, playerHull: 100 }, half);
  assert.ok(r.enemyMorale < MORALE_MAX, 'a volley costs the foe some nerve');
  assert.ok(r.enemyMorale >= 0 && r.enemyMorale <= MORALE_MAX);
  assert.equal(typeof r.yielded, 'boolean');
});

test('full engagement: chain-shot breaks the crew so the foe YIELDS rather than sinks', () => {
  // The merciful road: sawing the rigging rattles the crew until they strike their colours.
  for (const rng of [lo, half, hi]) {
    let enemyHull = MAX_HULL, playerHull = MAX_HULL, morale = MORALE_MAX, rounds = 0, yielded = false;
    while (!isSunk(enemyHull) && !isSunk(playerHull) && !yielded && rounds < 20) {
      const r = resolveExchange({ aim: 'chain', enemyHull, playerHull, morale, gunnery: 1.0 }, rng);
      enemyHull = r.enemyHull; playerHull = r.playerHull; morale = r.enemyMorale; yielded = r.yielded; rounds++;
    }
    assert.ok(yielded, `chain-shot should break the crew (rng), hull=${enemyHull} morale=${morale}`);
    assert.ok(!isSunk(enemyHull), 'a yielded foe is captured, not sunk');
    assert.ok(!isSunk(playerHull), 'the player survives the merciful road');
  }
});

test('full engagement: broadside-spam SINKS before the crew ever yields (playtest stays deterministic)', () => {
  // The headless playtest spams full broadsides and asserts a SINKING win — morale must NOT
  // short-circuit that into a capture. A broadside drowns them before their nerve breaks.
  for (const rng of [lo, half, hi]) {
    let enemyHull = MAX_HULL, playerHull = MAX_HULL, morale = MORALE_MAX, rounds = 0, yielded = false;
    while (!isSunk(enemyHull) && !isSunk(playerHull) && !yielded && rounds < 20) {
      const r = resolveExchange({ aim: 'broadside', enemyHull, playerHull, morale, gunnery: 1.1 }, rng);
      enemyHull = r.enemyHull; playerHull = r.playerHull; morale = r.enemyMorale; yielded = r.yielded; rounds++;
    }
    assert.equal(yielded, false, `broadside-spam must sink, never capture (hull=${enemyHull})`);
    assert.ok(isSunk(enemyHull), 'the foe is drowned by broadsides');
  }
});

test('captureSpoils: a ransom + lawful Standing, far less Infamy than a sinking (the mercy mirror)', () => {
  const cap = captureSpoils({ playerHull: 100, enemyMaxHull: 100 });
  const sink = spoils({ playerHull: 100, enemyMaxHull: 100 });
  assert.ok(cap.coins > 0 && cap.infamy > 0 && cap.standing > 0);
  assert.ok(cap.infamy < sink.infamy, 'mercy is far less infamous than a sinking');
  assert.ok(cap.standing > 0, 'sparing a beaten crew earns lawful standing');
  assert.ok(cap.coins <= 140, 'ransom stays modest');
});

test('strikeLine: returns a non-empty original surrender cry', () => {
  const s = strikeLine(half);
  assert.ok(typeof s === 'string' && s.length > 0);
});
