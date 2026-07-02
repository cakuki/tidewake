import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp01,
  seaGain,
  windGain,
  nextGullDelay,
  coastProximity,
  gullCoastGain,
  gullCoastDelay,
  COAST_AUDIO_RANGE,
  GULL_COAST_PEAK,
  semitoneToFreq,
  unlockEventNames,
  needsUnlock,
} from '../../src/audio.js';

const MAX = 55;

// ---- iOS WebAudio unlock logic (#76 follow-up) ----------------------------
// iOS Safari (tab AND installed PWA) only resumes a suspended AudioContext inside a real
// gesture; the pure helpers below decide WHICH gestures to bind and WHETHER a context still
// needs unlocking, so the unlock state machine is testable without a real AudioContext.

test('unlockEventNames: covers touch (iOS), pointer, mouse, click and key gestures', () => {
  const ev = unlockEventNames();
  assert.ok(Array.isArray(ev) && ev.length > 0, 'returns a non-empty list');
  // iOS specifically wants a touch event — both touchstart and touchend must be there.
  assert.ok(ev.includes('touchstart'), 'binds touchstart (iOS unlock)');
  assert.ok(ev.includes('touchend'), 'binds touchend (iOS unlock)');
  // Desktop / non-touch must still unlock.
  for (const e of ['pointerdown', 'mousedown', 'click', 'keydown']) {
    assert.ok(ev.includes(e), `binds ${e}`);
  }
  // No duplicate listeners.
  assert.equal(new Set(ev).size, ev.length, 'no duplicate event names');
});

test('needsUnlock: only a running context is considered unlocked', () => {
  assert.equal(needsUnlock('running'), false, 'running == unlocked');
  assert.equal(needsUnlock('suspended'), true, 'suspended needs a gesture resume');
  assert.equal(needsUnlock('interrupted'), true, 'iOS "interrupted" needs re-resume');
  assert.equal(needsUnlock(undefined), true, 'unknown/just-created needs unlock');
});

test('clamp01: clamps to [0,1]', () => {
  assert.equal(clamp01(-3), 0);
  assert.equal(clamp01(0.4), 0.4);
  assert.equal(clamp01(2), 1);
});

test('seaGain: gentle wash at rest, swells with speed', () => {
  const rest = seaGain(0, MAX);
  const full = seaGain(MAX, MAX);
  assert.ok(Math.abs(rest - 0.10) < 1e-9, 'rest wash == 0.10');
  assert.ok(Math.abs(full - 0.32) < 1e-9, 'full wash == 0.32');
  assert.ok(full > rest, 'faster is louder');
});

test('seaGain: monotonic and bounded across the speed range', () => {
  let prev = -1;
  for (let s = 0; s <= MAX; s += 5) {
    const g = seaGain(s, MAX);
    assert.ok(g >= prev, `not monotonic at ${s}`);
    assert.ok(g >= 0.10 - 1e-9 && g <= 0.32 + 1e-9, `out of range at ${s}: ${g}`);
    prev = g;
  }
});

test('seaGain: clamps above max speed and ignores bad maxSpeed', () => {
  assert.ok(Math.abs(seaGain(999, MAX) - 0.32) < 1e-9, 'clamped at full');
  assert.ok(Math.abs(seaGain(10, 0) - 0.10) < 1e-9, 'maxSpeed 0 -> rest value, no NaN');
});

test('windGain: quieter than wash at rest, brighter at speed', () => {
  assert.ok(windGain(0, MAX) < seaGain(0, MAX), 'wind under wash at rest');
  assert.ok(windGain(MAX, MAX) > windGain(0, MAX), 'wind lifts with speed');
  assert.ok(Math.abs(windGain(0, MAX) - 0.035) < 1e-9);
  assert.ok(Math.abs(windGain(MAX, MAX) - 0.155) < 1e-9);
});

test('nextGullDelay: maps random into [min,max]', () => {
  assert.ok(Math.abs(nextGullDelay(0) - 12) < 1e-9, 'rand 0 -> min');
  assert.ok(Math.abs(nextGullDelay(1) - 34) < 1e-9, 'rand 1 -> max');
  assert.ok(Math.abs(nextGullDelay(0.5) - 23) < 1e-9, 'rand 0.5 -> midpoint');
});

test('nextGullDelay: clamps out-of-range randoms and honors custom bounds', () => {
  assert.ok(nextGullDelay(-1) >= 12 - 1e-9, 'negative clamps to min');
  assert.ok(nextGullDelay(5) <= 34 + 1e-9, 'over-1 clamps to max');
  assert.ok(Math.abs(nextGullDelay(0, 2, 8) - 2) < 1e-9, 'custom min');
  assert.ok(Math.abs(nextGullDelay(1, 2, 8) - 8) < 1e-9, 'custom max');
});

// ---- Coastal gulls (#68): calls swell near land, silent at open sea ----------

test('coastProximity: 1 at the coast, 0 at open sea, eases in between', () => {
  assert.equal(coastProximity(0), 1, 'on the shoreline -> full');
  assert.equal(coastProximity(COAST_AUDIO_RANGE), 0, 'at the range edge -> nothing');
  assert.equal(coastProximity(COAST_AUDIO_RANGE * 2), 0, 'beyond the range clamps to 0');
  assert.ok(Math.abs(coastProximity(COAST_AUDIO_RANGE / 2) - 0.5) < 1e-9, 'halfway -> 0.5');
  assert.equal(coastProximity(Infinity), 0, 'no island anywhere -> open sea');
  assert.equal(coastProximity(NaN), 0, 'bad input -> 0, never NaN');
});

test('coastProximity: monotonic — closer to land is always more coastal', () => {
  let prev = 2;
  for (let d = 0; d <= COAST_AUDIO_RANGE; d += 40) {
    const p = coastProximity(d);
    assert.ok(p <= prev + 1e-9, `not monotonic decreasing at ${d}`);
    assert.ok(p >= 0 && p <= 1, `out of range at ${d}: ${p}`);
    prev = p;
  }
});

test('gullCoastGain: silent at sea, peaks at the coast, monotonic', () => {
  assert.equal(gullCoastGain(0), 0, 'open sea -> 0 (silent)');
  assert.ok(Math.abs(gullCoastGain(1) - GULL_COAST_PEAK) < 1e-9, 'coast -> peak');
  assert.ok(gullCoastGain(1) > gullCoastGain(0.5), 'louder nearer land');
  assert.ok(gullCoastGain(0.5) > gullCoastGain(0), 'and still louder than open sea');
  assert.equal(gullCoastGain(-1), 0, 'clamps negative proximity');
});

test('gullCoastGain: near the coast the SFX drives real amplitude; at sea it is ~0', () => {
  // The gate contract: intensity rises near the coast and falls to ~0 at open sea.
  const nearShore = gullCoastGain(coastProximity(20));   // ~20 units off the beach
  const openSea = gullCoastGain(coastProximity(4000));   // far out
  assert.ok(nearShore > 0.5, `coast should be loud (${nearShore})`);
  assert.ok(openSea < 1e-6, `open sea should be silent (${openSea})`);
});

test('gullCoastDelay: cries are frequent near land, sparse at open sea', () => {
  // Same random draw: the near-coast gap is shorter than the open-sea gap.
  const nearGap = gullCoastDelay(1, 0.5);
  const seaGap = gullCoastDelay(0, 0.5);
  assert.ok(nearGap < seaGap, `near coast should cry more often (${nearGap} < ${seaGap})`);
  // Bounds honoured at the extremes (rand endpoints hit the interpolated min/max).
  assert.ok(Math.abs(gullCoastDelay(1, 0) - 5) < 1e-9, 'coast + rand 0 -> nearMin 5s');
  assert.ok(Math.abs(gullCoastDelay(1, 1) - 12) < 1e-9, 'coast + rand 1 -> nearMax 12s');
  assert.ok(Math.abs(gullCoastDelay(0, 0) - 20) < 1e-9, 'sea + rand 0 -> farMin 20s');
  assert.ok(Math.abs(gullCoastDelay(0, 1) - 42) < 1e-9, 'sea + rand 1 -> farMax 42s');
});

test('semitoneToFreq: A4 is the reference and octaves double/halve', () => {
  assert.ok(Math.abs(semitoneToFreq(0) - 440) < 1e-9, '0 -> A4 440Hz');
  assert.ok(Math.abs(semitoneToFreq(12) - 880) < 1e-9, '+12 -> A5');
  assert.ok(Math.abs(semitoneToFreq(-12) - 220) < 1e-9, '-12 -> A3');
});

test('semitoneToFreq: equal-temperament steps and a custom reference', () => {
  assert.ok(Math.abs(semitoneToFreq(5) - 587.3295) < 1e-3, '+5 -> ~D5');
  assert.ok(semitoneToFreq(1) > semitoneToFreq(0), 'monotonic up');
  assert.ok(Math.abs(semitoneToFreq(0, 432) - 432) < 1e-9, 'honours custom A4');
});
