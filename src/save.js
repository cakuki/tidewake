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
import { sanitizeObjective } from './objectives.js';
import { sanitizeHarbour } from './systems/home-port.js';
import { sanitizeMorale } from './systems/morale.js';

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
// v9 added per-port memory — what each town remembers of your prior dealings (#104);
// v10 added the active chased-rumour objective — the typed sea-target you're steering toward
// (marker + arrival payoff), so a reload keeps the pin on your chart (#111/#112/#115).
// v11 deepened per-port memory — each port now also remembers your LAST notable DEED there, recalled
// by name on return, and a most-visited "home port" emerges (#104b, the "Your Harbour" seed); the
// deed rides the existing portMemory store as an additive, fail-open per-record field.
// v12 added the claimed HOME HARBOUR — the governor pole's first reactive verb: the port you've
// claimed as your own ({name, level, invested}), grown a level at a time by investing coin for
// Standing (#118, "Your Harbour"); an additive, fail-open field (junk → no claim).
// v13 added the home-isle GOVERNORSHIP — the lawful arc's named endgame crown, earned by growing
// your home port to its top tier while highly respected (#119); a plain boolean, the mirror of the
// `legends` crowns, coerced + fail-open (junk → not earned).
// v14 deepened the chased-rumour objective — a CONTESTED rumour now also carries the named rival
// racing you + the soft-clock state ({rival, budget, elapsed, claimed}, #133), so a reload can't
// reset the race clock. It rides the existing `objective` field as an additive, fail-open sub-object
// (sanitizeObjective drops a junk contest to a plain chase), so a pre-contest objective loads intact.
// v15 added CREW MORALE — a single 0..100 loyalty meter moved by the player's choices (rescue/plunder/
// a rumour win/a grounding, #124); an additive, fail-open number (junk/absent → the START baseline, so
// an older save simply boards with a willing crew rather than rejecting).
// Older saves fail the version gate and fall back to a fresh voyage rather than crashing.
export const SAVE_VERSION = 15;

// The set of canonical cargo keys we'll accept back from storage. Anything else is
// treated as corrupt — cargo keys are a single source of truth in economy.js.
const KNOWN_GOOD_IDS = new Set(GOODS.map((g) => g.id));

// ---- Declarative forward-migration pipeline (#122, DL #4) --------------------------------------
// A save schema that grows by editing one ever-bigger sanitise function silently WIPES a player's
// progress on every version bump (the old `obj.v !== SAVE_VERSION → null` gate). Instead we run an
// ORDERED chain of tiny per-version steps (v_n → v_{n+1}); an old save is upgraded one rung at a
// time to the current shape, then handed to the single validated reader below — which stays the one
// source of truth for field sanity. Each step is PURE + TOTAL (returns a NEW object, never throws),
// and adding a future field is ONE new registration here (or a no-op when the reader already
// fail-opens on its absence). The reader's fail-open behaviour is preserved as the final safety net.
//
// Most steps are pure version bumps: from v4 on, every field the schema added is FLAVOUR the reader
// already defaults when absent (legends→none, onboarding→inferred, voyageLog→[], colours→default,
// portMemory→{}, objective→null, harbour→null), so the migration only needs to advance the version.
// They're still registered explicitly to keep the chain ordered + auditable and to give any future
// non-trivial transform an obvious home.
const migrations = {
  // v1 → v2: the economy arrived (coins + cargo). A pre-economy save carried no purse/hold, which the
  // reader hard-rejects — so seed a fresh starting purse + empty hold. (The one step that ADDS data.)
  1: (s) => ({ ...s, coins: START_COINS, cargo: {} }),
  // v2 → v3: a single combined `renown` score was added. It's now DERIVED (infamy + standing) and no
  // longer stored, so there's nothing to add — the reader computes it.
  2: (s) => ({ ...s }),
  // v3 → v4: renown was SPLIT into the two poles (infamy/standing, #45). A combined score can't be
  // decomposed, so the poles start at 0 and the stale `renown` field is dropped. This is the single
  // irreducible historical loss; the load-bearing voyage state (pos/coins/cargo) is fully preserved.
  3: ({ renown, ...s }) => ({ ...s }), // eslint-disable-line no-unused-vars
  // v4 → v5 .. v11 → v12: each later field is reader-fail-open flavour → a pure version bump.
  4: (s) => ({ ...s }), // legends (#46)
  5: (s) => ({ ...s }), // onboarding flags (#60)
  6: (s) => ({ ...s }), // voyage log (#78)
  7: (s) => ({ ...s }), // displayed colours (#79)
  8: (s) => ({ ...s }), // per-port memory (#104)
  9: (s) => ({ ...s }), // chased-rumour objective (#111/#112/#115)
  10: (s) => ({ ...s }), // deepened port memory: lastDeed + home port (#104b)
  11: (s) => ({ ...s }), // claimed home harbour (#118)
  12: (s) => ({ ...s }), // home-isle governorship crown (#119)
  13: (s) => ({ ...s }), // contested-rumour rival + soft clock (#133): additive inside `objective`
  14: (s) => ({ ...s }), // crew morale (#124): reader fail-opens an absent meter to the START baseline
};

/**
 * Forward-migrate a parsed save object to the current SAVE_VERSION through the ordered pipeline.
 * Returns a NEW object stamped to the current version, or `null` when the version is missing, not a
 * whole number, from the future, or below range, or a chain step is missing — in every such case the
 * caller falls open to a fresh voyage. Pure; never mutates the input; never throws.
 * @param {object} obj  a parsed save object (must carry a numeric `v`)
 * @returns {object|null}
 */
export function migrate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  let v = obj.v;
  if (!Number.isInteger(v) || v < 1 || v > SAVE_VERSION) return null;
  let cur = obj;
  while (v < SAVE_VERSION) {
    const step = migrations[v];
    if (!step) return null; // a gap in the chain — fail open rather than load a half-migrated save
    cur = { ...step(cur), v: v + 1 };
    v += 1;
  }
  return cur;
}

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
  // Chased-rumour objective (#111/#112/#115): the active typed sea-target the captain is
  // steering toward. Sanitised on the way out so only a clean ACTIVE objective persists; a
  // resolved/absent one stores as null (no pin in flight).
  const objective = sanitizeObjective(state.objective);
  // Claimed home harbour (#118): the governor pole's home port + its growth tier. Sanitised on the
  // way out so only a clean claim persists; an unclaimed caller stores null (no home yet).
  const harbour = sanitizeHarbour(state.harbour);
  // Home-isle governorship (#119): the lawful endgame crown. A plain boolean, coerced; a pre-crown
  // caller (no `governorship`) records it unearned. The named title is derived from `harbour` on read.
  const governorship = !!state.governorship;
  // Crew morale (#124): the single 0..100 loyalty meter. Sanitised on the way out so junk stores as the
  // START baseline (a willing crew) rather than a corrupt number.
  const morale = sanitizeMorale(state.morale);
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
    objective,
    harbour,
    governorship,
    morale,
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

  // version gate — a current save loads directly; an OLDER save is forward-migrated through the
  // declarative pipeline (#122) so a schema bump upgrades the player's progress instead of silently
  // wiping it. A missing / future / unknown version still falls open to a fresh voyage (migrate →
  // null), and the migrated object is then fully re-validated by the reader below (fail-open intact).
  if (obj.v !== SAVE_VERSION) {
    obj = migrate(obj);
    if (!obj) return null;
  }

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

  // Chased-rumour objective (save v10, #111/#112/#115): like the other flavour fields it's not
  // load-bearing physics — sanitizeObjective drops a junk/resolved/absent objective to null
  // (no pin) rather than rejecting an otherwise-valid save (fail open).
  const objective = sanitizeObjective(obj.objective);

  // Claimed home harbour (save v12, #118): like the other flavour fields it's not load-bearing
  // physics — sanitizeHarbour drops a junk/absent claim to null (no home port) rather than
  // rejecting an otherwise-valid save (fail open).
  const harbour = sanitizeHarbour(obj.harbour);

  // Home-isle governorship (save v13, #119): like legends it's a celebration flag, not load-bearing
  // physics — coerced to a safe boolean; junk/absent → not earned, never rejects an otherwise-valid
  // save (fail open, not closed). The named title is derived from `harbour` by the reader.
  const governorship = !!obj.governorship;

  // Crew morale (save v15, #124): like the other flavour fields it's not load-bearing physics —
  // sanitizeMorale clamps a present value into range and fails open to the START baseline on junk or an
  // absent meter (an older save boards with a willing crew) rather than rejecting an otherwise-valid save.
  const morale = sanitizeMorale(obj.morale);

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
    objective,
    harbour,
    governorship,
    morale,
    renown: infamy + standing, // derived spine, for any caller that still reads it
  };
}
