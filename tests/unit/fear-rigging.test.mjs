// Fear you can SEE on your own ship (#177) — the PURE notoriety→fear-features map.
// Proves: features derive from persisted Infamy alone (NO save field), scale monotonically
// with Infamy, a #164 defeat (which dents Infamy) strips a trophy, and the humble start is
// truly bare. Composition with the real defeat ledger is asserted end-to-end below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fearRigging, SAIL_DARK_START, SAIL_BLACK_AT, TROPHY1_AT, TROPHY2_AT, MAX_TROPHIES,
  FIGUREHEAD1_AT, FIGUREHEAD2_AT, MAX_FIGUREHEAD,
} from '../../src/systems/fear-rigging.js';
import { defeatLedger } from '../../src/renown.js';

test('humble start: no infamy → a bare ship (no dark sails, no trophies, plain prow)', () => {
  const f = fearRigging(0);
  assert.equal(f.sailDarken, 0);
  assert.equal(f.trophies, 0);
  assert.equal(f.figurehead, 0);
});

test('junk / negative infamy is treated as a bare ship (fail-open)', () => {
  for (const junk of [undefined, null, NaN, -50, 'x', Infinity]) {
    const f = fearRigging(junk);
    assert.equal(f.sailDarken, 0, `sailDarken for ${junk}`);
    assert.equal(f.trophies, 0, `trophies for ${junk}`);
    assert.equal(f.figurehead, 0, `figurehead for ${junk}`);
  }
});

test('sails stay untouched until the dark-start floor, then ramp to full black', () => {
  assert.equal(fearRigging(SAIL_DARK_START - 1).sailDarken, 0);
  assert.equal(fearRigging(SAIL_DARK_START).sailDarken, 0);
  assert.ok(fearRigging(SAIL_DARK_START + 1).sailDarken > 0);
  assert.equal(fearRigging(SAIL_BLACK_AT).sailDarken, 1);
  assert.equal(fearRigging(SAIL_BLACK_AT * 5).sailDarken, 1, 'clamped at full black');
});

test('trophies appear at their milestones and cap at MAX_TROPHIES', () => {
  assert.equal(fearRigging(TROPHY1_AT - 1).trophies, 0);
  assert.equal(fearRigging(TROPHY1_AT).trophies, 1);
  assert.equal(fearRigging(TROPHY2_AT - 1).trophies, 1);
  assert.equal(fearRigging(TROPHY2_AT).trophies, 2);
  assert.equal(fearRigging(TROPHY2_AT * 10).trophies, MAX_TROPHIES);
});

test('figurehead grows fiercer at its milestones and caps at MAX_FIGUREHEAD', () => {
  assert.equal(fearRigging(FIGUREHEAD1_AT - 1).figurehead, 0, 'plain prow below the first milestone');
  assert.equal(fearRigging(FIGUREHEAD1_AT).figurehead, 1, 'a carved beast emerges');
  assert.equal(fearRigging(FIGUREHEAD2_AT - 1).figurehead, 1);
  assert.equal(fearRigging(FIGUREHEAD2_AT).figurehead, 2, 'a snarling beast rears');
  assert.equal(fearRigging(FIGUREHEAD2_AT * 10).figurehead, MAX_FIGUREHEAD, 'capped, never a third tier');
});

test('fear features are MONOTONIC non-decreasing in Infamy (deterministic)', () => {
  let prevSail = -1, prevTrophies = -1, prevFig = -1;
  for (let inf = 0; inf <= SAIL_BLACK_AT + 200; inf += 7) {
    const f = fearRigging(inf);
    assert.ok(f.sailDarken >= prevSail, `sailDarken dip at ${inf}`);
    assert.ok(f.trophies >= prevTrophies, `trophies dip at ${inf}`);
    assert.ok(f.figurehead >= prevFig, `figurehead dip at ${inf}`);
    prevSail = f.sailDarken;
    prevTrophies = f.trophies;
    prevFig = f.figurehead;
  }
});

test('a feared captain LOOKS the part vs the humble start', () => {
  const humble = fearRigging(0);
  const feared = fearRigging(SAIL_BLACK_AT + 100);
  assert.ok(feared.sailDarken > humble.sailDarken);
  assert.ok(feared.trophies > humble.trophies);
  assert.equal(feared.trophies, MAX_TROPHIES);
  assert.ok(feared.figurehead > humble.figurehead, 'a fiercer prow than the humble start');
  assert.equal(feared.figurehead, MAX_FIGUREHEAD);
});

test('strip-on-loss: a real #164 defeat dents Infamy and knocks a trophy off the rigging', () => {
  // Two trophies flying, just above the second milestone.
  const before = TROPHY2_AT + 12;
  assert.equal(fearRigging(before).trophies, 2);
  // A tier-3 raiding loss (the #164 ledger) dents Infamy — enough to cross back below TROPHY2.
  const led = defeatLedger(3, 'raid', { coins: 200, infamy: before, standing: 0 });
  assert.ok(led.infamy < before, 'the defeat actually dented Infamy');
  const afterLoss = fearRigging(led.infamy).trophies;
  assert.ok(afterLoss < 2, `a trophy is struck (${afterLoss} < 2)`);
});

test('strip-on-loss is BOUNDED and REVERSIBLE — never below zero, regained by climbing', () => {
  // A crushing loss at low Infamy floors trophies at 0, never negative.
  const led = defeatLedger(5, 'raid', { coins: 0, infamy: TROPHY1_AT + 5, standing: 0 });
  assert.equal(fearRigging(led.infamy).trophies, 0);
  // Climb back above the milestone → the trophy returns (derived, no memory of the loss).
  assert.equal(fearRigging(TROPHY2_AT).trophies, 2);
});

test('the figurehead STEPS BACK on a real #164 defeat, bounded and reversible', () => {
  // A snarling beast rears, just above the fiercest milestone.
  const before = FIGUREHEAD2_AT + 10;
  assert.equal(fearRigging(before).figurehead, 2);
  // A tier-3 raiding loss dents Infamy back below the fiercest milestone → the prow softens a step.
  const led = defeatLedger(3, 'raid', { coins: 200, infamy: before, standing: 0 });
  assert.ok(led.infamy < before, 'the defeat actually dented Infamy');
  const afterLoss = fearRigging(led.infamy).figurehead;
  assert.ok(afterLoss < 2, `the prow steps back a tier (${afterLoss} < 2)`);
  assert.ok(afterLoss >= 0, 'never negative');
  // Climb back → the fiercer prow returns (derived, no memory of the loss).
  assert.equal(fearRigging(FIGUREHEAD2_AT).figurehead, 2);
});

test('a governor-road (Standing) loss leaves the figurehead alone — it tracks Infamy only', () => {
  const infamy = FIGUREHEAD2_AT + 20;
  const led = defeatLedger(4, 'governor', { coins: 100, infamy, standing: 500 });
  assert.equal(led.infamy, infamy, 'Infamy untouched by a governor-road loss');
  assert.equal(fearRigging(led.infamy).figurehead, fearRigging(infamy).figurehead);
});

test('a governor-road (Standing) loss leaves the pirate rigging alone — fear tracks Infamy only', () => {
  const infamy = TROPHY2_AT + 20;
  // A loss on the governor road dents Standing, not Infamy (defeatContext → governor).
  const led = defeatLedger(4, 'governor', { coins: 100, infamy, standing: 500 });
  assert.equal(led.infamy, infamy, 'Infamy untouched by a governor-road loss');
  assert.equal(fearRigging(led.infamy).trophies, fearRigging(infamy).trophies);
});
