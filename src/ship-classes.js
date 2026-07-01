// Ship classes — the sea's pecking order (#163, the FOUNDATION of the difficulty/variety epic #162).
//
// Until now every NPC sail was mechanically identical (hull 100, gunnery 0.9–1.1); only colour, a tiny
// scale wobble, and speed varied (src/npc.js, makeFoe in src/cannons.js). The owner's complaint: "games
// are too easy; ships should VARY; a player who wants a challenge can seek a big/armed ship." This module
// gives the sea a CLASS system so danger + size vary at a glance and in the fight:
//
//   sloop → brig → frigate → man-o'-war   (the hull ladder — bigger = more hull + heavier guns + slower)
//   crossed with  merchant ↔ warship      (the ROLE — a merchant of a class carries far fewer/weaker guns)
//
// Each (class × role) yields hull / gunnery / gun-count / crew / a visible sizeScale / speed and a derived
// THREAT tier (1–5). The stats feed the EXISTING battle math directly:
//   • hull is on the shared 0..100 combat scale (MAX_HULL) so it seeds enemyHull straight into clampHull/
//     resolveBroadside — a man-o'-war simply takes MORE volleys; a merchant sloop folds fast.
//   • gunnery is the foe's return-fire multiplier resolveBroadside/resolveExchange already consume — a
//     warship frigate's broadside genuinely threatens you; a merchant sloop barely scratches.
//   • sizeScale drives the mesh group scale in npc.js — a man-o'-war visibly DWARFS a darting sloop.
//
// PURE data + selection. No THREE, no DOM, no game state — unit-tested under `node --test`. These are
// TRANSIENT spawn properties, NEVER persisted (save schema stays v17 — #162 owner-decision, binding).

// The full combat scale a hull rides on (kept in step with cannons.js MAX_HULL, imported by callers).
const HULL_SCALE = 100;

/**
 * The four hull classes — the size/toughness ladder. Base gunnery here is the WARSHIP figure; the
 * merchant role scales it down (see ROLES). `baseGuns` is the warship gun count (a legibility/label
 * figure for #165); `sizeScale` is the mesh scale a bigger class earns (visible dwarfing).
 * Ordered sloop < brig < frigate < man-o'-war on hull, guns, gunnery, size (and DESCENDING on speed).
 */
export const SHIP_CLASSES = {
  sloop:   { tier: 1, hullFrac: 0.55, baseGun: 0.60, baseGuns: 6,  crew: 20,  sizeScale: 0.72, speed: 30, label: 'Sloop' },
  brig:    { tier: 2, hullFrac: 0.72, baseGun: 0.85, baseGuns: 12, crew: 40,  sizeScale: 0.95, speed: 25, label: 'Brig' },
  frigate: { tier: 3, hullFrac: 0.88, baseGun: 1.10, baseGuns: 26, crew: 90,  sizeScale: 1.25, speed: 21, label: 'Frigate' },
  manowar: { tier: 4, hullFrac: 1.00, baseGun: 1.50, baseGuns: 40, crew: 160, sizeScale: 1.60, speed: 17, label: "Man-o'-War" },
};

/** The class keys in ascending order of size/danger — a stable ladder for tests + selection. */
export const CLASS_ORDER = ['sloop', 'brig', 'frigate', 'manowar'];

/**
 * The two ROLES a hull can be built for. A warship carries a full battery; a merchant of the SAME class
 * carries roughly half the guns at a fraction of the gunnery (a fat, slow prize) and reads a tier tamer.
 *   gunMult — scales the class base gunnery (the return-fire threat).
 *   gunFrac — scales the gun COUNT (a legibility figure).
 *   threatBump — nudges the derived threat tier (a warship is one pip more dangerous than its merchant).
 */
export const ROLES = {
  warship:  { gunMult: 1.0,  gunFrac: 1.0, threatBump: 1, label: 'Warship' },
  merchant: { gunMult: 0.55, gunFrac: 0.5, threatBump: 0, label: 'Merchant' },
};

/** Clamp a hull value onto the shared [0, HULL_SCALE] combat scale. */
function clampHull(h) { return Math.max(0, Math.min(HULL_SCALE, Math.round(h))); }

/**
 * The merged combat + visual stats for a (class × role). PURE + deterministic. This is the single
 * legible table the whole variety system reads: npc.js scales the mesh by `sizeScale` + seeds the
 * wander speed; battle.js/cannons.js seed the foe's hull + gunnery from it.
 * @param {string} classKey  one of CLASS_ORDER ('sloop'|'brig'|'frigate'|'manowar')
 * @param {string} role      'warship' | 'merchant'
 * @returns {{cls:string, role:string, label:string, tier:number, hull:number, maxHull:number,
 *            gunnery:number, guns:number, crew:number, sizeScale:number, speed:number}}
 */
export function shipStats(classKey, role = 'warship') {
  const c = SHIP_CLASSES[classKey] || SHIP_CLASSES.sloop;
  const r = ROLES[role] || ROLES.warship;
  const hull = clampHull(HULL_SCALE * c.hullFrac);
  const gunnery = Math.round(c.baseGun * r.gunMult * 100) / 100;
  const guns = Math.max(1, Math.round(c.baseGuns * r.gunFrac));
  // Threat tier 1–5: the class ladder (1–4) plus the warship pip, capped at 5 (a warship man-o'-war = 5).
  const tier = Math.max(1, Math.min(5, c.tier + r.threatBump));
  return {
    cls: classKey, role: (ROLES[role] ? role : 'warship'),
    label: `${r.label} ${c.label}`,
    tier, hull, maxHull: hull, gunnery, guns, crew: c.crew, sizeScale: c.sizeScale, speed: c.speed,
  };
}

// The OPEN-SEA spawn pool (#163). A deliberate MIX of approachable classes so the ordinary sea has a
// pecking order you can see + feel — from a darting merchant sloop (easy prey) up to a merchant man-o'-war
// (a giant, but weak-gunned) and a warship frigate (a real threat you'll meet by chance). The WARSHIP
// man-o'-war (threat 5) is deliberately withheld — that terror is the opt-in "seek a hard fight" reward
// of #167, so an unlucky pass never drops the player into an unwinnable slaughter.
export const SPAWN_POOL = [
  { cls: 'sloop',   role: 'merchant' }, // a little darting prize — folds fast
  { cls: 'frigate', role: 'warship'  }, // a genuine threat — her broadside stings
  { cls: 'manowar', role: 'merchant' }, // a lumbering giant — dwarfs the sloop, but few guns
  { cls: 'brig',    role: 'warship'  }, // a middling scrapper
  { cls: 'sloop',   role: 'warship'  }, // a small but toothy raider
  { cls: 'frigate', role: 'merchant' }, // a big fat trader — slow, lightly armed
];

/**
 * Choose a MIX of (class × role) specs for `count` open-sea spawns (#163). Deterministic given `rng`,
 * and GUARANTEED varied: it walks a curated pool from a seeded offset, so any small fleet spans at least
 * two distinct classes (the sea is never uniform). PURE + injectable rng.
 * @param {() => number} rng
 * @param {number} count
 * @returns {Array<{cls:string, role:string}>}
 */
export function spawnMix(rng = Math.random, count = 3) {
  const n = Math.max(0, Math.floor(count));
  const pool = SPAWN_POOL;
  const start = Math.min(pool.length - 1, Math.floor((rng() || 0) * pool.length));
  const out = [];
  for (let i = 0; i < n; i++) out.push({ ...pool[(start + i) % pool.length] });
  // Safety net: if a tiny fleet somehow drew a single class, force one hull to a contrasting class so
  // "the sea VARIES" always holds (never fires for the curated pool above; a guard for future edits).
  if (n >= 2 && out.every((s) => s.cls === out[0].cls)) {
    out[n - 1] = { cls: out[0].cls === 'frigate' ? 'sloop' : 'frigate', role: 'warship' };
  }
  return out;
}
