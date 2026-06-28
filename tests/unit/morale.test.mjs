import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MORALE_MIN, MORALE_MAX, MORALE_START, LOW_MORALE, MUTINY_RISK,
  freshMorale, clampMorale, sanitizeMorale, moraleDelta, applyMorale,
  isLow, atMutinyRisk, moraleTier, moraleBeat, GRUMBLE_LINES, MUTINY_LINES,
} from '../../src/systems/morale.js';

// Crew morale / loyalty (#124, DL #4/#5) — a reactive meter fed by the player's CHOICES. The whole
// model is pure, so the rises/falls on the right events + the low/very-low thresholds are unit-asserted
// (owner doctrine: a clearly testable outcome).

test('a fresh crew starts at the willing-but-not-fanatical baseline', () => {
  assert.equal(freshMorale(), MORALE_START);
  assert.ok(MORALE_MIN < MORALE_START && MORALE_START < MORALE_MAX, 'start has room to rise AND fall');
  assert.ok(MUTINY_RISK < LOW_MORALE && LOW_MORALE < MORALE_START, 'thresholds sit below the start');
});

test('morale RISES on good deeds (rescue / a rumour win / harbour growth)', () => {
  assert.ok(moraleDelta('rescue') > 0, 'a rescue lifts the crew');
  assert.ok(moraleDelta('rumourWin') > 0, 'a tip that paid off lifts the crew');
  assert.ok(moraleDelta('harbourGrow') > 0, 'a prospering home port lifts the crew');
  assert.equal(applyMorale(50, 'rescue'), 50 + moraleDelta('rescue'));
  assert.ok(applyMorale(50, 'rescue') > 50, 'a rescue raises morale');
});

test('morale FALLS on cruelty (plunder) and reckless losses (aground / a missed rescue)', () => {
  assert.ok(moraleDelta('plunder') < 0, 'leaving a crew to a cold row curdles loyalty');
  assert.ok(moraleDelta('aground') < 0, 'a reckless grounding sours the crew');
  assert.ok(moraleDelta('missedRescue') < 0, 'sailing past souls in distress is a cold thing to watch');
  assert.ok(applyMorale(50, 'plunder') < 50, 'plunder lowers morale');
});

test('an unknown event is a no-op (a stray call never moves the meter)', () => {
  assert.equal(moraleDelta('not-a-real-event'), 0);
  assert.equal(applyMorale(60, 'not-a-real-event'), 60);
});

test('morale is CLAMPED to [MIN, MAX] in both directions', () => {
  let m = MORALE_MAX;
  for (let i = 0; i < 20; i++) m = applyMorale(m, 'rescue');
  assert.equal(m, MORALE_MAX, 'good deeds never overflow the ceiling');
  let lo = MORALE_MIN;
  for (let i = 0; i < 20; i++) lo = applyMorale(lo, 'plunder');
  assert.equal(lo, MORALE_MIN, 'bad deeds never underflow the floor');
});

test('clamp / sanitise fail OPEN on junk → the START baseline (never NaN, never a reject)', () => {
  assert.equal(clampMorale(NaN), MORALE_START);
  assert.equal(clampMorale('80'), MORALE_START);
  assert.equal(clampMorale(undefined), MORALE_START);
  assert.equal(clampMorale(-999), MORALE_MIN);
  assert.equal(clampMorale(999), MORALE_MAX);
  assert.equal(sanitizeMorale(42), 42);
  assert.equal(sanitizeMorale({}), MORALE_START);
});

test('isLow / atMutinyRisk fire at and below their thresholds', () => {
  assert.ok(!isLow(LOW_MORALE + 1));
  assert.ok(isLow(LOW_MORALE));
  assert.ok(isLow(MUTINY_RISK));
  assert.ok(!atMutinyRisk(MUTINY_RISK + 1));
  assert.ok(atMutinyRisk(MUTINY_RISK));
  assert.ok(atMutinyRisk(0));
});

test('moraleTier reports the deepest tier a value qualifies for', () => {
  assert.equal(moraleTier(MUTINY_RISK), 'mutiny');
  assert.equal(moraleTier(MUTINY_RISK + 1), 'low');
  assert.equal(moraleTier(LOW_MORALE), 'low');
  assert.equal(moraleTier(LOW_MORALE + 1), 'steady');
  assert.equal(moraleTier(90), 'high');
});

test('the low-morale GRUMBLE beat fires only on the DOWNWARD crossing of LOW_MORALE', () => {
  const beat = moraleBeat(LOW_MORALE + 2, LOW_MORALE - 1);
  assert.ok(beat, 'crossing below the grumble line rings a beat');
  assert.equal(beat.tier, 'low');
  assert.ok(beat.title && beat.lines.length, 'the beat carries a title + a line pool');
  assert.deepEqual(beat.lines, GRUMBLE_LINES);
  // No beat when already below it (no fresh crossing) — it must not ring every frame.
  assert.equal(moraleBeat(LOW_MORALE - 1, LOW_MORALE - 2), null, 'no re-fire while already low');
  // No beat on the way back UP.
  assert.equal(moraleBeat(LOW_MORALE - 1, LOW_MORALE + 5), null, 'no beat recovering above the line');
});

test('the very-low MUTINY-RISK warning fires only on the DOWNWARD crossing of MUTINY_RISK', () => {
  const beat = moraleBeat(MUTINY_RISK + 3, MUTINY_RISK - 1);
  assert.ok(beat, 'crossing below the mutiny line rings a beat');
  assert.equal(beat.tier, 'mutiny');
  assert.deepEqual(beat.lines, MUTINY_LINES);
  // Crossing from above LOW straight into mutiny reports the deepest beat (mutiny), not the grumble.
  const deep = moraleBeat(LOW_MORALE + 5, MUTINY_RISK - 2);
  assert.equal(deep.tier, 'mutiny', 'a big plunge reports the mutiny beat, not just the grumble');
  // Already at mutiny risk → no re-fire.
  assert.equal(moraleBeat(MUTINY_RISK - 1, MUTINY_RISK - 3), null, 'no re-fire while already at risk');
});

test('a realistic slump: a run of cruelty drives a fresh crew through grumble then mutiny risk', () => {
  let m = MORALE_START;
  let grumbled = false, warned = false;
  for (let i = 0; i < 12; i++) {
    const next = applyMorale(m, 'plunder');
    const beat = moraleBeat(m, next);
    if (beat?.tier === 'low') grumbled = true;
    if (beat?.tier === 'mutiny') warned = true;
    m = next;
  }
  assert.ok(grumbled, 'a sustained cold streak rings the grumble');
  assert.ok(warned, 'and then the mutiny-risk warning');
  assert.ok(m <= MUTINY_RISK, 'the crew ends at mutiny risk');
});
