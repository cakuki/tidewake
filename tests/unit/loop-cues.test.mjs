// Reactive-loop diegetic cues (#116) — the PURE cue vocabulary + the pure decisions about WHICH
// cue a reactive-loop beat plays. Browser-free, deterministic: same loop event → same cue, so a
// headless playtest can listen/approach/claim and assert the right cue fired without an AudioContext.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectCue, payoffCueName, approachCrossed, APPROACH_RADIUS, LOOP_CUE_NAMES,
} from '../../src/systems/loop-cues.js';

test('LOOP_CUE_NAMES: the four loop-beat cues, in loop order (#116)', () => {
  assert.deepEqual(LOOP_CUE_NAMES, ['listen', 'approach', 'payoff', 'loss']);
});

test('selectCue: resolves each known cue to a renderable recipe with its name folded in (#116)', () => {
  for (const name of LOOP_CUE_NAMES) {
    const cue = selectCue(name);
    assert.ok(cue, `${name} should resolve`);
    assert.equal(cue.name, name);
    // A renderable recipe carries either diatonic degrees OR raw chromatic semitones, never neither.
    const hasNotes = Array.isArray(cue.degs) || Array.isArray(cue.semis);
    assert.ok(hasNotes, `${name} carries note data`);
    assert.equal(typeof cue.type, 'string');             // an oscillator type to render
    assert.ok(cue.gain > 0 && cue.gain <= 0.3, `${name} gain modest (rides over the bed)`);
    assert.ok(cue.dur > 0 && cue.tail > 0, `${name} has an envelope`);
  }
});

test('selectCue: junk / unknown names fail open to null, never throw (#116)', () => {
  assert.equal(selectCue('nope'), null);
  assert.equal(selectCue(''), null);
  assert.equal(selectCue(null), null);
  assert.equal(selectCue(undefined), null);
  assert.equal(selectCue(42), null);
  assert.equal(selectCue({}), null);
});

test('selectCue: returns a COPY — a caller can never mutate the shared recipe (#116)', () => {
  const a = selectCue('payoff');
  a.gain = 999;
  if (Array.isArray(a.degs)) a.degs.push(99);
  const b = selectCue('payoff');
  assert.notEqual(b.gain, 999);
});

test('payoffCueName: a claimed prize sours to LOSS, an honest win lands PAYOFF (#116/#133)', () => {
  assert.equal(payoffCueName({ claimed: true }), 'loss');
  assert.equal(payoffCueName({ claimed: false }), 'payoff');
  assert.equal(payoffCueName({}), 'payoff');        // uncontested → bright payoff
  assert.equal(payoffCueName(), 'payoff');          // no outcome → bright payoff
  assert.equal(payoffCueName(null), 'payoff');      // junk → fail open to payoff, never throws
});

test('payoff and loss are opposite in colour so the ear knows win vs wake (#116)', () => {
  const payoff = selectCue('payoff');
  const loss = selectCue('loss');
  assert.ok(Array.isArray(payoff.degs), 'payoff is diatonic-bright (in-key degrees)');
  assert.ok(Array.isArray(loss.semis), 'loss steps OUT of the key (raw chromatic semitones)');
});

test('approachCrossed: an EDGE trigger — fires only the frame you cross inward (#116)', () => {
  const r = APPROACH_RADIUS;
  assert.equal(approachCrossed(r + 10, r - 1, r), true);   // crossed inward this frame → ring once
  assert.equal(approachCrossed(r - 1, r - 5, r), false);   // already inside, drawing nearer → silent
  assert.equal(approachCrossed(r + 20, r + 10, r), false); // still outside → silent
  assert.equal(approachCrossed(r - 5, r + 5, r), false);   // leaving (outward) → silent
  assert.equal(approachCrossed(r, r, r), false);           // sitting exactly on it → no inward edge
});

test('approachCrossed: non-finite distances are safe → false, never throws (#116)', () => {
  assert.equal(approachCrossed(NaN, 10), false);           // fresh chase, no prev distance yet
  assert.equal(approachCrossed(Infinity, 10), false);
  assert.equal(approachCrossed(300, NaN), false);
  assert.equal(approachCrossed(undefined, 10), false);
});

test('APPROACH_RADIUS sits inside the port music horizon but outside the dock radius (#116)', () => {
  // The nod must land while closing on the pin — after the port bed blooms (260), before docking (90).
  assert.ok(APPROACH_RADIUS < 260 && APPROACH_RADIUS > 90);
});
