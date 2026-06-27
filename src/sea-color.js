// Pure sea-colour helpers (no three.js) — split out so they run under `node --test`
// (ocean.js imports three, which is only available in the browser via the importmap).
// These back the iOS shader-fallback sea: if the custom ocean ShaderMaterial ever fails
// to compile/link on a strict mobile GPU, ocean.js swaps in a flat lit plane tinted with
// oceanFallbackColor() so the player always sees a plausible sea, never an empty teal void.

// Sea palette — shared by the shader uniforms (ocean.js) and the fallback tint.
export const DEEP = 0x1192c6;    // rich tropical blue (offshore)
export const SHALLOW = 0x46e3d0; // luminous Caribbean turquoise (shallows)

/**
 * Linearly blend two packed 0xRRGGBB colours. t=0 → a, t=1 → b (clamped).
 * @param {number} a packed 0xRRGGBB
 * @param {number} b packed 0xRRGGBB
 * @param {number} t blend factor (clamped to [0,1])
 * @returns {number} packed 0xRRGGBB
 */
export function mixHex(a, b, t) {
  const k = Math.min(1, Math.max(0, t));
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

/**
 * The flat-but-coloured water tint used if the custom ocean shader fails to link — a
 * plausible mid sea-tone between the deep blue and the turquoise shallows.
 * @returns {number} packed 0xRRGGBB
 */
export function oceanFallbackColor() {
  return mixHex(DEEP, SHALLOW, 0.4);
}
