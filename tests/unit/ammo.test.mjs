import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AMMO, AMMO_TYPES, ammoProfile, cycleAmmo, defaultLoadout, fitAmmo, isFittable,
} from '../../src/systems/ammo.js';
import { resolveBroadside, MORALE_MAX } from '../../src/cannons.js';

const half = () => 0.5; // deterministic rng (== the ±20% jitter midpoint, so jitter()==1)

// ---- The catalogue ----------------------------------------------------------

test('AMMO_TYPES lists exactly the six fitted shot kinds the slice promises', () => {
  assert.deepEqual(AMMO_TYPES, ['round', 'chain', 'grape', 'light', 'heavy', 'swivel']);
});

test('every ammo type carries the full pure profile the broadside model reads', () => {
  for (const id of AMMO_TYPES) {
    const a = AMMO[id];
    assert.ok(a, `${id} exists`);
    assert.equal(a.id, id);
    assert.equal(typeof a.name, 'string');
    assert.equal(typeof a.icon, 'string');
    assert.equal(typeof a.blurb, 'string');
    for (const k of ['hullMult', 'returnMult', 'moraleMult', 'aimForgive', 'reloadMult']) {
      assert.equal(typeof a[k], 'number', `${id}.${k} is a number`);
      assert.ok(a[k] >= 0, `${id}.${k} >= 0`);
    }
    assert.ok(a.shock === 'broadside' || a.shock === 'rigging', `${id}.shock is a crewShock kind`);
  }
});

test('ammoProfile falls back to round for an unknown / missing id', () => {
  assert.equal(ammoProfile('round').id, 'round');
  assert.equal(ammoProfile('nonsense').id, 'round');
  assert.equal(ammoProfile().id, 'round');
});

// ---- Distinct effects (the Game Designer's fun-shaping numbers) -------------

test('each shot is mechanically DISTINCT — no two share the same effect fingerprint', () => {
  const seen = new Set();
  for (const id of AMMO_TYPES) {
    const a = AMMO[id];
    const fp = [a.hullMult, a.returnMult, a.moraleMult, a.aimForgive, a.reloadMult, a.shock].join(',');
    assert.ok(!seen.has(fp), `${id} must not duplicate another shot's effect`);
    seen.add(fp);
  }
});

test('round is the neutral workhorse (all multipliers 1, no forgiveness)', () => {
  const r = AMMO.round;
  assert.equal(r.hullMult, 1);
  assert.equal(r.returnMult, 1);
  assert.equal(r.moraleMult, 1);
  assert.equal(r.aimForgive, 0);
  assert.equal(r.reloadMult, 1);
});

test('the shots sit where the fantasy says they should', () => {
  assert.ok(AMMO.heavy.hullMult > AMMO.round.hullMult, 'heavy double-shot hits hardest on the hull');
  assert.ok(AMMO.chain.hullMult < AMMO.round.hullMult, 'chain barely dents the hull');
  assert.ok(AMMO.chain.returnMult < AMMO.round.returnMult, 'chain shreds her rigging so her reply is weak');
  assert.ok(AMMO.grape.moraleMult > AMMO.round.moraleMult, 'grapeshot sweeps the deck — it breaks nerve');
  assert.ok(AMMO.light.aimForgive > 0, 'light shot has a forgiving arc');
  assert.ok(AMMO.swivel.reloadMult < AMMO.round.reloadMult, 'swivels are quick-firing');
  assert.ok(AMMO.heavy.reloadMult > AMMO.round.reloadMult, 'a double-shotted gun is slow to load');
});

// ---- Loadout cycling (pure) -------------------------------------------------

test('cycleAmmo walks the fitted loadout in order and wraps around', () => {
  const lo = ['round', 'chain', 'grape'];
  assert.equal(cycleAmmo('round', lo), 'chain');
  assert.equal(cycleAmmo('chain', lo), 'grape');
  assert.equal(cycleAmmo('grape', lo), 'round', 'wraps back to the first');
});

test('cycleAmmo from an id not in the loadout starts at the first fitted shot', () => {
  assert.equal(cycleAmmo('heavy', ['round', 'chain']), 'round');
});

test('cycleAmmo on a single-shot loadout returns that same shot', () => {
  assert.equal(cycleAmmo('round', ['round']), 'round');
});

test('cycleAmmo defends against an empty/garbage loadout — you always have round to fire', () => {
  assert.equal(cycleAmmo('round', []), 'round');
  assert.equal(cycleAmmo('round', ['junk']), 'round');
});

test('defaultLoadout is a sensible variety with round always first', () => {
  const lo = defaultLoadout();
  assert.equal(lo[0], 'round', 'round is always fitted and first');
  assert.ok(lo.length >= 2, 'the cycle has variety out of the box');
  assert.ok(lo.every(isFittable), 'every default entry is a real shot');
});

// ---- Workshop fit/unfit (pure) ----------------------------------------------

test('fitAmmo fits an unfitted shot and keeps the canonical order', () => {
  const lo = fitAmmo(['round', 'chain'], 'heavy');
  assert.ok(lo.includes('heavy'));
  // canonical order is AMMO_TYPES order, not insertion order
  assert.deepEqual(lo, AMMO_TYPES.filter((id) => lo.includes(id)));
});

test('fitAmmo TOGGLES — fitting an already-fitted shot unfits it', () => {
  const lo = fitAmmo(['round', 'chain', 'grape'], 'chain');
  assert.ok(!lo.includes('chain'), 'a second fit unfits it');
  assert.ok(lo.includes('round') && lo.includes('grape'));
});

test('fitAmmo never lets you unfit round — your gun crew always has a ball at the rack', () => {
  const lo = fitAmmo(['round', 'chain'], 'round');
  assert.ok(lo.includes('round'), 'round cannot be unfitted');
});

test('fitAmmo ignores an unknown shot id', () => {
  assert.deepEqual(fitAmmo(['round'], 'junk'), ['round']);
});

// ---- The shots actually change the broadside resolution --------------------

test('resolveBroadside default (no ammo) is byte-identical to a round shot — backwards compatible', () => {
  const base = { quality: 1, enemyHull: 100, playerHull: 100, gunnery: 1, morale: MORALE_MAX };
  const noAmmo = resolveBroadside(base, half);
  const round = resolveBroadside({ ...base, ammo: AMMO.round }, half);
  assert.deepEqual(round, noAmmo);
});

test('chain shot deals less hull but cuts the foe’s reply vs round at the same aim', () => {
  const base = { quality: 1, enemyHull: 100, playerHull: 100, gunnery: 1 };
  const round = resolveBroadside({ ...base, ammo: AMMO.round }, half);
  const chain = resolveBroadside({ ...base, ammo: AMMO.chain }, half);
  assert.ok(chain.enemyHit < round.enemyHit, 'chain dents the hull less');
  assert.ok(chain.playerHit < round.playerHit, 'but her shredded rigging answers weakly');
});

test('heavy shot deals MORE hull than round at the same aim (double-shotted)', () => {
  const base = { quality: 1, enemyHull: 100, playerHull: 100, gunnery: 1 };
  const round = resolveBroadside({ ...base, ammo: AMMO.round }, half);
  const heavy = resolveBroadside({ ...base, ammo: AMMO.heavy }, half);
  assert.ok(heavy.enemyHit > round.enemyHit, 'a double-shotted gun bites harder');
});

test('grapeshot breaks more nerve than round — the capture road', () => {
  const base = { quality: 1, enemyHull: 40, playerHull: 100, gunnery: 1, morale: MORALE_MAX };
  const round = resolveBroadside({ ...base, ammo: AMMO.round }, half);
  const grape = resolveBroadside({ ...base, ammo: AMMO.grape }, half);
  assert.ok(grape.enemyMorale < round.enemyMorale, 'grapeshot rattles the crew harder');
});

test('light shot lifts a glancing (off-beam) hit — its forgiving arc', () => {
  const base = { quality: 0.3, enemyHull: 100, playerHull: 100, gunnery: 1 };
  const round = resolveBroadside({ ...base, ammo: AMMO.round }, half);
  const light = resolveBroadside({ ...base, ammo: AMMO.light }, half);
  // light is gentler per-quality but forgives the angle; at a poor angle the forgiveness wins.
  assert.ok(light.enemyHit >= round.enemyHit, 'a forgiving shot still bites when you are off the beam');
});
