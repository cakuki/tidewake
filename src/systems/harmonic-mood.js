// The harmonic reputation needle (#132 Slice B, DL #5) — the procedural bed's continuous MODAL RECOLOUR.
//
// #126 made the WORLD mirror the Infamy↔Standing pole; Slice A made the player's own SHIP wear it.
// This makes the SCORE wear it too: the SAME signed reputation lean (repLean) that grimes the hull now
// continuously recolours the lead's MODE. Drift toward Infamy and the lead leans into a freygish /
// phrygian-dominant "bite" (the flat-2 + flat-6 over a major third — the klezmer/Spanish menace colour
// from the Musician's DL#1 wildcard); drift toward Standing and it brightens to a warm Lydian voicing
// (the raised 4th — airy, luminous). Sit balanced and it's the honest D-major hornpipe, untouched.
// ONE cross-faded gain across the needle; the bass + chord/percussive bed stays fixed (the DL#3 trap).
//
// CREATIVE SPARK (Musician + Sound Engineer): "the score wears your legend." The same hornpipe, same
// palette, same melody — but lean feared and a flat-second sob slides into the tune like a knife under
// a cloak; lean honoured and a bright lifted fourth opens the air like a church window. You don't hear a
// new song when you turn pirate — you hear the SAME song turn on you. RTPC-style: one needle, one knob.
//
// PURE on purpose — no WebAudio, no game state. The mapping lives here (unit-tested); the wiring in
// music.js crossfades a recolour lead voice up as |lean| grows and voices the SCALE this returns. The
// recolour gain (and the complementary duck of the neutral lead) is the one needle-driven crossfade.

import { MAX_LEAN } from './reputation-grade.js';

// Scale degrees as semitone offsets from the root. IONIAN matches src/music.js MAJOR_SCALE — the
// neutral bed (the canonical D-major hornpipe). LYDIAN raises the 4th (warm/bright Standing voicing);
// FREYGISH is phrygian-dominant — flat-2, major-3, flat-6, flat-7 — the Infamy "bite". All three share
// root / third / fifth / octave, so they layer phase-coherently over the FIXED D-major bass + pad.
export const IONIAN   = [0, 2, 4, 5, 7, 9, 11];
export const LYDIAN   = [0, 2, 4, 6, 7, 9, 11];
export const FREYGISH = [0, 1, 4, 5, 7, 8, 10];

// The crossfade ceiling: even at full commitment a wisp of the honest Ionian theme survives UNDER the
// recolour, so the bed never fully abandons its identity (it COLOURS, never replaces). The wiring ramps
// the recolour gain to `blend` and ducks the neutral lead to `1 - blend` — one knob, complementary.
export const RECOLOUR_MAX = 0.9;

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * The cross-faded recolour amount 0..RECOLOUR_MAX from the signed, already-eased-deadzoned-and-bounded
 * lean (reputationLean()): |lean| spans [0, MAX_LEAN]. Mirrors auraCommitment so the AUDIBLE twin of
 * Slice A rides the exact same needle curve. Junk/NaN → 0.
 * @param {number} lean signed lean from reputationLean()
 * @returns {number} 0..RECOLOUR_MAX
 */
export function recolourBlend(lean) {
  if (!Number.isFinite(lean)) return 0;
  return clamp01(Math.abs(lean) / MAX_LEAN) * RECOLOUR_MAX;
}

/**
 * The live modal-recolour state for a signed reputation lean. Returns the pole, the SCALE the recolour
 * lead should voice (IONIAN at neutral, FREYGISH toward Infamy, LYDIAN toward Standing), and the cross-
 * faded `blend` [0, RECOLOUR_MAX] the wiring ramps the recolour gain to (the neutral lead ducks to
 * 1-blend complementarily). lean 0 (or junk) → the neutral bed: blend 0, IONIAN, the untouched hornpipe.
 * @param {number} lean signed lean: >0 = pirate (the bite), <0 = governor (the bright), 0 = neutral
 * @returns {{pole:'pirate'|'governor'|'neutral', blend:number, scale:number[]}}
 */
export function harmonicMood(lean) {
  const l = Number.isFinite(lean) ? lean : 0;
  const blend = recolourBlend(l);
  if (l === 0 || blend === 0) return { pole: 'neutral', blend: 0, scale: IONIAN };
  return l > 0
    ? { pole: 'pirate', blend, scale: FREYGISH }
    : { pole: 'governor', blend, scale: LYDIAN };
}
