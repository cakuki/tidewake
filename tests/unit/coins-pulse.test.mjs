import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createCoinsPulse, classifyDelta, formatDelta, pulseEnvelope,
  PULSE_SECONDS, PULSE_SCALE,
} from '../../src/systems/coins-pulse.js';

// ---- PURE helpers -----------------------------------------------------------

test('classifyDelta: gain > 0, spend < 0, none for 0 / non-finite', () => {
  assert.equal(classifyDelta(400), 'gain');
  assert.equal(classifyDelta(1), 'gain');
  assert.equal(classifyDelta(-250), 'spend');
  assert.equal(classifyDelta(-1), 'spend');
  assert.equal(classifyDelta(0), 'none', 'no change never pulses');
  assert.equal(classifyDelta(NaN), 'none');
  assert.equal(classifyDelta(Infinity), 'none');
});

test('formatDelta: signed, real minus sign, rounded, "0" for no change', () => {
  assert.equal(formatDelta(400), '+400');
  assert.equal(formatDelta(1), '+1');
  assert.equal(formatDelta(-250), '−250'); // U+2212 MINUS SIGN, not a hyphen
  assert.equal(formatDelta(-250).charCodeAt(0), 0x2212, 'a real minus sign, reads as maths');
  assert.equal(formatDelta(0), '0');
  assert.equal(formatDelta(399.6), '+400', 'rounded to whole coins');
  assert.equal(formatDelta(-0.4), '0', 'rounds to no-change');
});

test('pulseEnvelope: FULL at the instant of change, eases to 0 by duration', () => {
  assert.equal(pulseEnvelope(0, PULSE_SECONDS), 1, 'snaps to full at the change');
  assert.equal(pulseEnvelope(PULSE_SECONDS, PULSE_SECONDS), 0, 'spent exactly at duration');
  assert.equal(pulseEnvelope(PULSE_SECONDS + 1, PULSE_SECONDS), 0, 'spent past duration');
  const a = pulseEnvelope(PULSE_SECONDS * 0.2, PULSE_SECONDS);
  const b = pulseEnvelope(PULSE_SECONDS * 0.6, PULSE_SECONDS);
  assert.ok(a > b && b > 0, 'strictly easing out while live');
});

// ---- Controller: change detection ------------------------------------------

test('observe: first call seeds silently — no pop on load', () => {
  const cp = createCoinsPulse();
  const r = cp.observe(100);
  assert.equal(r.changed, false, 'the initial coin total does not pop');
  assert.equal(r.kind, null);
  assert.equal(cp.active(), false);
  assert.equal(cp.deltaText(), '');
});

test('observe: a GAIN pops green with the delta shown + chime kind "gain"', () => {
  const cp = createCoinsPulse();
  cp.observe(100);                 // seed
  const r = cp.observe(500);       // +400 — claim a bounty
  assert.equal(r.changed, true);
  assert.equal(r.kind, 'gain', 'a gain rings the "gain" chime');
  assert.equal(r.delta, 400);
  assert.equal(cp.active(), true, 'the readout pops');
  assert.equal(cp.tint(), 'gain', 'green');
  assert.equal(cp.deltaText(), '+400', 'the delta is legible');
  assert.ok(cp.scale() > 1 && cp.scale() <= 1 + PULSE_SCALE + 1e-9, 'the number swells within the cap');
  assert.ok(cp.level() >= 0 && cp.level() <= 1);
});

test('observe: a SPEND pops red with the delta shown + chime kind "spend"', () => {
  const cp = createCoinsPulse();
  cp.observe(500);                 // seed
  const r = cp.observe(250);       // −250 — buy a cannon
  assert.equal(r.changed, true);
  assert.equal(r.kind, 'spend', 'a spend ticks the "spend" chime');
  assert.equal(r.delta, -250);
  assert.equal(cp.tint(), 'spend', 'red');
  assert.equal(cp.deltaText(), '−250', 'the delta is legible');
});

test('observe: NO change is silent — never pulses every frame', () => {
  const cp = createCoinsPulse();
  cp.observe(300);                 // seed
  for (let i = 0; i < 10; i++) {
    const r = cp.observe(300);     // same value, frame after frame
    assert.equal(r.changed, false, 'a steady total never fires');
    assert.equal(r.kind, null);
    assert.equal(cp.active(), false, 'the readout stays at rest');
  }
});

test('update: the pop ages out and the readout returns to rest', () => {
  const cp = createCoinsPulse();
  cp.observe(0);
  cp.observe(1000);
  assert.equal(cp.active(), true);
  cp.update(PULSE_SECONDS * 0.5);
  assert.equal(cp.active(), true, 'still popping mid-window');
  cp.update(PULSE_SECONDS); // drain past the end
  assert.equal(cp.active(), false, 'spent');
  assert.equal(cp.scale(), 1, 'back to rest scale');
  assert.equal(cp.level(), 0);
  assert.equal(cp.deltaText(), '');
});

// ---- Suppression: reduced-motion + the runtime toggle -----------------------

test('reduced-motion: a change still CLASSIFIES (chime) but the visual pop is suppressed', () => {
  const cp = createCoinsPulse({ reducedMotion: true });
  cp.observe(100);
  const r = cp.observe(700); // +600
  assert.equal(r.changed, true, 'the change is still detected');
  assert.equal(r.kind, 'gain', 'the gentle chime can still play');
  assert.equal(r.delta, 600);
  assert.equal(cp.active(), false, 'but NO visual motion under reduced-motion');
  assert.equal(cp.scale(), 1, 'the number does not swell');
  assert.equal(cp.level(), 0);
  assert.equal(cp.deltaText(), '');
});

test('setEnabled(false): suppresses the pop AND clears a live one with no residual motion', () => {
  const cp = createCoinsPulse();
  cp.observe(0);
  cp.observe(200);
  assert.equal(cp.active(), true);
  cp.setEnabled(false);
  assert.equal(cp.active(), false, 'toggling off clears the live pop');
  assert.equal(cp.scale(), 1, 'no residual scale');
  const r = cp.observe(400); // still classifies for the chime…
  assert.equal(r.changed, true);
  assert.equal(r.kind, 'gain');
  assert.equal(cp.active(), false, '…but no visual pop while off');
});

test('suppressed observe still CONSUMES the value — a re-enable never fires a stale delta', () => {
  const cp = createCoinsPulse({ reducedMotion: true });
  cp.observe(100);
  cp.observe(900);            // consumed silently (visual suppressed)
  const cp2 = createCoinsPulse();
  cp2.observe(100); cp2.observe(900); cp2.setEnabled(false); cp2.observe(50); cp2.setEnabled(true);
  const r = cp2.observe(50); // same value after re-enable → no stale pop
  assert.equal(r.changed, false, 'no change ⇒ no pop after re-enable');
  assert.equal(cp2.active(), false);
});

test('snapshot: a JSON-safe read the headless gate can assert on', () => {
  const cp = createCoinsPulse();
  cp.observe(100);
  cp.observe(500);
  const s = cp.snapshot();
  assert.equal(s.active, true);
  assert.equal(s.kind, 'gain');
  assert.equal(s.delta, 400);
  assert.equal(s.deltaText, '+400');
  assert.ok(s.scale > 1);
  assert.equal(s.reducedMotion, false);
  assert.equal(s.enabled, true);
  assert.equal(JSON.parse(JSON.stringify(s)).kind, 'gain', 'plain + serialisable');
});
