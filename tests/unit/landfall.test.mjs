// Landfall transition — the pure phase/ease/duration state machine that turns the SAILING↔TOWN
// mode snap into a crafted, eased gesture (#102). Browser-free, deterministic, dt-driven (never
// wall-clock) so it proves out under node and headless. main.js owns the camera/grade wiring.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLandfall, easeInOut, PHASES } from '../../src/systems/landfall.js';

test('easeInOut is a clamped smoothstep: 0→0, 1→1, midpoint 0.5, monotonic', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.equal(easeInOut(0.5), 0.5);
  assert.equal(easeInOut(-3), 0);   // clamped low
  assert.equal(easeInOut(9), 1);    // clamped high
  // eased start is gentler than linear (smoothstep toe), and monotonic
  assert.ok(easeInOut(0.25) < 0.25);
  let prev = -1;
  for (let x = 0; x <= 1.0001; x += 0.1) { const y = easeInOut(x); assert.ok(y >= prev); prev = y; }
});

test('boots idle: blend 0, not active, town not ready', () => {
  const lf = createLandfall();
  assert.equal(lf.phase, PHASES.IDLE);
  assert.equal(lf.blend, 0);
  assert.equal(lf.active, false);
  assert.equal(lf.townReady, false);
});

test('land() runs a deterministic eased 0→1 over the configured duration', () => {
  const lf = createLandfall({ landMs: 1000 });
  assert.equal(lf.land(), true);            // started
  assert.equal(lf.phase, PHASES.LANDING);
  assert.equal(lf.active, true);
  assert.equal(lf.townReady, false);        // town opens only once ASHORE

  lf.step(0.5);                             // halfway in time → eased midpoint
  assert.ok(lf.blend > 0 && lf.blend < 1);
  assert.ok(Math.abs(lf.blend - 0.5) < 1e-9);

  lf.step(0.5);                             // completes
  assert.equal(lf.phase, PHASES.ASHORE);
  assert.equal(lf.blend, 1);
  assert.equal(lf.active, false);
  assert.equal(lf.townReady, true);         // NOW the town view may take the screen
});

test('blend is monotonic + deterministic across many small steps (headless tw.step cadence)', () => {
  const a = createLandfall({ landMs: 900 });
  const b = createLandfall({ landMs: 900 });
  a.land(); b.land();
  let prev = 0;
  for (let i = 0; i < 9; i++) { a.step(0.1); assert.ok(a.blend >= prev - 1e-12); prev = a.blend; }
  // one big step reaches the same end-state as nine small ones — duration, not frame-count, drives it
  b.step(0.9);
  assert.equal(a.phase, PHASES.ASHORE);
  assert.equal(b.phase, PHASES.ASHORE);
  assert.equal(a.blend, b.blend);
});

test('leave() eases blend 1→0 back to idle (the graceful reverse)', () => {
  const lf = createLandfall({ landMs: 100, leaveMs: 1000 });
  lf.land(); lf.step(0.1);                  // ashore
  assert.equal(lf.phase, PHASES.ASHORE);
  assert.equal(lf.leave(), true);
  assert.equal(lf.phase, PHASES.LEAVING);
  assert.equal(lf.townReady, false);        // town view closes the instant we set sail
  lf.step(0.5); assert.ok(Math.abs(lf.blend - 0.5) < 1e-9);
  lf.step(0.5);
  assert.equal(lf.phase, PHASES.IDLE);
  assert.equal(lf.blend, 0);
});

test('skip() completes the active transition instantly (skippable gesture)', () => {
  const lf = createLandfall({ landMs: 5000 });
  lf.land(); lf.step(0.2);                  // barely begun
  assert.ok(lf.blend < 0.3);
  assert.equal(lf.skip(), true);
  assert.equal(lf.phase, PHASES.ASHORE);
  assert.equal(lf.blend, 1);
  // skip is a no-op when nothing is transitioning
  assert.equal(lf.skip(), false);
  lf.leave(); lf.skip();
  assert.equal(lf.phase, PHASES.IDLE);
  assert.equal(lf.blend, 0);
});

test('interrupting a transition eases continuously from the current blend (no snap)', () => {
  const lf = createLandfall({ landMs: 1000, leaveMs: 1000 });
  lf.land(); lf.step(0.4);
  const mid = lf.blend;                     // ~0.35 (eased)
  assert.ok(mid > 0 && mid < 1);
  assert.equal(lf.leave(), true);           // bail out mid-landing
  assert.equal(lf.blend, mid);             // starts the reverse from exactly where we were
  lf.step(1000);                           // run it out
  assert.equal(lf.blend, 0);
  assert.equal(lf.phase, PHASES.IDLE);
});

test('guards: land() is a no-op while landing/ashore; leave() a no-op while idle', () => {
  const lf = createLandfall({ landMs: 1000 });
  assert.equal(lf.leave(), false);          // nothing to leave from idle
  assert.equal(lf.land(), true);
  assert.equal(lf.land(), false);           // already landing
  lf.skip();
  assert.equal(lf.land(), false);           // already ashore
  assert.equal(lf.leave(), true);
});

test('reset() snaps deterministically back to idle (a fresh voyage starts under sail)', () => {
  const lf = createLandfall();
  lf.land(); lf.step(0.3);
  lf.reset();
  assert.equal(lf.phase, PHASES.IDLE);
  assert.equal(lf.blend, 0);
  assert.equal(lf.active, false);
  assert.equal(lf.townReady, false);
});

test('step is inert when idle and clamps non-finite dt (never NaNs the helm)', () => {
  const lf = createLandfall();
  lf.step(0.5); assert.equal(lf.blend, 0);
  lf.land();
  lf.step(NaN); assert.ok(Number.isFinite(lf.blend));
  lf.step(-5); assert.ok(lf.blend >= 0);    // negative dt never rewinds past 0
});
