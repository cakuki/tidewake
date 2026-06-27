// Renown — the Captain's Ledger. PURE, DOM-free and three.js-free legend math so the
// whole reputation track unit-tests under `node --test`. Your legend only ever grows,
// but it now grows toward one of TWO POLES (#45):
//   * INFAMY   — the pirate path, earned by WINNING DUELS / aggression (duel.js reward).
//   * STANDING — the governor path, earned by PROFITABLE TRADES / commerce (economy.js sell).
// The shared spine is the TOTAL: renown = infamy + standing. That total picks your RUNG
// on the ladder; the *dominant pole* picks which titles that rung reads (piratical vs
// civic), and how harbourmasters react when you make port (feared vs respected).
//
// ENDGAME SEAM (not built yet): the very top of each pole is the fantasy's payoff —
// become THE feared pirate (Terror of the Tidewake) or THE respected governor (Governor
// of the Tidewake). A future slice can turn those top rungs into real milestone events
// (a coronation / a bounty, a win-state). For now they're just the proudest titles.

// The ladder. Thresholds are lifetime-renown (= infamy + standing) gates; the RANKS
// titles are the canonical spine kept for back-compat. Per-pole titles live in LADDERS
// below and are swapped in by titleFor() according to which pole dominates.
export const RANKS = [
  { at: 0,     title: 'Bilge-rat' },
  { at: 120,   title: 'Deckhand' },
  { at: 360,   title: 'Bosun' },
  { at: 820,   title: 'Quartermaster' },
  { at: 1600,  title: 'First Mate' },
  { at: 3200,  title: 'Sea Captain' },
  { at: 6400,  title: 'Dread Captain' },
  { at: 12800, title: 'Terror of the Tidewake' },
];

// ---- Two diverging title ladders + a neutral middle path (#45) ---------------
// Each ladder is as deep as RANKS (one title per rung). The dominant pole selects
// which ladder a given rung reads. All titles original to Tidewake, ascending.
//   pirate   — you are FEARED: a name whispered with a glance over the shoulder.
//   governor — you are RESPECTED: a name spoken with a tip of the hat.
//   neutral  — a free captain who has not yet leaned hard either way.
export const LADDERS = {
  neutral: [
    'Bilge-rat', 'Deckhand', 'Bosun', 'Quartermaster',
    'First Mate', 'Sea Captain', 'Free Captain', 'Legend of the Tidewake',
  ],
  pirate: [
    'Bilge-rat', 'Cutpurse', 'Brigand', 'Reaver',
    'Marauder', 'Corsair', 'Dread Captain', 'Terror of the Tidewake',
  ],
  governor: [
    'Bilge-rat', 'Dock Clerk', 'Tradesmaster', 'Portwarden',
    'Merchant Prince', 'Harbourmaster', 'Magistrate', 'Governor of the Tidewake',
  ],
};

// How balanced the two poles must be to still read "neutral". A pole only takes over
// once it holds more than (50 + 10)% of your total legend — a 60/40 lean still feels
// undecided. Below that band you're a free captain.
const BALANCE_BAND = 0.2;

// Short human word for a pole's flavour — surfaced in the HUD as a leaning hint.
const LEANING = { pirate: 'feared', governor: 'respected', neutral: 'balanced' };

function poleScore(n) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Which pole dominates a captain's ledger.
 * @param {number} infamy   pirate-path score (junk → 0)
 * @param {number} standing governor-path score (junk → 0)
 * @returns {'pirate'|'governor'|'neutral'}
 */
export function dominantPole(infamy, standing) {
  const i = poleScore(infamy), s = poleScore(standing);
  const total = i + s;
  if (total <= 0) return 'neutral';
  const tilt = (i - s) / total; // -1 = pure governor … +1 = pure pirate
  if (tilt > BALANCE_BAND) return 'pirate';
  if (tilt < -BALANCE_BAND) return 'governor';
  return 'neutral';
}

/**
 * The captain's current TITLE, chosen by total renown (the rung) and dominant pole
 * (which ladder that rung reads). This is the keystone of the two-poles fantasy.
 * @param {number} infamy
 * @param {number} standing
 * @returns {{title:string, pole:'pirate'|'governor'|'neutral', leaning:string, index:number}}
 */
export function titleFor(infamy, standing) {
  const i = poleScore(infamy), s = poleScore(standing);
  const pole = dominantPole(i, s);
  const { index } = rankForRenown(i + s);
  const ladder = LADDERS[pole] || LADDERS.neutral;
  const title = ladder[index] || ladder[ladder.length - 1];
  return { title, pole, leaning: LEANING[pole], index };
}

/**
 * Resolve a renown score to its place on the ladder.
 * @param {number} renown  lifetime renown (junk / negative is treated as 0)
 * @returns {{title:string, index:number, nextAt:number|null, nextTitle:string|null, progress:number}}
 *   `nextAt`/`nextTitle` are null at the top; `progress` is the [0,1] fraction toward
 *   the next rank (1 at the top of the ladder).
 */
export function rankForRenown(renown) {
  const r = Number.isFinite(renown) && renown > 0 ? renown : 0;
  let index = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (r >= RANKS[i].at) index = i; else break;
  }
  const cur = RANKS[index];
  const next = RANKS[index + 1] || null;
  const progress = next ? Math.min(1, Math.max(0, (r - cur.at) / (next.at - cur.at))) : 1;
  return {
    title: cur.title,
    index,
    nextAt: next ? next.at : null,
    nextTitle: next ? next.title : null,
    progress,
  };
}

// ---- Reputation tiers: how the world reacts to your legend (#43) ------------
// A coarse 3-bucket read of the fine-grained rank ladder, so ports can change their
// greeting and trade terms without a line per rung. Three reactions: the world doesn't
// know you (Unknown), is starting to (Known), or rolls out the barrel (Renowned).
//
// TWO POLES (#45): at the top (Renowned) tier the reaction DIVERGES by dominant pole —
// a feared Infamy captain gets nervous, deferential ports that would rather you sailed
// on; a respected Standing captain gets warm, cheering ones. The tier buckets + the
// price favour stay shared; only the greeting pool swaps (greetPlayer carries the pole).

/**
 * Bucket a renown score into one of three reaction tiers.
 * @param {number} renown
 * @returns {{tier:0|1|2, key:'unknown'|'known'|'renowned', label:string}}
 */
export function renownTier(renown) {
  const { index } = rankForRenown(renown);
  if (index >= 5) return { tier: 2, key: 'renowned', label: 'Renowned' }; // Sea Captain+
  if (index >= 2) return { tier: 1, key: 'known', label: 'Known' };       // Bosun..First Mate
  return { tier: 0, key: 'unknown', label: 'Unknown' };                   // Bilge-rat/Deckhand
}

/**
 * The "world favours you" trade perk: a small symmetric price nudge by tier. A known
 * captain buys a touch cheaper and sells a touch dearer. Deliberately modest (<=4%) so
 * the real profit still lives in the voyage between ports — standing seasons arbitrage,
 * it doesn't replace it. Monotonic non-decreasing with renown.
 * @param {number} renown
 * @returns {number} favour fraction in [0, 0.04]
 */
export function standingPriceModifier(renown) {
  return renownTier(renown).tier * 0.02;
}

// Tier-keyed harbourmaster greetings — original, warm + witty, pole-neutral. {port} and
// {title} are filled in per arrival. Lower tier is comically dismissive; higher tier greets
// you warmly and BY TITLE. Keep pools short so arrivals don't feel spammy.
export const GREETINGS = {
  unknown: [
    'Welcome to {port}, stranger. Mind the gulls — they file complaints.',
    "Another nameless sail at {port}. Tie up by the other nobodies, would you.",
    "{port} greets you, whoever you are. We'll learn your name if you last the week.",
    "New face? The dockhands wagered you'd sink before the jetty. Prove them poor.",
  ],
  known: [
    "Back at {port}, are you, {title}? Folk have stopped betting against you. Mostly.",
    'A familiar sail makes {port}. Welcome, {title} — your berth is the tidy one today.',
    "Ah, {title}. They're starting to remember your face around {port}. Some fondly.",
  ],
  renowned: [
    "Welcome back, {title} — your usual berth's ready and the gulls have been warned.",
    "{port} stands a little straighter today: the {title} is in. Fetch the good grog!",
    'Word ran ahead of your sails, {title}. {port} is yours — try not to buy it outright.',
  ],
  // Renowned + FEARED (infamy-led): the harbourmaster is nervously deferential and would,
  // all things considered, prefer you bought your barrel and left before nightfall.
  renowned_feared: [
    "Oh. {title}. We— we weren't expecting you. Berth's yours. Everyone's berth is yours.",
    '{port} welcomes you, {title}. *gulps* The grog is on the house. All of it. Please.',
    "Word ran ahead of your sails, {title}, and the town locked its shutters out of respect. Purely respect.",
    'Easy now, {title} — no trouble at {port} today, eh? Trade quick and we part friends.',
  ],
  // Renowned + RESPECTED (standing-led): the port throws the doors open and cheers.
  renowned_respected: [
    'Three cheers for {title}! {port} has saved you the finest berth and the warmest welcome.',
    "Welcome home, {title}! {port} prospers when your sails crest the horizon — the council sends its regards.",
    'Ring the harbour bell — the {title} is in! {port} is yours, and gladly so.',
    'A friend of {port} returns! Mind the bunting, {title}, the children hung it for you.',
  ],
};

/**
 * Pick the harbourmaster's arrival greeting for the player's current tier, with {port}
 * and {title} substituted. At the Renowned tier the reaction diverges by dominant
 * `pole` (feared pirate vs respected governor). Pure + injectable RNG so it unit-tests
 * deterministically.
 * @param {number} renown   total renown (infamy + standing)
 * @param {string} portName
 * @param {() => number} [rnd]  defaults to Math.random
 * @param {'pirate'|'governor'|'neutral'} [pole]  the captain's leaning (default neutral)
 * @returns {string}
 */
export function greetPlayer(renown, portName, rnd = Math.random, pole = 'neutral') {
  const { key } = renownTier(renown);
  // The world only fears/cheers a captain it actually knows — pole diverges at the top tier.
  let poolKey = key;
  if (key === 'renowned') {
    if (pole === 'pirate') poolKey = 'renowned_feared';
    else if (pole === 'governor') poolKey = 'renowned_respected';
  }
  const pool = GREETINGS[poolKey] || GREETINGS[key];
  const { index } = rankForRenown(renown);
  const ladder = LADDERS[pole] || LADDERS.neutral;
  const title = ladder[index] || ladder[ladder.length - 1];
  const line = pool[Math.floor(rnd() * pool.length) % pool.length] || pool[0];
  return line.replace(/\{port\}/g, portName).replace(/\{title\}/g, title);
}

/**
 * Renown earned from a single sale. Legend grows with the coin you pull in — bigger
 * hauls make a bigger name. One coin earned = one renown (junk / loss → 0). Monotonic.
 * @param {number} coinsEarned  the proceeds of the sale
 * @returns {number} renown to add (>= 0, integer)
 */
export function renownForSale(coinsEarned) {
  const c = Number.isFinite(coinsEarned) ? coinsEarned : 0;
  if (c <= 0) return 0;
  return Math.round(c);
}
