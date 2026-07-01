import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  debutPending, softenDebutFoe, debutPhase, debutCue, DEBUT_PHASES,
  DEBUT_GUNNERY_MULT, DEBUT_HULL_FRAC,
} from '../../src/systems/debut-battle.js';
import { MAX_HULL, MORALE_MAX } from '../../src/cannons.js';

// ---- debutPending: the one-shot gate -------------------------------------------------------------

test('debutPending: a captain who has NOT spent the debut still gets it', () => {
  assert.equal(debutPending(false), true);
  assert.equal(debutPending(undefined), true, 'an absent/unknown flag reads as still-to-come');
});

test('debutPending: once the debut flag is set, it never fires again', () => {
  assert.equal(debutPending(true), false);
});

// ---- softenDebutFoe: the forgiving FIRST foe -----------------------------------------------------

test('softenDebutFoe: softens the foe when the debut is pending (winnable + legible)', () => {
  const foe = { name: 'Black Sal', hull: MAX_HULL, maxHull: MAX_HULL, gunnery: 1.0 };
  const soft = softenDebutFoe(foe, true);
  assert.ok(soft.gunnery < foe.gunnery, 'her guns sting far less — a forgiving fight');
  assert.equal(soft.gunnery, foe.gunnery * DEBUT_GUNNERY_MULT);
  assert.ok(soft.hull < foe.maxHull, 'she squares up already softened, so the boarding window is near');
  assert.equal(soft.hull, Math.round(MAX_HULL * DEBUT_HULL_FRAC));
  assert.equal(soft.debut, true, 'the softened foe is flagged as the scaffolded debut');
});

test('softenDebutFoe: leaves her nerve intact (no early strike-colours) — the taught arc stays maneuver→board→duel', () => {
  const foe = { name: 'Sal', hull: MAX_HULL, maxHull: MAX_HULL, gunnery: 1.0 };
  const soft = softenDebutFoe(foe, true);
  // morale is deliberately NOT thinned: a debut foe fights the arc, she doesn't fold on the first volley.
  assert.equal(soft.morale, undefined, 'the debut does not pre-thin morale');
});

test('softenDebutFoe: a NON-debut engagement passes the foe straight through, unchanged', () => {
  const foe = { name: 'Sal', hull: MAX_HULL, maxHull: MAX_HULL, gunnery: 1.1 };
  assert.equal(softenDebutFoe(foe, false), foe, 'a veteran fight gets a full-strength foe');
});

test('softenDebutFoe: never mutates the input foe', () => {
  const foe = { name: 'Sal', hull: MAX_HULL, maxHull: MAX_HULL, gunnery: 1.0 };
  softenDebutFoe(foe, true);
  assert.equal(foe.gunnery, 1.0, 'input untouched');
  assert.equal(foe.hull, MAX_HULL, 'input untouched');
});

test('softenDebutFoe: tolerates a junk/missing foe without throwing', () => {
  assert.equal(softenDebutFoe(null, true), null);
  assert.equal(softenDebutFoe(undefined, true), undefined);
});

// ---- debutPhase: which verb the bosun calls next -------------------------------------------------

test('debutPhase: no live battle → no phase', () => {
  assert.equal(debutPhase(null), null);
  assert.equal(debutPhase({ active: false }), null);
});

test('debutPhase: a live maneuver reads as the FIRE-teaching phase', () => {
  assert.equal(debutPhase({ active: true, canBoard: false, surrenderPending: false }), 'maneuver');
});

test('debutPhase: once she is beaten to the boarding window, the phase is BOARD', () => {
  assert.equal(debutPhase({ active: true, canBoard: true, surrenderPending: false }), 'board');
});

test('debutPhase: a struck white flag takes priority — the SURRENDER decision is taught first', () => {
  assert.equal(debutPhase({ active: true, canBoard: true, surrenderPending: true }), 'surrender');
});

// ---- debutCue: the bosun's scripted call ---------------------------------------------------------

test('debutCue: every phase has a bosun line that names its verb', () => {
  for (const phase of DEBUT_PHASES) {
    const cue = debutCue(phase);
    assert.ok(cue && typeof cue.line === 'string' && cue.line.length > 0, `${phase} has a line`);
    assert.ok(typeof cue.verb === 'string' && cue.verb.length > 0, `${phase} names a verb`);
  }
});

test('debutCue: the maneuver call names the FIRE verb', () => {
  assert.equal(debutCue('maneuver').verb, 'fire');
});

test('debutCue: the board call names the BOARD verb', () => {
  assert.equal(debutCue('board').verb, 'board');
});

test('debutCue: an unknown phase yields no cue (fail-open)', () => {
  assert.equal(debutCue('nonsense'), null);
  assert.equal(debutCue(null), null);
});
