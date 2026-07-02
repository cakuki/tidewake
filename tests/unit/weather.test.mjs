// Unit: the optional weather layer's PURE logic (#88; #53 self-tested-component standard).
// No browser / three.js — weather(phase) maps a seeded weather-cycle phase to a readable state
// (clear → clouds → squall → clearing) plus cloud / rain / darken / flash intensities, and
// applyWeather(base, w) darkens a day-night palette toward a storm mood. The load-bearing
// guardrail: weather(0) is CLEAR with all-zero intensities, and applyWeather(base, clear)
// returns the base BYTE-FOR-BYTE — so the toggle OFF / clear default is today's sky, untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weather, applyWeather } from '../../src/weather.js';
import { dayNight, SUNNY, NOON } from '../../src/daynight.js';

test('CLEAR is the sacred default: weather(0) is all-zero, key "clear"', () => {
  const w = weather(0);
  assert.equal(w.key, 'clear');
  assert.equal(w.cloud, 0);
  assert.equal(w.rain, 0);
  assert.equal(w.darken, 0);
  assert.equal(w.flash, 0);
});

test('applyWeather(base, clear) === base BYTE-FOR-BYTE (OFF/clear invariant)', () => {
  const base = dayNight(NOON); // the sunny Caribbean look
  const out = applyWeather(base, weather(0));
  for (const key of ['sunColor', 'sunIntensity', 'hemiSky', 'hemiGround', 'hemiIntensity',
    'haze', 'skyTop', 'skyBottom', 'seaShallow', 'seaDeep', 'seaPaper']) {
    assert.equal(out[key], base[key], `${key} must be untouched when clear`);
  }
  assert.deepEqual(out.sun, base.sun);
});

test('the cycle progresses deterministically through its states', () => {
  // Seeded/pure: the same phase always yields the same state — this is what the gate asserts.
  assert.equal(weather(0.00).key, 'clear');
  assert.equal(weather(0.30).key, 'clouds');
  assert.equal(weather(0.50).key, 'squall');
  assert.equal(weather(0.72).key, 'clearing');
  assert.equal(weather(0.95).key, 'clear');
  // Determinism: re-evaluating a phase returns an identical snapshot.
  assert.deepEqual(weather(0.5), weather(0.5));
  assert.deepEqual(weather(0.37), weather(0.37));
});

test('the storm is the heaviest beat: cloud/rain/darken peak in the squall', () => {
  const clear = weather(0.0), clouds = weather(0.30), squall = weather(0.50);
  assert.ok(clouds.cloud > clear.cloud, 'clouds gather before the storm');
  assert.ok(clouds.rain < 0.01, 'no meaningful rain yet while clouds only gather');
  assert.ok(squall.cloud > clouds.cloud, 'the squall is fully overcast');
  assert.ok(squall.rain > 0.5, 'the squall brings real rain');
  assert.ok(squall.darken > clouds.darken && squall.darken > 0.35, 'the squall greys the world');
});

test('intensities stay well-formed and bounded across the whole cycle', () => {
  for (let t = 0; t < 1; t += 0.02) {
    const w = weather(t);
    for (const k of ['cloud', 'rain', 'darken', 'flash']) {
      assert.ok(Number.isFinite(w[k]) && w[k] >= 0 && w[k] <= 1, `${k} in [0,1] at t=${t.toFixed(2)}`);
    }
    assert.ok(['clear', 'clouds', 'squall', 'clearing'].includes(w.key), `valid key at t=${t.toFixed(2)}`);
  }
});

test('the cycle wraps seamlessly (phase mod 1)', () => {
  assert.deepEqual(weather(0.0), weather(1.0));
  assert.deepEqual(weather(0.3), weather(1.3));
  assert.deepEqual(weather(-0.5), weather(0.5)); // negative wraps (defensive)
  // Continuity across the wrap seam (clearing → clear): a hair before 1 ≈ a hair after 0.
  const before = weather(0.999), after = weather(0.001);
  assert.ok(Math.abs(before.darken - after.darken) < 0.05, 'no discontinuity at the loop seam');
});

test('the distant lightning flash fires ONLY in the storm, never in fair weather', () => {
  // No flash while it is clear or merely cloudy (darken is low).
  for (const t of [0.0, 0.1, 0.2, 0.28, 0.85, 0.95]) {
    assert.equal(weather(t).flash, 0, `no lightning in fair weather at t=${t}`);
  }
  // Somewhere in the squall band the sky flashes (deterministic pulses).
  let sawFlash = false;
  for (let t = 0.42; t < 0.60; t += 0.001) if (weather(t).flash > 0) { sawFlash = true; break; }
  assert.ok(sawFlash, 'the storm throws at least one distant flash');
});

test('applyWeather greys the palette and dims the light as the storm deepens', () => {
  const base = dayNight(NOON);
  const stormy = applyWeather(base, weather(0.50));
  assert.ok(stormy.sunIntensity < base.sunIntensity, 'the storm dims the sun');
  assert.ok(stormy.hemiIntensity < base.hemiIntensity, 'the storm dims the ambient fill');
  // The sea greys toward the storm slate (luminance drops from the luminous turquoise default).
  const lum = (h) => (h >> 16 & 255) + (h >> 8 & 255) + (h & 255);
  assert.ok(lum(stormy.seaShallow) < lum(base.seaShallow), 'the squall greys the sea');
  assert.ok(lum(stormy.haze) < lum(base.haze), 'the squall greys the haze');
  // Every field stays a valid packed colour.
  for (const k of ['sunColor', 'hemiSky', 'haze', 'skyTop', 'skyBottom', 'seaShallow', 'seaDeep', 'seaPaper']) {
    assert.ok(Number.isInteger(stormy[k]) && stormy[k] >= 0 && stormy[k] <= 0xffffff, `${k} valid`);
  }
  assert.ok(stormy.sunIntensity > 0 && stormy.hemiIntensity > 0, 'lights never collapse to black');
});

test('a lightning flash briefly LIFTS the light above the dimmed storm level', () => {
  const base = dayNight(NOON);
  // Find a flashing squall phase, compare its lit level to a non-flash squall phase.
  let flashPhase = null;
  for (let t = 0.42; t < 0.60; t += 0.001) if (weather(t).flash > 0.3) { flashPhase = t; break; }
  assert.ok(flashPhase != null, 'found a strong flash phase');
  const lit = applyWeather(base, weather(flashPhase));
  const dim = applyWeather(base, { ...weather(flashPhase), flash: 0 });
  assert.ok(lit.sunIntensity > dim.sunIntensity, 'the flash momentarily brightens the scene');
});
