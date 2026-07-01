// Reactive-loop diegetic cues (#116) — the PURE cue vocabulary + the pure decisions about WHICH
// cue a reactive-loop beat plays. Browser-free, deterministic: same loop event → same cue, so a
// headless playtest can listen/approach/claim and assert the right cue fired without an AudioContext.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectCue, payoffCueName, approachCrossed, APPROACH_RADIUS, LOOP_CUE_NAMES,
  LISTEN_CUE_NAMES, listenCueName, coinChimes,
  sightingEdge, RIVAL_SIGHT_RADIUS, RIVAL_REARM_FACTOR, RIVAL_SAIL_CUE,
  battleEarcon, BATTLE_EARCON_NAMES,
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

// ---- RIVAL-SAIL-SIGHTED sting (#116 follow-up) ----------------------------------------

test('RIVAL_SAIL_CUE resolves to a renderable recipe; it is NOT a loop-beat name (#116 f/u)', () => {
  assert.equal(RIVAL_SAIL_CUE, 'rivalSail');
  assert.ok(!LOOP_CUE_NAMES.includes(RIVAL_SAIL_CUE), 'the sting is an encounter cue, not a loop beat');
  const cue = selectCue(RIVAL_SAIL_CUE);
  assert.ok(cue, 'rivalSail resolves');
  assert.equal(cue.name, 'rivalSail');
  assert.equal(typeof cue.type, 'string');
  assert.ok(cue.dur > 0 && cue.tail > 0, 'has an envelope');
  assert.ok(cue.gain > 0 && cue.gain <= 0.3, 'modest — it primes, never jump-scares');
});

test('the rival sting is DARK + LOW + chromatic — the ear reads THREAT (#116 f/u)', () => {
  const rival = selectCue('rivalSail');
  // Steps OUT of the bright major (raw chromatic semitones), like the sour LOSS stab — not in-key.
  assert.ok(Array.isArray(rival.semis), 'rivalSail is chromatic (raw semitones), out of the bright key');
  assert.ok(rival.octave < 0, 'pitched DOWN — a low, brooding horn on the horizon');
  assert.ok(Number.isFinite(rival.lowpass) && rival.lowpass < 1200, 'lowpassed dark — muffled, ominous');
  // A rising tritone (root → #4) — the brooding "devil's interval" creeping up from below.
  assert.deepEqual(rival.semis, [0, 6], 'a rising tritone — menace climbing the horizon');
  // Distinct from the LOSS droop (a FALLING tritone, 6 → 5): the sting RISES, the loss FALLS.
  const loss = selectCue('loss');
  assert.ok(rival.semis[1] > rival.semis[0], 'rival sting RISES');
  assert.ok(loss.semis[1] < loss.semis[0], 'loss droop FALLS — opposite contour');
});

test('sightingEdge: a hostile crossing the horizon stings ONCE, then disarms (#116 f/u)', () => {
  const r = RIVAL_SIGHT_RADIUS;
  // Armed + a sail crosses inside the horizon → sting once, latch disarms.
  const hit = sightingEdge(true, r - 1, r);
  assert.deepEqual(hit, { armed: false, fire: true });
  // Now disarmed, the sail loitering inside the horizon → silent (no spam).
  assert.deepEqual(sightingEdge(false, r - 50, r), { armed: false, fire: false });
  assert.deepEqual(sightingEdge(false, r - 1, r), { armed: false, fire: false });
});

test('sightingEdge: armed but the nearest hostile still beyond the horizon → silent (#116 f/u)', () => {
  const r = RIVAL_SIGHT_RADIUS;
  assert.deepEqual(sightingEdge(true, r + 20, r), { armed: true, fire: false });
  assert.deepEqual(sightingEdge(true, r + 0.5, r), { armed: true, fire: false }); // a hair outside → still silent
  // At/inside the horizon counts as crossed (the `<=` edge, matching approachCrossed) → sting.
  assert.deepEqual(sightingEdge(true, r, r), { armed: false, fire: true });
});

test('sightingEdge: re-arms only after the sail draws back off past the hysteresis band (#116 f/u)', () => {
  const r = RIVAL_SIGHT_RADIUS;
  const off = r * RIVAL_REARM_FACTOR;
  // Disarmed + still within the re-arm band (between r and off) → stays disarmed (no jitter re-fire).
  assert.deepEqual(sightingEdge(false, r + 5, r), { armed: false, fire: false });
  assert.deepEqual(sightingEdge(false, off, r), { armed: false, fire: false }); // exactly at the band edge
  // Drawn off past the band → re-armed (ready for the next sighting), silent on the way out.
  assert.deepEqual(sightingEdge(false, off + 1, r), { armed: true, fire: false });
});

test('sightingEdge: no hostile in the world (non-finite dist) → quietly re-armed (#116 f/u)', () => {
  assert.deepEqual(sightingEdge(false, Infinity), { armed: true, fire: false });
  assert.deepEqual(sightingEdge(true, Infinity), { armed: true, fire: false });
  assert.deepEqual(sightingEdge(false, NaN), { armed: true, fire: false });
  assert.deepEqual(sightingEdge(true, undefined), { armed: true, fire: false });
});

test('sightingEdge: a full sighting cycle — arm, sting once, hold, draw off, re-arm, sting again (#116 f/u)', () => {
  const r = RIVAL_SIGHT_RADIUS;
  let armed = false;                                  // start disarmed (no false sting at session load)
  const log = [];
  for (const d of [Infinity, r + 100, r - 10, r - 5, r * 2, r - 10]) {
    const next = sightingEdge(armed, d, r);
    armed = next.armed;
    log.push(next.fire);
  }
  // Infinity→arm(no fire), beyond→hold, cross in→FIRE, loiter→silent, draw off→re-arm, cross in→FIRE.
  assert.deepEqual(log, [false, false, true, false, false, true]);
});

test('RIVAL_SIGHT_RADIUS spots a rival FAR off — outside the approach + port horizons (#116 f/u)', () => {
  // A rival is sighted on the HORIZON, well before any encounter — beyond the "drawing near" pin nod
  // (200) and the port-music bloom (260), so the sting primes long before a hail/cannon/battle.
  assert.ok(RIVAL_SIGHT_RADIUS > APPROACH_RADIUS, 'sighted farther out than the chased-pin nod');
  assert.ok(RIVAL_SIGHT_RADIUS > 260, 'sighted beyond the port-music horizon');
  assert.ok(RIVAL_REARM_FACTOR > 1, 'the re-arm band sits OUTSIDE the sighting radius (true hysteresis)');
});

// --- Battle-verb availability EARCONS (#154) — the audio half of #153's contextual key-prompts ---

test('BATTLE_EARCON_NAMES: the three verb-window earcons (#154)', () => {
  assert.deepEqual(BATTLE_EARCON_NAMES, ['fireReady', 'boardable', 'surrenderOffer']);
});

test('selectCue: each battle earcon resolves to a renderable, modest recipe (#154)', () => {
  for (const name of BATTLE_EARCON_NAMES) {
    const cue = selectCue(name);
    assert.ok(cue, `${name} should resolve through the shared vocabulary`);
    assert.equal(cue.name, name);
    assert.ok(Array.isArray(cue.degs) || Array.isArray(cue.semis), `${name} carries note data`);
    assert.equal(typeof cue.type, 'string');
    assert.ok(cue.gain > 0 && cue.gain <= 0.3, `${name} gain is subtle (rides over the bed)`);
    assert.ok(cue.dur > 0 && cue.tail > 0, `${name} is a SHORT gesture with a tail`);
  }
});

test('battleEarcon: a phase opening rings its earcon ONCE on the illegal→legal edge (#154)', () => {
  assert.equal(battleEarcon(null, 'fire'), 'fireReady');       // guns bear
  assert.equal(battleEarcon('fire', 'board'), 'boardable');    // she's beaten to the boarding window
  assert.equal(battleEarcon('fire', 'surrender'), 'surrenderOffer'); // colours struck mid-maneuver
  assert.equal(battleEarcon('board', 'surrender'), 'surrenderOffer');
});

test('battleEarcon: a HELD phase stays silent — no re-nag while the window is open (#154)', () => {
  assert.equal(battleEarcon('fire', 'fire'), null);
  assert.equal(battleEarcon('board', 'board'), null);
  assert.equal(battleEarcon('surrender', 'surrender'), null);
});

test('battleEarcon: a phase CLEARING (verb used / window shut) is silent (#154)', () => {
  assert.equal(battleEarcon('fire', null), null);       // fire learned → prompt fades → no earcon
  assert.equal(battleEarcon('surrender', null), null);  // offer answered → silent
  assert.equal(battleEarcon(null, null), null);         // at sea, nothing armed
});

test('battleEarcon: an unknown / junk phase fails open to null, never throws (#154)', () => {
  assert.equal(battleEarcon(null, 'nonsense'), null);
  assert.equal(battleEarcon('fire', ''), null);
  assert.equal(battleEarcon('fire', undefined), null);
  assert.equal(battleEarcon(undefined, 'fire'), 'fireReady'); // a fresh session (no prev) still rings
});
