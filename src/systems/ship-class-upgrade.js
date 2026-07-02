// Ship-class upgrades — buy a BIGGER ship at the Shipwright (#171, epic #168 "The Rise").
//
// Slice 2 (#170) let you buy CANNONS on your fixed sloop; this slice lets you buy a bigger HULL. The
// sloop→brig→frigate→man-o'-war class ladder already exists in src/ship-classes.js — but for NPCs
// ONLY (npc.js scales their mesh by `sizeScale`; cannons.makeFoe seeds their hull/gunnery). This is
// the owner's biggest power fantasy: spend coin to step UP a class so your ship VISIBLY dwarfs the
// sloop you started in AND fights bigger — more bite, more armour.
//
// This module is the PURE core of that purchase: the coin cost curve, the class→player-combat map,
// and the class→mesh-scale factor (reusing the NPC `sizeScale` so player + NPC dwarfing share ONE
// source). No THREE, no DOM, no game state — the whole progression unit-tests under `node --test`.
// main.js owns the wiring (spend coin, rescale the ship mesh, feed the combat mults into
// cannons.resolveBroadside/resolveExchange, persist the class in the v18 `shipClass` field).
//
// NO SAVE BUMP: the owned class rides the `shipClass` field #170 already RESERVED in v18 (default
// 'sloop'). This slice only WIRES it — persist on buy, apply on load. (#122 rule: the lane bumps ONCE.)

import { SHIP_CLASSES } from '../ship-classes.js';
import { sanitizeShipClass, DEFAULT_SHIP_CLASS } from './gun-upgrade.js';

// The buyable class ladder for THIS slice: sloop → brig → frigate. The warship man-o'-war (the deep
// sea's apex, #167) is a deliberate FOLLOW-UP — the smallest always-shippable increment lands the
// see/feel rise up to a frigate, whose ~1.7× hull already dwarfs the starting sloop legibly. A later
// slice extends the ladder to the man-o'-war once the frigate step is proven fun.
export const PLAYER_CLASS_LADDER = ['sloop', 'brig', 'frigate'];

// The coin to step UP to each class, keyed by the DESTINATION. Escalating and deliberately dear —
// a class is a far bigger investment than a single cannon (#170: 180/340/560c), a real save-up goal
// you take several good prizes to reach. The starting sloop costs nothing (it's where you begin).
export const CLASS_COSTS = { brig: 600, frigate: 1400 };

// The player-progression combat table — the Game Designer's fun-shaping numbers. The SLOOP is the
// starting hull and is the EXACT pre-#171 baseline (×1.0 everywhere), so a fresh voyage fights
// byte-identically to before this slice. Each class up makes her hit harder (`broadside` scales the
// hull bite) and soak more (`armor` DIVIDES the fire she takes → she survives more volleys). These
// mirror the SPIRIT of the NPC class table (ship-classes.js: bigger = tougher + heavier guns) but
// are tuned for the PLAYER so a frigate is a real power fantasy — yet a warship man-o'-war still
// takes several volleys and her broadside still stings (the rise buys an edge, never invincibility).
export const PLAYER_COMBAT = {
  sloop:   { broadside: 1.0,  armor: 1.0  },
  brig:    { broadside: 1.22, armor: 1.28 },
  frigate: { broadside: 1.5,  armor: 1.6  },
};

/** The player's owned class as an index into the buyable ladder, or -1 if off-ladder (e.g. manowar). */
function ladderIndex(id) {
  return PLAYER_CLASS_LADDER.indexOf(sanitizeShipClass(id));
}

/** The next class UP the ladder from `id`, or null when already at the top (or off-ladder). */
export function nextClass(id) {
  const i = ladderIndex(id);
  if (i < 0 || i >= PLAYER_CLASS_LADDER.length - 1) return null;
  return PLAYER_CLASS_LADDER[i + 1];
}

/** The coin cost of the NEXT class step, or null when the ladder is maxed. */
export function nextClassCost(id) {
  const nxt = nextClass(id);
  return nxt ? (CLASS_COSTS[nxt] ?? null) : null;
}

/**
 * Can the captain buy the next class up right now? PURE — reads only the owned class + purse.
 * @param {{shipClass:string, coins:number}} args
 * @returns {{ok:boolean, reason:(null|'maxed'|'no-coins'), cost:(number|null), next:(string|null)}}
 */
export function canBuyClass({ shipClass, coins } = {}) {
  const nxt = nextClass(shipClass);
  if (!nxt) return { ok: false, reason: 'maxed', cost: null, next: null };
  const cost = CLASS_COSTS[nxt];
  const purse = Number.isFinite(coins) ? coins : 0;
  if (purse < cost) return { ok: false, reason: 'no-coins', cost, next: nxt };
  return { ok: true, reason: null, cost, next: nxt };
}

/**
 * Buy the next class up. PURE + TOTAL: returns a NEW result, never mutates. On success the class
 * advances one rung and the purse is docked the cost; on failure the class/purse are returned
 * unchanged with a reason so the caller can flash a refusal.
 * @param {{shipClass:string, coins:number}} args
 * @returns {{ok:boolean, reason:(null|'maxed'|'no-coins'), shipClass:string, coins:number,
 *            cost:(number|null), next:(string|null)}}
 */
export function buyClass({ shipClass, coins } = {}) {
  const cls = sanitizeShipClass(shipClass);
  const purse = Number.isFinite(coins) ? coins : 0;
  const gate = canBuyClass({ shipClass: cls, coins: purse });
  if (!gate.ok) return { ok: false, reason: gate.reason, shipClass: cls, coins: purse, cost: gate.cost, next: gate.next };
  return { ok: true, reason: null, shipClass: gate.next, coins: purse - gate.cost, cost: gate.cost, next: nextClass(gate.next) };
}

/**
 * The MESH scale factor your class earns, RELATIVE to the starting sloop (so sloop = exactly 1.0 and
 * a fresh voyage is byte-identical). Reuses the NPC `sizeScale` from ship-classes.js — ONE source, so
 * the player frigate dwarfs the sloop by the SAME ratio an NPC frigate dwarfs an NPC sloop. main.js
 * multiplies this onto the ship's base (hull-normalising) scale — no new geometry (#121), just bigger.
 * @param {string} id  the owned class id
 * @returns {number} >= 1.0 for the ladder (sloop 1.0 → brig ~1.32 → frigate ~1.74)
 */
export function classScale(id) {
  const cls = sanitizeShipClass(id);
  const base = SHIP_CLASSES[DEFAULT_SHIP_CLASS].sizeScale;
  return (SHIP_CLASSES[cls]?.sizeScale ?? base) / base;
}

/** The broadside (offence) multiplier your class earns — a bigger hull's heavier guns bite harder. */
export function classBroadsideMult(id) {
  return (PLAYER_COMBAT[sanitizeShipClass(id)] || PLAYER_COMBAT[DEFAULT_SHIP_CLASS]).broadside;
}

/** The armour (defence) DIVISOR your class earns — a bigger hull soaks more of the fire she takes. */
export function classArmor(id) {
  return (PLAYER_COMBAT[sanitizeShipClass(id)] || PLAYER_COMBAT[DEFAULT_SHIP_CLASS]).armor;
}

/** The human label for a class (for the Shipwright plank + banners). */
export function classLabel(id) {
  const cls = sanitizeShipClass(id);
  return SHIP_CLASSES[cls]?.label ?? SHIP_CLASSES[DEFAULT_SHIP_CLASS].label;
}

/** The player's ship-class THREAT tier (sloop 1 · brig 2 · frigate 3) — the dread model (#172) reads it
 *  against a foe's tier to size the GAP. Shares the ONE class table so player + NPC tiers never drift. */
export function classTier(id) {
  const cls = sanitizeShipClass(id);
  return SHIP_CLASSES[cls]?.tier ?? SHIP_CLASSES[DEFAULT_SHIP_CLASS].tier;
}

// Re-export the class sanitiser so callers can validate a stored/live class from one import.
export { sanitizeShipClass };
