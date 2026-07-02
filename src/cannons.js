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
import { isDeceptive, treacheryBonus, surpriseDamage, DEFAULT_COLOURS, lawfulStanding } from './colours.js';

export const MAX_HULL = 100;

// A foe's crew NERVE (#72). A fight isn't only about hulls: a crew can lose its bottle
// and STRIKE ITS COLOURS — surrender rather than drown. The aim you choose decides the
// foe's fate. A full broadside drowns them (bloody, the loud Infamy road); chain-shot
// shreds the rigging and RATTLES the crew, so keep sawing through their sheets and their
// nerve breaks — they yield, and you take the merciful Standing road (a ransom, not a wreck).
export const MORALE_MAX = 100;
const MORALE_BREAK = 25;     // nerve at/below this + a wounded hull = the colours come down
const YIELD_HULL_CEIL = 50;  // a crew only loses heart once the hull is genuinely hurt

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

// The neutral shot profile (== round shot) used when resolveBroadside is called without an `ammo`
// argument, so slice-2 callers stay byte-identical. The real catalogue lives in systems/ammo.js;
// cannons.js stays dependency-free and just reads these plain numeric fields off whatever it's given.
const NEUTRAL_AMMO = { hullMult: 1, returnMult: 1, moraleMult: 1, shock: 'broadside', aimForgive: 0 };

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

// What a broken-nerved foe yells as it STRIKES ITS COLOURS — surrender, not a sinking (#72).
// The merciful road's beat: you rattled the crew off the fight rather than drowning them.
const STRIKE_LINES = [
  'We strike! We strike our colours — spare the crew, you salt-crusted menace!',
  'Enough! Down comes the flag — take the ransom and let us limp home, mercy!',
  'Quarter! QUARTER! The lads have had their fill of your chain-shot, blast you!',
  'She yields! Curse you, she yields — only stop sawing through my poor rigging!',
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
 * Crew nerve lost in ONE exchange (#72). Chain-shot/rigging hits rattle a crew far more
 * than a clean hull-punch (timber they can patch; shredded sheets and a topmast over the
 * side they cannot), and a crew watching its own hull cave panics — so fear scales up as
 * the hull falls. PURE + injectable rng. `enemyHull` is the hull AFTER your volley landed.
 * @param {{outcome:'broadside'|'rigging', enemyHull:number}} args
 * @returns {number} morale points lost (>= 0)
 */
export function crewShock({ outcome, enemyHull }, rng = Math.random) {
  const jitter = 0.8 + rng() * 0.4; // ±20% wobble, == 1 when rng()==0.5
  const base = outcome === 'rigging' ? 26 : 10; // chain-shot terrifies; a broadside mostly drowns
  const fear = enemyHull < 50 ? (50 - enemyHull) * 0.35 : 0; // a wounded crew loses its bottle
  return Math.round((base + fear) * jitter);
}

/**
 * Does a foe STRIKE ITS COLOURS this exchange (#72)? It yields only when its nerve has
 * broken AND its hull is genuinely wounded — a fresh ship never surrenders. PURE.
 * @param {{enemyHull:number, morale:number}} args
 */
export function strikesColours({ enemyHull, morale }) {
  return !isSunk(enemyHull) && enemyHull <= YIELD_HULL_CEIL && morale <= MORALE_BREAK;
}

/**
 * Resolve ONE cannon exchange: you fire with `aim`, then the foe fires back IF it is
 * still afloat afterwards. PURE — returns the new hulls + the hit sizes, never mutates.
 * `rng` is injectable so the whole thing is deterministic under test.
 *
 * The player holds the initiative (you opened fire), so firing broadsides is a reliable
 * win — but you'll take real damage, and a badly wounded ship can still be sunk. Chain-shot
 * also erodes the foe's crew NERVE; break it and they strike their colours (`yielded`) — a
 * capture, not a kill (#72).
 *
 * @param {{aim:string, enemyHull:number, playerHull:number, gunnery?:number, morale?:number}} args
 * @param {() => number} [rng]
 * @returns {{enemyHit:number, playerHit:number, enemyHull:number, playerHull:number,
 *            outcome:'broadside'|'rigging', sunkEnemy:boolean, sunkPlayer:boolean,
 *            enemyMorale:number, yielded:boolean}}
 */
export function resolveExchange({ aim, enemyHull, playerHull, gunnery = 1, morale = MORALE_MAX, broadsideMult = 1 }, rng = Math.random) {
  const jitter = () => 0.8 + rng() * 0.4; // ±20% fairness wobble (==1 when rng()==0.5)
  // Your OWN battery scales your volley (#170) — bought cannons bite through the turn-based cannonade
  // too. Defaults to 1 so every legacy caller/test stays byte-identical.
  const guns = Number.isFinite(broadsideMult) && broadsideMult > 0 ? broadsideMult : 1;
  let enemyHit, returnScale, outcome;
  if (aim === 'chain') {
    enemyHit = Math.round(BASE * 0.85 * guns * jitter());
    returnScale = 0.45;   // their rigging is torn — a feeble reply
    outcome = 'rigging';
  } else { // 'broadside' (the default for any unknown aim)
    enemyHit = Math.round(BASE * 1.4 * guns * jitter());
    returnScale = 1.0;
    outcome = 'broadside';
  }
  const newEnemyHull = clampHull(enemyHull - enemyHit, MAX_HULL);
  // A foe sunk by your volley never gets to fire back.
  const playerHit = isSunk(newEnemyHull)
    ? 0
    : Math.round(BASE * 1.0 * gunnery * returnScale * jitter());
  const newPlayerHull = clampHull(playerHull - playerHit, MAX_HULL);
  const sunkEnemy = isSunk(newEnemyHull);
  const sunkPlayer = isSunk(newPlayerHull);
  // Crew nerve only matters while the foe is still afloat — a drowned crew has no colours to strike.
  const enemyMorale = clampHull(morale - crewShock({ outcome, enemyHull: newEnemyHull }, rng), MORALE_MAX);
  const yielded = !sunkEnemy && !sunkPlayer && strikesColours({ enemyHull: newEnemyHull, morale: enemyMorale });
  return {
    enemyHit,
    playerHit,
    enemyHull: newEnemyHull,
    playerHull: newPlayerHull,
    outcome,
    sunkEnemy,
    sunkPlayer,
    enemyMorale,
    yielded,
  };
}

/**
 * Resolve ONE real-time broadside discharge (#135 slice 2 — the deliberate-stance teeth).
 * Like resolveExchange, but instead of picking an aim each turn, the hull bite scales with how
 * well the foe is ABEAM (`quality` 0..1, from broadsideAim): a glancing shot off the bow barely
 * scratches, a clean beam shot bites full. The foe replies if it is still afloat. Reuses the SAME
 * morale/yield model as the turn-based exchange (crewShock / strikesColours), so a battered crew
 * can still strike its colours. PURE + injectable rng — deterministic under test.
 *
 * The LOADED shot (#135 slice 3) shapes the volley through an `ammo` profile (see systems/ammo.js):
 * `hullMult` scales the bite, `returnMult` scales her reply (chain's torn rigging answers weakly),
 * `moraleMult`+`shock` scale the crew-nerve hit (grape sweeps the deck → a faster capture), and
 * `aimForgive` lifts a glancing off-beam hit toward a clean one (light shot reaches). Omitting `ammo`
 * is byte-identical to a plain round shot, so slice-2 callers are unchanged.
 *
 * @param {{quality:number, enemyHull:number, playerHull:number, gunnery?:number, morale?:number,
 *          ammo?:{hullMult?:number,returnMult?:number,moraleMult?:number,shock?:string,aimForgive?:number}}} args
 * @param {() => number} [rng]
 * @returns {{enemyHit:number, playerHit:number, enemyHull:number, playerHull:number, quality:number,
 *            sunkEnemy:boolean, sunkPlayer:boolean, enemyMorale:number, yielded:boolean}}
 */
export function resolveBroadside({ quality, enemyHull, playerHull, gunnery = 1, morale = MORALE_MAX, ammo = NEUTRAL_AMMO, broadsideMult = 1 }, rng = Math.random) {
  const q0 = Math.max(0, Math.min(1, quality));
  // A forgiving shot (light) lifts a glancing angle toward a clean one; round forgives nothing (q==q0).
  const q = q0 + (1 - q0) * (ammo.aimForgive || 0);
  const jitter = () => 0.8 + rng() * 0.4; // ±20% fairness wobble (==1 when rng()==0.5)
  // The player's OWN battery scales the hull bite (#170): more cannons bought at the workshop → a
  // heavier volley. Defaults to 1 so every legacy caller (and the pre-#170 tests) stays byte-identical.
  const guns = Number.isFinite(broadsideMult) && broadsideMult > 0 ? broadsideMult : 1;
  const enemyHit = Math.round(BASE * 1.5 * q * (ammo.hullMult ?? 1) * guns * jitter()); // a clean beam broadside hits harder than a turn-based volley
  const newEnemyHull = clampHull(enemyHull - enemyHit, MAX_HULL);
  // A foe sunk by your volley never gets to fire back; otherwise exposing your beam earns a reply.
  const playerHit = isSunk(newEnemyHull) ? 0 : Math.round(BASE * 0.9 * gunnery * (ammo.returnMult ?? 1) * jitter());
  const newPlayerHull = clampHull(playerHull - playerHit, MAX_HULL);
  const sunkEnemy = isSunk(newEnemyHull);
  const sunkPlayer = isSunk(newPlayerHull);
  const shock = crewShock({ outcome: ammo.shock || 'broadside', enemyHull: newEnemyHull }, rng);
  const enemyMorale = clampHull(morale - Math.round(shock * (ammo.moraleMult ?? 1)), MORALE_MAX);
  const yielded = !sunkEnemy && !sunkPlayer && strikesColours({ enemyHull: newEnemyHull, morale: enemyMorale });
  return { enemyHit, playerHit, enemyHull: newEnemyHull, playerHull: newPlayerHull, quality: q0, sunkEnemy, sunkPlayer, enemyMorale, yielded };
}

// Challenge-on-demand reward scaling (#167): a real purse per FOE TIER on top of the base spoils, so
// beating a warship frigate / man-o'-war out in the deep pays what the risk is worth — the symmetric
// mirror of #164's tier-scaled loss sting (high risk, high reward, both legible).
export const SPOILS_TIER_COIN = 15; // + this much coin per foe threat tier (a tier-5 man-o'-war = +75c)

/**
 * Spoils for sinking a foe. The pirate road's reward: a tidy purse and a teeth-y chunk
 * of **Infamy** (more than a duel pays, befitting the risk). Scales with how tough the
 * foe was, how much hull you kept, AND — challenge on demand (#167) — the foe's THREAT TIER,
 * so a man-o'-war hunted down in the deep pays real fame. Modest by design — never free riches.
 * `tier` defaults to 0 (no bonus) so every legacy caller/test is byte-identical.
 * @param {{playerHull?:number, enemyMaxHull?:number, tier?:number}} [args]
 * @returns {{coins:number, infamy:number}}
 */
export function spoils({ playerHull = 0, enemyMaxHull = MAX_HULL, tier = 0 } = {}) {
  const t = Math.max(0, Math.min(5, Math.round(Number(tier) || 0)));
  const coins = Math.round(45 + enemyMaxHull * 0.25 + playerHull * 0.15 + t * SPOILS_TIER_COIN);
  const infamy = Math.round(coins * 2.3);
  return { coins, infamy };
}

/**
 * Spoils for CAPTURING a foe that struck its colours (#72) — the merciful road's reward.
 * A ransom purse (a touch less than a sinking's plunder) and, crucially, a chunk of lawful
 * **Standing** (the governor pole): sparing a beaten crew is honourable work. Pays far LESS
 * Infamy than sinking — mercy isn't infamous. The deliberate mirror of `spoils`: sink for
 * Infamy, capture for Standing.
 * @returns {{coins:number, infamy:number, standing:number}}
 */
export function captureSpoils({ playerHull = 0, enemyMaxHull = MAX_HULL } = {}) {
  const coins = Math.round(40 + enemyMaxHull * 0.2 + playerHull * 0.15);
  const infamy = Math.round(coins * 0.8);
  const standing = Math.round(coins * 0.6);
  return { coins, infamy, standing };
}

/** A comic-but-real setback for losing the gun-duel — repairs cost a few coins. */
export function repairToll() {
  return { coins: 14 };
}

/**
 * Build a fresh foe: a name plus hull + gunnery. With no class (the legacy call) she's the old uniform
 * foe — full hull, plausible gunnery in [0.9, 1.1] — so every existing caller/test is byte-identical.
 * Ship classes (#163): pass the engaged hull's class stats (from src/ship-classes.js, carried on the npc
 * snapshot) and the foe is seeded from them instead — a sloop squares up with LESS hull + weaker guns,
 * a frigate with more of both. The stats flow straight into the existing resolveBroadside/resolveExchange
 * math (hull → enemyHull, gunnery → her return fire), so class VARIES the fight, not just the silhouette.
 * @param {() => number} [rng]
 * @param {{hull?:number, maxHull?:number, gunnery?:number, cls?:string, role?:string, tier?:number,
 *          guns?:number, crew?:number}|null} [shipClass]
 */
export function makeFoe(rng = Math.random, shipClass = null) {
  const name = FOE_NAMES[pickIndex(rng, FOE_NAMES.length)];
  if (shipClass && typeof shipClass === 'object') {
    const maxHull = clampHull((typeof shipClass.maxHull === 'number' ? shipClass.maxHull
      : (typeof shipClass.hull === 'number' ? shipClass.hull : MAX_HULL)), MAX_HULL);
    const gunnery = (typeof shipClass.gunnery === 'number') ? shipClass.gunnery : (0.9 + rng() * 0.2);
    return {
      name, hull: maxHull, maxHull, gunnery,
      // Carried through for the HUD/QA + later slices (labels #165, odds #166): what she IS.
      cls: shipClass.cls, role: shipClass.role, tier: shipClass.tier,
      guns: shipClass.guns, crew: shipClass.crew,
    };
  }
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

/** A foe's cry as it strikes its colours and yields (#72). */
export function strikeLine(rng = Math.random) {
  return STRIKE_LINES[pickIndex(rng, STRIKE_LINES.length)];
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

export function createCannons({ npcs, getShipPos, getColours, getBroadsideMult, applyReward, applyPenalty, onEnd, sfx, rng = Math.random } = {}) {
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
    enemyMorale: MORALE_MAX, // the foe crew's nerve (#72) — break it and they strike their colours
    maxMorale: MORALE_MAX,
    lastLine: '',
    lastOutcome: '',
    result: null, // 'win' (sunk) | 'capture' (yielded #72) | 'lose' | null
    round: 0,
    treachery: false, // were the guns run out under FALSE colours? (#79)
    targetKind: 'merchant', // the struck vessel's disposition — pirate/merchant (#91)
  };
  let foe = null;
  let engagedColours = DEFAULT_COLOURS; // the colours flown the instant the fight opened
  let engagedKind = 'merchant';         // the target's kind the instant the fight opened (#91)

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
    // Ship classes (#163): seed the foe from the engaged hull's class (carried on the snapshot), so
    // gunning down a merchant sloop is easy prey while a warship frigate genuinely bites back.
    const snapsForClass = (npcs && npcs.snapshot && npcs.snapshot()) || [];
    const foeClass = (snapsForClass[idx] && snapsForClass[idx].shipClass) || null;
    foe = makeFoe(rng, foeClass);
    // False Colours (#79): if you opened fire while flying a disguise, this is a treacherous
    // ambush — the foe starts weakened (a surprise opening volley) and the win pays a perfidy
    // bonus to Infamy. Captured at the instant of attack, before the colours can change.
    engagedColours = (getColours && getColours()) || DEFAULT_COLOURS;
    state.treachery = isDeceptive(engagedColours);
    // Letters of Marque (#91): capture the target's disposition now, so an HONEST kill of a
    // pirate pays Standing (lawful privateering) while gunning down an innocent merchant fines it.
    const snaps = (npcs && npcs.snapshot && npcs.snapshot()) || [];
    engagedKind = (snaps[idx] && snaps[idx].kind) || 'merchant';
    state.targetKind = engagedKind;
    state.active = true;
    state.foeIndex = idx;
    state.foeName = foe.name;
    state.playerHull = MAX_HULL;
    // A class foe brings her OWN hull (a sloop less, a man-o'-war the full scale); maxHull tracks it so the
    // HUD bar reads full for her class, not "pre-damaged". Falls back to the full scale for a class-less foe.
    state.maxHull = (typeof foe.maxHull === 'number') ? foe.maxHull : MAX_HULL;
    state.enemyHull = clampHull(state.maxHull - surpriseDamage(engagedColours), MAX_HULL);
    state.enemyMorale = MORALE_MAX; // a fresh crew starts with full nerve (#72)
    state.maxMorale = MORALE_MAX;
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
    const guns = (getBroadsideMult && Number(getBroadsideMult())) || 1; // bought cannons (#170) bite here too
    const r = resolveExchange(
      { aim: name, enemyHull: state.enemyHull, playerHull: state.playerHull, gunnery: foe.gunnery, morale: state.enemyMorale, broadsideMult: guns },
      rng
    );
    state.enemyHull = r.enemyHull;
    state.playerHull = r.playerHull;
    state.enemyMorale = r.enemyMorale;
    state.lastOutcome = r.outcome;
    state.round++;

    if (r.sunkEnemy) return finish('win');
    if (r.sunkPlayer) return finish('lose');
    if (r.yielded) return finish('capture'); // their nerve broke — they strike their colours (#72)
    state.lastLine = fireQuip(r.outcome, rng);
    ping('cut'); // a solid hit
    return r;
  }

  function finish(result) {
    state.result = result;
    ping(result === 'lose' ? 'lose' : 'win'); // a sinking AND a capture are both victories
    let reward_ = null, penalty_ = null;
    if (result === 'capture') {
      // They struck their colours (#72): the merciful road — a ransom + lawful Standing, modest
      // Infamy. The foe lives; the wreck-clear respawn just sails a beaten ship off over the horizon.
      state.lastLine = strikeLine(rng);
      reward_ = { ...captureSpoils({ playerHull: state.playerHull, enemyMaxHull: state.maxHull }), captured: true };
      if (applyReward) applyReward(reward_);
      if (npcs && npcs.respawn) npcs.respawn(state.foeIndex);
    } else if (result === 'win') {
      state.lastLine = defeatLine(rng);
      // Reward scales by foe TIER (#167): a warship man-o'-war pays real coin + Infamy.
      reward_ = spoils({ playerHull: state.playerHull, enemyMaxHull: state.maxHull, tier: (foe && Number.isFinite(foe.tier)) ? foe.tier : 0 });
      // Treachery payoff (#79): a kill under false colours pays a perfidy bonus to Infamy.
      if (state.treachery) {
        const bonus = treacheryBonus(reward_.infamy, engagedColours);
        reward_ = { ...reward_, infamy: reward_.infamy + bonus, treachery: true, treacheryBonus: bonus };
      }
      // Letters of Marque (#91): an HONEST kill pays the lawful pole — Standing for hunting a
      // pirate, a fine for sinking an innocent. The opposing mirror of the treachery bonus.
      const standing = lawfulStanding(reward_.infamy, engagedColours, engagedKind);
      if (standing !== 0) {
        reward_ = { ...reward_, standing, targetKind: engagedKind, lawful: standing > 0 };
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
      enemyMorale: state.enemyMorale, // the foe crew's nerve (#72) — the HUD draws a "their nerve" bar
      maxMorale: state.maxMorale,
      lastLine: state.lastLine,
      lastOutcome: state.lastOutcome,
      result: state.result,
      round: state.round,
      treachery: state.treachery, // fighting under false colours (#79)
      targetKind: state.targetKind, // the foe's disposition — pirate/merchant (#91)
      inRange: inRange(),
      options: AIMS.map((a, i) => ({ i, aim: a, label: AIM_LABELS[a] })),
    };
  }

  return { state, openFire, fire, cancel, inRange, snapshot };
}
