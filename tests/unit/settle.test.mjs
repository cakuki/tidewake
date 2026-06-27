// #76 phase c — arcade slow-to-stop for harbouring & fighting.
//
// TDD for the PURE easing/decel model in physics.js: a ship arriving at a berth or squaring
// up for a fight must EASE to a near-stop (reusing approach()), never teleport-freeze. These
// tests pin the math down before any of it is wired into the live sim:
//   • harbourSlowFactor  — a smooth [0,1] multiplier that coasts the hull in as it nears a port
//   • settledTargetSpeed — the (lowered) target speed given a fight / harbour-approach reason
//   • the easing itself converges to ~0 without overshoot/oscillation, and RELEASES the moment
//     the settle reason clears (normal throttle control returns).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approach,
  harbourSlowFactor,
  settledTargetSpeed,
  SETTLE_RATE,
} from '../../src/physics.js';

// ---- harbourSlowFactor: a smooth coast-in multiplier --------------------------------------

test('harbourSlowFactor: open water (>= radius) leaves full control (factor 1)', () => {
  assert.equal(harbourSlowFactor(90, 90), 1);
  assert.equal(harbourSlowFactor(500, 90), 1);
});

test('harbourSlowFactor: at the berth (distance 0) the factor is 0 — a full stop', () => {
  assert.equal(harbourSlowFactor(0, 90), 0);
});

test('harbourSlowFactor: inside the band it is in (0,1) and rises monotonically with distance', () => {
  const radius = 90;
  let prev = -1;
  for (let d = 0; d <= radius; d += 5) {
    const f = harbourSlowFactor(d, radius);
    assert.ok(f >= 0 && f <= 1, `factor ${f} out of [0,1] at d=${d}`);
    assert.ok(f >= prev - 1e-9, `factor must not decrease as distance grows (d=${d})`);
    prev = f;
  }
});

test('harbourSlowFactor: smoothstep soft knee — barely-there at the harbour mouth', () => {
  // Just inside the band the slowdown is gentle (a soft knee, not a wall): >85% speed kept.
  assert.ok(harbourSlowFactor(85, 90) > 0.85, 'should barely slow at the harbour mouth');
  // Deep inside, near the berth, it has eased well down.
  assert.ok(harbourSlowFactor(15, 90) < 0.2, 'should be nearly stopped near the berth');
});

test('harbourSlowFactor: a non-positive radius is a no-op (no phantom slowdown)', () => {
  assert.equal(harbourSlowFactor(10, 0), 1);
  assert.equal(harbourSlowFactor(10, -5), 1);
});

// ---- settledTargetSpeed: the lowered target the ship eases toward --------------------------

test('settledTargetSpeed: a fight forces a near-stop target of 0, whatever the throttle', () => {
  assert.equal(settledTargetSpeed(50, { fighting: true }), 0);
  assert.equal(settledTargetSpeed(50, { fighting: true, harbourDistance: 999, harbourRadius: 90 }), 0);
});

test('settledTargetSpeed: open water leaves the desired (throttle/wind) target untouched', () => {
  assert.equal(settledTargetSpeed(50, { harbourDistance: 300, harbourRadius: 90 }), 50);
  assert.equal(settledTargetSpeed(50, {}), 50); // no settle reason at all
});

test('settledTargetSpeed: approaching a harbour scales the target down into [0, desired)', () => {
  const desired = 50;
  const t = settledTargetSpeed(desired, { harbourDistance: 30, harbourRadius: 90 });
  assert.ok(t > 0 && t < desired, `eased target ${t} should be between 0 and ${desired}`);
  assert.equal(t, desired * harbourSlowFactor(30, 90));
});

test('settledTargetSpeed: never exceeds the desired target and never goes negative', () => {
  for (const d of [0, 10, 45, 89, 90, 200]) {
    const t = settledTargetSpeed(40, { harbourDistance: d, harbourRadius: 90 });
    assert.ok(t >= 0 && t <= 40, `target ${t} out of [0,40] at d=${d}`);
  }
});

// ---- the easing converges (no overshoot / oscillation) and releases cleanly ----------------

test('fight decel: approach() eases speed to ~0 with no overshoot or oscillation', () => {
  let speed = 50;            // charging in at speed when the guns run out
  const dt = 1 / 60;
  let prev = Infinity;
  for (let i = 0; i < 60 * 5; i++) {  // 5 seconds of fight
    const target = settledTargetSpeed(50, { fighting: true });
    speed = approach(speed, target, dt, SETTLE_RATE);
    assert.ok(speed >= -1e-9, `speed went negative (overshoot): ${speed}`);
    assert.ok(speed <= prev + 1e-9, `speed must be monotonically non-increasing (no oscillation), got ${speed} after ${prev}`);
    prev = speed;
  }
  assert.ok(speed < 0.5, `ship should have settled to a near-stop, got ${speed}`);
});

test('release: when the fight ends, the target returns to desired and speed climbs back (no overshoot)', () => {
  let speed = 0;             // dead in the water at the end of a fight
  const dt = 1 / 60;
  const desired = 50;
  let prev = -Infinity;
  for (let i = 0; i < 60 * 5; i++) {
    const target = settledTargetSpeed(desired, { fighting: false }); // control returned
    speed = approach(speed, target, dt, SETTLE_RATE);
    assert.ok(speed <= desired + 1e-9, `speed overshot the desired target: ${speed}`);
    assert.ok(speed >= prev - 1e-9, `speed should climb back monotonically, got ${speed} after ${prev}`);
    prev = speed;
  }
  assert.ok(speed > desired - 0.5, `control should have returned and speed recovered, got ${speed}`);
});

test('harbour coast-in: as the hull nears the berth the eased speed trends down to a near-stop', () => {
  // Simulate the distance shrinking as the ship glides in; speed should ease toward ~0 and
  // never overshoot the (falling) target.
  let speed = 40;
  const dt = 1 / 60;
  let distance = 90;
  let prev = Infinity;
  // Bounded: the hull asymptotically approaches the berth (as speed→0 it creeps ever slower),
  // so cap the sim at 15s and assert it has all but stopped by then.
  for (let i = 0; i < 60 * 15 && distance > 0.01; i++) {
    const target = settledTargetSpeed(40, { harbourDistance: distance, harbourRadius: 90 });
    speed = approach(speed, target, dt, SETTLE_RATE);
    assert.ok(speed <= prev + 1e-6, `coast-in speed should not surge back up, got ${speed} after ${prev}`);
    prev = speed;
    distance -= speed * dt; // the ship creeps in by however far it moved this step
  }
  assert.ok(speed < 2, `ship should have all but stopped at the berth, got ${speed}`);
});
