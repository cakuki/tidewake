// Reputation needle (#132, DL #5) — the pole made personal & audible.
// The spine is the Infamy↔Standing pole; this slice makes a change FELT (needle swing + sting +
// a line about who you're becoming). We assert the PURE core: the needle target (signed, deadzoned
// like #126), the shift detector (delta → pole/tier/cue/line), the tier buckets, the gauge angle,
// the line rotation, and the frame-rate-independent easing — all browser-free under node:test.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  needleTarget, needlePole, needleTier, needleAngle, ackLine,
  reputationShift, easeNeedle,
  BALANCE_BAND, TIER_STIR, TIER_KNOWN, NEEDLE_MAX_DEG, ACK_LINES,
} from '../../src/systems/reputation-needle.js';

// ---- needleTarget: signed, deadzoned, bounded ------------------------------------------------

test('no legend → needle centred (neutral default)', () => {
  assert.equal(needleTarget(0, 0), 0);
  assert.equal(needleTarget(undefined, undefined), 0);
  assert.equal(needleTarget(NaN, -10), 0);
  assert.equal(needlePole(0), 'neutral');
});

test('a balanced ledger reads neutral — the 60/40 deadzone mirrors #126', () => {
  assert.equal(needleTarget(55, 45), 0); // |tilt| 0.1 < band
  assert.equal(needleTarget(60, 40), 0); // exactly at the band edge
  assert.ok(needleTarget(70, 30) > 0);   // past the band → leans pirate
});

test('infamy dominant → positive (pirate); standing dominant → negative (governor)', () => {
  assert.ok(needleTarget(100, 0) > 0);
  assert.ok(needleTarget(0, 100) < 0);
  assert.equal(needlePole(needleTarget(100, 0)), 'pirate');
  assert.equal(needlePole(needleTarget(0, 100)), 'governor');
});

test('needle is bounded to [-1, 1] and reaches the pole at full commitment', () => {
  const pirate = needleTarget(1000, 0);
  const gov = needleTarget(0, 1000);
  assert.ok(pirate > 0 && pirate <= 1);
  assert.ok(gov < 0 && gov >= -1);
  assert.ok(pirate > 0.99); // pure infamy → essentially pinned to the pole
});

test('needle is symmetric in the two poles', () => {
  assert.ok(Math.abs(needleTarget(90, 10) + needleTarget(10, 90)) < 1e-12);
});

test('needle magnitude grows monotonically as you commit harder', () => {
  const a = needleTarget(70, 30);
  const b = needleTarget(85, 15);
  const c = needleTarget(100, 0);
  assert.ok(a < b && b < c);
});

// ---- tiers + gauge angle ---------------------------------------------------------------------

test('needleTier buckets by commitment, both signs', () => {
  assert.equal(needleTier(0), 0);
  assert.equal(needleTier(0.2), 0);
  assert.equal(needleTier(TIER_STIR), 1);
  assert.equal(needleTier(-0.5), 1);
  assert.equal(needleTier(TIER_KNOWN), 2);
  assert.equal(needleTier(-1), 2);
});

test('needleAngle maps [-1,1] onto the gauge sweep, clamped', () => {
  assert.equal(needleAngle(0), 0);
  assert.equal(needleAngle(1), NEEDLE_MAX_DEG);
  assert.equal(needleAngle(-1), -NEEDLE_MAX_DEG);
  assert.equal(needleAngle(5), NEEDLE_MAX_DEG);   // clamped
  assert.equal(needleAngle(-5), -NEEDLE_MAX_DEG); // clamped
  assert.equal(needleAngle(NaN), 0);
});

// ---- acknowledgement lines -------------------------------------------------------------------

test('ackLine returns a non-empty line for each pole + tier, rotating by seen', () => {
  for (const pole of ['pirate', 'governor']) {
    for (let tier = 0; tier <= 2; tier++) {
      const pool = ACK_LINES[pole][tier];
      assert.equal(ackLine(pole, tier, 0), pool[0]);
      assert.equal(ackLine(pole, tier, 1), pool[1 % pool.length]);
      assert.equal(ackLine(pole, tier, pool.length), pool[0]); // wraps
      assert.ok(ackLine(pole, tier, 0).length > 0);
    }
  }
});

test('ackLine clamps a bad tier and a negative seen safely', () => {
  assert.equal(ackLine('pirate', 9, 0), ACK_LINES.pirate[2][0]);
  assert.equal(ackLine('pirate', -1, 0), ACK_LINES.pirate[0][0]);
  assert.equal(ackLine('pirate', 0, -1), ACK_LINES.pirate[0][ACK_LINES.pirate[0].length - 1]);
  assert.equal(ackLine('nonsense', 0, 0), '');
});

// ---- reputationShift: the felt-change detector -----------------------------------------------

test('no change → null (a sale that only moved coin, a no-op frame)', () => {
  assert.equal(reputationShift({ infamy: 50, standing: 20 }, { infamy: 50, standing: 20 }), null);
  assert.equal(reputationShift(null, null), null);
});

test('a loss never fires a positive shift', () => {
  assert.equal(reputationShift({ infamy: 50, standing: 50 }, { infamy: 50, standing: 30 }), null);
});

test('an infamy gain (a kill) reads a pirate shift with the new needle target', () => {
  const s = reputationShift({ infamy: 0, standing: 0 }, { infamy: 120, standing: 0 });
  assert.ok(s);
  assert.equal(s.pole, 'pirate');
  assert.equal(s.delta, 120);
  assert.ok(s.target > 0);
  assert.equal(s.cue, 'rep-pirate');
  assert.ok(s.line.length > 0);
});

test('a standing gain (a rescue / trade / investment) reads a governor shift', () => {
  const s = reputationShift({ infamy: 10, standing: 0 }, { infamy: 10, standing: 200 });
  assert.ok(s);
  assert.equal(s.pole, 'governor');
  assert.equal(s.delta, 200);
  assert.ok(s.target < 0);
  assert.equal(s.cue, 'rep-governor');
});

test('the gain is attributed to whichever pole rose more this step', () => {
  // both grew, infamy more → pirate
  const a = reputationShift({ infamy: 0, standing: 0 }, { infamy: 100, standing: 30 });
  assert.equal(a.pole, 'pirate');
  assert.equal(a.delta, 100);
  // both grew, standing more → governor
  const b = reputationShift({ infamy: 0, standing: 0 }, { infamy: 30, standing: 100 });
  assert.equal(b.pole, 'governor');
  assert.equal(b.delta, 100);
});

test('shift tier tracks the resulting commitment, and the line matches', () => {
  const s = reputationShift({ infamy: 0, standing: 0 }, { infamy: 1000, standing: 0 }, 0);
  assert.equal(s.tier, 2);
  assert.equal(s.line, ACK_LINES.pirate[2][0]);
});

test('junk/negative ledgers are coerced, never throw', () => {
  const s = reputationShift({ infamy: NaN, standing: undefined }, { infamy: 80, standing: -5 });
  assert.ok(s);
  assert.equal(s.pole, 'pirate');
  assert.equal(s.delta, 80);
});

// ---- easeNeedle: frame-rate-independent smoothing --------------------------------------------

test('easeNeedle moves toward the target and never overshoots', () => {
  const a = easeNeedle(0, 1, 1 / 60);
  assert.ok(a > 0 && a < 1);
  const b = easeNeedle(0, -1, 1 / 60);
  assert.ok(b < 0 && b > -1);
});

test('easeNeedle converges to the target over time and snaps when close', () => {
  let p = 0;
  for (let i = 0; i < 600; i++) p = easeNeedle(p, 1, 1 / 60);
  assert.equal(p, 1); // snapped exactly to target
});

test('easeNeedle is ~frame-rate independent (one 1/30 step ≈ two 1/60 steps)', () => {
  const big = easeNeedle(0, 1, 1 / 30);
  let small = 0;
  small = easeNeedle(small, 1, 1 / 60);
  small = easeNeedle(small, 1, 1 / 60);
  assert.ok(Math.abs(big - small) < 1e-9);
});

test('easeNeedle tolerates junk dt / values', () => {
  assert.equal(easeNeedle(NaN, 1, NaN), 0);        // junk current+dt → starts at 0, no move
  assert.equal(easeNeedle(0.5, 0.5, 1 / 60), 0.5); // already there
  assert.equal(easeNeedle(0, 1, 0), 0);            // dt 0 → no movement
});
