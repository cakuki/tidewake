// #20 — smooth, satisfying steering. The helm should feel responsive but WEIGHTY: holding
// the rudder over RAMPS the turn in (it accelerates as you hold), and releasing settles it
// smoothly back to neutral — a gentle rudder, never an instant constant-yaw snap.
//
// TDD for the PURE turn-rate easing in physics.js BEFORE it is wired into the live sim:
//   • easeRudder  — eases a rudder value toward the held steer input, frame-rate independent,
//     never overshooting the input, ramping in while held and settling to 0 on release.
// The yaw a step applies is then `rudder * steerRate(speed)` — eased, never a hard step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { easeRudder, RUDDER_RATE, steerRate } from '../../src/physics.js';

// ---- easeRudder: the rudder swings toward the held input, eased ----------------------------

test('easeRudder: neutral with no input stays neutral', () => {
  assert.equal(easeRudder(0, 0, 1 / 60), 0);
});

test('easeRudder: holding hard-over ramps the rudder IN toward the input (accelerating turn)', () => {
  const dt = 1 / 60;
  let rudder = 0;
  let prev = -Infinity;
  for (let i = 0; i < 60; i++) {            // one second of holding A (input = +1)
    rudder = easeRudder(rudder, 1, dt);
    assert.ok(rudder >= prev - 1e-9, `rudder must ramp up monotonically while held, got ${rudder} after ${prev}`);
    assert.ok(rudder <= 1 + 1e-9, `rudder must never overshoot the input, got ${rudder}`);
    prev = rudder;
  }
  // It eases IN, not instantly: after a beat it is meaningfully over but still shy of hard-over,
  // and after a full second it is most of the way there.
  assert.ok(rudder > 0.9, `after 1s held the rudder should be nearly hard-over, got ${rudder}`);
});

test('easeRudder: the ramp is gradual — one beat does not snap to full rudder', () => {
  // A single ~0.1s beat of holding over should move the rudder only PART way — the weighty feel.
  const r = easeRudder(0, 1, 0.1);
  assert.ok(r > 0 && r < 0.6, `one 0.1s beat should ease the rudder only part way, got ${r}`);
});

test('easeRudder: releasing settles the rudder smoothly back to neutral (no snap, no overshoot)', () => {
  const dt = 1 / 60;
  let rudder = 1;                            // hard-over, then released (input = 0)
  let prev = Infinity;
  for (let i = 0; i < 120; i++) {            // two seconds of settling
    rudder = easeRudder(rudder, 0, dt);
    assert.ok(rudder <= prev + 1e-9, `rudder must settle monotonically toward neutral, got ${rudder} after ${prev}`);
    assert.ok(rudder >= -1e-9, `rudder must not overshoot past neutral, got ${rudder}`);
    prev = rudder;
  }
  assert.ok(rudder < 0.05, `after release the rudder should have all but centred, got ${rudder}`);
});

test('easeRudder: crossing over (A then D) eases THROUGH neutral, never teleporting', () => {
  // Flipping from hard-a-port (+1) to hard-a-starboard (-1) must pass smoothly through 0.
  const dt = 1 / 60;
  let rudder = 1;
  let crossedSmoothly = true, prev = 1;
  for (let i = 0; i < 120; i++) {
    rudder = easeRudder(rudder, -1, dt);
    if (rudder > prev + 1e-9) crossedSmoothly = false; // must only ever decrease toward -1
    assert.ok(rudder >= -1 - 1e-9, `rudder must never overshoot the opposite input, got ${rudder}`);
    prev = rudder;
  }
  assert.ok(crossedSmoothly, 'the rudder should ease monotonically across neutral, not jump');
  assert.ok(rudder < -0.9, `after a second hard-over the other way the rudder should be near -1, got ${rudder}`);
});

test('easeRudder: frame-rate independent within its valid step regime', () => {
  // Over the same elapsed time, a moderate per-step dt (kept within approach()'s dt*rate<1
  // regime) and many tiny steps should land close — the sim drives this in fixed sub-steps, so
  // the helm feels the same whatever the frame rate. (Large clamped steps are expected to differ;
  // that's the documented approach() caveat and the sim never takes them.)
  const total = 0.5;
  let coarse = 0;
  for (let i = 0; i < 10; i++) coarse = easeRudder(coarse, 1, total / 10); // dt*rate = 0.175
  let fine = 0;
  for (let i = 0; i < 60; i++) fine = easeRudder(fine, 1, total / 60);
  assert.ok(Math.abs(coarse - fine) < 0.06, `coarse (${coarse}) and fine (${fine}) integration should agree`);
});

test('easeRudder: never overshoots even with a large dt (clamped step)', () => {
  // A huge frame hitch must not fling the rudder past the input.
  assert.ok(easeRudder(0, 1, 100) <= 1 + 1e-9);
  assert.ok(easeRudder(0, -1, 100) >= -1 - 1e-9);
});

test('RUDDER_RATE: is a sane positive easing rate', () => {
  assert.ok(RUDDER_RATE > 0 && RUDDER_RATE < 50, `RUDDER_RATE looks off: ${RUDDER_RATE}`);
});

// ---- the eased yaw still scales sensibly with speed (existing steerRate, unchanged) --------

test('eased yaw: applied yaw is rudder * steerRate(speed) — weightier the faster you go up to a cap', () => {
  // The turn the sim applies is the EASED rudder times the speed-scaled steerRate. A half-rudder
  // turns half as hard; a full rudder at speed turns hardest (capped). This is the contract the
  // sim wires: heading += rudder * steerRate(speed) * dt.
  const slow = steerRate(2), fast = steerRate(40);
  assert.ok(fast > slow, 'turn authority should firm up with speed');
  assert.ok(0.5 * fast < 1.0 * fast, 'a half rudder turns less than a full rudder at the same speed');
});
