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
import {
  makeFoe, resolveBroadside, spoils, captureSpoils, repairToll,
  defeatLine, strikeLine, fireQuip, MAX_HULL, MORALE_MAX,
} from '../cannons.js';

// Slice 2 (#135) tunables — the Game Designer's fun-shaping numbers:
//   RELOAD_SECONDS — how long the gun deck takes to swab and reload between volleys, so the
//     loop is maneuver → line up → FIRE → come about, never a fire-button mash.
//   ARC_THRESHOLD  — how close to dead-abeam the foe must be for a shot to "count" (the HUD's
//     ABEAM cue). Below it a volley flies wide. 0.5 ≈ within ±60° of perfectly abeam.
export const RELOAD_SECONDS = 2.2;
export const ARC_THRESHOLD = 0.5;

// On a clean beam shot landing — a salty crack to punctuate the volley (reuses the cannonade pool).
// On a wide shot — the bosun's nudge to bring her broadside to bear.
const WIDE_LINE = 'Wide! She’s not abeam — bring her round and lay her alongside!';

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

/**
 * How well the foe is ABEAM of you (#135 slice 2) — the heart of the real-time broadside. A
 * broadside fires from the SIDE of the ship, so the bite is best when the foe sits dead off your
 * beam (~90° from the bow, port or starboard) and falls to nothing when she's dead ahead/astern.
 * PURE geometry, same convention as quarterViewPos: forward=(sin h, cos h), starboard=(cos h,−sin h).
 * @param {[number,number]} shipXZ  the ship's [x, z]
 * @param {number} heading          the ship heading (radians)
 * @param {[number,number]} foeXZ   the foe's [x, z]
 * @param {{arcThreshold?:number}} [opts]
 * @returns {{quality:number, side:'port'|'starboard', inArc:boolean}}
 */
export function broadsideAim([sx, sz], heading, [fx, fz], { arcThreshold = ARC_THRESHOLD } = {}) {
  const dx = fx - sx, dz = fz - sz;
  const len = Math.hypot(dx, dz) || 1;
  const nx = dx / len, nz = dz / len;
  const rightX = Math.cos(heading), rightZ = -Math.sin(heading);
  const beamDot = nx * rightX + nz * rightZ; // ±1 when dead abeam, 0 when ahead/astern
  const quality = Math.min(1, Math.abs(beamDot));
  return { quality, side: beamDot >= 0 ? 'starboard' : 'port', inArc: quality >= arcThreshold };
}

// ---- Engagement controller (wired into main.js) -----------------------------
//
// Owns the live deliberate stance. DOM-free: the HUD reads `battle.snapshot()`; main.js
// drives engage/flee from the key verb and ends it when a cannonade resolves or a new
// voyage resets. Mirrors createCannons/createDuel so the combat paths feel like siblings.
//
// createBattle({ npcs, getShipPos, getShipHeading, onEnter, onFlee, onResolve,
//                applyReward, applyPenalty, sfx, rng, reloadSeconds })
//   npcs          : the createNpcs() handle (snapshot())
//   getShipPos    : () => [x, z]   the player's current position
//   getShipHeading: () => radians  the player's current heading (for the broadside arc, slice 2)
//   onEnter       : ({ foeName, foeIndex }) -> announce the stance (banner)
//   onFlee        : ({ foeName }) -> announce the break-off (banner)
//   onResolve     : ({ result, reward, penalty, foeName }) -> announce a real-time broadside outcome
//   applyReward   : (spoils)  -> apply coins/infamy/standing on a sinking or capture
//   applyPenalty  : (toll)    -> apply the repair setback if the player is beaten
//   sfx           : (kind) -> optional audio sting (reuses the duel bus kinds)
//   reloadSeconds : how long the guns take to reload between volleys (slice 2)

export function createBattle({
  npcs, getShipPos, getShipHeading, onEnter, onFlee, onResolve,
  applyReward, applyPenalty, sfx, rng = Math.random, reloadSeconds = RELOAD_SECONDS,
} = {}) {
  // A sting must never break the stance, so every audio call is swallowed.
  function ping(kind) {
    try { if (sfx) sfx(kind); } catch { /* a sting must never sink the battle */ }
  }

  const state = {
    active: false,
    foeIndex: -1,
    foeName: '',
    // Real-time broadside engagement (slice 2) — seeded on engage, reset on flee/end.
    playerHull: MAX_HULL,
    enemyHull: MAX_HULL,
    maxHull: MAX_HULL,
    enemyMorale: MORALE_MAX,
    maxMorale: MORALE_MAX,
    reload: 0,        // seconds until the guns are loaded again (0 = ready to fire)
    round: 0,         // volleys fired this engagement
    result: null,     // 'win' (sunk) | 'capture' (yielded) | 'lose' | null
    lastLine: '',     // a quip / the bosun's nudge / the foe's parting cry
    lastSide: 'starboard',
  };
  let foe = null;

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

  // Reset the engagement fields to a clean, un-engaged state.
  function clear() {
    state.active = false;
    state.foeIndex = -1;
    state.foeName = '';
    state.playerHull = MAX_HULL;
    state.enemyHull = MAX_HULL;
    state.enemyMorale = MORALE_MAX;
    state.reload = 0;
    foe = null;
  }

  /** Square up to the nearest foe — take the deliberate battle stance. True if it started. */
  function engage() {
    if (state.active) return false;
    const idx = nearestInRange();
    if (idx === -1) return false;
    foe = makeFoe(rng); // a characterful foe: name + a plausible gunnery, full hull
    state.active = true;
    state.foeIndex = idx;
    state.foeName = foe.name;
    state.playerHull = MAX_HULL;
    state.enemyHull = MAX_HULL;
    state.maxHull = MAX_HULL;
    state.enemyMorale = MORALE_MAX;
    state.maxMorale = MORALE_MAX;
    state.reload = 0;          // you square up with the guns loaded and ready
    state.round = 0;
    state.result = null;
    state.lastLine = '';
    state.lastSide = 'starboard';
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
    clear();
    ping('lose'); // the wry break-off sting (reuses the duel bus)
    if (onFlee) {
      try { onFlee({ foeName }); }
      catch { /* a flourish must never break the stance */ }
    }
    return true;
  }

  /** End the stance WITHOUT a flee flourish — a cannonade resolved it, or a new voyage reset. */
  function end() { clear(); }

  // The engaged foe's current [x, z], read live from the world so you can steer to bring her
  // abeam (the world keeps living underneath — she may be moving). null if she's gone.
  function foePos() {
    const snaps = (npcs && npcs.snapshot && npcs.snapshot()) || [];
    const s = snaps[state.foeIndex];
    return (s && s.pos) ? s.pos : null;
  }

  /** The live broadside-arc reading for the engaged foe (slice 2). PURE-derived from world state. */
  function aim() {
    if (!state.active) return { quality: 0, side: 'starboard', inArc: false };
    const fp = foePos();
    if (!fp) return { quality: 0, side: 'starboard', inArc: false };
    const ship = (getShipPos && getShipPos()) || [0, 0];
    const h = (getShipHeading && getShipHeading()) || 0;
    return broadsideAim(ship, h, fp);
  }

  /** Advance the gun reload on the sim clock (slice 2). Called each frame while engaged. */
  function tick(dt) {
    if (!state.active || !(dt > 0)) return;
    if (state.reload > 0) state.reload = Math.max(0, state.reload - dt);
  }

  // Resolve a real-time broadside outcome: pay spoils / take the repair toll, announce, end the
  // engagement (which returns the helm to SAILING via main.js's mode system). Mirrors cannons.finish.
  function finish(result) {
    state.result = result;
    let reward = null, penalty = null;
    if (result === 'win') {
      state.lastLine = defeatLine(rng);
      reward = spoils({ playerHull: state.playerHull, enemyMaxHull: state.maxHull });
      ping('win');
      if (applyReward) applyReward(reward);
    } else if (result === 'capture') {
      state.lastLine = strikeLine(rng);
      reward = { ...captureSpoils({ playerHull: state.playerHull, enemyMaxHull: state.maxHull }), captured: true };
      ping('win'); // a capture is a victory too
      if (applyReward) applyReward(reward);
    } else { // 'lose'
      penalty = repairToll();
      ping('lose');
      if (applyPenalty) applyPenalty(penalty);
    }
    const foeName = state.foeName;
    if (onResolve) {
      try { onResolve({ result, reward, penalty, foeName }); }
      catch { /* a flourish must never break the loop */ }
    }
    clear();
    state.result = result; // keep the verdict readable for one snapshot after clearing
    return { result, reward, penalty };
  }

  /**
   * Discharge the loaded broadside in real time (slice 2). No-op while not engaged or still
   * reloading. The bite scales with how well the foe is abeam (aim quality); the foe replies if
   * still afloat; a sinking/capture/loss resolves the engagement. Returns the volley result, or null.
   */
  function fire() {
    if (!state.active || !foe) return null;
    if (state.reload > 0) return null; // the guns aren't loaded yet
    const a = aim();
    const r = resolveBroadside(
      { quality: a.quality, enemyHull: state.enemyHull, playerHull: state.playerHull, gunnery: foe.gunnery, morale: state.enemyMorale },
      rng
    );
    state.enemyHull = r.enemyHull;
    state.playerHull = r.playerHull;
    state.enemyMorale = r.enemyMorale;
    state.reload = reloadSeconds; // swab and reload before the next volley
    state.round++;
    state.lastSide = a.side;

    if (r.sunkEnemy) return finish('win');
    if (r.sunkPlayer) return finish('lose');
    if (r.yielded) return finish('capture');
    state.lastLine = a.inArc ? fireQuip('broadside', rng) : WIDE_LINE;
    ping('cut'); // a solid hit / a spent volley
    return r;
  }

  // A plain, JSON-safe snapshot for the window.__tidewake QA hook + the HUD.
  function snapshot() {
    const a = aim();
    return {
      active: state.active,
      foeName: state.foeName,
      foeIndex: state.foeIndex,
      inRange: inRange(),
      // Real-time broadside (slice 2):
      playerHull: state.playerHull,
      enemyHull: state.enemyHull,
      maxHull: state.maxHull,
      enemyMorale: state.enemyMorale,
      maxMorale: state.maxMorale,
      reload: state.reload,
      loaded: state.active && state.reload <= 0,
      aimQuality: a.quality,
      aimSide: a.side,
      inArc: a.inArc,
      round: state.round,
      result: state.result,
      lastLine: state.lastLine,
    };
  }

  return { state, engage, flee, end, fire, tick, aim, inRange, nearestInRange, snapshot };
}
