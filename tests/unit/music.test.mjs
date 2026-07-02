import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp01,
  beatDuration,
  midiToFreq,
  noteNameToMidi,
  scaleDegreeToMidi,
  degreeToFreq,
  speedToIntensity,
  wakeBedGain,
  WAKE_FLOOR,
  melodyPattern,
  bassPattern,
  MAJOR_SCALE,
  BARS,
  BEATS_PER_BAR,
  LOOP_BEATS,
  STEPS_PER_BAR,
  isDownbeat,
  createMusic,
} from '../../src/music.js';
import { townMusicIdentity, townDockedCue } from '../../src/town-theme.js';

test('isDownbeat: true only on a bar boundary (the landfall stinger bar-clock, #102 ph2)', () => {
  assert.equal(STEPS_PER_BAR, BEATS_PER_BAR * 2, 'eighth-note grid → 8 steps per bar');
  assert.equal(isDownbeat(0), true);              // bar 1, beat 1
  assert.equal(isDownbeat(STEPS_PER_BAR), true);  // next bar's downbeat
  assert.equal(isDownbeat(2 * STEPS_PER_BAR), true);
  for (let s = 1; s < STEPS_PER_BAR; s++) assert.equal(isDownbeat(s), false, `step ${s} is mid-bar`);
  // tolerant of out-of-range / negative steps (never throws, wraps cleanly)
  assert.equal(isDownbeat(-STEPS_PER_BAR), true);
  assert.equal(isDownbeat(-1), false);
});

test('clamp01: clamps to [0,1]', () => {
  assert.equal(clamp01(-2), 0);
  assert.equal(clamp01(0.3), 0.3);
  assert.equal(clamp01(7), 1);
});

test('beatDuration: seconds-per-beat from tempo', () => {
  assert.ok(Math.abs(beatDuration(120) - 0.5) < 1e-12, '120bpm -> 0.5s');
  assert.ok(Math.abs(beatDuration(60) - 1) < 1e-12, '60bpm -> 1s');
  assert.ok(Math.abs(beatDuration(90) - (2 / 3)) < 1e-12, '90bpm -> 0.666..s');
  assert.equal(beatDuration(0), 0, 'no divide-by-zero / Infinity');
  assert.equal(beatDuration(-10), 0, 'negative tempo guarded');
});

test('midiToFreq: A4 is 440 and octaves double', () => {
  assert.ok(Math.abs(midiToFreq(69) - 440) < 1e-9, 'A4 == 440');
  assert.ok(Math.abs(midiToFreq(81) - 880) < 1e-9, 'A5 == 880 (octave up)');
  assert.ok(Math.abs(midiToFreq(57) - 220) < 1e-9, 'A3 == 220 (octave down)');
});

test('noteNameToMidi: parses naturals, sharps and octaves', () => {
  assert.equal(noteNameToMidi('A4'), 69);
  assert.equal(noteNameToMidi('C4'), 60);
  assert.equal(noteNameToMidi('D4'), 62);
  assert.equal(noteNameToMidi('F#4'), 66);
  assert.equal(noteNameToMidi('C5'), 72, 'one octave up adds 12');
});

test('MAJOR_SCALE: the seven diatonic semitone offsets', () => {
  assert.deepEqual(MAJOR_SCALE, [0, 2, 4, 5, 7, 9, 11]);
});

test('scaleDegreeToMidi: 1-based degree, octave wrapping', () => {
  const root = 62; // D4
  assert.equal(scaleDegreeToMidi(1, root), 62, 'degree 1 == root');
  assert.equal(scaleDegreeToMidi(3, root), 66, 'degree 3 == major third (+4)');
  assert.equal(scaleDegreeToMidi(5, root), 69, 'degree 5 == fifth (+7)');
  assert.equal(scaleDegreeToMidi(8, root), 74, 'degree 8 == octave (+12)');
  assert.equal(scaleDegreeToMidi(10, root), 78, 'degree 10 == ninth+octave');
  assert.equal(scaleDegreeToMidi(15, root), 86, 'degree 15 == two octaves (+24)');
});

test('degreeToFreq: degree -> frequency via the scale', () => {
  assert.ok(Math.abs(degreeToFreq(1, 69) - 440) < 1e-9, 'root A4 -> 440');
  assert.ok(Math.abs(degreeToFreq(8, 69) - 880) < 1e-9, 'octave -> 880');
});

test('speedToIntensity: in [0,1], monotonic non-decreasing, bounded', () => {
  const MAX = 55;
  assert.ok(Math.abs(speedToIntensity(0, MAX) - 0) < 1e-12, 'rest -> 0');
  assert.ok(Math.abs(speedToIntensity(MAX, MAX) - 1) < 1e-12, 'full -> 1');
  assert.equal(speedToIntensity(999, MAX), 1, 'clamps above max');
  assert.equal(speedToIntensity(10, 0), 0, 'maxSpeed 0 -> 0, no NaN');
  let prev = -1;
  for (let s = 0; s <= MAX; s += 5) {
    const v = speedToIntensity(s, MAX);
    assert.ok(v >= prev, `not monotonic at ${s}`);
    assert.ok(v >= 0 && v <= 1, `out of range at ${s}: ${v}`);
    prev = v;
  }
});

test('wakeBedGain: becalmed floor, concave rise, saturates at speed (#150 wake/helm water-bed)', () => {
  const MAX = 55;
  // Becalmed with the helm amidships → just the gentle lapping floor (never silent, never loud).
  assert.ok(Math.abs(wakeBedGain(0, MAX, 0) - WAKE_FLOOR) < 1e-12, 'becalmed -> floor');
  assert.ok(WAKE_FLOOR > 0 && WAKE_FLOOR < 0.2, 'floor is a soft lap, audible but quiet');
  // Full sail with no helm → the layer reaches full (1.0): sailing sounds like fast water.
  assert.ok(Math.abs(wakeBedGain(MAX, MAX, 0) - 1) < 1e-12, 'full sail -> 1');
  assert.equal(wakeBedGain(999, MAX, 0), 1, 'clamps above max');
  // Monotonic non-decreasing in speed, always in [0,1].
  let prev = -1;
  for (let s = 0; s <= MAX; s += 5) {
    const v = wakeBedGain(s, MAX, 0);
    assert.ok(v >= prev, `not monotonic at ${s}`);
    assert.ok(v >= 0 && v <= 1, `out of range at ${s}: ${v}`);
    prev = v;
  }
  // Concave (fills early, plateaus): half speed already past the midpoint of the rise.
  const half = wakeBedGain(MAX / 2, MAX, 0);
  assert.ok(half > (WAKE_FLOOR + 1) / 2, 'concave: half-speed wash is already past halfway');
  // The helm CHURNS extra wash — but only while making way (a turn at rest barely laps).
  assert.ok(wakeBedGain(MAX * 0.6, MAX, 1) > wakeBedGain(MAX * 0.6, MAX, 0), 'hard turn at speed adds wash');
  assert.ok(Math.abs(wakeBedGain(0, MAX, 1) - wakeBedGain(0, MAX, 0)) < 1e-9, 'turning becalmed adds ~no wash');
  // Robust: bad/zero maxSpeed, junk helm, negative inputs never NaN/throw, stay in range.
  assert.equal(wakeBedGain(10, 0, 0), WAKE_FLOOR, 'maxSpeed 0 -> floor, no NaN');
  for (const [sp, mx, hl] of [[NaN, MAX, 0], [-5, MAX, 0], [20, MAX, NaN], [20, MAX, 9], [20, MAX, -3]]) {
    const v = wakeBedGain(sp, mx, hl);
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `junk (${sp},${mx},${hl}) -> finite [0,1], got ${v}`);
  }
});

test('melodyPattern: well-formed events that fill the loop exactly', () => {
  const mel = melodyPattern();
  assert.ok(Array.isArray(mel) && mel.length > 0, 'non-empty array');
  let total = 0;
  for (const n of mel) {
    assert.equal(typeof n.deg, 'number', 'deg is a number');
    assert.ok(Number.isFinite(n.deg), 'deg finite');
    assert.ok(n.beats > 0, 'positive duration');
    total += n.beats;
  }
  assert.ok(Math.abs(total - LOOP_BEATS) < 1e-9, `melody spans the full ${LOOP_BEATS}-beat loop`);
});

test('bassPattern: one chord root per bar', () => {
  const bass = bassPattern();
  assert.equal(bass.length, BARS, 'one root per bar');
  for (const deg of bass) {
    assert.equal(typeof deg, 'number');
    assert.ok(deg >= 1, 'degrees are 1-based');
  }
});

test('loop geometry: bars * beats-per-bar == loop beats', () => {
  assert.equal(BARS * BEATS_PER_BAR, LOOP_BEATS);
});

// ---- Per-town docked cue wiring (#129), fully headless (no AudioContext) ----

test('createMusic.dockedCue: defaults to a valid bell before any town is keyed', () => {
  const m = createMusic();
  const cue = m.dockedCue();
  assert.ok(cue && Array.isArray(cue.notes) && cue.notes.length === 4, 'a 4-note default flourish');
  assert.equal(cue.port, null, 'no town keyed yet → the default cue');
});

test('createMusic.dockedCue: follows the town set via setTownTheme (harbour sounds like itself)', () => {
  const m = createMusic();
  for (const name of ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"]) {
    m.setTownTheme(townMusicIdentity(name));   // no engine up → just stores the identity
    assert.deepEqual(m.dockedCue(), townDockedCue(name), `${name}: cue matches its pure descriptor`);
  }
});

test('createMusic.stinger: latches the CURRENT town cue at arm-time (landfall greets you in THIS port)', () => {
  const m = createMusic();
  m.setTownTheme(townMusicIdentity('Barnacle Bottom'));
  m.stinger();                                  // arm on landfall — no ctx, but the cue is latched
  const armed = m.dockedCue();
  assert.deepEqual(armed, townDockedCue('Barnacle Bottom'), 'the armed cue is the port you made');
  // Sailing on and re-keying does NOT rewrite the already-armed landfall cue until the next stinger.
  m.setTownTheme(townMusicIdentity("Gullet's Rest"));
  assert.deepEqual(m.dockedCue(), townDockedCue('Barnacle Bottom'), 'armed cue survives a later re-key');
});

test('createMusic: distinct towns arm distinct docked cues', () => {
  const sigs = new Set();
  for (const name of ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"]) {
    const m = createMusic();
    m.setTownTheme(townMusicIdentity(name));
    m.stinger();
    const c = m.dockedCue();
    sigs.add(`${c.notes.join(',')}|${c.shape}|${c.type}`);
  }
  assert.equal(sigs.size, 3, 'each harbour arms its own flourish');
});
