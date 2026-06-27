// Pure, three-free hull geometry — the SINGLE source of truth for the sloop's
// parametric cross-section, shared by src/ship.js (which builds the THREE meshes from
// these numbers) and the unit tests (which run in node, where three.js is only loaded
// via the browser import map). Mirrors src/swell.js's pattern: keep the math here so
// the geometry can be asserted in node without a GPU.
import { MAX_SWELL } from './swell.js';

export const L = 16;              // hull length
export const halfLen = L / 2;
export const maxBeam = 3.0;       // half-beam amidships (full beam 6)
export const maxDepth = 3.3;      // hull depth (gunwale -> keel)
export const topY = 2.0;          // gunwale base height
export const nStations = 18;
export const DECK_INSET = 0.86;   // the deck is inset this fraction inside the gunwale

// Normalized cross-section (port gunwale -> keel -> stbd gunwale), swept along the keel.
export const profile = [
  [-1.00, 0.00], [-0.98, -0.30], [-0.82, -0.62], [-0.45, -0.90],
  [0.00, -1.00],
  [0.45, -0.90], [0.82, -0.62], [0.98, -0.30], [1.00, 0.00],
];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Half-beam at fractional station t (0 = transom stern, 1 = pointed bow).
export function beamAt(t) {
  let b = maxBeam;
  if (t > 0.5) b *= clamp(1 - Math.pow((t - 0.5) / 0.5, 1.4), 0.04, 1); // pointed bow
  if (t < 0.18) b *= 0.55 + 0.45 * (t / 0.18);                          // narrow transom
  return b;
}
export const depthAt = (t) => maxDepth * (0.55 + 0.45 * Math.sin(Math.PI * clamp(t, 0, 1)));
export function sheerAt(t) {
  let y = topY + 0.95 * Math.pow(Math.abs(t - 0.5) * 2, 2.2);
  if (t > 0.5) y += 0.6 * Math.pow((t - 0.5) / 0.5, 2); // extra-proud bow
  return y;
}

// Local y of the hull's interior bottom (keel) at station t.
export const keelAt = (t) => sheerAt(t) - depthAt(t);

// Starboard branch of the profile (keel py=-1 .. gunwale py=0), used to read the hull's
// interior half-width at any local height.
const STARBOARD = profile.filter(([x]) => x >= 0).sort((a, b) => a[1] - b[1]);

// Interior half-width (local x) of the hull at station t and local height y. The hull is
// widest at the sheer and narrows downward to the keel; returns 0 when y is below the
// local keel (no hull there — the solid bottom has risen above y at that station).
export function hullHalfWidthAt(t, y) {
  const py = (y - sheerAt(t)) / depthAt(t); // -1 keel .. 0 gunwale
  if (py <= STARBOARD[0][1]) return 0;
  if (py >= STARBOARD[STARBOARD.length - 1][1]) return beamAt(t);
  const b = beamAt(t);
  for (let i = 1; i < STARBOARD.length; i++) {
    const [x0, y0] = STARBOARD[i - 1];
    const [x1, y1] = STARBOARD[i];
    if (py <= y1) {
      const f = (py - y0) / (y1 - y0);
      return (x0 + f * (x1 - x0)) * b;
    }
  }
  return b;
}

// The interior sole (bilge floor) height in ship-local space (#65). The hull is an
// open-topped bowl whose interior dips well below the waterline, so looking down through
// the open ring between the inset deck and the gunwale you'd see the ocean plane sitting
// *inside* the boat ("water in the hull"). SOLE_Y places one opaque cap above the
// waterline + swell margin so the sea is occluded. The ship RIDES the swell
// (ship.position.y = ocean.sampleHeight at its centre), so the ocean plane only deviates
// across the hull footprint by a fraction of a wave — SOLE_Y clears even the absolute
// MAX_SWELL crest with margin, while staying below the deck (topY) so nothing pokes past
// the gunwale.
export const SOLE_Y = 1.5;

// Sanity: the sole must clear the swell yet stay inside the hull (below the deck).
// (Guards a future swell/geometry edit from re-opening #65 — fails loudly at import.)
if (SOLE_Y <= MAX_SWELL) throw new Error(`hull: SOLE_Y ${SOLE_Y} must sit above MAX_SWELL ${MAX_SWELL}`);
if (SOLE_Y >= topY) throw new Error(`hull: SOLE_Y ${SOLE_Y} must sit below the deck/gunwale ${topY}`);

// Outline (local [x, z] points: starboard stern->bow, then port bow->stern) of the sole
// cap — the hull's own interior cross-section at SOLE_Y, scaled a hair inside the wall to
// avoid z-fighting. Tapers to nothing toward the ends, where the solid hull bottom has
// already risen above SOLE_Y and occludes the sea on its own.
export function soleOutline(y = SOLE_Y, flush = 0.995) {
  const stbd = [];
  const port = [];
  for (let i = 0; i < nStations; i++) {
    const t = i / (nStations - 1);
    const w = hullHalfWidthAt(t, y) * flush;
    const z = -halfLen + t * L;
    stbd.push([w, z]);
    port.push([-w, z]);
  }
  return stbd.concat(port.reverse());
}
