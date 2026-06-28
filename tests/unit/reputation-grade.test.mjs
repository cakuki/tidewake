// Reputation-reactive world grade (#126, DL #4) — pure pole→grade mapping.
// The game's spine is the Infamy↔Standing pole; this makes it VISIBLE. We assert the lean math
// (neutral default, signed poles, deadzone, easing, bounds) and the colour eases (cooler when
// infamous, warmer when lawful, untouched when neutral) — all PURE, so node:test proves them.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reputationLean, leanPole, gradeHaze, gradeSun, gradeSunKey,
  MAX_LEAN, PIRATE_HAZE, GOVERNOR_HAZE,
} from '../../src/systems/reputation-grade.js';

const chan = (hex, shift) => (hex >> shift) & 0xff;
const R = (h) => chan(h, 16), G = (h) => chan(h, 8), B = (h) => h & 0xff;

test('neutral by default — no legend, no tint (the sunny Caribbean stays the default)', () => {
  assert.equal(reputationLean(0, 0), 0);
  assert.equal(reputationLean(undefined, undefined), 0);
  assert.equal(reputationLean(NaN, -5), 0);
  assert.equal(leanPole(0), 'neutral');
});

test('a balanced ledger still reads neutral (the 60/40 deadzone mirrors renown.js)', () => {
  // 55/45 split → |tilt| = 0.1 < band → no tint.
  assert.equal(reputationLean(55, 45), 0);
  // Right at the band edge (60/40 → tilt 0.2) is still neutral.
  assert.equal(reputationLean(60, 40), 0);
});

test('infamy dominant → a POSITIVE (pirate) lean; standing dominant → NEGATIVE (governor)', () => {
  const pirate = reputationLean(100, 0);
  const gov = reputationLean(0, 100);
  assert.ok(pirate > 0, 'pure infamy leans pirate (+)');
  assert.ok(gov < 0, 'pure standing leans governor (-)');
  assert.equal(leanPole(pirate), 'pirate');
  assert.equal(leanPole(gov), 'governor');
  // Symmetric magnitude for mirror-image ledgers.
  assert.ok(Math.abs(pirate + gov) < 1e-9, 'poles are symmetric');
});

test('lean is bounded — it never overwhelms the scene', () => {
  assert.ok(reputationLean(1e9, 0) <= MAX_LEAN + 1e-9);
  assert.ok(reputationLean(0, 1e9) >= -MAX_LEAN - 1e-9);
  assert.equal(reputationLean(1e9, 0), MAX_LEAN);
});

test('lean grows monotonically with a deepening commitment past the band', () => {
  const a = reputationLean(65, 35); // tilt 0.3
  const b = reputationLean(85, 15); // tilt 0.7
  const c = reputationLean(100, 0); // tilt 1.0
  assert.ok(a > 0 && b > a && c >= b, `monotone: ${a} < ${b} <= ${c}`);
});

test('gradeHaze: neutral leaves the base byte-exact; poles pull cool vs warm', () => {
  const base = 0xbfe8e6; // today's sunny sea-haze
  assert.equal(gradeHaze(base, 0), base, 'lean 0 → untouched (sunny default)');

  const cool = gradeHaze(base, MAX_LEAN);   // infamous
  const warm = gradeHaze(base, -MAX_LEAN);  // lawful
  // Infamous pulls toward the steely storm-grey target (blue >= red ordering shifts cooler).
  assert.ok(B(cool) >= R(cool), 'infamous haze reads cool (blue not below red)');
  // Lawful pulls toward the warm golden target (red rises over blue).
  assert.ok(R(warm) > B(warm), 'lawful haze reads warm (red over blue)');
  // Both stay between the base and their pole target (bounded mix, never past the target).
  assert.notEqual(cool, base);
  assert.notEqual(warm, base);
});

test('gradeHaze eases TOWARD the pole target but never overshoots it', () => {
  const base = 0xbfe8e6;
  const cool = gradeHaze(base, MAX_LEAN);
  // Each channel sits between base and PIRATE_HAZE (a bounded lerp).
  for (const ch of [R, G, B]) {
    const lo = Math.min(ch(base), ch(PIRATE_HAZE));
    const hi = Math.max(ch(base), ch(PIRATE_HAZE));
    assert.ok(ch(cool) >= lo && ch(cool) <= hi);
  }
});

test('gradeSun: neutral untouched; pirate cools the light, governor warms it', () => {
  const base = 0xfff4de; // warm-white sun
  assert.equal(gradeSun(base, 0), base);
  const cool = gradeSun(base, MAX_LEAN);
  const warm = gradeSun(base, -MAX_LEAN);
  assert.ok(B(cool) - R(cool) > B(base) - R(base), 'pirate sun cooler than base');
  assert.ok(R(warm) - B(warm) >= R(base) - B(base), 'governor sun at least as warm');
});

test('gradeSunKey: pirate lowers the key (stormy), governor lifts it (bright), neutral is 1', () => {
  assert.equal(gradeSunKey(0), 1);
  assert.ok(gradeSunKey(MAX_LEAN) < 1, 'infamous dims');
  assert.ok(gradeSunKey(-MAX_LEAN) > 1, 'lawful brightens');
  // Bounded and modest — never blows out or blacks out the scene.
  assert.ok(gradeSunKey(MAX_LEAN) > 0.85 && gradeSunKey(-MAX_LEAN) < 1.15);
});
