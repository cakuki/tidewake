// Reactive-loop diegetic cues (#116) — the PURE cue vocabulary + the pure decisions about WHICH
// cue a reactive-loop beat plays. Browser-free, deterministic: same loop event → same cue, so a
// headless playtest can listen/approach/claim and assert the right cue fired without an AudioContext.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectCue, payoffCueName, approachCrossed, APPROACH_RADIUS, LOOP_CUE_NAMES,
  LISTEN_CUE_NAMES, listenCueName, coinChimes,
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

// ---- per-rumour-kind LISTEN colour + coin chime (#116 follow-up) -----------------------

test('LISTEN_CUE_NAMES: the four listen colours, rep/trade/sea/deed order (#116)', () => {
  assert.deepEqual(LISTEN_CUE_NAMES, ['listen', 'listenTrade', 'listenSea', 'listenDeed']);
});

test('listenCueName: each rumour kind picks its own listen colour; junk fails open to base (#116)', () => {
  assert.equal(listenCueName('rep'), 'listen');
  assert.equal(listenCueName('trade'), 'listenTrade');
  assert.equal(listenCueName('sea'), 'listenSea');
  assert.equal(listenCueName('deed'), 'listenDeed');
  assert.equal(listenCueName('nonsense'), 'listen'); // unknown kind → base cup-an-ear
  assert.equal(listenCueName(undefined), 'listen');  // no kind (first-listen edge) → base
  assert.equal(listenCueName(null), 'listen');
  assert.equal(listenCueName(42), 'listen');         // junk type → fail open, never throws
});

test('every listen colour + the coin chime resolves to a renderable in-key recipe (#116)', () => {
  for (const name of [...LISTEN_CUE_NAMES, 'coin']) {
    const cue = selectCue(name);
    assert.ok(cue, `${name} should resolve`);
    assert.equal(cue.name, name);
    assert.ok(Array.isArray(cue.degs), `${name} is diatonic (in-key degrees)`); // all soft + in-key
    assert.equal(typeof cue.type, 'string');
    assert.ok(cue.gain > 0 && cue.gain <= 0.1, `${name} stays UNDER the loop beats (soft, nods not shouts)`);
    assert.ok(cue.dur > 0 && cue.tail > 0, `${name} has an envelope`);
  }
});

test('the coin chime sits brighter/higher than the payoff flourish it rides under (#116)', () => {
  const coin = selectCue('coin');
  const payoff = selectCue('payoff');
  assert.ok(coin.octave > payoff.octave, 'coin tinkles above the payoff crown');
  assert.ok(coin.gain < payoff.gain, 'coin rides UNDER the payoff in level');
});

test('coinChimes: only an honest win that actually paid coin rings the chime (#116)', () => {
  assert.equal(coinChimes({ claimed: false, coins: 120 }), true);  // honest win, paid coin → chime
  assert.equal(coinChimes({ claimed: false, coins: 0 }), false);   // win but zero coin → no chime
  assert.equal(coinChimes({ claimed: true, coins: 0 }), false);    // rival claimed it → no chime
  assert.equal(coinChimes({ claimed: true, coins: 99 }), false);   // claimed (defensive) → no chime
  assert.equal(coinChimes({}), false);                             // no data → no chime
  assert.equal(coinChimes(), false);                               // no outcome → no chime
  assert.equal(coinChimes(null), false);                           // junk → fail safe, never throws
});
