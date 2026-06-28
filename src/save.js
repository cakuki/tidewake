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
import { normalizeFlags, freshFlags, completedFlags } from './onboarding.js';
import { sanitizeLog } from './voyage-log.js';
import { COLOURS, DEFAULT_COLOURS } from './colours.js';
import { sanitizePortMemory } from './systems/port-memory.js';

// The set of colours ids we'll accept back from storage (#79). Anything else loads as the
// honest default rather than rejecting the whole save (flag choice is flavour, not physics).
const KNOWN_COLOUR_IDS = new Set(COLOURS.map((c) => c.id));

export const SAVE_KEY = 'tidewake.save.v1';
// v2 added the economy fields (coins + cargo); v3 added renown (the Captain's Ledger);
// v4 split renown into two poles — infamy (pirate) + standing (governor) (#45); v5 added
// the earned endgame legends ({pirate, governor} crowns, #46); v6 added the invisible-
// onboarding progress flags (seeded goal + first-win beats, fired once per captain, #60);
// v7 added the voyage log — the deeds the Ballad of Your Voyage is composed from (#78);
// v8 added the displayed colours — true black vs false merchant flag (#79 False Colours);
// v9 added per-port memory — what each town remembers of your prior dealings (#104).
// Older saves fail the version gate and fall back to a fresh voyage rather than crashing.
export const SAVE_VERSION = 9;

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
  // Endgame legends (#46): the earned crowns. Plain booleans, coerced; a pre-legend
  // caller (no `legends`) simply records none earned.
  const lg = state.legends || {};
  const legends = { pirate: !!lg.pirate, governor: !!lg.governor };
  // Onboarding progress (#60): the seeded-goal + first-win flags, coerced to safe booleans.
  // A pre-onboarding caller (no `onboarding`) records a fresh, all-to-do set.
  const onboarding = state.onboarding ? normalizeFlags(state.onboarding) : freshFlags();
  // Voyage log (#78): the deeds the Ballad is composed from. Sanitised on the way out so
  // only clean, known entries are stored; a pre-ballad caller simply records an empty log.
  const voyageLog = sanitizeLog(state.voyageLog);
  // Displayed colours (#79): the chosen flag, validated to a known id; junk → honest black.
  const colours = KNOWN_COLOUR_IDS.has(state.colours) ? state.colours : DEFAULT_COLOURS;
  // Per-port memory (#104): what each town remembers of you. Sanitised on the way out so only
  // clean records persist; a pre-memory caller simply records an empty store (no port knows you).
  const portMemory = sanitizePortMemory(state.portMemory);
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
    legends,
    onboarding,
    voyageLog,
    colours,
    portMemory,
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

  // Endgame legends (save v5): the earned crowns, coerced to safe booleans. Absent or
  // malformed → none earned; a junk `legends` never rejects an otherwise-valid save (the
  // legend is a celebration flag, not load-bearing physics — fail open, not closed).
  const lg = (obj.legends && typeof obj.legends === 'object' && !Array.isArray(obj.legends)) ? obj.legends : {};
  const legends = { pirate: !!lg.pirate, governor: !!lg.governor };

  // Onboarding progress (save v6, #60): coerce to safe booleans; like legends, junk never
  // rejects an otherwise-valid save (these are teaching flags, not load-bearing physics).
  // If the field is ABSENT (a leaner / migrated save), infer from progress: a captain who
  // already has coin beyond the starting purse, any renown, or cargo isn't new — they're
  // returning, so onboarding is considered done and they're never nagged. An untouched save
  // gets a fresh set so the goal can still greet a genuinely new captain.
  let onboarding;
  if (obj.onboarding !== undefined) {
    onboarding = normalizeFlags(obj.onboarding);
  } else {
    const hasProgress = coins !== START_COINS || infamy > 0 || standing > 0 || Object.keys(cleanCargo).length > 0;
    onboarding = hasProgress ? completedFlags() : freshFlags();
  }

  // Voyage log (save v7, #78): the deeds for the Ballad. Like legends/onboarding it's
  // flavour, not load-bearing physics — sanitiseLog drops any junk/foreign entry rather than
  // rejecting an otherwise-valid save (fail open). Absent → an empty log (a fresh tale).
  const voyageLog = sanitizeLog(obj.voyageLog);

  // Displayed colours (save v8, #79): flavour, not load-bearing physics — an absent or
  // unknown value loads as the honest black default rather than rejecting the save.
  const colours = KNOWN_COLOUR_IDS.has(obj.colours) ? obj.colours : DEFAULT_COLOURS;

  // Per-port memory (save v9, #104): like legends/onboarding/ballad it's flavour, not load-bearing
  // physics — sanitizePortMemory drops any junk/zero-visit record rather than rejecting an
  // otherwise-valid save (fail open). Absent → an empty store (a town that doesn't know you yet).
  const portMemory = sanitizePortMemory(obj.portMemory);

  return {
    heading,
    speed: Math.max(0, speed),
    throttle: clamp(throttle, 0, 1),
    pos: [pos[0], pos[1], pos[2]],
    coins,
    cargo: cleanCargo,
    infamy,
    standing,
    legends,
    onboarding,
    voyageLog,
    colours,
    portMemory,
    renown: infamy + standing, // derived spine, for any caller that still reads it
  };
}
