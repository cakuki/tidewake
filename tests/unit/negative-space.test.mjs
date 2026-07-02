// #179 — Negative space: the held breath before the payoff.
//
// TDD for the PURE hush/swell/pulse envelope timing + the createNegativeSpace controller. The whole
// point is deterministic, bounded, headless-testable game-feel that makes ALREADY-SHIPPED climaxes
// land bigger — a beat of near-silence before a surrender sting (a), a rising swell before a rank-up
// thunk (b), a colour-grade flare on a big win (c). It reuses the #80 juice envelope machinery
// (flashEnvelope) and mirrors the #80 doctrine: bounded, auto-resuming, and fully suppressed by the
// Combat-feel toggle / prefers-reduced-motion. It NEVER touches the sim clock (audio/visual only).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hushGain,
  swellRise,
  pulseEnvelope,
  createNegativeSpace,
  HUSH_SECONDS,
  HUSH_FLOOR,
  SWELL_SECONDS,
  MAX_PULSE,
} from '../../src/systems/negative-space.js';

// ---- hushGain: the anticipatory audio-duck curve -------------------------------------------

test('hushGain: full gain (1) outside the window — before, at, and past it', () => {
  assert.equal(hushGain(-0.1, 0.6), 1);   // negative elapsed → no duck
  assert.equal(hushGain(0.6, 0.6), 1);    // at the release → back to full (the sting cracks in)
  assert.equal(hushGain(2, 0.6), 1);      // long past → full
  assert.equal(hushGain(0.3, 0), 1);      // zero-length window → no duck
});

test('hushGain: ducks DOWN to the floor and HOLDS there — a held breath', () => {
  const start = hushGain(0, 0.6);         // right at the strike: still ~full, ducking begins
  const mid = hushGain(0.3, 0.6);         // deep in the hold
  assert.ok(start > mid, 'the duck should fall from ~full toward the floor');
  assert.ok(Math.abs(mid - HUSH_FLOOR) < 1e-9, 'the middle of the window holds at the floor');
});

test('hushGain: always bounded to [floor, 1]', () => {
  for (let e = 0; e < 0.6; e += 0.017) {
    const g = hushGain(e, 0.6);
    assert.ok(g >= HUSH_FLOOR - 1e-9 && g <= 1 + 1e-9, `duck ${g} out of [${HUSH_FLOOR},1] at ${e}`);
  }
});

test('hushGain: never fully silent — the floor is a hush, not a mute', () => {
  assert.ok(HUSH_FLOOR > 0, 'the hush floor must be > 0 (near-silence, never a dead mute)');
});

// ---- swellRise: the rank-up rising build ---------------------------------------------------

test('swellRise: 0 at the start, 1 at (and past) the release', () => {
  assert.equal(swellRise(0, 0.8), 0);
  assert.equal(swellRise(0.8, 0.8), 1);
  assert.equal(swellRise(3, 0.8), 1);
  assert.equal(swellRise(-1, 0.8), 0);
});

test('swellRise: rises monotonically across the window (tension loads)', () => {
  let prev = -1;
  for (let e = 0; e <= 0.8; e += 0.02) {
    const v = swellRise(e, 0.8);
    assert.ok(v >= prev - 1e-9, `swell should not fall (was ${prev}, now ${v} at ${e})`);
    assert.ok(v >= 0 && v <= 1, `swell ${v} out of [0,1]`);
    prev = v;
  }
});

test('swellRise: ease-IN (slow start) — the front half gains less than the back half', () => {
  const q = swellRise(0.4, 0.8);          // the midpoint
  assert.ok(q < 0.5, 'a t^2 build sits below the linear midpoint (tension back-loads to the thunk)');
});

// ---- pulseEnvelope: the colour-grade flare (reuses the #80 flash shape) ---------------------

test('pulseEnvelope: 0 outside the window, a bounded flare within', () => {
  assert.equal(pulseEnvelope(-0.1, 0.7), 0);
  assert.equal(pulseEnvelope(0.7, 0.7), 0);
  const peak = pulseEnvelope(0.16, 0.7);
  assert.ok(peak > 0 && peak <= 1, 'the flare peaks within (0,1]');
});

// ---- createNegativeSpace: the controller ---------------------------------------------------

test('anticipate: opens a HUSH (ducks the audio) and DEFERS the sting until the window elapses', () => {
  const ns = createNegativeSpace();
  let stung = 0;
  ns.anticipate(() => { stung++; });
  assert.equal(stung, 0, 'the sting must NOT fire immediately — the hush comes first');
  assert.ok(ns.snapshot().hush, 'a hush is live');
  ns.consume(1 / 60);                     // one frame in, the duck has begun to fall
  assert.ok(ns.audioDuck() < 1, 'the combat audio ducks during the hush');
  // Drain a little more — still within the window, still ducked, sting still held.
  ns.consume(HUSH_SECONDS * 0.5);
  assert.equal(stung, 0, 'still held mid-hush');
  assert.ok(ns.audioDuck() < 1, 'still ducked mid-hush');
  // Drain past the window — the sting cracks exactly once, the duck releases.
  ns.consume(HUSH_SECONDS);
  assert.equal(stung, 1, 'the sting fires exactly once at the release');
  assert.equal(ns.audioDuck(), 1, 'the duck fully releases after the hush');
  assert.equal(ns.snapshot().hush, false, 'the hush cleared');
});

test('anticipate: BOUNDED + auto-resumes — a huge frame gap still releases in one step', () => {
  const ns = createNegativeSpace();
  let stung = 0;
  ns.anticipate(() => { stung++; });
  ns.consume(999);                        // a monster stall (tab blur) — must not hang, just release
  assert.equal(stung, 1, 'a huge dt releases the sting once, not never and not twice');
  assert.equal(ns.audioDuck(), 1);
  assert.equal(ns.active(), false);
});

test('charge: opens a rising SWELL + a grade pulse and DEFERS the thunk to the release', () => {
  const ns = createNegativeSpace();
  let thunk = 0;
  ns.charge(() => { thunk++; });
  assert.equal(thunk, 0, 'the thunk waits for the swell to build');
  assert.ok(ns.snapshot().swell, 'a swell is live');
  assert.ok(ns.snapshot().pulse, 'the colour-grade pulse rides the same beat');
  const early = ns.swellLevel();
  ns.consume(SWELL_SECONDS * 0.6);
  assert.ok(ns.swellLevel() > early, 'the swell keeps rising');
  assert.equal(thunk, 0, 'still building');
  ns.consume(SWELL_SECONDS);
  assert.equal(thunk, 1, 'the bass thunk releases exactly once');
  assert.equal(ns.snapshot().swell, false, 'the swell cleared');
});

test('gradeLevel: bounded by MAX_PULSE and decays back to 0', () => {
  const ns = createNegativeSpace();
  ns.charge(() => {});
  let sawFlare = false;
  for (let i = 0; i < 60; i++) {
    const g = ns.gradeLevel();
    assert.ok(g >= 0 && g <= MAX_PULSE + 1e-9, `grade ${g} out of [0,${MAX_PULSE}]`);
    if (g > 0) sawFlare = true;
    ns.consume(1 / 60);
  }
  assert.ok(sawFlare, 'the colour-grade actually flared');
  assert.equal(ns.gradeLevel(), 0, 'the grade pulse decays fully back to 0');
});

test('a fresh anticipation never swallows a pending sting (no lost payoff)', () => {
  const ns = createNegativeSpace();
  let a = 0, b = 0;
  ns.anticipate(() => { a++; });
  ns.anticipate(() => { b++; });          // a second strike before the first released
  assert.equal(a, 1, 'the first sting is flushed immediately, never lost');
  ns.consume(HUSH_SECONDS);
  assert.equal(b, 1, 'the second sting still lands');
});

// ---- suppression: the Combat-feel toggle + prefers-reduced-motion --------------------------

test('toggle OFF: the payoff fires IMMEDIATELY (no hush/swell), and nothing ducks or flares', () => {
  const ns = createNegativeSpace({ enabled: false });
  let stung = 0, thunk = 0;
  ns.anticipate(() => { stung++; });
  ns.charge(() => { thunk++; });
  assert.equal(stung, 1, 'with the beat off the surrender sting still plays — at once');
  assert.equal(thunk, 1, 'with the beat off the rank-up thunk still plays — at once');
  assert.equal(ns.audioDuck(), 1, 'no duck when suppressed');
  assert.equal(ns.swellLevel(), 0, 'no swell when suppressed');
  assert.equal(ns.gradeLevel(), 0, 'no grade pulse when suppressed');
  assert.equal(ns.active(), false, 'nothing is live when suppressed');
});

test('reduced-motion: same suppression, and it cannot be toggled back on', () => {
  const ns = createNegativeSpace({ reducedMotion: true });
  let stung = 0;
  ns.setEnabled(true);                    // the runtime toggle cannot override the accessibility off
  ns.anticipate(() => { stung++; });
  assert.equal(stung, 1, 'reduced-motion fires the payoff immediately, no hush');
  assert.equal(ns.audioDuck(), 1);
  assert.equal(ns.snapshot().hush, false);
});

test('setEnabled(false) mid-hush flushes the pending sting and clears every beat', () => {
  const ns = createNegativeSpace();
  let stung = 0;
  ns.anticipate(() => { stung++; });
  ns.charge(() => {});
  assert.ok(ns.active(), 'beats are live');
  ns.setEnabled(false);
  assert.equal(stung, 1, 'turning the beat off never loses the pending surrender sting');
  assert.equal(ns.active(), false, 'all beats cleared on toggle-off');
  assert.equal(ns.audioDuck(), 1, 'no residual duck');
});

test('the controller owns NO sim freeze — audioDuck/swell/grade are the only outputs', () => {
  const ns = createNegativeSpace();
  ns.anticipate(() => {});
  ns.charge(() => {});
  const snap = ns.snapshot();
  // A negative-space beat is audio/visual only; there is no hit-stop-style field that could zero
  // the sim dt. The presence of these three (and nothing sim-coupled) is the guarantee.
  assert.ok('audioDuck' in snap && 'swellLevel' in snap && 'gradeLevel' in snap);
  assert.ok(!('hitStop' in snap) && !('timeDilation' in snap), 'never owes a sim freeze');
});
