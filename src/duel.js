// Insult Broadside — comedic ship-to-ship combat fought with WIT, not cannon (#33).
//
// Realism in the sailing, comedy in the people: instead of gore, two crews shout
// insults across the waves and the deadliest weapon is a good zinger. A sharp,
// well-chosen line cracks the ENEMY crew's morale; a mismatched whiff shakes your
// OWN. Break their morale and they yield — you take coins + renown, the prize intact.
//
// The MODEL is split in two:
//   * PURE, DOM-free, three.js-free helpers (resolveInsult / isOver / reward / …)
//     so the whole duel resolves under `node --test`. No imports here on purpose.
//   * A small controller (createDuel) that owns the encounter state and is wired
//     into main.js's loop + the HUD panel. It calls only the pure helpers above.
//
// All insults + comebacks are ORIGINAL to Tidewake — invented for this slice, never
// lifted from any existing game. Family-friendly, swashbuckling, slightly daft.

export const MAX_MORALE = 100;

// The five flavours of jab. An enemy is WEAK to one (a cutting hit) and GUARDS one
// (jeer at that and it backfires on your own crew). Everything else just glances.
export const CATEGORIES = ['pride', 'cowardice', 'looks', 'seamanship', 'wit'];

// The insult pool. `category` decides the outcome vs the enemy; `sting` is the base
// bite; `line` is what you shout; `comeback` is the enemy's retort flung back at you.
export const INSULTS = [
  // pride
  { id: 'pride1', category: 'pride', sting: 22, line: "Your figurehead's the prettiest thing aboard — and it's a goat.", comeback: "She's worth more than your whole crew, hooves and all." },
  { id: 'pride2', category: 'pride', sting: 24, line: 'They named a wind after you: the one that smells faintly of regret.', comeback: "Breathe deep — you're downwind of greatness." },
  { id: 'pride3', category: 'pride', sting: 20, line: "I've met prouder captains bailing out my bilge.", comeback: 'Then bail faster, the view suits you.' },
  // cowardice
  { id: 'cow1', category: 'cowardice', sting: 23, line: 'You flinch at your own cannon — does the boom frighten the baby?', comeback: "I flinch so the cannonball doesn't have to." },
  { id: 'cow2', category: 'cowardice', sting: 21, line: 'Your battle flag is a white sheet with extra steps.', comeback: "It matches the colour you'll turn shortly." },
  { id: 'cow3', category: 'cowardice', sting: 25, line: 'You sail so bravely — directly away from everything.', comeback: "It's called strategy. You'll learn it, retreating." },
  // looks
  { id: 'look1', category: 'looks', sting: 22, line: 'Is that a beard, or did a gull lose a fight on your chin?', comeback: 'The gull won. You are looking at the loser.' },
  { id: 'look2', category: 'looks', sting: 20, line: 'Your face could sour a whole hold of rum.', comeback: 'Good — more sober hands to thrash you with.' },
  { id: 'look3', category: 'looks', sting: 24, line: "I'd call you barnacle-ugly, but the barnacles objected.", comeback: 'They have better taste than your mirror, plainly.' },
  // seamanship
  { id: 'sea1', category: 'seamanship', sting: 23, line: "You couldn't navigate a bathtub to its own plug.", comeback: 'And yet here I am, plugging up your day.' },
  { id: 'sea2', category: 'seamanship', sting: 21, line: 'Your knots are just confused string having a bad afternoon.', comeback: "They'll hold long enough to hang your pride." },
  { id: 'sea3', category: 'seamanship', sting: 25, line: "You reef a sail like you're wrestling a ghost — and losing.", comeback: 'The ghost tells me you sail even worse.' },
  // wit
  { id: 'wit1', category: 'wit', sting: 22, line: "I'd trade wits with you, but I never rob the needy.", comeback: 'Keep yours — clearly you are hoarding the lot.' },
  { id: 'wit2', category: 'wit', sting: 24, line: 'Your comebacks arrive like your ship: late and leaking.', comeback: 'Yet still in time to sink you.' },
];

// Names for the captain you're hailing — characterful, harmless, on-tone.
const ENEMY_NAMES = [
  'Captain Mossbeard', 'One-Sock Sal', 'Bartholomew Bilgewater', 'Greta the Gull',
  'Old Crustpurse', 'Lefty McSqualls', 'Doubloon Dottie', 'Three-Pint Pete',
];

// Opening taunts the enemy throws before the first exchange.
const OPENERS = [
  'Well, look what the tide coughed up. Care to lose, stranger?',
  'Heave to and be insulted, you floating apology!',
  "I've sunk wittier crews before breakfast. Speak!",
  'Ahoy, fresh meat for the mockery — open your mouth.',
];

// ---- PURE resolution helpers ------------------------------------------------

/** Clamp a morale value into [0, max]. */
export function clampMorale(m, max = MAX_MORALE) {
  return Math.max(0, Math.min(max, m));
}

/** A crew breaks (yields/flees) when its morale falls to zero or below. */
export function isOver(morale) {
  return morale <= 0;
}

/**
 * Resolve one shouted insult against the enemy's temperament. PURE: returns the
 * morale deltas, never mutates. `rng` is injectable for deterministic tests.
 *
 * - CUTTING  (matches enemy.weakTo): big hit to the enemy, nothing to you.
 * - BACKFIRE (matches enemy.guard):  your crew cringes — you take the damage, enemy barely dents.
 * - GLANCING (anything else):        a modest chip at the enemy.
 *
 * @param {{category:string,sting:number,comeback?:string}} insult
 * @param {{weakTo:string,guard:string}} enemy
 * @param {() => number} [rng]
 * @returns {{enemyDelta:number, playerDelta:number, outcome:'cutting'|'backfire'|'glancing', comeback:string}}
 */
export function resolveInsult(insult, enemy, rng = Math.random) {
  const jitter = 0.85 + rng() * 0.3; // ±15% fairness wobble (==1 when rng()==0.5)
  let enemyDelta = 0, playerDelta = 0, outcome;
  if (insult.category === enemy.weakTo) {
    outcome = 'cutting';
    enemyDelta = -Math.round(insult.sting * 1.6 * jitter);
  } else if (insult.category === enemy.guard) {
    outcome = 'backfire';
    playerDelta = -Math.round(insult.sting * 0.9 * jitter);
    enemyDelta = -2; // the enemy chuckles; a sliver of dignity lost anyway
  } else {
    outcome = 'glancing';
    enemyDelta = -Math.round(insult.sting * 0.7 * jitter);
  }
  return { enemyDelta, playerDelta, outcome, comeback: insult.comeback || '' };
}

/**
 * Spoils for breaking the enemy. Modest by design — winning a duel is a tidy purse
 * and a real bump to your legend, never free riches. Scales with how tough the foe
 * was (enemyMaxMorale) and how cleanly you won (playerMorale left).
 * @returns {{coins:number, renown:number}}
 */
export function reward({ playerMorale = 0, enemyMaxMorale = MAX_MORALE } = {}) {
  const coins = Math.round(30 + enemyMaxMorale * 0.2 + playerMorale * 0.2);
  const renown = Math.round(coins * 1.4);
  return { coins, renown };
}

/** A comic setback for losing the shouting match — a few coins dropped, nothing harsh. */
export function penalty() {
  return { coins: 8 };
}

// Small seeded helper used only by the pure pickers; keeps Math.random injectable.
function pickIndex(rng, n) {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/**
 * Build a fresh enemy: full morale, weak to one category, guarding a different one.
 * @param {() => number} [rng]
 */
export function makeEnemy(rng = Math.random) {
  const weakTo = CATEGORIES[pickIndex(rng, CATEGORIES.length)];
  let guard = weakTo;
  let safety = 0;
  while (guard === weakTo && safety++ < 8) guard = CATEGORIES[pickIndex(rng, CATEGORIES.length)];
  if (guard === weakTo) guard = CATEGORIES[(CATEGORIES.indexOf(weakTo) + 1) % CATEGORIES.length];
  const name = ENEMY_NAMES[pickIndex(rng, ENEMY_NAMES.length)];
  return { name, morale: MAX_MORALE, maxMorale: MAX_MORALE, weakTo, guard };
}

/**
 * Offer `n` distinct insults for the round. ALWAYS includes at least one line that
 * matches the enemy's weakness, so a sharp-eyed captain always has a winning move
 * available (and an automated test can always make progress). The rest are random.
 * @returns {Array<object>} insult objects from INSULTS
 */
export function pickOptions(rng = Math.random, enemy, n = 4) {
  const sharp = INSULTS.filter((i) => i.category === enemy.weakTo);
  const chosen = [];
  if (sharp.length) chosen.push(sharp[pickIndex(rng, sharp.length)]);
  const pool = INSULTS.filter((i) => !chosen.includes(i));
  while (chosen.length < n && pool.length) {
    const idx = pickIndex(rng, pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  // Light shuffle so the sharp line isn't always slot 1.
  for (let i = chosen.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  return chosen;
}

/** Pick the enemy's opening taunt. */
export function opener(rng = Math.random) {
  return OPENERS[pickIndex(rng, OPENERS.length)];
}

// ---- Encounter controller (wired into main.js) ------------------------------
//
// Owns the live duel state and the challenge/range logic. DOM-free: the HUD reads
// `duel.state` and renders it; main.js drives challenge + choose from key events.
//
// createDuel({ npcs, getShipPos, applyReward, applyPenalty, onEnd, rng })
//   npcs        : the createNpcs() handle (snapshot() + respawn(i))
//   getShipPos  : () => [x, z]   the player's current position
//   applyReward : (reward)  -> apply coins/renown on win
//   applyPenalty: (penalty) -> apply the comic setback on loss
//   onEnd       : ({result, reward?, penalty?, enemyName}) -> announce (toast)

export const CHALLENGE_RANGE = 200; // metres the player must be within to hail an NPC

export function createDuel({ npcs, getShipPos, applyReward, applyPenalty, onEnd, rng = Math.random } = {}) {
  const state = {
    active: false,
    enemyIndex: -1,
    enemyName: '',
    enemyWeakTo: '', // exposed for QA; the visible UI never spells out the weakness
    enemyGuard: '',
    playerMorale: MAX_MORALE,
    enemyMorale: MAX_MORALE,
    maxMorale: MAX_MORALE,
    options: [],
    enemyLine: '',
    lastOutcome: '',
    result: null, // 'win' | 'lose' | null
    round: 0,
  };
  let enemy = null;

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

  /** Is there a hailable ship within range right now? (drives the HUD prompt) */
  function inRange() { return !state.active && nearestInRange() !== -1; }

  /** Hail the nearest NPC and open the duel. Returns true if a duel started. */
  function tryChallenge() {
    if (state.active) return false;
    const idx = nearestInRange();
    if (idx === -1) return false;
    enemy = makeEnemy(rng);
    state.active = true;
    state.enemyIndex = idx;
    state.enemyName = enemy.name;
    state.enemyWeakTo = enemy.weakTo;
    state.enemyGuard = enemy.guard;
    state.playerMorale = MAX_MORALE;
    state.enemyMorale = MAX_MORALE;
    state.maxMorale = MAX_MORALE;
    state.options = pickOptions(rng, enemy, 4);
    state.enemyLine = opener(rng);
    state.lastOutcome = '';
    state.result = null;
    state.round = 0;
    return true;
  }

  /** Play option `i`. Resolves the exchange, updates morale, ends the duel on a break. */
  function choose(i) {
    if (!state.active) return null;
    const insult = state.options[i];
    if (!insult) return null;
    const r = resolveInsult(insult, enemy, rng);
    state.enemyMorale = clampMorale(state.enemyMorale + r.enemyDelta, state.maxMorale);
    state.playerMorale = clampMorale(state.playerMorale + r.playerDelta, state.maxMorale);
    state.enemyLine = r.comeback;
    state.lastOutcome = r.outcome;
    state.round++;

    if (isOver(state.enemyMorale)) return finish('win');
    if (isOver(state.playerMorale)) return finish('lose');
    state.options = pickOptions(rng, enemy, 4); // fresh lines for the next round
    return r;
  }

  function finish(result) {
    state.result = result;
    let reward_ = null, penalty_ = null;
    if (result === 'win') {
      reward_ = reward({ playerMorale: state.playerMorale, enemyMaxMorale: state.maxMorale });
      if (applyReward) applyReward(reward_);
      if (npcs && npcs.respawn) npcs.respawn(state.enemyIndex); // beaten foe sails off elsewhere
    } else {
      penalty_ = penalty();
      if (applyPenalty) applyPenalty(penalty_);
    }
    const enemyName = state.enemyName;
    if (onEnd) onEnd({ result, reward: reward_, penalty: penalty_, enemyName });
    // Back to sailing; the panel hides, the result is announced via the toast.
    state.active = false;
    return { result, reward: reward_, penalty: penalty_ };
  }

  /** Abandon a duel without resolving (e.g. on new voyage). */
  function cancel() { state.active = false; state.result = null; }

  // A plain, JSON-safe snapshot for the window.__tidewake QA hook.
  function snapshot() {
    return {
      active: state.active,
      enemyName: state.enemyName,
      enemyWeakTo: state.enemyWeakTo, // QA affordance only
      playerMorale: state.playerMorale,
      enemyMorale: state.enemyMorale,
      maxMorale: state.maxMorale,
      enemyLine: state.enemyLine,
      lastOutcome: state.lastOutcome,
      result: state.result,
      round: state.round,
      inRange: inRange(),
      options: state.options.map((o) => ({ id: o.id, category: o.category, line: o.line })),
    };
  }

  return { state, tryChallenge, choose, cancel, inRange, snapshot };
}
