// Regional danger — challenge on demand, FIXED BY REGION (#167, the payoff slice of epic #162).
//
// The owner's binding decision (#162): difficulty is a property of WHERE you sail, NOT a rubber-band
// that tracks your renown. Safe home coasts stay gentle; the open deep is deadly. A player who WANTS a
// hard fight can SEEK one — point the bow at the deep water and the sea answers with heavier ships
// (frigates, and out past the points the withheld WARSHIP man-o'-war). It is a fixed, learnable rule
// the player exploits: "there's a frigate off the point worth real Infamy."
//
// This module is the PURE, deterministic mapping from a world POSITION to (a) the region's danger cap
// and (b) a region-appropriate spawn spec (class × role). It reads ONLY position — no renown, no game
// state, no THREE, no DOM — so the whole regional-danger rule unit-tests under `node --test`. The spawn
// specs are TRANSIENT (npc.js seeds a hull from them on spawn); NOTHING is persisted (save stays v17).
//
// It composes src/ship-classes.js: the class ladder + threat tiers are canon there; here we only choose
// WHICH class×role belongs to WHICH stretch of sea. Reward scales by that tier elsewhere (spoils in
// cannons.js), mirroring #164's tier-scaled loss sting — high risk out here pays high reward.

import { SHIP_CLASSES, ROLES, shipStats } from '../ship-classes.js';

// The danger LADDER, keyed by distance from the origin (the home coast). Fixed + deterministic: the
// farther out you sail, the higher the threat tier the sea can throw at you. `cap` is the TOP threat
// tier (1–5) a region will spawn. The outermost band is the tier-5 deep — the man-o'-war's water.
export const DANGER_BANDS = [
  { maxR: 400, cap: 2 },       // home coast — sloops & the odd brig, gentle prey
  { maxR: 600, cap: 3 },       // the near sea — brigs & merchant frigates begin to roam
  { maxR: 780, cap: 4 },       // rough water — warship frigates & merchant men-o'-war
  { maxR: Infinity, cap: 5 },  // THE DEEP — the warship man-o'-war's hunting ground (seek it for real fame)
];

// At/beyond this radius the region is the tier-5 deep. npc.js uses it to guarantee at least one
// man-o'-war is genuinely reachable out there (the seekable reward of the whole difficulty epic).
export const DEEP_R = 780;

/**
 * The region's danger CAP (top threat tier, 1–5) at a world position. PURE, radial, monotone outward.
 * Reads only distance from the origin — the FIXED regional rule, never a renown-tracking rubber-band.
 * @param {number} x @param {number} z
 * @returns {number} the top threat tier (1..5) this stretch of sea will spawn
 */
export function regionDanger(x, z) {
  const r = Math.hypot(Number(x) || 0, Number(z) || 0);
  for (const b of DANGER_BANDS) if (r < b.maxR) return b.cap;
  return 5;
}

// The full (class × role) catalogue with each pairing's canonical threat tier (from ship-classes.js).
// Built once. This is the single place regional selection reads "which specs exist at which tier".
const CATALOG = [];
for (const cls of Object.keys(SHIP_CLASSES)) {
  for (const role of Object.keys(ROLES)) {
    CATALOG.push({ cls, role, tier: shipStats(cls, role).tier });
  }
}

/**
 * Choose a region-appropriate spawn spec (class × role) for a world position. PURE + deterministic
 * given `rng`. The choice is FIXED BY REGION: a spec never out-classes its region's danger cap, and the
 * deep out-classes the coast — so sailing toward danger reliably raises the ships you meet.
 *
 *   • normal:   a small band [cap-1 .. cap] of the region's toughest classes — region-appropriate variety.
 *   • apex:     the region's TOP tier only — in the deep this is the withheld WARSHIP man-o'-war (tier 5),
 *               the reward npc.js guarantees is reachable if you sail out to meet her.
 *
 * @param {number} x @param {number} z
 * @param {() => number} [rng]
 * @param {{apex?:boolean}} [opts]
 * @returns {{cls:string, role:string}}
 */
export function regionalSpec(x, z, rng = Math.random, { apex = false } = {}) {
  const cap = regionDanger(x, z);
  const loTier = apex ? cap : Math.max(1, cap - 1);
  let pool = CATALOG.filter((s) => s.tier >= loTier && s.tier <= cap);
  if (!pool.length) pool = CATALOG.filter((s) => s.tier === cap);
  if (!pool.length) pool = CATALOG.filter((s) => s.tier === 1);
  const idx = Math.min(pool.length - 1, Math.max(0, Math.floor((rng() || 0) * pool.length)));
  const s = pool[idx];
  return { cls: s.cls, role: s.role };
}
