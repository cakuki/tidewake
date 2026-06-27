// Cannon Broadside — the OTHER way to settle a quarrel at sea (#59).
//
// The Insult Broadside (duel.js) lets you talk a rival down with wit. This is its
// teeth-y twin: when a hostile sail crowds you, you can instead RUN OUT THE GUNS and
// open fire. A fight becomes a genuine CHOICE — out-jeer them, or out-gun them — and
// the bloodier road pays the bigger **Infamy** (the pirate pole, #45).
//
// Realism in the gunnery, comedy in the crew: it's still swashbuckling, not gore. You
// pick where to aim each exchange and trade volleys until one hull gives. You hold the
// initiative (you chose to fire), so a steady captain wins — but you'll take splinters
// doing it, and a wounded ship CAN be sunk.
//
// The MODEL is split in two, exactly like duel.js:
//   * PURE, DOM-free, three.js-free helpers (resolveExchange / spoils / makeFoe / …)
//     so the whole cannonade resolves under `node --test`. No imports up here on purpose.
//   * A small controller (createCannons) that owns the live engagement and is wired into
//     main.js's loop + the HUD panel. It calls only the pure helpers above.
//
// All foe names + quips are ORIGINAL to Tidewake — invented for this slice, never lifted
// from any existing game. Family-friendly, salt-crusted, a little daft.

import { CHALLENGE_RANGE } from './duel.js';
import { isDeceptive, treacheryBonus, surpriseDamage, DEFAULT_COLOURS } from './colours.js';

export const MAX_HULL = 100;

// The two ways to lay a gun. A genuine risk/reward choice each exchange:
//   broadside — pound their hull. Heavy damage, but side-on you take the full reply.
//   chain     — chain-shot their rigging. Lighter hull damage, but it shreds their sails
//               so their return volley comes back weak.
export const AIMS = ['broadside', 'chain'];

// On-screen labels for the two aims (the HUD reads these).
export const AIM_LABELS = {
  broadside: 'Full broadside — pound the hull',
  chain: 'Chain-shot — shred the rigging',
};

// Base bite of a volley before the aim profile + a fairness wobble are applied.
const BASE = 22;

// Characterful foes to open fire on — original to Tidewake, on-tone, harmless.
const FOE_NAMES = [
  'the Black Gannet', 'Sister Grapeshot', 'Captain Ironwake', 'Saltlung Maggs',
  'the Brass Lobster', 'Powderkeg Pim', 'Cutlass Cormorant', 'Old Thunderbottom',
];

// The hail the foe throws as the gunports bang open.
const OPENERS = [
  'Run out your guns then, chancer — let us see whose powder is dry!',
  'You want a fight? The Tidewake has TEETH. Mind your splinters!',
  'Strike now or be struck — either way the crabs eat well tonight.',
  'Bold of you to draw on ME. Gunners — give them a taste!',
];

// What the foe yells as it goes down (the defeated-NPC line — a CREATIVE SPARK beat).
const DEFEAT_LINES = [
  "She's going down — and taking my dignity with her! Curse your aim!",
  'Abandon— no, hold on— ABANDON ship! Tell my parrot I tried!',
  "You sank the prettiest hull on the sea, you—! ...well played, blast you.",
  'Down she goes! I shall haunt your bilge, see if I don’t!',
];

// Comic quips that punctuate a volley landing — keyed by exchange outcome.
const QUIPS = {
  broadside: [
    'A crunch of timber — somewhere a foe is rethinking their afternoon.',
    'Direct hit! Their figurehead just lost a nostril.',
    'The hull caves with a noise like a very large hiccup.',
    'Splinters fly. A gull files a complaint.',
  ],
  rigging: [
    'Chain-shot scissors their rigging — sails flap like startled laundry.',
    'Their topmast sags, embarrassed, into the breeze.',
    'Rigging shreds; the foe’s reply comes back limp and apologetic.',
    'You tangle their sheets — they’ll be a beat slow to answer.',
  ],
};

// ---- PURE resolution helpers ------------------------------------------------

/** Clamp a hull value into [0, max]. */
export function clampHull(h, max = MAX_HULL) {
  return Math.max(0, Math.min(max, h));
}

/** A ship is sunk (or routed) when its hull falls to zero or below. */
export function isSunk(hull) {
  return hull <= 0;
}

// Small seeded helper used by the pure pickers; keeps Math.random injectable.
function pickIndex(rng, n) {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/**
 * Resolve ONE cannon exchange: you fire with `aim`, then the foe fires back IF it is
 * still afloat afterwards. PURE — returns the new hulls + the hit sizes, never mutates.
 * `rng` is injectable so the whole thing is deterministic under test.
 *
 * The player holds the initiative (you opened fire), so firing broadsides is a reliable
 * win — but you'll take real damage, and a badly wounded ship can still be sunk.
 *
 * @param {{aim:string, enemyHull:number, playerHull:number, gunnery?:number}} args
 * @param {() => number} [rng]
 * @returns {{enemyHit:number, playerHit:number, enemyHull:number, playerHull:number,
 *            outcome:'broadside'|'rigging', sunkEnemy:boolean, sunkPlayer:boolean}}
 */
export function resolveExchange({ aim, enemyHull, playerHull, gunnery = 1 }, rng = Math.random) {
  const jitter = () => 0.8 + rng() * 0.4; // ±20% fairness wobble (==1 when rng()==0.5)
  let enemyHit, returnScale, outcome;
  if (aim === 'chain') {
    enemyHit = Math.round(BASE * 0.85 * jitter());
    returnScale = 0.45;   // their rigging is torn — a feeble reply
    outcome = 'rigging';
  } else { // 'broadside' (the default for any unknown aim)
    enemyHit = Math.round(BASE * 1.4 * jitter());
    returnScale = 1.0;
    outcome = 'broadside';
  }
  const newEnemyHull = clampHull(enemyHull - enemyHit, MAX_HULL);
  // A foe sunk by your volley never gets to fire back.
  const playerHit = isSunk(newEnemyHull)
    ? 0
    : Math.round(BASE * 1.0 * gunnery * returnScale * jitter());
  const newPlayerHull = clampHull(playerHull - playerHit, MAX_HULL);
  return {
    enemyHit,
    playerHit,
    enemyHull: newEnemyHull,
    playerHull: newPlayerHull,
    outcome,
    sunkEnemy: isSunk(newEnemyHull),
    sunkPlayer: isSunk(newPlayerHull),
  };
}

/**
 * Spoils for sinking a foe. The pirate road's reward: a tidy purse and a teeth-y chunk
 * of **Infamy** (more than a duel pays, befitting the risk). Scales with how tough the
 * foe was and how much hull you kept. Modest by design — never free riches.
 * @returns {{coins:number, infamy:number}}
 */
export function spoils({ playerHull = 0, enemyMaxHull = MAX_HULL } = {}) {
  const coins = Math.round(45 + enemyMaxHull * 0.25 + playerHull * 0.15);
  const infamy = Math.round(coins * 2.3);
  return { coins, infamy };
}

/** A comic-but-real setback for losing the gun-duel — repairs cost a few coins. */
export function repairToll() {
  return { coins: 14 };
}

/** Build a fresh foe: full hull, a name, and plausible gunnery in [0.9, 1.1]. */
export function makeFoe(rng = Math.random) {
  const name = FOE_NAMES[pickIndex(rng, FOE_NAMES.length)];
  const gunnery = 0.9 + rng() * 0.2;
  return { name, hull: MAX_HULL, maxHull: MAX_HULL, gunnery };
}

/** The foe's opening hail as the gunports bang open. */
export function fireOpener(rng = Math.random) {
  return OPENERS[pickIndex(rng, OPENERS.length)];
}

/** A defeated foe's parting cry. */
export function defeatLine(rng = Math.random) {
  return DEFEAT_LINES[pickIndex(rng, DEFEAT_LINES.length)];
}

/** A comic quip for a landed volley, keyed by exchange outcome ('broadside'|'rigging'). */
export function fireQuip(outcome, rng = Math.random) {
  const pool = QUIPS[outcome] || QUIPS.broadside;
  return pool[pickIndex(rng, pool.length)];
}

// ---- Engagement controller (wired into main.js) -----------------------------
//
// Owns the live cannonade and the open-fire/range logic. DOM-free: the HUD reads
// `cannons.snapshot()` and renders it; main.js drives open-fire + fire from key events.
// Mirrors createDuel so the two combat paths feel like siblings.
//
// createCannons({ npcs, getShipPos, applyReward, applyPenalty, onEnd, sfx, rng })
//   npcs        : the createNpcs() handle (snapshot() + respawn(i))
//   getShipPos  : () => [x, z]   the player's current position
//   applyReward : (spoils)  -> apply coins/infamy on a sinking
//   applyPenalty: (toll)    -> apply the repair setback on a loss
//   onEnd       : ({result, reward?, penalty?, foeName}) -> announce (toast)
//   sfx         : (kind)    -> optional audio sting (reuses the duel bus kinds)

export function createCannons({ npcs, getShipPos, getColours, applyReward, applyPenalty, onEnd, sfx, rng = Math.random } = {}) {
  // A sting must never break the fight, so every audio call is swallowed.
  function ping(kind) {
    try { if (sfx) sfx(kind); } catch { /* a sting must never sink the duel */ }
  }

  const state = {
    active: false,
    foeIndex: -1,
    foeName: '',
    playerHull: MAX_HULL,
    enemyHull: MAX_HULL,
    maxHull: MAX_HULL,
    lastLine: '',
    lastOutcome: '',
    result: null, // 'win' | 'lose' | null
    round: 0,
    treachery: false, // were the guns run out under FALSE colours? (#79)
  };
  let foe = null;
  let engagedColours = DEFAULT_COLOURS; // the colours flown the instant the fight opened

  // Nearest NPC within range, or -1. Positions are [x,z]; ship pos is [x,z] too.
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

  /** Is there a ship to open fire on within range right now? */
  function inRange() { return !state.active && nearestInRange() !== -1; }

  /** Run out the guns on the nearest foe. Returns true if an engagement started. */
  function openFire() {
    if (state.active) return false;
    const idx = nearestInRange();
    if (idx === -1) return false;
    foe = makeFoe(rng);
    // False Colours (#79): if you opened fire while flying a disguise, this is a treacherous
    // ambush — the foe starts weakened (a surprise opening volley) and the win pays a perfidy
    // bonus to Infamy. Captured at the instant of attack, before the colours can change.
    engagedColours = (getColours && getColours()) || DEFAULT_COLOURS;
    state.treachery = isDeceptive(engagedColours);
    state.active = true;
    state.foeIndex = idx;
    state.foeName = foe.name;
    state.playerHull = MAX_HULL;
    state.enemyHull = clampHull(MAX_HULL - surpriseDamage(engagedColours), MAX_HULL);
    state.maxHull = MAX_HULL;
    state.lastLine = fireOpener(rng);
    state.lastOutcome = '';
    state.result = null;
    state.round = 0;
    ping('challenge'); // gunports bang open
    return true;
  }

  /** Fire a volley with aim `i` (index into AIMS) or an aim name. Resolves one exchange. */
  function fire(aim) {
    if (!state.active) return null;
    const name = typeof aim === 'number' ? AIMS[aim] : aim;
    if (!AIMS.includes(name)) return null;
    const r = resolveExchange(
      { aim: name, enemyHull: state.enemyHull, playerHull: state.playerHull, gunnery: foe.gunnery },
      rng
    );
    state.enemyHull = r.enemyHull;
    state.playerHull = r.playerHull;
    state.lastOutcome = r.outcome;
    state.round++;

    const ending = r.sunkEnemy || r.sunkPlayer;
    if (!ending) {
      state.lastLine = fireQuip(r.outcome, rng);
      ping('cut'); // a solid hit
    }
    if (r.sunkEnemy) return finish('win');
    if (r.sunkPlayer) return finish('lose');
    return r;
  }

  function finish(result) {
    state.result = result;
    ping(result === 'win' ? 'win' : 'lose');
    let reward_ = null, penalty_ = null;
    if (result === 'win') {
      state.lastLine = defeatLine(rng);
      reward_ = spoils({ playerHull: state.playerHull, enemyMaxHull: state.maxHull });
      // Treachery payoff (#79): a kill under false colours pays a perfidy bonus to Infamy.
      if (state.treachery) {
        const bonus = treacheryBonus(reward_.infamy, engagedColours);
        reward_ = { ...reward_, infamy: reward_.infamy + bonus, treachery: true, treacheryBonus: bonus };
      }
      if (applyReward) applyReward(reward_);
      if (npcs && npcs.respawn) npcs.respawn(state.foeIndex); // the wreck clears; a new sail wanders in
    } else {
      penalty_ = repairToll();
      if (applyPenalty) applyPenalty(penalty_);
    }
    const foeName = state.foeName;
    if (onEnd) onEnd({ result, reward: reward_, penalty: penalty_, foeName });
    state.active = false;
    return { result, reward: reward_, penalty: penalty_ };
  }

  /** Abandon an engagement without resolving (e.g. on a new voyage). */
  function cancel() { state.active = false; state.result = null; }

  // A plain, JSON-safe snapshot for the window.__tidewake QA hook + the HUD.
  function snapshot() {
    return {
      active: state.active,
      foeName: state.foeName,
      playerHull: state.playerHull,
      enemyHull: state.enemyHull,
      maxHull: state.maxHull,
      lastLine: state.lastLine,
      lastOutcome: state.lastOutcome,
      result: state.result,
      round: state.round,
      treachery: state.treachery, // fighting under false colours (#79)
      inRange: inRange(),
      options: AIMS.map((a, i) => ({ i, aim: a, label: AIM_LABELS[a] })),
    };
  }

  return { state, openFire, fire, cancel, inRange, snapshot };
}
