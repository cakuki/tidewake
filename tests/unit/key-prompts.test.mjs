// Unit: the contextual just-in-time key-prompts' PURE logic (#153, R2 deep-reading flagship; #53
// component standard). No browser — `activePrompts` is a plain function of the battle + duel snapshots
// plus a "learned" set, and `learnFromTransition` derives what the player has USED from two successive
// snapshots. Read-only: it invents no mechanics, only reads flags already on the snapshots, and it
// teaches each battle verb at the moment it becomes possible, then falls silent once it's been used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { activePrompts, learnFromTransition } from '../../src/ui/key-prompts.js';
import { KEYS } from '../../src/keymap.js';

const ids = (ps) => ps.map((p) => p.id);

test('no battle → no prompts (at sea, nothing engaged)', () => {
  assert.deepEqual(activePrompts(null, null), []);
  assert.deepEqual(activePrompts({ active: false, inRange: false }, { active: false }), []);
});

test('a foe in range but not yet engaged is taught by the standing challenge-prompt, not here', () => {
  // The at-sea entry verb (E) is owned by the persistent #challenge-prompt; this component only
  // teaches the IN-BATTLE arc, so it stays silent until the stance is actually active.
  assert.deepEqual(activePrompts({ active: false, inRange: true }, { active: false }), []);
});

test('maneuver phase teaches FIRE (single fitted shot → no cycle hint)', () => {
  const ps = activePrompts({ active: true, loaded: true, loadout: ['round'] }, { active: false });
  assert.deepEqual(ids(ps), ['fire']);
  assert.equal(ps[0].glyph, KEYS.fire.glyph);
  assert.equal(ps[0].verb, KEYS.fire.verb);
});

test('maneuver phase with a 2+ shot locker also teaches CHANGE SHOT', () => {
  const ps = activePrompts({ active: true, loaded: true, loadout: ['round', 'chain'] }, {});
  assert.deepEqual(ids(ps), ['fire', 'cycle']);
});

test('a beaten foe (canBoard) teaches BOARD only', () => {
  const ps = activePrompts({ active: true, canBoard: true, loadout: ['round', 'chain'] }, {});
  assert.deepEqual(ids(ps), ['board']);
  assert.equal(ps[0].glyph, KEYS.board.glyph);
});

test('a struck foe (surrenderPending) teaches ACCEPT and PRESS, ahead of everything else', () => {
  const ps = activePrompts({ active: true, surrenderPending: true, canBoard: true, loaded: true, loadout: ['round', 'chain'] }, {});
  assert.deepEqual(ids(ps), ['accept', 'press']);
  assert.equal(ps[0].glyph, KEYS.accept.glyph);
  assert.equal(ps[1].glyph, KEYS.press.glyph);
});

test('a boarded verbal duel shows no battle prompts (the duel panel owns its own 1–4 jabs)', () => {
  assert.deepEqual(activePrompts({ active: false }, { active: true, boarded: true }), []);
  // even if a stale battle flag lingers, the boarded duel wins
  assert.deepEqual(activePrompts({ active: true, canBoard: true }, { active: true, boarded: true }), []);
});

test('a learned verb falls silent (veterans are not nagged)', () => {
  const learned = new Set(['fire']);
  const ps = activePrompts({ active: true, loaded: true, loadout: ['round', 'chain'] }, {}, learned);
  assert.deepEqual(ids(ps), ['cycle']); // fire already learned → only the un-learned cycle remains
});

test('learnFromTransition: a spent load (loaded true→false) marks FIRE learned', () => {
  const prev = { active: true, loaded: true, round: 0 };
  const cur = { active: true, loaded: false, round: 1 };
  assert.ok(learnFromTransition(prev, cur, new Set()).has('fire'));
});

test('learnFromTransition: a changed loaded shot marks CYCLE learned', () => {
  const prev = { active: true, ammo: 'round' };
  const cur = { active: true, ammo: 'chain' };
  assert.ok(learnFromTransition(prev, cur, new Set()).has('cycle'));
});

test('learnFromTransition: going boarded marks BOARD learned', () => {
  const prev = { active: true, boarded: false };
  const cur = { active: true, boarded: true };
  assert.ok(learnFromTransition(prev, cur, new Set()).has('board'));
});

test('learnFromTransition: answering a surrender (pending true→false) marks ACCEPT + PRESS learned', () => {
  const prev = { active: true, surrenderPending: true };
  const cur = { active: true, surrenderPending: false };
  const next = learnFromTransition(prev, cur, new Set());
  assert.ok(next.has('accept') && next.has('press'));
});

test('learnFromTransition is pure — it returns a new set and never mutates the input', () => {
  const learned = new Set(['board']);
  const next = learnFromTransition({ loaded: true, active: true }, { loaded: false, active: true }, learned);
  assert.notEqual(next, learned);
  assert.deepEqual([...learned], ['board']); // input untouched
  assert.ok(next.has('board') && next.has('fire'));
});

test('learnFromTransition tolerates null/first-frame prev without throwing', () => {
  assert.doesNotThrow(() => learnFromTransition(null, { active: true, loaded: true }, new Set()));
});
