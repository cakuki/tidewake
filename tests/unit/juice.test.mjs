import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createJuice, decay, flashEnvelope, shakeOffset, recoilMagnitude, ammoWeight, flashPeak,
  MAX_SHAKE, MAX_FLASH, SHAKE_SECONDS, LUNGE_SECONDS, FLASH_SECONDS,
} from '../../src/systems/juice.js';

// ---- PURE curves ------------------------------------------------------------

test('decay: 1 at the start, 0 at and past the duration, monotone in between', () => {
  assert.equal(decay(0, 0.3), 1);
  assert.equal(decay(0.3, 0.3), 0, 'exactly at duration is spent');
  assert.equal(decay(0.5, 0.3), 0, 'past duration is spent');
  assert.equal(decay(-1, 0.3), 0, 'negative elapsed is spent');
  assert.equal(decay(0.1, 0), 0, 'zero duration never rings');
  const a = decay(0.05, 0.3), b = decay(0.15, 0.3);
  assert.ok(a > b && b > 0, 'strictly decreasing while live');
});

test('flashEnvelope: rises from 0 to a peak, then fades back to 0', () => {
  assert.equal(flashEnvelope(0, 0.4), 0, 'starts dark');
  assert.equal(flashEnvelope(0.4, 0.4), 0, 'ends dark');
  const peak = flashEnvelope(0.4 * 0.18, 0.4); // the attack→fade seam is the brightest
  assert.ok(peak > 0.99, 'reaches full at the attack seam');
  const rising = flashEnvelope(0.02, 0.4), fading = flashEnvelope(0.30, 0.4);
  assert.ok(rising > 0 && rising < 1);
  assert.ok(fading > 0 && fading < peak, 'fades after the seam');
});

test('shakeOffset: strongest at impact, bounded by the cap, and dead once spent', () => {
  const [x0] = shakeOffset(0, { magnitude: 2 }); // the shake peaks at the impact frame, then decays
  assert.equal(x0, 0, 'the x axis starts at rest (sin 0)');
  assert.deepEqual(shakeOffset(SHAKE_SECONDS, { magnitude: 2 }), [0, 0], 'spent at duration');
  for (let e = 0; e < SHAKE_SECONDS; e += 0.005) {
    const [x, y] = shakeOffset(e, { magnitude: 999 }); // request an absurd magnitude
    assert.ok(Math.abs(x) <= MAX_SHAKE + 1e-9, 'x axis stays under the cap');
    assert.ok(Math.abs(y) <= MAX_SHAKE + 1e-9, 'y axis stays under the cap');
  }
});

test('recoilMagnitude: scales with aim quality and shot weight, capped', () => {
  assert.equal(recoilMagnitude(0, 2), 0, 'a wide (quality 0) shot barely kicks');
  const clean = recoilMagnitude(1, ammoWeight(1.7)); // heavy, dead-abeam
  const glance = recoilMagnitude(0.3, ammoWeight(1.7));
  assert.ok(clean > glance, 'a cleaner shot kicks harder');
  assert.ok(recoilMagnitude(1, 99) <= MAX_SHAKE, 'never past the cap');
  // heavy shot kicks harder than a swivel at the same aim
  assert.ok(recoilMagnitude(1, ammoWeight(1.7)) > recoilMagnitude(1, ammoWeight(0.45)), 'heavy > swivel');
});

test('flashPeak: proportional to damage, bounded by the cap', () => {
  assert.equal(flashPeak(0), 0);
  assert.ok(flashPeak(10) < flashPeak(25), 'more damage flashes brighter');
  assert.ok(flashPeak(9999) <= MAX_FLASH, 'never a full red/white-out');
});

// ---- Controller trigger edges ----------------------------------------------

test('createJuice.fire: a clean beam volley produces a real camera kick that decays away', () => {
  const j = createJuice();
  assert.equal(j.active(), false, 'idle to begin with');
  j.fire({ quality: 1, weight: ammoWeight(1.7) });
  assert.equal(j.active(), true, 'a fired volley is felt');
  j.update(1 / 60); // one frame in
  const mag = j.snapshot().offsetMag;
  assert.ok(mag > 0, 'the camera is offset after firing');
  // ...and it is gone once the shake window elapses
  j.update(SHAKE_SECONDS);
  assert.equal(j.active(), false, 'the kick is transient');
  assert.equal(j.snapshot().offsetMag, 0);
});

test('createJuice.fire: a wide shot (quality 0) does not kick', () => {
  const j = createJuice();
  j.fire({ quality: 0, weight: 1 });
  assert.equal(j.active(), false, 'a shot that flew wide has nothing to feel');
});

test('createJuice.board: a boarding lunges the camera forward (-z), then settles', () => {
  const j = createJuice();
  j.board();
  j.update(1 / 60);
  const o = j.cameraOffset();
  assert.ok(o.z < 0, 'the lunge pushes toward the foe');
  j.update(LUNGE_SECONDS);
  assert.equal(j.cameraOffset().z, 0, 'the lunge eases back to rest');
});

test('createJuice.hit: a landed hit flashes, tinted, bounded, and transient', () => {
  const j = createJuice();
  j.hit({ damage: 30, tint: 'red' });
  j.update(FLASH_SECONDS * 0.18); // step to the flash peak
  const f = j.flashLevel();
  assert.ok(f.level > 0 && f.level <= MAX_FLASH, 'a bounded flash');
  assert.equal(f.tint, 'red');
  j.update(FLASH_SECONDS);
  assert.equal(j.flashLevel().level, 0, 'the flash fades to nothing');
});

test('reduce-motion: every trigger is a clean no-op', () => {
  const j = createJuice({ reducedMotion: true });
  j.fire({ quality: 1, weight: 2 });
  j.board();
  j.hit({ damage: 99, tint: 'red' });
  j.update(1 / 60);
  assert.equal(j.active(), false, 'reduced-motion silences all game-feel');
  assert.equal(j.snapshot().offsetMag, 0);
  assert.equal(j.flashLevel().level, 0);
});

test('update: ignores a non-positive dt (deterministic, headless-safe)', () => {
  const j = createJuice();
  j.fire({ quality: 1, weight: 1.5 });
  const before = j.snapshot().shakes;
  j.update(0);
  j.update(-1);
  assert.equal(j.snapshot().shakes, before, 'no time passed → no aging');
});

test('simultaneous shakes are capped so a fire-spam cannot stack to sea-sickness', () => {
  const j = createJuice();
  for (let i = 0; i < 20; i++) j.fire({ quality: 1, weight: 1.5 });
  assert.ok(j.snapshot().shakes <= 4, 'stacked shakes are bounded');
});
