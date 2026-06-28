// Emergent at-sea encounter (#125, DL#4) — a foundering ship, and a real moral CHOICE:
// RESCUE her crew (the lawful road → Standing, a grateful line) or PLUNDER the wreck (the
// dark road → Infamy + coin). One systemic beat turns the SAILING mode — our most-used but
// least-reactive — into a story generator, echoing the False-Colours / Strike-the-Colours
// moral-choice DNA (#79/#72): the world hands you a fork, and who you become is your answer.
//
// The model is split the #53 way:
//   * PURE, DOM-free, three.js-free helpers (rollNextSpawn / placeFounderer / resolveEncounter)
//     so the seeded spawn cadence + the choice→reward/pole resolution unit-test under `node --test`.
//   * A small controller (createEncounter) that owns the live encounter state, drives the
//     seeded spawn off distance SAILED, and is wired into main.js's loop + the HUD choice panel.
//
// CREATIVE SPARK (Game Designer): the open sea should occasionally LOOK BACK at you. A distress
// flare on the horizon is a mirror — rescue and you sail off a touch more respected and a crew's
// blessing in your wake; plunder and you sail off richer and a touch more feared. Cheap by design:
// ONE founderer at a time, spawned ahead of the bow within view, reusing the hero hull mesh.
//
// FOLLOW-UPS (filed): more encounter types (a becalmed trader, a derelict, a press-ganged crew);
// richer outcomes (a grateful crew that fights at your side, a cursed hold); a flying distress flag.

// ---- Tuning (the Game Designer's first-class output) ----------------------------------
// Cadence is keyed to distance SAILED (deterministic + headless-safe), not wall-clock, so the
// same voyage meets the same wrecks. First founderer after ~one good leg of open water; then a
// fresh interval each time. Modest, so it punctuates a voyage without ever becoming a treadmill.
export const SPAWN_MIN_DISTANCE = 900;  // metres of open water before the FIRST/NEXT founderer
export const SPAWN_JITTER = 700;        // + a seeded 0..JITTER so it never feels metronomic
export const SPAWN_RANGE = 170;         // how far ahead of the bow the wreck appears (within view)
export const CHOICE_RANGE = 240;        // how near you must be for the choice to stand (SPAWN_RANGE < this)
export const DESPAWN_RANGE = 700;       // sail this far from the wreck without choosing → she's gone
export const BEARING_SPREAD = 1.1;      // ± radians of bearing wobble so she isn't always dead ahead

// Rewards. Tuned against the existing poles (a duel win ≈100–160 Infamy; a strong sale ≈160–280
// Standing; a chased rumour ≈60 coin): a single lucky encounter moves the needle a visible rung
// (renown gaps start at 40/80) without out-earning the deliberate loops. Rescue = pure Standing;
// plunder = Infamy + a coin haul a touch above a rumour's.
export const RESCUE_STANDING = 120;
export const PLUNDER_INFAMY = 120;
export const PLUNDER_COINS = 80;

// Characterful, harmless names for the stricken vessel — original to Tidewake, on-tone.
const FOUNDERER_NAMES = [
  'the Saltwidow', 'the Limping Gull', 'the Brine Mary', 'the Tattered Hope',
  'the Sinking Sixpence', 'the Last Ducat', 'the Wallowing Wren', 'the Broken Compass',
];

// The distress hail the lookout calls when a founderer heaves into view.
export const HAIL_LINES = [
  'A ship low in the water off the bow — colours half-struck, crew waving anything that flies!',
  "There's a wreck ahead taking on water fast — souls at the rail, hailing you for aid!",
  'Off the bow: a foundering hull, her pumps losing the fight and her people crying out!',
];

// The grateful payoff for choosing RESCUE — the lawful road, the crew's blessing.
export const RESCUE_LINES = [
  'You come alongside and haul her crew aboard, soaked and blessing your name to every saint at sea.',
  'You take off her people before she goes under — they swear your name will travel ahead of your sails.',
  'You throw lines and pull them clear; their captain grips your hand and the ports will hear of this one.',
];

// The darker payoff for choosing PLUNDER — coin in hand, a colder wake.
export const PLUNDER_LINES = [
  'You strip her hold as she settles, and leave her crew their longboat and a long, cold row to think on it.',
  'You take what the sea was about to, and sail off heavier of purse and shorter of conscience.',
  'You board the wallowing wreck and haul her cargo clear — the gulls and the rumours can have the rest.',
];

function num(n) { return typeof n === 'number' && Number.isFinite(n) ? n : 0; }

/**
 * PURE — the next spawn threshold (metres of sea to sail before the next founderer). Driven
 * ONLY by the injected rng, so a seeded controller meets the same wrecks every voyage.
 * @param {() => number} rng
 * @returns {number} a distance in [SPAWN_MIN_DISTANCE, SPAWN_MIN_DISTANCE + SPAWN_JITTER)
 */
export function rollNextSpawn(rng = Math.random) {
  const r = Math.max(0, Math.min(0.999999, rng()));
  return SPAWN_MIN_DISTANCE + Math.floor(r * SPAWN_JITTER);
}

/** PURE — has the player sailed far enough for the next founderer to appear? */
export function dueToSpawn(sailed, nextAt) {
  return num(sailed) >= num(nextAt);
}

/**
 * PURE — where the founderer appears: ahead of the bow at ~SPAWN_RANGE, with a seeded bearing
 * wobble so she isn't always dead ahead. Returns world `{x, z}`. Never throws.
 * @param {[number,number]} pos     ship position [x, z]
 * @param {number} heading          ship heading (radians; 0 = +Z, the project convention)
 * @param {() => number} rng
 */
export function placeFounderer(pos, heading = 0, rng = Math.random) {
  const x0 = (pos && num(pos[0])) || 0;
  const z0 = (pos && num(pos[1])) || 0;
  const bearing = num(heading) + (rng() - 0.5) * BEARING_SPREAD;
  return { x: x0 + Math.sin(bearing) * SPAWN_RANGE, z: z0 + Math.cos(bearing) * SPAWN_RANGE };
}

/**
 * PURE — resolve a CHOICE into its reward + reputation pole. RESCUE pays the GOVERNOR pole
 * (Standing); PLUNDER pays the PIRATE pole (Infamy) + a coin haul. Deterministic; returns null
 * for an unknown choice so a stray call can never pay out.
 * @param {'rescue'|'plunder'} choice
 * @returns {{choice:string, pole:'governor'|'pirate', standing:number, infamy:number, coins:number}|null}
 */
export function resolveEncounter(choice) {
  if (choice === 'rescue') return { choice: 'rescue', pole: 'governor', standing: RESCUE_STANDING, infamy: 0, coins: 0 };
  if (choice === 'plunder') return { choice: 'plunder', pole: 'pirate', standing: 0, infamy: PLUNDER_INFAMY, coins: PLUNDER_COINS };
  return null;
}

/** PURE — pick a deterministic, in-bounds element from a pool ('' for an empty pool). */
export function pickFromPool(pool, rng = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const i = Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(0.999999, rng())) * pool.length));
  return pool[i];
}

/** PURE — a characterful name for the stricken vessel. */
export function pickFoundererName(rng = Math.random) { return pickFromPool(FOUNDERER_NAMES, rng); }

// ---- Encounter controller (wired into main.js) ----------------------------------------
//
// Owns the live encounter state + the seeded spawn cadence. DOM-free + three.js-free: the HUD
// reads `encounter.snapshot()` and renders the choice panel; main.js drives update()/choose()
// and positions the (reused) founderer mesh. The rng is injectable so spawns are DETERMINISTIC
// and reproducible (main.js seeds a mulberry32, reset on a new voyage).
//
// createEncounter({ getShipPos, getShipHeading, onSpawn, onResolve, onDespawn, rng })
//   getShipPos     : () => [x, z]   the player's current position
//   getShipHeading : () => radians  the player's heading (to drop the wreck ahead)
//   onSpawn        : ({name,x,z}) -> announce the distress (toast)
//   onResolve      : (reward & {name}) -> apply the reward + announce the outcome (toast + ballad)
//   onDespawn      : ({name}) -> a missed chance slipped under (optional)
export function createEncounter({ getShipPos, getShipHeading, onSpawn, onResolve, onDespawn, rng = Math.random } = {}) {
  const state = {
    active: false,
    name: '',
    ship: null,       // {x, z} of the founderer, or null
    bearing: 0,       // the founderer's own heading, for the listing mesh
    choice: null,     // 'rescue' | 'plunder' | null
    result: null,     // the resolved reward, or null
    sailed: 0,        // metres of sea sailed (the cadence clock)
    nextAt: rollNextSpawn(rng),
    lastPos: null,    // previous frame's [x,z] for the distance delta
  };

  function shipPos() { return (getShipPos && getShipPos()) || null; }
  function shipHeading() { return (getShipHeading && num(getShipHeading())) || 0; }

  function spawnAt(pos) {
    const where = placeFounderer(pos, shipHeading(), rng);
    state.ship = where;
    state.name = pickFoundererName(rng);
    state.bearing = shipHeading() + (rng() - 0.5) * 2; // a random list/heave so she reads stricken
    state.active = true;
    state.choice = null;
    state.result = null;
    try { if (onSpawn) onSpawn({ name: state.name, x: where.x, z: where.z }); } catch { /* a flourish must never break the loop */ }
  }

  /** Drive the cadence + the despawn-on-wander. ctx.canSpawn:false suppresses spawning (town/battle). */
  function update(dt, ctx = {}) {
    const pos = shipPos();
    if (!pos) return;
    if (state.lastPos) {
      const d = Math.hypot(pos[0] - state.lastPos[0], pos[1] - state.lastPos[1]);
      if (Number.isFinite(d)) state.sailed += d;
    }
    state.lastPos = [pos[0], pos[1]];

    if (!state.active) {
      if (ctx.canSpawn !== false && dueToSpawn(state.sailed, state.nextAt)) spawnAt(pos);
      return;
    }
    // A founderer left behind (you sailed on without choosing) slips quietly under.
    const dist = Math.hypot(pos[0] - state.ship.x, pos[1] - state.ship.z);
    if (dist > DESPAWN_RANGE) despawn('missed');
  }

  /** Is the player near enough to make the choice? (drives the HUD panel + prompt). */
  function inRange() {
    if (!state.active || !state.ship) return false;
    const pos = shipPos();
    if (!pos) return false;
    return Math.hypot(pos[0] - state.ship.x, pos[1] - state.ship.z) <= CHOICE_RANGE;
  }

  function endAndRearm() {
    state.active = false;
    state.ship = null;
    // Schedule the next founderer a fresh interval of sea ahead from here.
    state.nextAt = state.sailed + rollNextSpawn(rng);
  }

  /** Resolve the encounter with a CHOICE. Returns the reward, or null if no encounter is up. */
  function choose(choice) {
    if (!state.active) return null;
    const r = resolveEncounter(choice);
    if (!r) return null;
    state.choice = choice;
    state.result = r;
    const name = state.name;
    endAndRearm();
    try { if (onResolve) onResolve({ ...r, name }); } catch { /* a flourish must never break the loop */ }
    return r;
  }

  /** QA / fallback: raise a founderer right now (deterministic). True if one was raised. */
  function forceSpawn() {
    if (state.active) return false;
    const pos = shipPos();
    if (!pos) return false;
    spawnAt(pos);
    return state.active;
  }

  function despawn(reason) {
    if (!state.active) return;
    const name = state.name;
    endAndRearm();
    try { if (onDespawn) onDespawn({ name, reason: reason || 'missed' }); } catch { /* never break the loop */ }
  }

  /** Abandon any live encounter without resolving (e.g. on entering town). Cadence is preserved. */
  function cancel() { state.active = false; state.ship = null; state.choice = null; state.result = null; }

  /** A fresh voyage: clear any encounter and re-seed the cadence from a clean slate. */
  function reset() {
    state.active = false;
    state.ship = null;
    state.choice = null;
    state.result = null;
    state.sailed = 0;
    state.lastPos = null;
    state.nextAt = rollNextSpawn(rng);
  }

  /** A plain, JSON-safe snapshot for the HUD + the window.__tidewake QA hook. */
  function snapshot() {
    return {
      active: state.active,
      name: state.name,
      ship: state.ship ? { x: state.ship.x, z: state.ship.z } : null,
      choice: state.choice,
      result: state.result,
      inRange: inRange(),
      sailed: Math.round(state.sailed),
      nextAt: Math.round(state.nextAt),
    };
  }

  return { state, update, choose, inRange, forceSpawn, despawn, cancel, reset, snapshot };
}
