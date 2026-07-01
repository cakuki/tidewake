// Unit: hard battle isolation (#161 slice 1) — the PURE stance guard that keeps a fight clean.
// The owner reported the #125 rescue offer + the open-sea f/g hails leaking INTO the fight. The
// fix is a single predicate the input handlers + the encounter spawn gate consult; this pins its
// contract without a DOM (the #53 self-tested-component standard). No save-schema — transient only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { interactionsSuppressed, ambientInteractionsAllowed } from '../../src/systems/battle-isolation.js';

// ---- interactionsSuppressed: true ⇔ in the deliberate BATTLE stance -----------------------

test('interactionsSuppressed is TRUE while in the deliberate battle stance', () => {
  assert.equal(interactionsSuppressed({ battleActive: true }), true);
});

test('interactionsSuppressed is FALSE at sea (no active battle)', () => {
  assert.equal(interactionsSuppressed({ battleActive: false }), false);
});

test('interactionsSuppressed defaults to FALSE for missing/empty state (fail-open at sea)', () => {
  assert.equal(interactionsSuppressed(), false);
  assert.equal(interactionsSuppressed({}), false);
});

test('interactionsSuppressed only trusts an EXACT boolean true (no truthy coercion surprises)', () => {
  assert.equal(interactionsSuppressed({ battleActive: 1 }), false);
  assert.equal(interactionsSuppressed({ battleActive: 'yes' }), false);
  assert.equal(interactionsSuppressed({ battleActive: null }), false);
});

// ---- ambientInteractionsAllowed: helm-free AND not-fighting --------------------------------

test('ambientInteractionsAllowed: an at-sea, helm-free captain CAN meet a founderer', () => {
  assert.equal(ambientInteractionsAllowed({ paused: false, battleActive: false }), true);
});

test('ambientInteractionsAllowed: a FIGHT suppresses the ambient rescue/hail (the reported bug)', () => {
  // Helm stays live in the deliberate stance (f.paused === false), so the OLD gate (!paused) let a
  // founderer spawn mid-fight. Battle isolation must veto it regardless of the helm.
  assert.equal(ambientInteractionsAllowed({ paused: false, battleActive: true }), false);
});

test('ambientInteractionsAllowed: a paused world (town/menu) also blocks ambient spawns', () => {
  assert.equal(ambientInteractionsAllowed({ paused: true, battleActive: false }), false);
});

test('ambientInteractionsAllowed defaults to allowed for empty state (helm free, no fight)', () => {
  assert.equal(ambientInteractionsAllowed(), true);
});
