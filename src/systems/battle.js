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
import { ammoProfile, cycleAmmo, AMMO_TYPES } from './ammo.js';
import { canBoard as canBoardHull, resolveBrawl, boardingEdge, offersSurrender } from './board.js';

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

// On refusing a struck foe's surrender (#135, Option 4) — no quarter. Defiant, a touch grim, on-tone.
const NO_QUARTER_LINES = [
  'You wave off her white flag — “No quarter!” Steel comes out; she’ll sell her deck dear now.',
  'Surrender refused. Her captain spits, hauls the colours back up, and squares to fight to the last plank.',
  'You deny her quarter. The guns run out again — this one ends in a wreck or over the rail.',
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

/** The "no quarter" line as you refuse a struck foe's surrender (#135, Option 4). PURE + injectable rng. */
export function noQuarterLine(rng = Math.random) {
  return NO_QUARTER_LINES[pickIndex(rng, NO_QUARTER_LINES.length)];
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
  npcs, getShipPos, getShipHeading, getLoadout, getCrewMorale, onEnter, onFlee, onResolve, onCycleAmmo, onBoard,
  onSurrender, onPressAttack,
  applyReward, applyPenalty, sfx, rng = Math.random, reloadSeconds = RELOAD_SECONDS,
} = {}) {
  // The fitted shot locker (#135 slice 3) — what you fit at the town workshop. The cycle key walks
  // it mid-fight. Defends to a plain round shot so the guns can always fire something.
  function loadout() {
    const lo = (getLoadout && getLoadout()) || AMMO_TYPES;
    return (Array.isArray(lo) && lo.length) ? lo : ['round'];
  }
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
    ammo: 'round',    // the LOADED shot (#135 slice 3) — cycled mid-fight from the fitted loadout
    boarded: false,   // slice 4 — has the crew gone over the rail this engagement?
    brawl: null,      // slice 4 — the resolved deck-brawl beat ({won, advantage, lines}), for the HUD/QA
    // Early surrender / strike-colours short-circuit (Option 4): a broken foe strikes her colours
    // mid-maneuver and the offer is HELD OPEN until you answer — accept the quick capture, or refuse
    // quarter (then she never strikes again this engagement — fights to the bitter end).
    surrenderPending: false,
    quarterRefused: false,
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
    state.boarded = false;
    state.brawl = null;
    state.surrenderPending = false;
    state.quarterRefused = false;
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
    state.boarded = false;
    state.brawl = null;
    state.surrenderPending = false;
    state.quarterRefused = false;
    state.ammo = loadout()[0]; // load the first fitted shot (round, by default) as you square up
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
    if (state.surrenderPending) return null; // she's flying a white flag — answer it before you fire again
    if (state.reload > 0) return null; // the guns aren't loaded yet
    const a = aim();
    const profile = ammoProfile(state.ammo); // the LOADED shot shapes the volley (#135 slice 3)
    const r = resolveBroadside(
      { quality: a.quality, enemyHull: state.enemyHull, playerHull: state.playerHull, gunnery: foe.gunnery, morale: state.enemyMorale, ammo: profile },
      rng
    );
    state.enemyHull = r.enemyHull;
    state.playerHull = r.playerHull;
    state.enemyMorale = r.enemyMorale;
    state.reload = reloadSeconds * (profile.reloadMult ?? 1); // heavy loads slow, swivels quick
    state.round++;
    state.lastSide = a.side;

    if (r.sunkEnemy) return finish('win');
    if (r.sunkPlayer) return finish('lose');
    // Early surrender / strike-colours short-circuit (#135, Option 4): a broken foe strikes her colours
    // BEFORE you board. Instead of auto-capturing, HOLD the offer open — the player chooses to accept the
    // quick prize or refuse quarter (below). Refuse once and she never strikes again (offersSurrender
    // gates on quarterRefused), so this can't loop; she fights on to a sinking or a boarding.
    if (offersSurrender({ yielded: r.yielded, boarded: state.boarded, quarterRefused: state.quarterRefused })) {
      return openSurrender();
    }
    // The quip reads from the LOADED shot's flavour — chain shreds rigging, the rest pound the hull.
    state.lastLine = a.inArc ? fireQuip(profile.shock === 'rigging' ? 'rigging' : 'broadside', rng) : WIDE_LINE;
    ping('cut'); // a solid hit / a spent volley
    return r;
  }

  /**
   * Cycle the LOADED shot to the next one in the fitted loadout (#135 slice 3) — the ONE mid-fight
   * key the owner asked for. No-op while not engaged (you load shot for THIS fight). Returns the
   * newly-loaded shot id. The reload is NOT reset — you swap what's at the rack, not re-swab a gun.
   */
  function cycleShot() {
    if (!state.active) return state.ammo;
    state.ammo = cycleAmmo(state.ammo, loadout());
    ping('cut'); // a clack of the shot-rack
    if (onCycleAmmo) {
      try { onCycleAmmo({ ammo: state.ammo }); }
      catch { /* a flourish must never break the stance */ }
    }
    return state.ammo;
  }

  // Hold the foe's white flag OPEN (#135, Option 4) — she has struck her colours mid-maneuver and the
  // player must answer (accept the quick capture, or refuse quarter). Called from fire() the volley she
  // breaks. The engagement stays ACTIVE and PAUSED on the offer; main.js wires `onSurrender` to the
  // prompt banner + the 1/2 keys. Returns a small marker so a caller/QA can tell a volley opened a flag.
  function openSurrender() {
    state.surrenderPending = true;
    state.lastLine = strikeLine(rng); // her cry as the colours come down (#72, reused)
    ping('win'); // a beaten foe strikes — a soft, hopeful sting
    if (onSurrender) {
      try { onSurrender({ foeName: state.foeName, foeIndex: state.foeIndex }); }
      catch { /* a flourish must never break the offer */ }
    }
    return { surrendered: true, foeName: state.foeName };
  }

  /**
   * ACCEPT a struck foe's surrender (#135, Option 4) — the quick, merciful road. Takes her as a captured
   * prize (a ransom purse + Standing via finish('capture')) WITHOUT the board→brawl→duel, and ends the
   * engagement. No-op unless a surrender is actually pending. Returns the resolved capture, or null.
   */
  function acceptSurrender() {
    if (!state.surrenderPending) return null;
    state.surrenderPending = false;
    return finish('capture'); // captureSpoils: ransom coin + lawful Standing (the governor pole)
  }

  /**
   * PRESS THE ATTACK on a struck foe (#135, Option 4) — refuse quarter. No prize now; she hauls her
   * colours back up and fights to the bitter end (quarterRefused latches so she never strikes again this
   * engagement — no offer loop). You must then sink her or board her. No-op unless a surrender is pending.
   * Returns true if quarter was refused.
   */
  function pressAttack() {
    if (!state.surrenderPending) return false;
    state.surrenderPending = false;
    state.quarterRefused = true;
    state.lastLine = noQuarterLine(rng);
    ping('challenge'); // steel out, guns run back out
    if (onPressAttack) {
      try { onPressAttack({ foeName: state.foeName, foeIndex: state.foeIndex }); }
      catch { /* a flourish must never break the stance */ }
    }
    return true;
  }

  /**
   * Is the foe beaten down enough to grapple and BOARD her (#135 slice 4)? True once her hull is at
   * or below BOARD_HULL_FRACTION — the "Board! at ≤30% hull" prompt lights, the broadside becomes a
   * finisher. PURE-derived from the live engagement; never while un-engaged, already boarded, or while
   * a surrender offer is open (answer her white flag first).
   */
  function canBoard() {
    if (!state.active || !foe || state.boarded || state.surrenderPending) return false;
    return canBoardHull({ enemyHull: state.enemyHull, maxHull: state.maxHull });
  }

  /**
   * Send the crew over the rail (#135 slice 4) — a quick auto crew brawl (crew × morale × loadout, with
   * 2–3 comic lines), then HAND OFF to the verbal captain's duel (#33, the climax). No-op unless she's
   * boardable. main.js wires `onBoard` to end the stance and open `duel.tryChallenge` with the brawl's
   * opening dent. Returns the resolved brawl, or null. The duel is THE decider — the brawl is the bridge.
   */
  function board() {
    if (!canBoard()) return null;
    const brawl = resolveBrawl({
      crewMorale: (getCrewMorale && getCrewMorale()) ?? MORALE_MAX,
      maxMorale: MORALE_MAX,
      loadout: loadout(),
      foeMorale: state.enemyMorale,
      foeHull: state.enemyHull,
      maxHull: state.maxHull,
    }, rng);
    state.boarded = true;
    state.brawl = brawl;
    state.lastLine = brawl.lines[0] || '';
    ping('challenge'); // grapples bite, crew over the rail
    if (onBoard) {
      try { onBoard({ foeName: state.foeName, foeIndex: state.foeIndex, brawl }); }
      catch { /* a flourish must never break the boarding hand-off */ }
    }
    return brawl;
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
      // The LOADED shot (#135 slice 3) + the fitted locker, for the HUD readout + the QA hook.
      ammo: state.ammo,
      ammoProfile: ammoProfile(state.ammo),
      loadout: loadout().slice(),
      // Boarding (#135 slice 4): the Board! prompt lights at ≤30% hull; the resolved brawl beat reads here.
      canBoard: canBoard(),
      boarded: state.boarded,
      // Early surrender / strike-colours short-circuit (#135, Option 4): once she strikes, the offer is
      // HELD OPEN (accept the quick capture / press the attack). `quarterRefused` latches a refused offer.
      surrenderPending: state.surrenderPending,
      quarterRefused: state.quarterRefused,
      // Hull damage → boarding odds (#135 Option-4 slice 2): how far past the boarding line you battered
      // her — the edge your gunnery buys the coming brawl. 0 on the line, up to MAX_BOARDING_EDGE at a wreck.
      boardEdge: (state.active && !state.boarded) ? boardingEdge({ foeHull: state.enemyHull, maxHull: state.maxHull }) : 0,
      brawl: state.brawl ? { won: state.brawl.won, advantage: state.brawl.advantage, lines: state.brawl.lines.slice() } : null,
    };
  }

  return { state, engage, flee, end, fire, tick, aim, cycleShot, canBoard, board, acceptSurrender, pressAttack, inRange, nearestInRange, snapshot };
}
