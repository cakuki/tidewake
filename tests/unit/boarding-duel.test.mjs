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

// ── Crew casualties → duel confidence (#135, Option 4 slice 3): a bloodied boarding shakes YOUR captain ──
test('a plain hail opens the duel at FULL player morale (no confidence dent)', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  duel.tryChallenge();
  assert.equal(duel.state.playerMorale, MAX_MORALE, 'an open-sea hail never shakes your own captain');
  assert.equal(duel.snapshot().confidenceDent, 0);
});

test('a bloodied boarding opens the duel with YOUR captain shaken (playerDent off player morale)', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  duel.tryChallenge({ openingDent: 10, playerDent: 18, boarded: true });
  assert.equal(duel.state.playerMorale, MAX_MORALE - 18, 'a costly boarding shifts your opening footing');
  assert.equal(duel.state.enemyMorale, MAX_MORALE - 10, 'her captain is still dented by the brawl (slice 4)');
  assert.equal(duel.snapshot().confidenceDent, 18, 'the confidence dent is QA-visible for the coupling');
});

test('the confidence dent is clamped and never drives the player out of the fight (morale ≥ 0, still active)', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  duel.tryChallenge({ playerDent: 9999, boarded: true });
  assert.ok(duel.state.playerMorale >= 0, 'a huge dent never drives your morale negative');
  assert.ok(duel.state.active, 'you always still get to open your mouth — the duel is the decider');
});

test('the enemy-side and player-side dents are independent (slice 4 + slice 3 stack cleanly)', () => {
  const duel = createDuel({ npcs: stubNpcs(), getShipPos: () => [0, 0], rng: half });
  duel.tryChallenge({ openingDent: 25, playerDent: 0, boarded: true });
  assert.equal(duel.state.playerMorale, MAX_MORALE, 'a clean boarding dents only HER captain, not yours');
  assert.equal(duel.state.enemyMorale, MAX_MORALE - 25);
});
