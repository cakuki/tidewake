import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp01,
  seaGain,
  windGain,
  nextGullDelay,
} from '../../src/audio.js';

const MAX = 55;

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
