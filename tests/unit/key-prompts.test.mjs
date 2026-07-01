// Unit: the contextual just-in-time key-prompts' PURE logic (#153, R2 deep-reading flagship; #53
// component standard). No browser — `activePrompts` is a plain function of the battle + duel snapshots
// plus a "learned" set, and `learnFromTransition` derives what the player has USED from two successive
// snapshots. Read-only: it invents no mechanics, only reads flags already on the snapshots, and it
// teaches each battle verb at the moment it becomes possible, then falls silent once it's been used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { activePrompts, learnFromTransition, signifiedVerbs } from '../../src/ui/key-prompts.js';
import { KEYS } from '../../src/keymap.js';

const ids = (ps) => ps.map((p) => p.id);

// The cold-start FTUE (#156) canonical states: for each keymap verb, the moment it FIRST becomes legal
// to a fresh captain. Kept beside the model so the coverage lock below stays honest as the keymap grows.
const FTUE_STATES = {
  engage: [{ active: false }, { active: false, inRange: true }],                 // hailable ship at sea
  flee:   [{ active: true, loaded: true, loadout: ['round'] }, { active: false }], // any live fight
  fire:   [{ active: true, loaded: true, loadout: ['round'] }, { active: false }],
  cycle:  [{ active: true, loaded: true, loadout: ['round', 'chain'] }, { active: false }],
  board:  [{ active: true, canBoard: true, loadout: ['round'] }, { active: false }],
  accept: [{ active: true, surrenderPending: true }, { active: false }],
  press:  [{ active: true, surrenderPending: true }, { active: false }],
};

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

// ---- Cold-start FTUE discoverability model (#156) --------------------------------------------------

test('signifiedVerbs: at sea, nothing in range → nothing signified', () => {
  assert.deepEqual([...signifiedVerbs(null, null)], []);
  assert.deepEqual([...signifiedVerbs({ active: false, inRange: false }, { active: false })], []);
});

test('signifiedVerbs: a hailable ship signifies the at-sea entry verb E (give battle)', () => {
  assert.ok(signifiedVerbs({ active: false }, { active: false, inRange: true }).has('engage'));
});

test('signifiedVerbs: a live fight always signifies E (break off) plus the maneuver arc', () => {
  const s = signifiedVerbs({ active: true, loaded: true, loadout: ['round', 'chain'] }, {});
  assert.ok(s.has('flee'), 'break off must be taught while a fight is live');
  assert.ok(s.has('fire') && s.has('cycle'), 'the maneuver broadside arc must be taught');
  assert.ok(!s.has('engage'), 'the at-sea entry verb is not signified mid-fight');
});

test('signifiedVerbs: each keymap verb IS signified the instant it becomes legal (#156)', () => {
  for (const [verb, [state, duel]] of Object.entries(FTUE_STATES)) {
    assert.ok(signifiedVerbs(state, duel).has(verb),
      `keymap verb "${verb}" (${KEYS[verb].glyph} ${KEYS[verb].verb}) is un-signified when legal`);
  }
});

test('signifiedVerbs: EVERY keymap verb is covered by the FTUE model — a new un-taught verb fails (#156)', () => {
  // The auto-coverage lock, written against the keymap source-of-truth: the union of what the model
  // signifies across the cold-start states must equal EXACTLY the keymap. Add a verb to src/keymap.js
  // without a teacher (and an FTUE state) and this goes red — a reachable verb can never silently ship
  // un-signified again (the #135 defect #153 fixed). This IS the discoverability deliverable.
  const union = new Set();
  for (const [state, duel] of Object.values(FTUE_STATES)) for (const id of signifiedVerbs(state, duel)) union.add(id);
  assert.deepEqual([...union].sort(), Object.keys(KEYS).sort(),
    'the FTUE model does not signify exactly the keymap — a verb is un-taught or the state battery is stale');
});

test('signifiedVerbs: a boarded verbal duel signifies no keymap verb (its 1–4 jabs own the moment)', () => {
  assert.deepEqual([...signifiedVerbs({ active: true, canBoard: true }, { active: true, boarded: true })], []);
});
