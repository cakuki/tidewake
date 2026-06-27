// Save/load voyage persistence — pure, DOM-free, three.js-free serialize/validate
// helpers so the whole save schema can be unit-tested under `node --test`. The
// renderer (main.js) owns the actual localStorage I/O (guarded in try/catch) and
// just leans on these functions for the shape, versioning, and sanity-checks.
//
// Contract: a "save" is a tiny JSON object
//   { v, heading, speed, throttle, pos, coins, cargo, infamy, standing }
// where pos is a [x, y, z] array, coins is a finite number >= 0, cargo is a
// {goodId: qty} map over known goods (total within HOLD_CAP), and infamy + standing are
// finite numbers >= 0 (the two poles of the Captain's Ledger; absent poles load as 0,
// and renown is derived as their sum, not stored). Anything that doesn't match — wrong
// version, missing/partial fields, non-finite numbers, absurd positions,
// unknown/over-capacity cargo — deserialises to `null` so the caller can simply start a
// fresh voyage. Never throws.

import { GOODS, HOLD_CAP, START_COINS } from './economy.js';

export const SAVE_KEY = 'tidewake.save.v1';
// v2 added the economy fields (coins + cargo); v3 added renown (the Captain's Ledger);
// v4 split renown into two poles — infamy (pirate) + standing (governor) (#45).
// Older saves fail the version gate and fall back to a fresh voyage rather than crashing.
export const SAVE_VERSION = 4;

// The set of canonical cargo keys we'll accept back from storage. Anything else is
// treated as corrupt — cargo keys are a single source of truth in economy.js.
const KNOWN_GOOD_IDS = new Set(GOODS.map((g) => g.id));

// Defensive world bound: positions beyond this are treated as corrupt rather than
// teleporting the player into the void. The sea is large but not unbounded.
const MAX_COORD = 1e7;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// Produce a clean cargo map for storage: only known goods with a positive, finite
// quantity. Drops unknown keys and emptied (zero) holds. Never mutates the input.
function cleanCargoForSave(cargo) {
  const out = {};
  if (cargo && typeof cargo === 'object' && !Array.isArray(cargo)) {
    for (const id of KNOWN_GOOD_IDS) {
      const q = cargo[id];
      if (isFiniteNumber(q) && q > 0) out[id] = q;
    }
  }
  return out;
}

/**
 * Serialise a live ship state into a versioned JSON string ready for storage.
 * Accepts `pos` as either a [x,y,z] array or a THREE.Vector3-like object exposing
 * `toArray()` — so callers can pass `state.pos` straight through.
 * @param {{heading:number, speed:number, throttle:number, pos:number[]|{toArray:()=>number[]}}} state
 * @returns {string} JSON string
 */
export function serialize(state) {
  const pos = Array.isArray(state.pos)
    ? state.pos
    : (state.pos && typeof state.pos.toArray === 'function' ? state.pos.toArray() : [0, 0, 0]);
  // Economy: persist the purse + hold. A live state always carries these (economy.js
  // initialises them), but default defensively so a pre-economy caller still round-trips.
  const coins = isFiniteNumber(state.coins) && state.coins >= 0 ? state.coins : START_COINS;
  // Two poles (#45): infamy (pirate) + standing (governor); each defaults to 0 for a
  // pre-pole caller. Renown is derived (infamy + standing) on load, so it isn't stored.
  const infamy = isFiniteNumber(state.infamy) && state.infamy >= 0 ? state.infamy : 0;
  const standing = isFiniteNumber(state.standing) && state.standing >= 0 ? state.standing : 0;
  return JSON.stringify({
    v: SAVE_VERSION,
    heading: state.heading,
    speed: state.speed,
    throttle: state.throttle,
    pos: [pos[0], pos[1], pos[2]],
    coins,
    cargo: cleanCargoForSave(state.cargo),
    infamy,
    standing,
  });
}

/**
 * Parse + validate a stored save string. Returns a clean, sanitised state object
 * `{ heading, speed, throttle, pos:[x,y,z], coins, cargo }` on success, or `null` for
 * anything missing, corrupt, or from an incompatible version. A success always carries
 * valid economy fields (coins finite >= 0; cargo a known-goods map within HOLD_CAP),
 * so a restored voyage never lands in an inconsistent economy. Never throws.
 * @param {unknown} raw  the string read back from storage (or null/undefined)
 * @returns {{heading:number, speed:number, throttle:number, pos:number[], coins:number, cargo:object} | null}
 */
export function deserialize(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  // version gate — future fields bump SAVE_VERSION, old saves fall back to fresh
  if (obj.v !== SAVE_VERSION) return null;

  const { heading, speed, throttle, pos } = obj;
  if (!isFiniteNumber(heading) || !isFiniteNumber(speed) || !isFiniteNumber(throttle)) return null;

  if (!Array.isArray(pos) || pos.length !== 3) return null;
  for (const c of pos) {
    if (!isFiniteNumber(c) || Math.abs(c) > MAX_COORD) return null;
  }

  // Economy: coins must be a finite, non-negative purse.
  const { coins, cargo } = obj;
  if (!isFiniteNumber(coins) || coins < 0) return null;

  // Cargo must be a plain object whose keys are known goods and whose quantities are
  // finite, non-negative, and total within the hold's capacity.
  if (!cargo || typeof cargo !== 'object' || Array.isArray(cargo)) return null;
  const cleanCargo = {};
  let held = 0;
  for (const key of Object.keys(cargo)) {
    if (!KNOWN_GOOD_IDS.has(key)) return null;
    const q = cargo[key];
    if (!isFiniteNumber(q) || q < 0) return null;
    held += q;
    if (q > 0) cleanCargo[key] = q;
  }
  if (held > HOLD_CAP) return null;

  // Two poles (save v4): each absent pole loads as 0 (a leaner v4 shape stays valid),
  // but a present-but-corrupt pole — negative or non-finite — fails the whole save.
  let infamy = 0, standing = 0;
  if (obj.infamy !== undefined) {
    if (!isFiniteNumber(obj.infamy) || obj.infamy < 0) return null;
    infamy = obj.infamy;
  }
  if (obj.standing !== undefined) {
    if (!isFiniteNumber(obj.standing) || obj.standing < 0) return null;
    standing = obj.standing;
  }

  return {
    heading,
    speed: Math.max(0, speed),
    throttle: clamp(throttle, 0, 1),
    pos: [pos[0], pos[1], pos[2]],
    coins,
    cargo: cleanCargo,
    infamy,
    standing,
    renown: infamy + standing, // derived spine, for any caller that still reads it
  };
}
