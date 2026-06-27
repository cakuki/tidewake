import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL, BEATS,
  freshFlags, completedFlags, normalizeFlags,
  shouldShowGoal, onboardingComplete, applyEvent, currentStep,
} from '../../src/onboarding.js';

// ---- Flag hygiene ----------------------------------------------------------

test('freshFlags is an all-to-do captain', () => {
  assert.deepEqual(freshFlags(), { goal: false, firstDock: false, firstTrade: false, firstRank: false });
});

test('completedFlags has every step done', () => {
  assert.deepEqual(completedFlags(), { goal: true, firstDock: true, firstTrade: true, firstRank: true });
  assert.ok(onboardingComplete(completedFlags()));
});

test('normalizeFlags coerces junk / partial / non-object to safe booleans', () => {
  assert.deepEqual(normalizeFlags(null), freshFlags());
  assert.deepEqual(normalizeFlags(undefined), freshFlags());
  assert.deepEqual(normalizeFlags('nope'), freshFlags());
  assert.deepEqual(normalizeFlags([1, 2]), freshFlags());
  assert.deepEqual(
    normalizeFlags({ goal: 'yes', firstDock: 1, firstTrade: 0 }),
    { goal: true, firstDock: true, firstTrade: false, firstRank: false },
  );
});

// ---- The seeded goal nudge -------------------------------------------------

test('a brand-new captain is shown the seeded goal', () => {
  assert.ok(shouldShowGoal(freshFlags()));
  assert.equal(currentStep(freshFlags()), 'goal');
});

test('the goal clears once the captain acts (first dock) or dismisses it', () => {
  assert.equal(shouldShowGoal({ ...freshFlags(), firstDock: true }), false);
  assert.equal(shouldShowGoal({ ...freshFlags(), goal: true }), false);
});

test('a returning captain is never shown the goal', () => {
  assert.equal(shouldShowGoal(completedFlags()), false);
  assert.ok(onboardingComplete(completedFlags()));
});

// ---- First-win beats: each fires ONCE ever ---------------------------------

test('first dock fires the first-port beat and also clears the goal', () => {
  const r = applyEvent(freshFlags(), 'dock');
  assert.ok(r.changed);
  assert.equal(r.beat, BEATS.firstDock);
  assert.equal(r.flags.firstDock, true);
  assert.equal(r.flags.goal, true, 'docking satisfies the seeded goal');
});

test('first profitable trade fires the first-coin beat', () => {
  const r = applyEvent(freshFlags(), 'profit');
  assert.ok(r.changed);
  assert.equal(r.beat, BEATS.firstTrade);
  assert.equal(r.flags.firstTrade, true);
});

test('first rank climbed fires the name-travels beat', () => {
  const r = applyEvent(freshFlags(), 'rank');
  assert.ok(r.changed);
  assert.equal(r.beat, BEATS.firstRank);
  assert.equal(r.flags.firstRank, true);
});

test('each beat fires only once — a repeat event is a no-op', () => {
  for (const [event, key] of [['dock', 'firstDock'], ['profit', 'firstTrade'], ['rank', 'firstRank']]) {
    const once = applyEvent(freshFlags(), event);
    const twice = applyEvent(once.flags, event);
    assert.equal(twice.changed, false, `${event} should not fire twice`);
    assert.equal(twice.beat, null);
    assert.equal(twice.flags[key], true);
  }
});

test('a returning captain (all flags done) gets no beats from any event', () => {
  for (const event of ['dock', 'profit', 'rank']) {
    const r = applyEvent(completedFlags(), event);
    assert.equal(r.changed, false);
    assert.equal(r.beat, null);
  }
});

test('applyEvent never mutates its input and ignores unknown events', () => {
  const flags = freshFlags();
  const snapshot = { ...flags };
  const r = applyEvent(flags, 'kraken-attack');
  assert.deepEqual(flags, snapshot, 'input untouched');
  assert.equal(r.changed, false);
  assert.equal(r.beat, null);
});

// ---- Step ordering ---------------------------------------------------------

test('currentStep walks goal → firstDock → firstTrade → firstRank → done', () => {
  let f = freshFlags();
  assert.equal(currentStep(f), 'goal');
  f = applyEvent(f, 'dock').flags;     // dock sets firstDock + goal
  assert.equal(currentStep(f), 'firstTrade');
  f = applyEvent(f, 'profit').flags;
  assert.equal(currentStep(f), 'firstRank');
  f = applyEvent(f, 'rank').flags;
  assert.equal(currentStep(f), 'done');
});

test('goal/beat copy is present and non-empty (no blank cards)', () => {
  assert.ok(GOAL.title && GOAL.line);
  for (const k of ['firstDock', 'firstTrade', 'firstRank']) {
    assert.ok(BEATS[k].title && BEATS[k].line, `${k} copy`);
  }
});
