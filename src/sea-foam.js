// Pure whitecap-foam math (no three.js) — the SINGLE source of truth for the ocean's
// drifting crest foam (#70), shared by the GPU fragment shader (whose foam GLSL is
// generated from the constants below) and any CPU/QA sampler. Kept three-free so the
// intensity maths can be unit-tested in node, exactly like swell.js.
//
// The delight beat: on the sunny Caribbean sea the wave CRESTS catch the light and
// froth white, then the foam breaks apart as the swell rolls — small, free surface
// life that makes a flat sea feel alive and in motion. It reads the swell HEIGHT the
// shader already computes (lock-step with the CPU sampleHeight #102/#65), so it never
// touches the geometry the ship/wake/ports ride — purely a colour wash on the crests.

import { MAX_SWELL } from './swell.js';

// Crest-height window (world units) over which foam fades in. Foam starts catching only
// near the upper crests (FOAM_LO) and is full white at the peaks (FOAM_HI), so the sea
// reads as whitecaps on the tops — never a milky, foam-covered sheet. Both sit at/below
// MAX_SWELL (1.4) so the foam is actually REACHABLE on the live swell.
export const FOAM_LO = 0.7;
export const FOAM_HI = 1.3;

// Bright sunlit sea-foam tint (a hair warmer than pure white so it sits in the sunny palette).
export const FOAM_COLOR = 0xf2fbff;

// How fast the patchy foam streaks drift across the crests (shader time multiplier).
export const FOAM_DRIFT = 0.45;

// How strongly full foam lightens the crest colour (0..1) — kept below 1 so even the
// whitest cap keeps a breath of turquoise underneath and never blows out.
export const FOAM_STRENGTH = 0.9;

// GLSL/Hermite smoothstep — identical to the shader's built-in so JS and GPU agree.
export function smoothstep(e0, e1, x) {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

// Crest-foam factor (0..1) for a given swell height: 0 in the troughs, ramping to 1 on
// the peaks. Below FOAM_LO (troughs and gentle mid-swell) there is no foam at all.
export function crestFoam(height) {
  return smoothstep(FOAM_LO, FOAM_HI, height);
}

// Combined whitecap intensity (0..1): the crest factor gated by a patchy "streak" value
// (0..1) — in the shader the streak is a drifting noise pattern so foam appears in broken
// patches, not as a solid band. Here it's a plain multiply so it's deterministic to test.
export function whitecap(height, streak) {
  const s = Math.min(1, Math.max(0, streak));
  return crestFoam(height) * s;
}

// Re-export so a test can assert the foam window is reachable on the live swell.
export { MAX_SWELL };
