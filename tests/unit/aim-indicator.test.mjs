import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aimReadout, beamGeometry,
  AIM_ON_TARGET, AIM_CLOSING, AIM_OFF,
  MIN_SPREAD_DEG, MAX_SPREAD_DEG,
} from '../../src/ui/aim-indicator.js';

// Aim-angle feedback (#161 slice 5). Two PURE cores are unit-tested here — the aim READOUT that
// classifies a broadsideAim reading into a legible on-target/closing/off band + a firing-cone spread,
// and the beam GEOMETRY that lays out the rotated aim-line bar between two screen points. Read-only:
// the aim MATHS (broadsideAim) is untouched; this only presents it.

// ---- aimReadout: the on-target classification ------------------------------------------------

test('aimReadout: a dead-abeam foe (inArc, quality 1) reads ON TARGET with the tightest spread', () => {
  const r = aimReadout({ quality: 1, inArc: true, side: 'starboard' });
  assert.equal(r.level, AIM_ON_TARGET);
  assert.equal(r.onTarget, true);
  assert.equal(r.spreadDeg, MIN_SPREAD_DEG); // dead abeam ⇒ the cone collapses to its tightest
  assert.equal(r.side, 'starboard');
  assert.match(r.label, /ON TARGET/);
});

test('aimReadout: a bow-on foe (out of arc, quality ~0) reads OFF TARGET with the widest spread', () => {
  const r = aimReadout({ quality: 0, inArc: false, side: 'port' });
  assert.equal(r.level, AIM_OFF);
  assert.equal(r.onTarget, false);
  assert.equal(r.spreadDeg, MAX_SPREAD_DEG); // bow-on ⇒ the guns can't bear, the cone is wide open
  assert.equal(r.side, 'port');
});

test('aimReadout: abeam vs bow-on — the on-target line is unmistakably tighter than the off one', () => {
  const abeam = aimReadout({ quality: 0.98, inArc: true });
  const bowOn = aimReadout({ quality: 0.05, inArc: false });
  assert.equal(abeam.onTarget, true);
  assert.equal(bowOn.onTarget, false);
  assert.ok(abeam.spreadDeg < bowOn.spreadDeg, 'coming abeam must visibly tighten the aim cone');
});

test('aimReadout: just below the arc reads CLOSING (amber), not OFF — the "keep coming" telegraph', () => {
  // arcThreshold default 0.5, closingBand default 0.18 ⇒ [0.32, 0.5) is the closing band.
  const r = aimReadout({ quality: 0.4, inArc: false });
  assert.equal(r.level, AIM_CLOSING);
  assert.equal(r.onTarget, false);
});

test('aimReadout: inArc always wins the on-target read regardless of a low reported quality', () => {
  // inArc is the maths' own verdict; the readout must mirror it, never contradict it.
  const r = aimReadout({ quality: 0.51, inArc: true });
  assert.equal(r.level, AIM_ON_TARGET);
});

test('aimReadout: a custom arcThreshold shifts the closing band with it', () => {
  const r = aimReadout({ quality: 0.6, inArc: false }, { arcThreshold: 0.8, closingBand: 0.25 });
  assert.equal(r.level, AIM_CLOSING); // 0.6 ≥ 0.8−0.25 ⇒ closing, not off
});

test('aimReadout: garbage/NaN quality clamps to a safe off-target read', () => {
  const r = aimReadout({ quality: NaN, inArc: false });
  assert.equal(r.quality, 0);
  assert.equal(r.level, AIM_OFF);
});

// ---- beamGeometry: the rotated aim-line bar layout -------------------------------------------

test('beamGeometry: a horizontal run has zero angle and the point-to-point width', () => {
  const g = beamGeometry({ x: 100, y: 200 }, { x: 340, y: 200 });
  assert.equal(g.left, 100);
  assert.equal(g.top, 200);
  assert.equal(g.width, 240);
  assert.equal(g.angleRad, 0);
  assert.equal(g.midX, 220);
  assert.equal(g.midY, 200);
});

test('beamGeometry: a foe below-right of the ship rotates the bar toward her', () => {
  const g = beamGeometry({ x: 0, y: 0 }, { x: 100, y: 100 });
  assert.ok(Math.abs(g.width - Math.hypot(100, 100)) < 1e-9);
  assert.ok(Math.abs(g.angleRad - Math.PI / 4) < 1e-9); // 45° down-right (screen y grows downward)
  assert.equal(g.midX, 50);
  assert.equal(g.midY, 50);
});

test('beamGeometry: missing/garbage points degrade to a zero-length bar at the origin', () => {
  const g = beamGeometry(null, undefined);
  assert.equal(g.width, 0);
  assert.equal(g.left, 0);
  assert.equal(g.top, 0);
});
