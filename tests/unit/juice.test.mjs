import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createJuice, decay, flashEnvelope, shakeOffset, recoilMagnitude, ammoWeight, flashPeak,
  impact01, impactShakeMag, hitStopDuration,
  MAX_SHAKE, MAX_FLASH, SHAKE_SECONDS, LUNGE_SECONDS, FLASH_SECONDS,
  MAX_HITSTOP, MIN_HITSTOP, HITSTOP_GRAZE, DAMAGE_REF,
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

// ---- #80 combat/harbour game-feel "juice" pass: impact scaling + hit-stop ---
// The pure curves that make a hit LAND — a graze, a full broadside, and a sinking must each read as a
// DIFFERENT jolt, and the freeze must be bounded so it can never stall the loop.

test('impact01: normalises hull bite to [0,1], clamped, monotone', () => {
  assert.equal(impact01(0), 0, 'no damage is no impact');
  assert.equal(impact01(-5), 0, 'negative bite is floored');
  assert.equal(impact01(DAMAGE_REF), 1, 'a full-reference bite is a full impact');
  assert.equal(impact01(9999), 1, 'a monstrous bite never exceeds 1');
  assert.ok(impact01(8) < impact01(20), 'a bigger bite reads as a bigger impact');
});

test('impactShakeMag: scales with impact, floored for a solid hit, capped at MAX_SHAKE', () => {
  assert.equal(impactShakeMag(0), 0, 'no impact → no shake');
  const graze = impactShakeMag(0.3), full = impactShakeMag(1);
  assert.ok(full > graze && graze > 0, 'a stronger impact rocks the view harder');
  assert.ok(impactShakeMag(9) <= MAX_SHAKE + 1e-9, 'never past the shake cap');
  assert.ok(full <= MAX_SHAKE + 1e-9, 'a full impact tops out at the cap');
});

test('hitStopDuration: a graze never freezes; a solid hit freezes MIN→MAX, bounded', () => {
  assert.equal(hitStopDuration(0), 0, 'no impact, no freeze');
  assert.equal(hitStopDuration(HITSTOP_GRAZE * 0.5), 0, 'a graze does NOT stop time');
  const solid = hitStopDuration(HITSTOP_GRAZE + 1e-6);
  assert.ok(solid >= MIN_HITSTOP && solid < MIN_HITSTOP + 1e-3, 'the smallest solid hit earns ~the min freeze');
  const heavy = hitStopDuration(1);
  assert.ok(heavy > solid, 'a heavier bite freezes longer');
  assert.equal(heavy, MAX_HITSTOP, 'a full impact freezes exactly the max');
  for (let i = 0; i <= 1.0001; i += 0.01) {
    assert.ok(hitStopDuration(i) <= MAX_HITSTOP + 1e-9, 'the freeze is ALWAYS bounded (never a stall)');
  }
});

// ---- Controller: the #80 impact/sink triggers + the hit-stop consumer -------

test('createJuice.impact: a solid hit rocks the view AND owes a hit-stop, scaled by bite', () => {
  const light = createJuice(); light.impact({ damage: 6 });
  const heavy = createJuice(); heavy.impact({ damage: DAMAGE_REF });
  light.update(1 / 60); heavy.update(1 / 60);
  assert.ok(heavy.snapshot().offsetMag > light.snapshot().offsetMag, 'a heavier hit kicks the camera harder');
  assert.ok(heavy.snapshot().hitStop > 0, 'a heavy hit owes a freeze');
  assert.ok(heavy.snapshot().hitStop >= light.snapshot().hitStop, 'freeze scales with impact');
});

test('createJuice.impact: a graze does not stop time (juice echoes the mechanic, never masks it)', () => {
  const j = createJuice();
  j.impact({ damage: 1 }); // below the graze threshold
  assert.equal(j.snapshot().hitStop, 0, 'a glancing tap never freezes the world');
});

test('createJuice.impact: stop:false rocks the view without any freeze', () => {
  const j = createJuice();
  j.impact({ damage: DAMAGE_REF, stop: false });
  assert.equal(j.snapshot().hitStop, 0, 'the freeze can be withheld while the shake still lands');
  j.update(1 / 60);
  assert.ok(j.snapshot().offsetMag > 0, 'the shake still rocks the view');
});

test('createJuice.sink: the kill punctuates with the strongest rock + the longest freeze', () => {
  const j = createJuice();
  j.sink();
  assert.equal(j.snapshot().hitStop, MAX_HITSTOP, 'a sinking freezes the max');
  j.update(1 / 60);
  assert.ok(j.snapshot().offsetMag > 0, 'a sinking rocks the view');
});

test('consumeHitStop: freezes the sim for a BOUNDED window, drains on REAL time, always resumes', () => {
  const j = createJuice();
  j.impact({ damage: DAMAGE_REF }); // a full freeze owed (MAX_HITSTOP)
  assert.ok(j.snapshot().hitStop > 0);
  // While a freeze is owed, the consumer returns 0 (sim holds) and drains on the real dt handed in.
  let frames = 0;
  while (j.snapshot().hitStop > 0) {
    const scale = j.consumeHitStop(1 / 60);
    assert.equal(scale, 0, 'the sim is frozen while a freeze is owed');
    frames++;
    assert.ok(frames < 20, 'the freeze is bounded — it CANNOT stall the loop');
  }
  assert.equal(j.consumeHitStop(1 / 60), 1, 'once drained the sim runs at full speed again');
  assert.equal(j.snapshot().hitStop, 0, 'no residual freeze');
});

test('consumeHitStop: with no freeze owed it is a clean pass-through (scale 1)', () => {
  const j = createJuice();
  assert.equal(j.consumeHitStop(1 / 60), 1, 'no freeze → the sim runs full, deterministically');
});

test('setEnabled(false): the whole juice pass is fully suppressed — no shake, no flash, no freeze, no residual', () => {
  const j = createJuice();
  j.impact({ damage: DAMAGE_REF }); j.fire({ quality: 1, weight: 2 }); j.hit({ damage: 40 }); j.sink();
  j.update(1 / 60);
  assert.equal(j.active(), true, 'juice is live while enabled');
  j.setEnabled(false);
  assert.equal(j.active(), false, 'toggling juice off clears every live effect');
  assert.equal(j.snapshot().offsetMag, 0, 'no residual camera offset when off');
  assert.equal(j.snapshot().hitStop, 0, 'no residual freeze when off');
  assert.equal(j.consumeHitStop(1 / 60), 1, 'the sim runs full while off (fully playable)');
  // …and while OFF, new triggers do nothing.
  j.impact({ damage: DAMAGE_REF }); j.sink();
  j.update(1 / 60);
  assert.equal(j.active(), false, 'triggers are no-ops while the toggle is off');
});

test('reduce-motion suppresses the #80 impact/sink triggers + hit-stop too', () => {
  const j = createJuice({ reducedMotion: true });
  j.impact({ damage: DAMAGE_REF }); j.sink();
  j.update(1 / 60);
  assert.equal(j.active(), false, 'reduced-motion silences the impact pass');
  assert.equal(j.snapshot().hitStop, 0, 'no freeze under reduced-motion');
  assert.equal(j.consumeHitStop(1 / 60), 1, 'the sim runs full under reduced-motion (no freeze)');
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
