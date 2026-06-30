// Your ship wears your legend (#132 Slice A, DL #5) — the reputation needle, made PERSONAL.
//
// #126 made the WORLD mirror the Infamy↔Standing pole; this makes the player's OWN SHIP mirror it
// too — the one thing the captain looks at most. Driven off the SAME single signed lean #126 already
// computes (reputationLean), so who you're becoming is felt at a glance on your own canvas and timber.
//
// CREATIVE SPARK (Graphic Designer + Game Designer): "your ship wears your legend." Lean infamous and
// the canvas greys with salt and powder-grime, the timbers darken weathered and matte — a feared ship
// looks the part before she fires a shot. Lean lawful and the sails brighten to clean trim that catches
// the light, the hull warmed and cared-for — a respected ship gleams. Sit balanced and she's the honest
// working sloop she has always been. Bounded (the cast is gentle) so the Caribbean still reads through.
//
// PURE on purpose — no THREE, no DOM, no game state. The mapping lives here (unit-tested); the wiring in
// main.js clones the GLB's sail + hull materials once and writes these uniforms each frame (colour /
// roughness / emissive only — ZERO new draws). Composes cleanly: lean 0 → the neutral identity, byte-
// for-byte the untouched ship.

import { mixHex } from '../sea-color.js';
import { MAX_LEAN } from './reputation-grade.js';

// The neutral colour-MULTIPLIER over the GLB's colormap texture: white leaves the texture untouched.
const NEUTRAL = 0xffffff;

// Pirate cast: colour multipliers BELOW white darken + grime the texture (a multiplier can only
// darken). Salt-greyed, powder-stained canvas; weathered, salt-streaked timber.
const PIRATE_SAIL = 0x8c8270; // dingy, salt-and-powder-grimed canvas
const PIRATE_HULL = 0x6f6451; // weathered, salt-streaked, darkened timber

// Governor cast: a multiplier can't brighten past the texture, so "clean/bright" reads through a
// faint WARM tint + a soft trim GLOW (emissive) + a cared-for SHEEN (lower roughness).
const GOVERNOR_SAIL = 0xfff4df; // a whisper of warm on bright, clean canvas
const GOVERNOR_HULL = 0xfde6c8; // cared-for, warmly lit trim
const GOVERNOR_GLOW = 0xffe7ad; // the soft warm emissive trim glow (echoes #126 governor light)

// Ceilings — gentle on purpose so a slight lean barely shows and the honest sloop still reads.
const PIRATE_TINT = 0.85;  // colour blend toward the grimed target at full commitment
const GOVERNOR_TINT = 0.6; // colour blend toward the warm-clean target at full commitment
const ROUGH_GRIME = 0.28;  // +roughness at full Infamy (matte, salt-caked)
const ROUGH_CLEAN = 0.18;  // -roughness at full Standing (a cared-for sheen)
const GLOW_MAX = 0.22;     // emissiveIntensity at full Standing (a soft trim glow)

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Normalised commitment 0..1 from the signed, already-eased-and-bounded lean (reputationLean()):
 * |lean| ranges over [0, MAX_LEAN], so a full commitment reaches 1. Junk/NaN → 0.
 * @param {number} lean signed lean from reputationLean()
 * @returns {number} 0..1
 */
export function auraCommitment(lean) {
  if (!Number.isFinite(lean)) return 0;
  return clamp01(Math.abs(lean) / MAX_LEAN);
}

// The per-part (sail / hull) cast for a given commitment magnitude and pole sign.
function part(mag, sign, pirateTarget, govTarget) {
  if (sign > 0) {
    // Infamy: darken + grime the colour, roughen to matte, no glow.
    return {
      color: mixHex(NEUTRAL, pirateTarget, mag * PIRATE_TINT),
      roughnessAdd: mag * ROUGH_GRIME,
      emissive: 0x000000,
      emissiveIntensity: 0,
    };
  }
  if (sign < 0) {
    // Standing: warm-clean colour, a sheen (lower roughness), a soft warm trim glow.
    return {
      color: mixHex(NEUTRAL, govTarget, mag * GOVERNOR_TINT),
      roughnessAdd: -mag * ROUGH_CLEAN,
      emissive: GOVERNOR_GLOW,
      emissiveIntensity: mag * GLOW_MAX,
    };
  }
  return { color: NEUTRAL, roughnessAdd: 0, emissive: 0x000000, emissiveIntensity: 0 };
}

/**
 * The player ship's material cast for a signed reputation lean. Returns per-part (sail / hull) colour
 * multipliers, a signed roughness delta (the wiring adds it to the material's captured base roughness
 * and clamps), and an emissive trim glow. lean 0 (or junk) → the neutral identity (white, no glow, no
 * roughness delta), so the untouched ship is byte-for-byte unchanged.
 * @param {number} lean signed lean: >0 = pirate (grimy/dark), <0 = governor (clean/bright), 0 = neutral
 * @returns {{pole:'pirate'|'governor'|'neutral', mag:number, sail:object, hull:object}}
 */
export function shipAura(lean) {
  const l = Number.isFinite(lean) ? lean : 0;
  const sign = l > 0 ? 1 : l < 0 ? -1 : 0;
  const mag = auraCommitment(l);
  if (sign === 0 || mag === 0) {
    const n = () => ({ color: NEUTRAL, roughnessAdd: 0, emissive: 0x000000, emissiveIntensity: 0 });
    return { pole: 'neutral', mag: 0, sail: n(), hull: n() };
  }
  return {
    pole: sign > 0 ? 'pirate' : 'governor',
    mag,
    sail: part(mag, sign, PIRATE_SAIL, GOVERNOR_SAIL),
    hull: part(mag, sign, PIRATE_HULL, GOVERNOR_HULL),
  };
}

export {
  NEUTRAL, PIRATE_SAIL, PIRATE_HULL, GOVERNOR_SAIL, GOVERNOR_HULL, GOVERNOR_GLOW,
  PIRATE_TINT, GOVERNOR_TINT, ROUGH_GRIME, ROUGH_CLEAN, GLOW_MAX,
};
