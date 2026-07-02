// Gun upgrades — buy a cannon at the Gunner's Workshop (#170, epic #168 "The Rise").
//
// The owner's canonical fun example — "buy a cannon → SEE it on the deck → HEAR a heavier boom →
// FEEL enemies sink faster" — lived nowhere: the player was a FIXED 4-cannon sloop with no way to
// grow her firepower. This module is the PURE core of that purchase: the coin cost curve, the
// owned-cannons → broadside-damage mapping, and the deck-mount placement data. No THREE, no DOM, no
// game state, so the whole progression math unit-tests under `node --test`. main.js owns the wiring
// (spend coin, mount the extra gun mesh, feed the multiplier into cannons.resolveBroadside, persist).
//
// The persisted state is a single small integer — `extraCannons`, how many cannons you've BOUGHT on
// top of the base battery — kept deliberately tiny (a small cap) so this first slice is the smallest
// always-shippable increment; deeper gun-tiers are follow-ups. It rides the v18 save (#122 rule).

import { SHIP_CLASSES, CLASS_ORDER } from '../ship-classes.js';

// The sloop's fixed battery — the 4 stubby cannons carved onto the starting hull (src/ship.js:
// two per side). Everything the player BUYS is on top of this.
export const BASE_GUNS = 4;

// How many extra cannons the workshop will sell (this slice's cap). Small on purpose — the smallest
// increment that lands the whole see/hear/feel loop; gun-tiers / a bigger battery are later slices.
export const MAX_EXTRA_CANNONS = 3;

// The coin cost of the 1st, 2nd, 3rd extra cannon — an escalating curve so each gun is a real
// spend you save toward (the first is reachable after a couple of good prizes; the last is a goal).
export const CANNON_COSTS = [180, 340, 560];

// Each extra cannon adds this fraction to your broadside's hull bite. Four guns (extra 0) = 1.0×;
// a full three extra (7 guns) = 1.48× — a volley you can FEEL land harder, without trivialising a
// warship fight (a man-o'-war still takes several volleys; she just folds sooner than she did).
export const GUN_DAMAGE_STEP = 0.16;

// The player's OWNED ship class (#171, reserved here so the v18 save bumps ONCE). The starting hull
// is a sloop; #171 wires buying up the class. Kept as a class id validated against ship-classes.js.
export const DEFAULT_SHIP_CLASS = 'sloop';

// Where the bought cannons bolt onto the deck (in the ~16-unit ship-group space, bow toward +Z,
// mirroring the procedural sloop's own gun line). Index 0 is the 1st extra cannon, and so on — a
// cheap fixed layout the deck-gun mesh reads; the mesh REUSES one shared geometry per #121.
// (deck sits at ~y=2.0 in the ~16-unit hull space; the sloop's own cannons ride at ~2.45 — src/hull.js).
export const DECK_GUN_SLOTS = [
  { x: 2.5, y: 2.7, z: 2.8, side: 1 },   // starboard, forward of the beam — run out at the bulwark cap
  { x: -2.5, y: 2.7, z: 2.8, side: -1 }, // port, mirroring the first (a matched pair)
  { x: 2.5, y: 2.7, z: -1.4, side: 1 },  // starboard, amidships-aft
];

/** Coerce a stored / live owned-extra-cannons value to a whole number in [0, MAX_EXTRA_CANNONS]. */
export function sanitizeExtraCannons(n) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(MAX_EXTRA_CANNONS, v);
}

/** Coerce a stored / live owned ship-class id to a known class, defaulting to the starting sloop. */
export function sanitizeShipClass(id) {
  return (typeof id === 'string' && SHIP_CLASSES[id]) ? id : DEFAULT_SHIP_CLASS;
}

/** Total guns on deck for a given extra-cannon count: the base battery plus what you've bought. */
export function totalGuns(extra) {
  return BASE_GUNS + sanitizeExtraCannons(extra);
}

/** The coin cost of the NEXT cannon at this owned count, or null when the battery is maxed. */
export function nextCannonCost(extra) {
  const e = sanitizeExtraCannons(extra);
  if (e >= MAX_EXTRA_CANNONS) return null;
  return CANNON_COSTS[e];
}

/**
 * Can the captain buy another cannon right now? PURE — reads only the owned count + purse.
 * @param {{extra:number, coins:number}} args
 * @returns {{ok:boolean, reason:(null|'maxed'|'no-coins'), cost:(number|null)}}
 */
export function canBuyCannon({ extra, coins } = {}) {
  const cost = nextCannonCost(extra);
  if (cost === null) return { ok: false, reason: 'maxed', cost: null };
  const purse = Number.isFinite(coins) ? coins : 0;
  if (purse < cost) return { ok: false, reason: 'no-coins', cost };
  return { ok: true, reason: null, cost };
}

/**
 * Buy the next cannon. PURE + TOTAL: returns a NEW result, never mutates. On success the owned count
 * goes up one and the purse is docked the cost; on failure the count/purse are returned unchanged
 * with a reason, so the caller can flash a refusal.
 * @param {{extra:number, coins:number}} args
 * @returns {{ok:boolean, reason:(null|'maxed'|'no-coins'), extra:number, coins:number, cost:(number|null)}}
 */
export function buyCannon({ extra, coins } = {}) {
  const e = sanitizeExtraCannons(extra);
  const purse = Number.isFinite(coins) ? coins : 0;
  const gate = canBuyCannon({ extra: e, coins: purse });
  if (!gate.ok) return { ok: false, reason: gate.reason, extra: e, coins: purse, cost: gate.cost };
  return { ok: true, reason: null, extra: e + 1, coins: purse - gate.cost, cost: gate.cost };
}

/**
 * The broadside hull-damage multiplier your owned cannons earn — the FEEL of the upgrade. Feeds
 * straight into cannons.resolveBroadside / resolveExchange (a plain scalar on the player's bite).
 * Base (no extra) is exactly 1.0 so every legacy caller/test stays byte-identical.
 * @param {number} extra  owned extra cannons
 * @returns {number} >= 1.0
 */
export function broadsideMult(extra) {
  return 1 + sanitizeExtraCannons(extra) * GUN_DAMAGE_STEP;
}

/** The deck-mount slots occupied by the first `extra` bought cannons (for the gun mesh). */
export function deckGunSlots(extra) {
  return DECK_GUN_SLOTS.slice(0, sanitizeExtraCannons(extra));
}

// Re-export the class ladder id list so #171's ship-class purchase can walk it without re-importing.
export { CLASS_ORDER };
