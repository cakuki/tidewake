// Auto-harbour pure-logic tests (#67 + #96): the edge-triggered landfall decision, the
// slow-assist suspension, the leftHarbour re-arm latch, and the seaward-nudge heading.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldEnterTown, harbourAssistActive, nextLeftHarbour, seawardHeading,
} from '../../src/systems/harbour.js';
import { SAILING, TOWN, BATTLE } from '../../src/mode.js';

test('shouldEnterTown: fires on the fresh arrival while under sail', () => {
  assert.equal(shouldEnterTown({ mode: SAILING, arrived: true }), true);
});

test('shouldEnterTown: never without a fresh arrival (sitting at the berth)', () => {
  assert.equal(shouldEnterTown({ mode: SAILING, arrived: false }), false);
});

test('shouldEnterTown: never re-enters from TOWN, never interrupts a BATTLE', () => {
  assert.equal(shouldEnterTown({ mode: TOWN, arrived: true }), false);
  assert.equal(shouldEnterTown({ mode: BATTLE, arrived: true }), false);
});

test('harbourAssistActive: on by default, suspended while leaving', () => {
  assert.equal(harbourAssistActive(false), true);
  assert.equal(harbourAssistActive(true), false);
});

test('nextLeftHarbour: raised by leaving, held in range, dropped once clear', () => {
  // press "Set Sail" → latch up
  assert.equal(nextLeftHarbour(false, { docked: 'Gullet\'s Rest', leaving: true }), true);
  // sailing out but still within range → latch holds (assist stays suspended, nudge carries on)
  assert.equal(nextLeftHarbour(true, { docked: 'Gullet\'s Rest', leaving: false }), true);
  // cleared the harbour mouth → latch drops, re-armed for the next landfall
  assert.equal(nextLeftHarbour(true, { docked: null, leaving: false }), false);
  // never auto-raises while merely approaching
  assert.equal(nextLeftHarbour(false, { docked: 'Gullet\'s Rest', leaving: false }), false);
});

test('nextLeftHarbour: leaving wins even on the frame you are still docked', () => {
  assert.equal(nextLeftHarbour(false, { docked: 'Barnacle Bottom', leaving: true }), true);
});

test('seawardHeading: returns the jetty angle, falls back without NaN-ing the helm', () => {
  assert.equal(seawardHeading(1.25), 1.25);
  assert.equal(seawardHeading(0), 0);
  assert.equal(seawardHeading(undefined, 2.1), 2.1);
  assert.equal(seawardHeading(NaN, 0.4), 0.4);
});
