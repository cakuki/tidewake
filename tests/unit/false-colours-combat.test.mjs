// False Colours (#79) — the treachery payoff wired through the combat controllers.
// Verifies that opening a fight under FALSE colours (a) catches the foe off-guard (a
// reduced starting hull/morale) and (b) pays a perfidy bonus to Infamy on the win, while
// an honest TRUE-colours fight does neither. Deterministic rng so the resolution is fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCannons, MAX_HULL } from '../../src/cannons.js';
import { createDuel, MAX_MORALE } from '../../src/duel.js';
import { TREACHERY_RATE, SURPRISE_DAMAGE } from '../../src/colours.js';

const half = () => 0.5; // deterministic rng → fairness jitter == 1.0

// A foe sitting right on top of the player so nearestInRange() always engages.
function stubNpcs() {
  return { snapshot: () => [{ pos: [0, 0] }], respawn() {} };
}

test('cannons: a FALSE-colours ambush weakens the foe and pays a treachery Infamy bonus', () => {
  let reward = null;
  const cannons = createCannons({
    npcs: stubNpcs(),
    getShipPos: () => [0, 0],
    getColours: () => 'merchant', // a lie
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(cannons.openFire(), true);
  // (a) opening advantage: the foe starts already weakened by the surprise.
  assert.equal(cannons.state.treachery, true);
  assert.equal(cannons.state.enemyHull, MAX_HULL - SURPRISE_DAMAGE);
  // Spam full broadsides (aim 0) — the player holds the initiative, so it's a sure win.
  for (let r = 0; r < 20 && cannons.state.active; r++) cannons.fire(0);
  assert.equal(cannons.state.result, 'win');
  // (b) the win pays a perfidy bonus on top of the honest spoils.
  assert.ok(reward && reward.treachery === true);
  assert.ok(reward.treacheryBonus > 0);
  const base = reward.infamy - reward.treacheryBonus;
  assert.equal(reward.treacheryBonus, Math.round(base * TREACHERY_RATE));
});

test('cannons: an HONEST true-colours fight gives no surprise and no treachery bonus', () => {
  let reward = null;
  const cannons = createCannons({
    npcs: stubNpcs(),
    getShipPos: () => [0, 0],
    getColours: () => 'black', // honest
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(cannons.openFire(), true);
  assert.equal(cannons.state.treachery, false);
  assert.equal(cannons.state.enemyHull, MAX_HULL); // no ambush — full hull
  for (let r = 0; r < 20 && cannons.state.active; r++) cannons.fire(0);
  assert.equal(cannons.state.result, 'win');
  assert.ok(reward);
  assert.ok(!reward.treachery);
  assert.equal(reward.treacheryBonus, undefined);
});

test('duel: a FALSE-colours hail dents enemy morale and pays a treachery Infamy bonus', () => {
  let reward = null;
  const duel = createDuel({
    npcs: stubNpcs(),
    getShipPos: () => [0, 0],
    getColours: () => 'merchant',
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(duel.tryChallenge(), true);
  assert.equal(duel.state.treachery, true);
  assert.equal(duel.state.enemyMorale, MAX_MORALE - SURPRISE_DAMAGE);
  // Always fling the cutting line (the one matching the enemy's weakness).
  for (let r = 0; r < 40 && duel.state.active; r++) {
    const snap = duel.snapshot();
    let idx = snap.options.findIndex((o) => o.category === snap.enemyWeakTo);
    if (idx < 0) idx = 0;
    duel.choose(idx);
  }
  assert.equal(duel.state.result, 'win');
  assert.ok(reward && reward.treachery === true);
  assert.ok(reward.treacheryBonus > 0);
  const base = reward.renown - reward.treacheryBonus; // the duel's `renown` field IS infamy
  assert.equal(reward.treacheryBonus, Math.round(base * TREACHERY_RATE));
});

test('duel: an honest true-colours hail gives no surprise and no treachery bonus', () => {
  let reward = null;
  const duel = createDuel({
    npcs: stubNpcs(),
    getShipPos: () => [0, 0],
    getColours: () => 'black',
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(duel.tryChallenge(), true);
  assert.equal(duel.state.treachery, false);
  assert.equal(duel.state.enemyMorale, MAX_MORALE);
  for (let r = 0; r < 40 && duel.state.active; r++) {
    const snap = duel.snapshot();
    let idx = snap.options.findIndex((o) => o.category === snap.enemyWeakTo);
    if (idx < 0) idx = 0;
    duel.choose(idx);
  }
  assert.equal(duel.state.result, 'win');
  assert.ok(reward && !reward.treachery);
  assert.equal(reward.treacheryBonus, undefined);
});
