import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creakDrive,
  creakRate,
  creakGain,
  shouldCreak,
  creakGrain,
  CREAK_IDLE_RATE,
  CREAK_MAX_RATE,
  CREAK_GAIN_FLOOR,
  CREAK_MODES,
} from '../../src/systems/hull-creak.js';

const MAX = 55;

test('creakDrive: 0 at rest/amidships/glassy, 1 working hard, bounded, monotonic in each driver', () => {
  assert.equal(creakDrive(0, MAX, 0, 0), 0, 'becalmed, helm amidships, no swell → no work');
  assert.ok(Math.abs(creakDrive(MAX, MAX, 1, 1) - 1) < 1e-9, 'full sail + hard helm + heavy swell → saturates');
  // Each driver only ever ADDS work (monotonic non-decreasing), output always in [0,1].
  assert.ok(creakDrive(MAX, MAX, 0, 0) > creakDrive(MAX / 2, MAX, 0, 0), 'more speed → more work');
  assert.ok(creakDrive(MAX * 0.6, MAX, 1, 0) > creakDrive(MAX * 0.6, MAX, 0, 0), 'a hard helm AT SPEED works the hull');
  assert.ok(Math.abs(creakDrive(0, MAX, 1, 0) - creakDrive(0, MAX, 0, 0)) < 1e-9, 'a hard helm at REST barely works her');
  assert.ok(creakDrive(0, MAX, 0, 1) > creakDrive(0, MAX, 0, 0), 'a heavy swell works a becalmed hull');
  for (let s = 0; s <= MAX; s += 5) {
    const v = creakDrive(s, MAX, 0.5, 0.5);
    assert.ok(v >= 0 && v <= 1, `out of range at ${s}: ${v}`);
  }
});

test('creakDrive: junk / zero / negative inputs fail safe (finite, in range, never throws)', () => {
  for (const args of [[NaN, MAX, 0, 0], [10, 0, 0, 0], [-5, MAX, 0, 0], [10, MAX, NaN, 9], [10, MAX, -3, -2]]) {
    const v = creakDrive(...args);
    assert.ok(Number.isFinite(v) && v >= 0 && v <= 1, `junk ${JSON.stringify(args)} → finite [0,1], got ${v}`);
  }
  assert.equal(creakDrive(10, 0, 0, 0), 0, 'maxSpeed 0 → 0, no divide-by-zero');
});

test('creakRate: idle floor at anchor, busy max working hard, bounded by the constants', () => {
  assert.ok(CREAK_IDLE_RATE > 0 && CREAK_IDLE_RATE < CREAK_MAX_RATE, 'a quiet but non-zero idle floor');
  assert.ok(Math.abs(creakRate(0, MAX, 0, 0) - CREAK_IDLE_RATE) < 1e-12, 'becalmed → exactly the idle rate');
  assert.ok(Math.abs(creakRate(MAX, MAX, 1, 1) - CREAK_MAX_RATE) < 1e-9, 'working hard → the max rate');
  let prev = -1;
  for (let s = 0; s <= MAX; s += 5) {
    const v = creakRate(s, MAX, 0, 0);
    assert.ok(v >= prev, `not monotonic at ${s}`);
    assert.ok(v >= CREAK_IDLE_RATE - 1e-9 && v <= CREAK_MAX_RATE + 1e-9, `out of band at ${s}: ${v}`);
    prev = v;
  }
});

test('creakGain: soft floor even idle, fuller working hard, bounded [floor,1]', () => {
  assert.ok(Math.abs(creakGain(0, MAX, 0, 0) - CREAK_GAIN_FLOOR) < 1e-9, 'idle grain sits at the floor');
  assert.ok(Math.abs(creakGain(MAX, MAX, 1, 1) - 1) < 1e-9, 'working hard → full grain');
  assert.ok(creakGain(MAX, MAX, 0, 0) > creakGain(0, MAX, 0, 0), 'louder grains the harder she works');
  for (const args of [[NaN, MAX, 0, 0], [10, 0, NaN, 9]]) {
    const v = creakGain(...args);
    assert.ok(Number.isFinite(v) && v >= CREAK_GAIN_FLOOR - 1e-9 && v <= 1, `junk → [floor,1], got ${v}`);
  }
});

test('shouldCreak: fires with probability rate*dt against the supplied sample; junk fails safe', () => {
  // p = clamp(rate*dt). A sample below p fires; at/above p does not.
  assert.equal(shouldCreak(1, 0.5, 0.49), true, 'sample below p=0.5 fires');
  assert.equal(shouldCreak(1, 0.5, 0.5), false, 'sample at p does not fire');
  assert.equal(shouldCreak(1, 0.5, 0.9), false, 'sample above p does not fire');
  assert.equal(shouldCreak(2, 0, 0.0), false, 'dt 0 → never fires (p=0)');
  assert.equal(shouldCreak(0, 0.5, 0.0), false, 'rate 0 → never fires');
  assert.equal(shouldCreak(1000, 1000, 0.99), true, 'p clamps to 1 → any in-range sample fires');
  // Junk rate/dt/sample never throw and never spuriously fire.
  for (const args of [[NaN, 0.5, 0.1], [1, NaN, 0.1], [1, 0.5, NaN], [1, 0.5, undefined]]) {
    assert.equal(shouldCreak(...args), false, `junk ${JSON.stringify(args)} → no fire`);
  }
});

test('creakGrain: deterministic for a given source, in-range timbre, low-biased, junk fails safe', () => {
  // A fixed sample source → a fixed grain (proves it is pure / testable).
  const fixed = () => 0.5;
  const a = creakGrain(fixed);
  const b = creakGrain(fixed);
  assert.deepEqual(a, b, 'same source → same grain');
  assert.ok(a.freq > 0 && Number.isFinite(a.freq), 'a positive resonance frequency');
  assert.ok(a.dur >= 0.16 && a.dur <= 0.16 + 0.42 + 1e-9, 'duration within the stick-slip..groan band');
  // Low-bias: a sweep of samples should land on the lowest modes far more than the highest.
  let low = 0, high = 0;
  for (let i = 0; i < 100; i++) {
    const s = (i + 0.5) / 100;
    const g = creakGrain(() => s);
    const nearestMode = CREAK_MODES.reduce((p, m) => (Math.abs(m - g.freq) < Math.abs(p - g.freq) ? m : p));
    if (nearestMode <= CREAK_MODES[1]) low++;
    if (nearestMode >= CREAK_MODES[CREAK_MODES.length - 1]) high++;
  }
  assert.ok(low > high, `low groans favoured over high creaks (low=${low}, high=${high})`);
  // A junk source must not throw and still yields a valid grain.
  const j = creakGrain(() => NaN);
  assert.ok(j.freq > 0 && j.dur > 0, 'junk source → still a valid grain');
  assert.doesNotThrow(() => creakGrain(null), 'a non-function source never throws');
});
