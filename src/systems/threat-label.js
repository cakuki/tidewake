// Over-ship threat labels — the PURE brain (#165, epic #162 slice 3, "pick your fight").
//
// The owner's #7 note for the difficulty/variety epic: "over-the-ship displays telling/hinting what
// ships are, so a player can CHOOSE fights and read danger at a glance." This module turns a ship's
// CLASS (#163's shipStats/shipClass block) into a floating world-space label — its name plus a threat
// glyph that escalates with danger — so you glance across the sea and instantly read a fat merchant
// prize ("Merchant Sloop ·") from a deadly warship ("Warship Man-o'-War ☠☠☠☠") before committing.
//
// It ALSO owns the declutter rule: threat is legible at a distance, but distant traffic FADES and only
// the nearest handful render at once (a lower cap on a phone, the #146 guard), so labels never smother
// the view. All of it is PURE + DOM-free + three.js-free so it unit-tests under `node --test` (#53):
// class → label text + glyph, tier → colour band, and the distance/count/mobile declutter decision.
// main.js is the thin shell — it drives the SAME over-ship-billboard module as the #161-s3 target ring
// (one module, two consumers) through these functions; no second billboard system, 0 draw calls.
//
// PURE presentation logic — reads only the transient class block. NO save impact (schema stays v17).

/** The trivial-threat mark a tier-1 easy-prey hull carries — a single quiet dot, no skulls. */
export const PREY_GLYPH = '·';
/** The danger mark that repeats with the threat tier — a man-o'-war bristles with them. */
export const THREAT_GLYPH = '☠';

/**
 * The at-a-glance threat glyph string for a threat tier 1..5 (PURE). Tier 1 is easy prey (a single
 * dot); tiers 2..5 escalate with skulls (☠ … ☠☠☠☠) so a higher tier ALWAYS reads visibly deadlier.
 * Clamps + rounds out-of-range / non-numeric input to [1,5].
 * @param {number} tier
 * @returns {string}
 */
export function threatGlyphs(tier) {
  const t = Math.max(1, Math.min(5, Math.round(Number(tier) || 1)));
  return t <= 1 ? PREY_GLYPH : THREAT_GLYPH.repeat(t - 1);
}

// The colour-band name per tier — drives the label's colour scale (green prey → red deadly) so bigger
// danger is obvious without reading the words. Monotonic in tier.
const LEVELS = ['prey', 'easy', 'even', 'hard', 'deadly'];

/**
 * The danger LEVEL name a tier reads as (PURE) — one of prey/easy/even/hard/deadly, monotonic in tier.
 * main.js maps it to a `lvl-*` CSS class so the label colour scales with threat.
 * @param {number} tier
 * @returns {'prey'|'easy'|'even'|'hard'|'deadly'}
 */
export function dangerLevel(tier) {
  const t = Math.max(1, Math.min(5, Math.round(Number(tier) || 1)));
  return LEVELS[t - 1];
}

/**
 * The full floating label for a ship's class block (PURE). Reads `label` + `tier` off #163's
 * shipStats/shipClass — e.g. { label: 'Merchant Sloop', tier: 1 } → "Merchant Sloop ·"; a null/absent
 * class yields null (nothing to render).
 * @param {{label?:string, tier?:number}|null} shipClass
 * @returns {{label:string, tier:number, glyphs:string, level:string, text:string}|null}
 */
export function threatLabelFor(shipClass) {
  if (!shipClass) return null;
  const tier = Math.max(1, Math.min(5, Math.round(Number(shipClass.tier) || 1)));
  const label = String(shipClass.label || 'Ship');
  const glyphs = threatGlyphs(tier);
  return { label, tier, glyphs, level: dangerLevel(tier), text: `${label} ${glyphs}` };
}

/**
 * Distance FADE (PURE): a label is fully opaque within `near`, fades linearly to 0 by `far`, and is
 * gone beyond — so threat stays legible at a distance yet distant traffic recedes and never smothers
 * the view. Returns an opacity in [0,1], monotonically decreasing with distance.
 * @param {number} distance  world distance from the camera to the ship
 * @param {number} near      full-opacity radius
 * @param {number} far       cull radius (opacity 0 at/after this)
 * @returns {number}
 */
export function labelFade(distance, near, far) {
  const d = Number(distance) || 0;
  if (d <= near) return 1;
  if (d >= far) return 0;
  return 1 - (d - near) / (far - near);
}

/**
 * How many labels may render at once for a viewport width (PURE) — the #146 mobile declutter guard: a
 * phone-portrait screen shows FEWER so labels never smother a small view.
 * @param {number} width  viewport width in px
 * @returns {number}
 */
export function maxLabelsForViewport(width) {
  return (Number(width) || 0) < 560 ? 3 : 6;
}

/**
 * The whole DECLUTTER decision (PURE): from per-ship entries choose which labels to show and at what
 * opacity — on-screen + eligible + within `far` only, nearest-first, capped at `maxLabels`. Distant
 * hulls fade (labelFade); the farthest beyond the cap drop entirely. Returns an object keyed by ship
 * index → opacity (an absent index means "hidden").
 * @param {Array<{index:number, distance:number, onScreen:boolean, eligible?:boolean}>} entries
 * @param {{near?:number, far?:number, maxLabels?:number}} [opts]
 * @returns {Object<number, number>}
 */
export function selectLabels(entries, { near = 320, far = 1500, maxLabels = 6 } = {}) {
  const eligible = (entries || [])
    .filter((e) => e && e.eligible !== false && e.onScreen && (Number(e.distance) || 0) <= far)
    .sort((a, b) => a.distance - b.distance);
  const out = {};
  for (let i = 0; i < eligible.length && i < maxLabels; i++) {
    const e = eligible[i];
    out[e.index] = labelFade(e.distance, near, far);
  }
  return out;
}
