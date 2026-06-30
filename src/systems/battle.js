// Battle Mode — the deliberate fight STANCE (#135, slice 1 of the owner's battle lane).
//
// Until now a fight was only ever REACTIVE: press 'g' and the cannonade resolves itself
// in an instant turn-based exchange (cannons.js), or 'f' for the insult duel. There was
// no *deliberate* "I choose to give battle" beat — the Sid Meier's Pirates! moment where
// you square up to a sail, the camera swings to a quarter-view, the music settles, and the
// world keeps living around you while you bear down for a broadside.
//
// This is the SHELL for that: a held BATTLE engagement you ENTER against the nearest ship
// and can always FLEE from. It rides the #95 mode-switch infra (main.js holds mode=BATTLE
// while this is active OR a cannonade is live), inherits the #94 battle-music settle and the
// #116 feedback vocabulary, and is the maneuvering arena the later slices (real-time
// broadside, loadouts, boarding, the expanded duel) build on. The existing cannonade (#59)
// is the teeth INSIDE this stance; this slice only adds the deliberate enter→stance→leave.
//
// CREATIVE SPARK (Game Designer): a battle isn't a menu you fall into — it's a CHOICE OF
// STANCE you commit to. Engaging is "hands off the trade-winds, eyes on the prize"; fleeing
// is always on the table (a coward lives to sail another day), so the commitment is real but
// never a trap. The quarter-view camera is the drama — the helm pulls back and to your
// quarter so you finally SEE your ship and your foe square off across the swell.
//
// PURE on purpose — no THREE, no DOM, no game state. The geometry of the quarter-view camera
// and the engage/flee lifecycle are unit-tested under node (tests/unit/battle.test.mjs);
// main.js owns the wiring (the key verb, the camera ease, the HUD banner).

import { CHALLENGE_RANGE } from '../duel.js';
import { makeFoe } from '../cannons.js';

// ---- PURE helpers -----------------------------------------------------------

// On engaging — the foe's challenge as you bear down. Original to Tidewake, on-tone, daft.
const ENGAGE_LINES = [
  'Squaring up! Steer for her beam and run out the guns — or break off while you still can.',
  'Battle stations! Get a broadside angle on her, captain — the wind is yours to spend.',
  'You bear down hard. She heels to meet you — this is a fight now, or a chase if you flinch.',
  'Colours up, gunports ready! Lay her alongside for a broadside, or come about and flee.',
];

// On fleeing — breaking off the engagement. A coward's grace, played for a wink not a sting.
const FLEE_LINES = [
  'You come hard about and slip the engagement — the foe jeers, but the crabs go hungry tonight.',
  'Sails full, helm over — you break off and run. Discretion, the better part of plunder.',
  'You wave off the fight and bear away. "We’ll settle this another tide!" hollers the bosun.',
  'Off the wind and away — you leave the foe shaking a fist at your wake. Live to sail again.',
];

function pickIndex(rng, n) {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** The foe's challenge line as the stance is taken. PURE + injectable rng. */
export function engageLine(rng = Math.random) {
  return ENGAGE_LINES[pickIndex(rng, ENGAGE_LINES.length)];
}

/** The breaking-off line as you flee the stance. PURE + injectable rng. */
export function fleeLine(rng = Math.random) {
  return FLEE_LINES[pickIndex(rng, FLEE_LINES.length)];
}

/**
 * The quarter-view camera world position for a battle (#135). PURE geometry: pull the camera
 * astern and off to the ship's starboard quarter and lift it, so the player SEES their ship in
 * three-quarter profile squaring up to the foe — the deliberate "change of stance" framing.
 * Convention matches the sim: forward = (sin h, cos h), starboard = (cos h, -sin h).
 * @param {[number,number]} shipXZ  the ship's [x, z]
 * @param {number} heading          the ship heading (radians)
 * @param {{back?:number, side?:number, height?:number}} [opts]
 * @returns {[number, number, number]} the camera [x, y, z]
 */
export function quarterViewPos([x, z], heading, { back = 95, side = 60, height = 52 } = {}) {
  const fwdX = Math.sin(heading), fwdZ = Math.cos(heading);
  const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
  return [
    x - fwdX * back + rightX * side, // astern + to starboard
    height,                          // lifted for the three-quarter look
    z - fwdZ * back + rightZ * side,
  ];
}

// ---- Engagement controller (wired into main.js) -----------------------------
//
// Owns the live deliberate stance. DOM-free: the HUD reads `battle.snapshot()`; main.js
// drives engage/flee from the key verb and ends it when a cannonade resolves or a new
// voyage resets. Mirrors createCannons/createDuel so the combat paths feel like siblings.
//
// createBattle({ npcs, getShipPos, onEnter, onFlee, sfx, rng })
//   npcs       : the createNpcs() handle (snapshot())
//   getShipPos : () => [x, z]   the player's current position
//   onEnter    : ({ foeName, foeIndex }) -> announce the stance (banner)
//   onFlee     : ({ foeName }) -> announce the break-off (banner)
//   sfx        : (kind) -> optional audio sting (reuses the duel bus kinds)

export function createBattle({ npcs, getShipPos, onEnter, onFlee, sfx, rng = Math.random } = {}) {
  // A sting must never break the stance, so every audio call is swallowed.
  function ping(kind) {
    try { if (sfx) sfx(kind); } catch { /* a sting must never sink the battle */ }
  }

  const state = {
    active: false,
    foeIndex: -1,
    foeName: '',
  };

  // Nearest NPC within engage range, or -1. Positions are [x,z]; ship pos is [x,z] too.
  function nearestInRange() {
    const ship = getShipPos && getShipPos();
    if (!ship) return -1;
    const snaps = (npcs && npcs.snapshot && npcs.snapshot()) || [];
    let best = -1, bestD = CHALLENGE_RANGE;
    for (let i = 0; i < snaps.length; i++) {
      const p = snaps[i].pos;
      const d = Math.hypot(p[0] - ship[0], p[1] - ship[1]);
      if (d <= bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** Is there a ship to give battle to within range right now (and not already engaged)? */
  function inRange() { return !state.active && nearestInRange() !== -1; }

  /** Square up to the nearest foe — take the deliberate battle stance. True if it started. */
  function engage() {
    if (state.active) return false;
    const idx = nearestInRange();
    if (idx === -1) return false;
    state.active = true;
    state.foeIndex = idx;
    state.foeName = makeFoe(rng).name; // a characterful name for the foe you square up to
    ping('challenge'); // colours up, gunports ready
    if (onEnter) {
      try { onEnter({ foeName: state.foeName, foeIndex: idx }); }
      catch { /* a flourish must never break the stance */ }
    }
    return true;
  }

  /** Break off — always available. Returns true if an engagement was actually fled. */
  function flee() {
    if (!state.active) return false;
    const foeName = state.foeName;
    state.active = false;
    state.foeIndex = -1;
    state.foeName = '';
    ping('lose'); // the wry break-off sting (reuses the duel bus)
    if (onFlee) {
      try { onFlee({ foeName }); }
      catch { /* a flourish must never break the stance */ }
    }
    return true;
  }

  /** End the stance WITHOUT a flee flourish — a cannonade resolved it, or a new voyage reset. */
  function end() {
    state.active = false;
    state.foeIndex = -1;
    state.foeName = '';
  }

  // A plain, JSON-safe snapshot for the window.__tidewake QA hook + the HUD.
  function snapshot() {
    return {
      active: state.active,
      foeName: state.foeName,
      foeIndex: state.foeIndex,
      inRange: inRange(),
    };
  }

  return { state, engage, flee, end, inRange, nearestInRange, snapshot };
}
