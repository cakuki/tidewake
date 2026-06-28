// Reputation-reactive world grade (#126, DL #4) — the look reflects who you're becoming.
//
// The whole spine of Tidewake is the Infamy↔Standing pole (renown.js): every duel, trade, mercy
// and plunder tilts you toward the feared pirate or the respected governor. Until now the WORLD's
// look never said so. This is the PURE pole→grade math that makes the pole VISIBLE: a single signed
// "lean" off the ledger, plus colour eases that the wiring maps onto the live scene grade
// (sea-haze / fog / sun / sky horizon) each frame.
//
// CREATIVE SPARK (Game Designer): "every sail becomes a mirror of your legend." Lean infamous and
// the Caribbean turns colder, steelier and storm-grey, the light dropping to a low ominous key —
// the sea itself grows wary of you. Lean lawful and the air warms to a golden, prosperous glow.
// Sit balanced and it stays the sunny holiday default it has always been. The cast is BOUNDED
// (MAX_LEAN) so it colours the mood without ever drowning the Caribbean it is.
//
// PURE on purpose — no THREE, no DOM, no game state. It composes OVER day-night (#58, which writes
// the base palette) and UNDER the landfall golden grade (#102, which warms over the top): capture/
// restore lives in main.js, the mapping lives here, unit-tested in tests/unit/reputation-grade.test.mjs.

import { mixHex } from '../sea-color.js';

// Mirror renown.js's neutral band: a 60/40 lean still reads "balanced", so the world only starts to
// take a side once you clearly commit past it. Below the band the look is the plain sunny default.
const BALANCE_BAND = 0.2;

// The ceiling on the cast. At full commitment the grade eases AT MOST this far toward the pole, so
// the scene's own day-night / landfall look always still reads through. Gentle on purpose (#126:
// "keep the sunny default at neutral so the game still reads as the Caribbean it is").
export const MAX_LEAN = 0.35;

const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

// Pole target casts (packed 0xRRGGBB). Pirate = colder/stormier/lower-key; governor = warmer/golden.
export const PIRATE_HAZE = 0x8a9bad;     // steely storm-grey horizon haze
export const PIRATE_SUN = 0xb4c6d8;      // cold steel light
export const GOVERNOR_HAZE = 0xf3dca6;   // warm golden horizon haze
export const GOVERNOR_SUN = 0xffe7ad;    // warm golden light

// How far the sun's KEY swings at a full lean: infamous lowers it (a stormy, low-key light), lawful
// lifts it (a brighter, prosperous day). Kept modest so the scene never blows out or blacks down.
const SUN_KEY_SWING = 0.2;

/**
 * The captain's signed world-grade lean from the two poles. The same tilt renown.js uses for the
 * dominant pole, deadzoned by the neutral band, eased (smoothstep) and bounded to [-MAX_LEAN, MAX_LEAN].
 * @param {number} infamy   pirate-path score (junk/neg → 0)
 * @param {number} standing governor-path score (junk/neg → 0)
 * @returns {number} signed lean: >0 = pirate (cold/stormy), <0 = governor (warm/golden),
 *   0 = neutral (the sunny default look, untouched).
 */
export function reputationLean(infamy, standing) {
  const i = Number.isFinite(infamy) && infamy > 0 ? infamy : 0;
  const s = Number.isFinite(standing) && standing > 0 ? standing : 0;
  const total = i + s;
  if (total <= 0) return 0;                              // no legend yet → sunny default
  const tilt = (i - s) / total;                         // -1 pure governor … +1 pure pirate
  const mag = Math.abs(tilt);
  if (mag <= BALANCE_BAND) return 0;                    // still balanced → no tint
  const t = (mag - BALANCE_BAND) / (1 - BALANCE_BAND);  // remap (band,1] → (0,1]
  const eased = t * t * (3 - 2 * t);                    // smoothstep — a gentle onset
  return Math.sign(tilt) * eased * MAX_LEAN;            // bounded, signed
}

/**
 * The categorical pole for a signed lean (matches renown.dominantPole at the same band).
 * @param {number} lean signed lean from reputationLean()
 * @returns {'pirate'|'governor'|'neutral'}
 */
export function leanPole(lean) {
  return lean > 0 ? 'pirate' : lean < 0 ? 'governor' : 'neutral';
}

/**
 * Ease a base haze/fog/sky hex toward the dominant pole's cast by |lean|. A bounded lerp toward the
 * pole target — never overshoots it, and lean 0 returns the base byte-exact (sunny default intact).
 * @param {number} baseHex packed 0xRRGGBB (the current, un-graded base colour)
 * @param {number} lean signed lean (sign picks the pole; |lean| is the blend amount)
 * @returns {number} packed 0xRRGGBB
 */
export function gradeHaze(baseHex, lean) {
  if (!lean) return baseHex;
  const target = lean > 0 ? PIRATE_HAZE : GOVERNOR_HAZE;
  return mixHex(baseHex, target, clamp(Math.abs(lean), 0, 1));
}

/**
 * Ease a base sun-colour hex toward the dominant pole's light by |lean|. lean 0 → unchanged.
 * @param {number} baseHex packed 0xRRGGBB sun colour
 * @param {number} lean signed lean
 * @returns {number} packed 0xRRGGBB
 */
export function gradeSun(baseHex, lean) {
  if (!lean) return baseHex;
  const target = lean > 0 ? PIRATE_SUN : GOVERNOR_SUN;
  return mixHex(baseHex, target, clamp(Math.abs(lean), 0, 1));
}

/**
 * Sun KEY (intensity) multiplier for a lean: pirate lowers the key (stormy/ominous), governor lifts
 * it (bright/prosperous). lean 0 → 1 (the default exposure). Bounded by SUN_KEY_SWING.
 * @param {number} lean signed lean
 * @returns {number} a multiplier near 1 (≈[1-SWING, 1+SWING] over the lean range)
 */
export function gradeSunKey(lean) {
  return 1 - clamp(lean, -1, 1) * SUN_KEY_SWING;
}
