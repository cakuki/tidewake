// Unit: the day-night cycle's PURE palette (#58; #53 self-tested-component standard).
// No browser / three.js — dayNight(t) maps a normalised time-of-day to a sun direction +
// sky / ambient / sea colours. We assert the dawn/noon/dusk/night keyframes, smooth
// interpolation, seamless looping, and — the load-bearing guardrail — that the NOON keyframe
// equals the permanent sunny Caribbean constants (so OFF/default is byte-for-byte the sunny look).
import test from 'node:test';
import assert from 'node:assert/strict';
import { dayNight, SUNNY, NOON } from '../../src/daynight.js';

const norm = ([x, y, z]) => { const m = Math.hypot(x, y, z) || 1; return [x / m, y / m, z / m]; };
const closeArr = (a, b, eps = 1e-9) => a.every((v, i) => Math.abs(v - b[i]) <= eps);

test('NOON keyframe is EXACTLY the sunny Caribbean look (OFF/default invariant)', () => {
  const p = dayNight(NOON);
  // Colours match the sunny constants byte-for-byte (the default look must never drift).
  assert.equal(p.sunColor, SUNNY.sunColor);
  assert.equal(p.sunIntensity, SUNNY.sunIntensity);
  assert.equal(p.hemiSky, SUNNY.hemiSky);
  assert.equal(p.hemiGround, SUNNY.hemiGround);
  assert.equal(p.hemiIntensity, SUNNY.hemiIntensity);
  assert.equal(p.haze, SUNNY.haze);
  assert.equal(p.skyTop, SUNNY.skyTop);
  assert.equal(p.skyBottom, SUNNY.skyBottom);
  assert.equal(p.seaShallow, SUNNY.seaShallow);
  assert.equal(p.seaDeep, SUNNY.seaDeep);
  assert.equal(p.seaPaper, SUNNY.seaPaper);
  // Sun points where the sunny default points (high overhead), as a unit vector.
  assert.ok(closeArr(p.sun, norm(SUNNY.sun)));
  assert.ok(Math.abs(Math.hypot(...p.sun) - 1) < 1e-9, 'sun is a unit direction');
});

test('sun arcs: highest at noon, low at dawn and dusk, a moon at night', () => {
  const noon = dayNight(0.5).sun;
  const dawn = dayNight(0.25).sun;
  const dusk = dayNight(0.83).sun;
  const night = dayNight(0.0).sun;
  assert.ok(noon[1] > dawn[1], 'noon sun is higher than dawn');
  assert.ok(noon[1] > dusk[1], 'noon sun is higher than dusk');
  assert.ok(dawn[1] > 0 && dawn[1] < 0.4, 'dawn sun rides low on the horizon');
  assert.ok(dusk[1] > 0 && dusk[1] < 0.4, 'dusk sun rides low on the horizon');
  assert.ok(night[1] > 0, 'a soft moon still lights the night (never pitch black)');
  // Sun crosses the sky: rises in the east (+x at dawn) and sets in the west (-x at dusk).
  assert.ok(dawn[0] > 0, 'dawn sun is to the east (+x)');
  assert.ok(dusk[0] < 0, 'dusk sun has crossed to the west (-x)');
});

test('night stays a soft moonlit blue, never gloomy black', () => {
  const n = dayNight(0.0);
  assert.ok(n.sunIntensity > 0.2, 'the moon still casts light');
  assert.ok(n.sunIntensity < SUNNY.sunIntensity, 'night is dimmer than noon');
  assert.ok(n.hemiIntensity > 0.2, 'ambient never collapses to black');
  // The night haze is a real blue, not (near-)black.
  const lum = (n.haze >> 16 & 255) + (n.haze >> 8 & 255) + (n.haze & 255);
  assert.ok(lum > 120, `night haze is not gloomy-black (lum=${lum})`);
});

test('smooth interpolation between keyframes (noon → golden)', () => {
  const noon = dayNight(0.50);
  const golden = dayNight(0.70);
  const mid = dayNight(0.60);
  // The mid sun intensity sits strictly between the two keyframes (monotone, smooth ramp).
  const lo = Math.min(noon.sunIntensity, golden.sunIntensity);
  const hi = Math.max(noon.sunIntensity, golden.sunIntensity);
  assert.ok(mid.sunIntensity > lo && mid.sunIntensity < hi, 'sun intensity eases between keyframes');
  // Tiny steps produce tiny changes — no jumps/strobing.
  const a = dayNight(0.600), b = dayNight(0.601);
  assert.ok(Math.abs(a.sunIntensity - b.sunIntensity) < 0.05, 'palette changes continuously');
});

test('the cycle loops seamlessly (t wraps mod 1)', () => {
  assert.deepEqual(dayNight(0.0), dayNight(1.0));
  assert.deepEqual(dayNight(0.0), dayNight(2.0));
  assert.deepEqual(dayNight(0.3), dayNight(1.3));
  // Negative time wraps too (defensive).
  assert.deepEqual(dayNight(-0.25), dayNight(0.75));
  // Continuity across the wrap seam (dusk → night): a hair before 1.0 ≈ a hair after 0.0.
  const before = dayNight(0.999), after = dayNight(0.001);
  assert.ok(Math.abs(before.sunIntensity - after.sunIntensity) < 0.05, 'no discontinuity at the loop seam');
});

test('every palette field is well-formed at any time of day', () => {
  for (let t = 0; t < 1; t += 0.05) {
    const p = dayNight(t);
    for (const key of ['sunColor', 'hemiSky', 'hemiGround', 'haze', 'skyTop', 'skyBottom', 'seaShallow', 'seaDeep', 'seaPaper']) {
      assert.ok(Number.isInteger(p[key]) && p[key] >= 0 && p[key] <= 0xffffff, `${key} is a valid colour at t=${t.toFixed(2)}`);
    }
    assert.ok(p.sunIntensity > 0 && p.hemiIntensity > 0, `lights stay positive at t=${t.toFixed(2)}`);
    assert.ok(Math.abs(Math.hypot(...p.sun) - 1) < 1e-9, `sun is a unit vector at t=${t.toFixed(2)}`);
  }
});
