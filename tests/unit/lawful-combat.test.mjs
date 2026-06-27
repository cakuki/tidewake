// Letters of Marque (#91) — the LAWFUL Standing reward wired through the combat controllers.
// The honest mirror of #79's treachery: an HONEST kill (true colours) of a PIRATE vessel pays
// Standing (lawful privateering); an honest kill of an innocent MERCHANT fines it; a kill under
// FALSE colours pays no Standing (that's the Infamy/treachery road). Deterministic rng.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCannons } from '../../src/cannons.js';
import { createDuel } from '../../src/duel.js';
import { LAWFUL_RATE, PIRACY_FINE } from '../../src/colours.js';

const half = () => 0.5; // deterministic rng → fairness jitter == 1.0

// A foe of a given KIND sitting on top of the player so nearestInRange() always engages.
function stubNpcs(kind) {
  return { snapshot: () => [{ pos: [0, 0], kind }], respawn() {} };
}

test('cannons: an HONEST kill of a PIRATE pays Standing (lawful privateering)', () => {
  let reward = null;
  const cannons = createCannons({
    npcs: stubNpcs('pirate'),
    getShipPos: () => [0, 0],
    getColours: () => 'black', // honest
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(cannons.openFire(), true);
  assert.equal(cannons.state.targetKind, 'pirate');
  for (let r = 0; r < 20 && cannons.state.active; r++) cannons.fire(0);
  assert.equal(cannons.state.result, 'win');
  assert.ok(reward && reward.lawful === true, 'a lawful prize is flagged');
  assert.ok(reward.standing > 0, 'lawful privateering earns Standing');
  assert.equal(reward.standing, Math.round(reward.infamy * LAWFUL_RATE));
  assert.equal(reward.targetKind, 'pirate');
  assert.ok(!reward.treachery, 'honest work is not treachery');
});

test('cannons: an HONEST kill of an innocent MERCHANT FINES Standing (piracy under your own flag)', () => {
  let reward = null;
  const cannons = createCannons({
    npcs: stubNpcs('merchant'),
    getShipPos: () => [0, 0],
    getColours: () => 'black',
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(cannons.openFire(), true);
  assert.equal(cannons.state.targetKind, 'merchant');
  for (let r = 0; r < 20 && cannons.state.active; r++) cannons.fire(0);
  assert.equal(cannons.state.result, 'win');
  assert.ok(reward && reward.standing < 0, 'sinking an innocent costs Standing');
  assert.equal(reward.standing, -Math.round(reward.infamy * PIRACY_FINE));
  assert.ok(!reward.lawful, 'piracy is never lawful');
});

test('cannons: a FALSE-colours kill of a pirate pays NO Standing (it feeds Infamy instead)', () => {
  let reward = null;
  const cannons = createCannons({
    npcs: stubNpcs('pirate'),
    getShipPos: () => [0, 0],
    getColours: () => 'merchant', // a lie — forfeits any lawful claim
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(cannons.openFire(), true);
  for (let r = 0; r < 20 && cannons.state.active; r++) cannons.fire(0);
  assert.equal(cannons.state.result, 'win');
  assert.equal(reward.standing, undefined, 'a deceptive kill awards no Standing');
  assert.equal(reward.treachery, true, 'it pays the perfidy Infamy bonus instead');
});

test('duel: an HONEST win over a PIRATE pays Standing (the lawful mirror)', () => {
  let reward = null;
  const duel = createDuel({
    npcs: stubNpcs('pirate'),
    getShipPos: () => [0, 0],
    getColours: () => 'black',
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(duel.tryChallenge(), true);
  assert.equal(duel.state.targetKind, 'pirate');
  for (let r = 0; r < 40 && duel.state.active; r++) {
    const snap = duel.snapshot();
    let idx = snap.options.findIndex((o) => o.category === snap.enemyWeakTo);
    if (idx < 0) idx = 0;
    duel.choose(idx);
  }
  assert.equal(duel.state.result, 'win');
  assert.ok(reward && reward.lawful === true);
  assert.ok(reward.standing > 0);
  assert.equal(reward.standing, Math.round(reward.renown * LAWFUL_RATE)); // duel's `renown` IS infamy
});

test('duel: an honest win over an innocent MERCHANT fines Standing', () => {
  let reward = null;
  const duel = createDuel({
    npcs: stubNpcs('merchant'),
    getShipPos: () => [0, 0],
    getColours: () => 'black',
    applyReward: (r) => { reward = r; },
    rng: half,
  });
  assert.equal(duel.tryChallenge(), true);
  for (let r = 0; r < 40 && duel.state.active; r++) {
    const snap = duel.snapshot();
    let idx = snap.options.findIndex((o) => o.category === snap.enemyWeakTo);
    if (idx < 0) idx = 0;
    duel.choose(idx);
  }
  assert.equal(duel.state.result, 'win');
  assert.ok(reward.standing < 0);
  assert.ok(!reward.lawful);
});
