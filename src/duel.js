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
//
// (The pure resolution helpers below import nothing on purpose; the colours import is only
// used by the controller at the bottom — the False-Colours treachery payoff, #79.)
import { isDeceptive, treacheryBonus, surpriseDamage, DEFAULT_COLOURS, lawfulStanding } from './colours.js';

export const MAX_MORALE = 100;

// The seven flavours of jab. An enemy is WEAK to one (a cutting hit) and GUARDS one
// (jeer at that and it backfires on your own crew). Everything else just glances.
// Superstition + Hygiene joined the original five in #135 slice 5 — a sailor's two
// softest spots: what he fears at sea, and what he smells like ashore.
export const CATEGORIES = ['pride', 'cowardice', 'looks', 'seamanship', 'wit', 'superstition', 'hygiene'];

// The insult pool — 50+ original Tidewake lines, each a JAB and its captain's RIPOSTE,
// written for this slice and lifted from no existing game. `category` decides the
// outcome vs the enemy; `sting` is the base bite; `line` is what you shout; `comeback`
// is the enemy's retort flung back at you. Each category carries a deep enough bench
// (≥6) that the anti-repeat picker can keep a long fight feeling fresh (see pickOptions).
export const INSULTS = [
  // pride
  { id: 'pride1', category: 'pride', sting: 22, line: "Your figurehead's the prettiest thing aboard — and it's a goat.", comeback: "She's worth more than your whole crew, hooves and all." },
  { id: 'pride2', category: 'pride', sting: 24, line: 'They named a wind after you: the one that smells faintly of regret.', comeback: "Breathe deep — you're downwind of greatness." },
  { id: 'pride3', category: 'pride', sting: 20, line: "I've met prouder captains bailing out my bilge.", comeback: 'Then bail faster, the view suits you.' },
  { id: 'pride4', category: 'pride', sting: 21, line: 'You strut the quarterdeck like a gull that found a whole loaf.', comeback: 'And you skulk yours like one that lost the crumb.' },
  { id: 'pride5', category: 'pride', sting: 23, line: 'Your crew salutes you — out of pity, I am told.', comeback: "Pity's the only thing your lot can afford to give." },
  { id: 'pride6', category: 'pride', sting: 25, line: "They'll write ballads of you: short ones, mostly about the smell.", comeback: "At least I rate a verse. You'd struggle for a footnote." },
  { id: 'pride7', category: 'pride', sting: 22, line: 'You polish that captain\'s hat so the gulls have somewhere grand to land.', comeback: 'Better a perch for gulls than a bare pole like your mast.' },
  { id: 'pride8', category: 'pride', sting: 24, line: 'Grand title, for a man whose flagship leaks at the bow.', comeback: 'She leaks proudly — more than your slack sails ever managed.' },
  // cowardice
  { id: 'cow1', category: 'cowardice', sting: 23, line: 'You flinch at your own cannon — does the boom frighten the baby?', comeback: "I flinch so the cannonball doesn't have to." },
  { id: 'cow2', category: 'cowardice', sting: 21, line: 'Your battle flag is a white sheet with extra steps.', comeback: "It matches the colour you'll turn shortly." },
  { id: 'cow3', category: 'cowardice', sting: 25, line: 'You sail so bravely — directly away from everything.', comeback: "It's called strategy. You'll learn it, retreating." },
  { id: 'cow4', category: 'cowardice', sting: 20, line: 'You keep a course so cautious the barnacles outrun you.', comeback: 'Slow and afloat beats fast and drowned, friend.' },
  { id: 'cow5', category: 'cowardice', sting: 22, line: "Your motto is 'retreat with dignity' — minus the dignity.", comeback: 'And plus the living, which you will shortly lack.' },
  { id: 'cow6', category: 'cowardice', sting: 24, line: "I've seen jellyfish square up braver than your whole watch.", comeback: "Jellyfish don't have to look at your face. Lucky things." },
  { id: 'cow7', category: 'cowardice', sting: 23, line: 'You drew your cutlass and asked it to wait outside.', comeback: "It's resting. It'll be along the moment you're worth the swing." },
  { id: 'cow8', category: 'cowardice', sting: 21, line: 'Even your shadow keeps a safe distance from the fight.', comeback: 'Smart shadow. Wish my crew were half as sensible.' },
  // looks
  { id: 'look1', category: 'looks', sting: 22, line: 'Is that a beard, or did a gull lose a fight on your chin?', comeback: 'The gull won. You are looking at the loser.' },
  { id: 'look2', category: 'looks', sting: 20, line: 'Your face could sour a whole hold of rum.', comeback: 'Good — more sober hands to thrash you with.' },
  { id: 'look3', category: 'looks', sting: 24, line: "I'd call you barnacle-ugly, but the barnacles objected.", comeback: 'They have better taste than your mirror, plainly.' },
  { id: 'look4', category: 'looks', sting: 23, line: 'Your mother hung a lantern by you so ships knew what to avoid.', comeback: 'And yet you steered straight in. Poor navigator AND blind.' },
  { id: 'look5', category: 'looks', sting: 21, line: "I've seen friendlier faces carved on ships that sank on purpose.", comeback: 'They sank to get away from looking at you, no doubt.' },
  { id: 'look6', category: 'looks', sting: 22, line: "Squint and you're almost passable — so everyone aboard squints.", comeback: 'Squint harder and you might pass for competent. We will wait.' },
  { id: 'look7', category: 'looks', sting: 20, line: 'Your figurehead asked to be moved to the stern, away from you.', comeback: 'Wise wood. Pity your crew can\'t relocate from your jokes.' },
  { id: 'look8', category: 'looks', sting: 25, line: "You've a face that could becalm a gale out of sheer disappointment.", comeback: "Then I'll save a fortune in canvas, won't I." },
  // seamanship
  { id: 'sea1', category: 'seamanship', sting: 23, line: "You couldn't navigate a bathtub to its own plug.", comeback: 'And yet here I am, plugging up your day.' },
  { id: 'sea2', category: 'seamanship', sting: 21, line: 'Your knots are just confused string having a bad afternoon.', comeback: "They'll hold long enough to hang your pride." },
  { id: 'sea3', category: 'seamanship', sting: 25, line: "You reef a sail like you're wrestling a ghost — and losing.", comeback: 'The ghost tells me you sail even worse.' },
  { id: 'sea4', category: 'seamanship', sting: 22, line: 'You call that a heading? A drunk compass would file a complaint.', comeback: 'It complained about the company, mostly.' },
  { id: 'sea5', category: 'seamanship', sting: 20, line: "Your wake spells out 'sorry' in three languages.", comeback: "All three you'll be begging in shortly." },
  { id: 'sea6', category: 'seamanship', sting: 24, line: 'You trim a sail like you owe it money and dare not meet its canvas.', comeback: 'I trim to win, not to impress a man who rows.' },
  { id: 'sea7', category: 'seamanship', sting: 21, line: "Your charts have a mark for 'here be me, lost again'.", comeback: 'Better an honest mark than your blank, hopeful guesswork.' },
  { id: 'sea8', category: 'seamanship', sting: 23, line: 'You tacked so wide you visited a port on the way to nowhere.', comeback: 'Lovely port. Sent your reputation a postcard from it.' },
  // wit
  { id: 'wit1', category: 'wit', sting: 22, line: "I'd trade wits with you, but I never rob the needy.", comeback: 'Keep yours — clearly you are hoarding the lot.' },
  { id: 'wit2', category: 'wit', sting: 24, line: 'Your comebacks arrive like your ship: late and leaking.', comeback: 'Yet still in time to sink you.' },
  { id: 'wit3', category: 'wit', sting: 21, line: "I'd match wits with you, but I left my smaller one ashore.", comeback: "Bring it next time — you'll need the spare." },
  { id: 'wit4', category: 'wit', sting: 23, line: 'Your jokes land like an anchor: loud, wet, and dragging everyone down.', comeback: "And yet you're still hooked on every one." },
  { id: 'wit5', category: 'wit', sting: 20, line: 'You think you are quick — the tide disagrees, and it has seen slower.', comeback: 'The tide and I have an understanding. You it merely tolerates.' },
  { id: 'wit6', category: 'wit', sting: 22, line: "I'd explain the jest, but your crew is still parsing the last one.", comeback: "We're savouring it. Slowly. Out of charity." },
  { id: 'wit7', category: 'wit', sting: 24, line: 'Sharp as a spoon, that tongue of yours.', comeback: "Spoons feed people. What have your barbs ever served?" },
  { id: 'wit8', category: 'wit', sting: 21, line: 'You bring a quip to a quarrel like you bring a sieve to bail.', comeback: 'It bails enough to keep me talking, sadly for you.' },
  // superstition — what a sailor fears out on the water
  { id: 'sup1', category: 'superstition', sting: 24, line: 'You sailed on a Friday, renamed the ship, AND whistled — bold, for a man who fears his own bilge.', comeback: 'I make my own luck. You inherited yours, and it has run out.' },
  { id: 'sup2', category: 'superstition', sting: 22, line: "There's a curse on your hull, and frankly it's the most interesting thing aboard.", comeback: "Keep talking and I'll introduce you to it personally." },
  { id: 'sup3', category: 'superstition', sting: 21, line: 'You toss salt over both shoulders and still cannot season a victory.', comeback: "I'll season it with your tears, then. Plenty of those coming." },
  { id: 'sup4', category: 'superstition', sting: 25, line: 'A banana in the hold, a dead albatross, and you out here picking fights — death wish, or just daft?', comeback: 'Daft enough to beat you, which is all the luck I need.' },
  { id: 'sup5', category: 'superstition', sting: 20, line: 'Even your ship\'s cat leapt overboard rather than share your omens.', comeback: 'Cat couldn\'t swim. Bad omen for it, not for me.' },
  { id: 'sup6', category: 'superstition', sting: 23, line: 'You painted eyes on the bow so the ship can see what is coming. It looks terrified.', comeback: 'She is looking at you, naturally. Anyone would flinch.' },
  { id: 'sup7', category: 'superstition', sting: 22, line: 'Mermaids surface just to warn other ships about you.', comeback: 'Flattered they noticed. They will be warning about you by dusk.' },
  { id: 'sup8', category: 'superstition', sting: 21, line: 'You carry more lucky charms than crew, and twice as useless.', comeback: 'The charms work. You are proof — they sent you straight to me.' },
  // hygiene — what he smells like when he finally comes ashore
  { id: 'hyg1', category: 'hygiene', sting: 22, line: 'Downwind of you the fish surface to apologise.', comeback: "Then they'll be right there when I gut your nets." },
  { id: 'hyg2', category: 'hygiene', sting: 20, line: 'Your crew bathes once a voyage, whether the storm hits them or not.', comeback: 'Cleaner than your conscience, salt-licker.' },
  { id: 'hyg3', category: 'hygiene', sting: 24, line: 'I smelled your ship before I sighted it, and I sighted it from the horizon.', comeback: "Then you had time to flee, and didn't. Slow nose, slower wits." },
  { id: 'hyg4', category: 'hygiene', sting: 23, line: 'Your beard has its own ecosystem and pays you no rent.', comeback: 'It guards my chin better than your crew guards your deck.' },
  { id: 'hyg5', category: 'hygiene', sting: 21, line: 'You could caulk a hull with what is under those fingernails.', comeback: 'Handy, that. Saves me buying tar to seal your fate.' },
  { id: 'hyg6', category: 'hygiene', sting: 25, line: 'Last time you washed, the harbour filed it as a spill.', comeback: 'And I have out-lasted the clean-up. You will not last the hour.' },
  { id: 'hyg7', category: 'hygiene', sting: 22, line: 'Your socks could stand a watch on their own — and run a tighter ship.', comeback: "They'd still let you board. That's more mercy than you'll get from me." },
  { id: 'hyg8', category: 'hygiene', sting: 20, line: 'The barnacles left your hull for somewhere cleaner: a sewer.', comeback: 'More room for speed, then. I will catch you before you catch your breath.' },
];

// How many recently-OFFERED lines the duel remembers ACROSS hails in one session, so two
// duels back-to-back don't open with the same stale hand (#135 slice 5). Session-scoped on
// purpose — the corpus is static, so nothing here touches the save (stays v16).
export const DUEL_MEMORY = 18;

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
  // Infamy per win (#57): scaled so a duel visibly moves the needle against the lowered
  // legend curve — ~100-160 infamy a win, keeping the pirate pole ~comparable, per deed,
  // to the trader's standing so either path reaches its legend in a like-sized sitting.
  const renown = Math.round(coins * 2.0);
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
 * available (and an automated test can always make progress).
 *
 * ANTI-REPEAT (#135 slice 5): `recent` is a set/array of recently-OFFERED insult ids
 * (within this engagement AND carried across recent hails). The picker PREFERS lines not
 * in `recent`, so a long fight — and back-to-back duels — keep feeling fresh. The two hard
 * guarantees (a sharp line is always offered; the hand is always `n` distinct) ALWAYS win
 * over freshness: if the fresh bench can't satisfy them, the picker falls back to stale
 * lines rather than starve the winning move or short the hand. PURE; `rng` is injectable.
 *
 * @param {() => number} [rng]
 * @param {{weakTo:string}} enemy
 * @param {number} [n]
 * @param {Iterable<string>} [recent] — ids shown recently; avoided when a fresh bench allows
 * @returns {Array<object>} insult objects from INSULTS
 */
export function pickOptions(rng = Math.random, enemy, n = 4, recent = []) {
  const stale = recent instanceof Set ? recent : new Set(recent);
  const chosen = [];

  // 1) The sharp (weakness) line — prefer a fresh one, fall back to any sharp line.
  const sharpAll = INSULTS.filter((i) => i.category === enemy.weakTo);
  const sharpFresh = sharpAll.filter((i) => !stale.has(i.id));
  const sharpPool = sharpFresh.length ? sharpFresh : sharpAll;
  if (sharpPool.length) chosen.push(sharpPool[pickIndex(rng, sharpPool.length)]);

  // 2) Fill the rest: drain the FRESH pool first, only dipping into stale lines if the
  //    fresh bench can't fill the hand (a very long fight, or a near-exhausted corpus).
  const remaining = INSULTS.filter((i) => !chosen.includes(i));
  const fresh = remaining.filter((i) => !stale.has(i.id));
  const leftover = remaining.filter((i) => stale.has(i.id));
  const drain = (pool) => {
    const p = pool.slice();
    while (chosen.length < n && p.length) {
      chosen.push(p.splice(pickIndex(rng, p.length), 1)[0]);
    }
  };
  drain(fresh);
  drain(leftover);

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

export function createDuel({ npcs, getShipPos, getColours, applyReward, applyPenalty, onEnd, sfx, rng = Math.random } = {}) {
  // Fire a procedural duel stinger (audio.playDuelHit) if one was wired in. Audio
  // must never break a duel, so every call is swallowed.
  function ping(kind) {
    try { if (sfx) sfx(kind); } catch { /* a stinger must never break the duel */ }
  }
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
    treachery: false, // was the duel opened under FALSE colours? (#79)
    targetKind: 'merchant', // the hailed vessel's disposition — pirate/merchant (#91)
    boarded: false, // was this captain's duel reached by BOARDING a beaten ship? (#135 slice 4)
    confidenceDent: 0, // how shaken YOUR captain opened, from the brawl's crew casualties (#135 O4 slice 3)
  };
  let enemy = null;
  let engagedColours = DEFAULT_COLOURS; // the colours flown the instant the hail went up
  let engagedKind = 'merchant';         // the target's kind the instant the hail went up (#91)

  // ANTI-REPEAT memory (#135 slice 5), session-scoped (never persisted — save stays v16):
  //   * `engagementSeen` — every line offered in the CURRENT duel; reset each hail so a single
  //     fight never re-offers a jab while the bench can cover it.
  //   * `sessionRecent` — a rolling window of the last DUEL_MEMORY ids offered ACROSS hails, so
  //     two duels back-to-back don't open with the same stale hand.
  let engagementSeen = new Set();
  const sessionRecent = [];
  function avoidSet() { return new Set([...engagementSeen, ...sessionRecent]); }
  function rememberOffered(opts) {
    for (const o of opts) {
      engagementSeen.add(o.id);
      sessionRecent.push(o.id);
      while (sessionRecent.length > DUEL_MEMORY) sessionRecent.shift();
    }
  }
  // Offer a fresh hand AND record it, so the next pick avoids it. One seam for both call sites.
  function dealOptions() {
    const opts = pickOptions(rng, enemy, 4, avoidSet());
    rememberOffered(opts);
    return opts;
  }

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

  /**
   * Hail the nearest NPC and open the duel. Returns true if a duel started.
   * @param {{openingDent?:number, boarded?:boolean, playerDent?:number}} [opts] — a captain's duel
   *   reached by BOARDING (#135 slice 4) opens with HER crew already shaken by the deck brawl
   *   (`openingDent` off her morale) and flags `boarded` so main.js frames the win as a CAPTURE
   *   (Standing). `playerDent` (#135 Option-4 slice 3) is the mirror on YOUR side — a boarding that
   *   cost you crew opens with your OWN captain shaken (off your morale), shifting the duel's footing.
   *   Defaults keep the open-sea hail (the existing #33/#79/#91 callers) byte-identical.
   */
  function tryChallenge({ openingDent = 0, boarded = false, playerDent = 0, targetIndex } = {}) {
    if (state.active) return false;
    // Default: the NEAREST hailable ship (the keyboard 'f' verb, unchanged). The hover-to-interact
    // picker (#161 slice 6) passes an explicit `targetIndex` so a CLICK hails exactly the ship under the
    // cursor. Given index is trusted (the picker only offers 'hail' for an in-range hull).
    const idx = (Number.isInteger(targetIndex) && targetIndex >= 0) ? targetIndex : nearestInRange();
    if (idx === -1) return false;
    enemy = makeEnemy(rng);
    // False Colours (#79): hailing under a disguise is a treacherous opening — the enemy crew
    // is caught off guard (starts with morale already dented) and the win pays a perfidy bonus
    // to Infamy. Captured the instant the colours go up, before they can be changed.
    engagedColours = (getColours && getColours()) || DEFAULT_COLOURS;
    state.treachery = isDeceptive(engagedColours);
    // Letters of Marque (#91): capture the target's disposition now — an honest win over a
    // pirate earns Standing (lawful), over an innocent merchant it fines it.
    const snaps = (npcs && npcs.snapshot && npcs.snapshot()) || [];
    engagedKind = (snaps[idx] && snaps[idx].kind) || 'merchant';
    state.targetKind = engagedKind;
    state.active = true;
    state.enemyIndex = idx;
    state.enemyName = enemy.name;
    state.enemyWeakTo = enemy.weakTo;
    state.enemyGuard = enemy.guard;
    // Crew casualties → duel confidence (#135 Option-4 slice 3): a boarding that cost you crew opens
    // with YOUR captain shaken too. Clamped so a ruinous boarding rattles, never routs — you always
    // still get to open your mouth, and the wit remains the decider.
    state.confidenceDent = Math.max(0, playerDent || 0);
    state.playerMorale = clampMorale(MAX_MORALE - state.confidenceDent, MAX_MORALE);
    // A boarded captain (#135 slice 4) starts already shaken by the deck brawl, on top of any
    // false-colours surprise (#79). The dent is clamped so the duel is always still a real fight.
    state.boarded = !!boarded;
    state.enemyMorale = clampMorale(
      MAX_MORALE - surpriseDamage(engagedColours) - Math.max(0, openingDent || 0), MAX_MORALE);
    state.maxMorale = MAX_MORALE;
    engagementSeen = new Set(); // a new fight forgets the last fight's WITHIN-duel exclusions…
    state.options = dealOptions(); // …but sessionRecent still steers the opening hand fresh
    state.enemyLine = opener(rng);
    state.lastOutcome = '';
    state.result = null;
    state.round = 0;
    ping('challenge'); // a light bugle as the colours go up
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

    const ending = isOver(state.enemyMorale) || isOver(state.playerMorale);
    // On the blow that ends the duel, let the win/lose flourish carry the moment
    // (finish() fires it); otherwise punctuate the exchange with its own sting.
    if (!ending) {
      ping(r.outcome === 'cutting' ? 'cut' : r.outcome === 'backfire' ? 'backfire' : 'glance');
    }

    if (isOver(state.enemyMorale)) return finish('win');
    if (isOver(state.playerMorale)) return finish('lose');
    state.options = dealOptions(); // fresh, anti-repeat lines for the next round (#135 slice 5)
    return r;
  }

  function finish(result) {
    state.result = result;
    ping(result === 'win' ? 'win' : 'lose'); // triumphant fanfare / comic defeat sting
    let reward_ = null, penalty_ = null;
    if (result === 'win') {
      reward_ = reward({ playerMorale: state.playerMorale, enemyMaxMorale: state.maxMorale });
      // Treachery payoff (#79): a win under false colours pays a perfidy bonus to Infamy
      // (the duel's `renown` field IS infamy — combat is the pirate pole, #45).
      if (state.treachery) {
        const bonus = treacheryBonus(reward_.renown, engagedColours);
        reward_ = { ...reward_, renown: reward_.renown + bonus, treachery: true, treacheryBonus: bonus };
      }
      // Letters of Marque (#91): an honest win pays the lawful pole — Standing for besting a
      // pirate, a fine for picking on an innocent. (The duel's `renown` field IS infamy.)
      const standing = lawfulStanding(reward_.renown, engagedColours, engagedKind);
      if (standing !== 0) {
        reward_ = { ...reward_, standing, targetKind: engagedKind, lawful: standing > 0 };
      }
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
      treachery: state.treachery, // dueling under false colours (#79)
      targetKind: state.targetKind, // the foe's disposition — pirate/merchant (#91)
      boarded: state.boarded, // reached by boarding a beaten ship (#135 slice 4)
      confidenceDent: state.confidenceDent, // how shaken YOUR captain opened, from brawl casualties (#135 O4 slice 3)
      inRange: inRange(),
      options: state.options.map((o) => ({ id: o.id, category: o.category, line: o.line })),
    };
  }

  return { state, tryChallenge, choose, cancel, inRange, snapshot };
}
