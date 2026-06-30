// Boarding → captain's-duel hand-off (#135 slice 4). Verifies the verbal duel (#33) opened by
// BOARDING a beaten ship (a) starts the captain already shaken by the deck brawl (the opening dent),
// (b) flags the duel `boarded` so main.js frames the win as a CAPTURE (Standing), and (c) leaves the
// existing open-sea hail byte-identical (no dent, not boarded) for the #79/#91 callers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDuel, MAX_MORALE } from '../../src/duel.js';

const half = () => 0.5;

function stubNpcs() {
  return { snapshot: () => [{ pos: [0, 0] }], respawn() {} };
}

test('a plain hail (no opts) opens the duel un-boarded, at full enemy morale', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  assert.equal(duel.tryChallenge(), true);
  assert.equal(duel.state.boarded, false, 'an open-sea hail is not a boarding');
  assert.equal(duel.state.enemyMorale, MAX_MORALE, 'honest colours → no opening dent');
  assert.equal(duel.snapshot().boarded, false);
});

test('a boarding hand-off opens the duel boarded, with the captain already dented', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  assert.equal(duel.tryChallenge({ openingDent: 25, boarded: true }), true);
  assert.equal(duel.state.boarded, true, 'flagged boarded for the capture framing');
  assert.equal(duel.state.enemyMorale, MAX_MORALE - 25, 'the brawl softened the captain');
  assert.equal(duel.snapshot().boarded, true);
});

test('the opening dent is clamped and never trivialises the duel (morale stays ≥ 0)', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  assert.equal(duel.tryChallenge({ openingDent: 9999, boarded: true }), true);
  assert.ok(duel.state.enemyMorale >= 0, 'a huge dent never drives morale negative');
  assert.ok(duel.state.active, 'the duel still opens — it is the decider, not auto-won');
});
