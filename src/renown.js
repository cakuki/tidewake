// Renown — the Captain's Ledger. PURE, DOM-free and three.js-free legend math so the
// whole reputation track unit-tests under `node --test`. Your legend only ever grows,
// but it now grows toward one of TWO POLES (#45):
//   * INFAMY   — the pirate path, earned by WINNING DUELS / aggression (duel.js reward).
//   * STANDING — the governor path, earned by PROFITABLE TRADES / commerce (economy.js sell).
// The shared spine is the TOTAL: renown = infamy + standing. That total picks your RUNG
// on the ladder; the *dominant pole* picks which titles that rung reads (piratical vs
// civic), and how harbourmasters react when you make port (feared vs respected).
//
// ENDGAME (#46): the very top of each pole IS the fantasy's payoff — become THE feared
// pirate (Terror of the Tidewake) or THE respected governor (Governor of the Tidewake).
// Crossing the top rung of a committed pole crowns a one-time LEGEND (earnedLegend +
// LEGENDS below); main.js fires a celebratory beat and the save remembers it. The world
// keeps sailing after — a legend milestone, not a game-over. FUTURE: deeper endings could
// branch off a legend (e.g. a governorship of a *specific* city, a named bounty arc).

// The ladder. Thresholds are lifetime-renown (= infamy + standing) gates; the RANKS
// titles are the canonical spine kept for back-compat. Per-pole titles live in LADDERS
// below and are swapped in by titleFor() according to which pole dominates.
// Tuned for a single short web session (#57): the median sitting is minutes, and the
// first session must deliver a visible win. Thresholds reward EARLY (the first named
// rank lands within ~one strong deed) then STRETCH (gaps strictly grow), so a focused
// 10-20 min of trading/dueling climbs several rungs and a dedicated captain can reach
// the summit. Gaps: 40, 80, 160, 280, 440, 600, 800 — fast dopamine, earned legend.
export const RANKS = [
  { at: 0,    title: 'Bilge-rat' },
  { at: 40,   title: 'Deckhand' },
  { at: 120,  title: 'Bosun' },
  { at: 280,  title: 'Quartermaster' },
  { at: 560,  title: 'First Mate' },
  { at: 1000, title: 'Sea Captain' },
  { at: 1600, title: 'Dread Captain' },
  { at: 2400, title: 'Terror of the Tidewake' },
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

// ---- Endgame legends: the payoff of the two-pole arc (#46) ------------------
// The very top rung of the ladder is the summit of legend. Reach it while COMMITTED to a
// pole (the dominant pole picks WHICH crown) and you become THE one: the feared Terror or
// the respected Governor of the Tidewake. A balanced captain sits at the neutral summit
// ("Legend of the Tidewake") but earns neither single crown until they lean — earn BOTH
// crowns across a voyage and you are, fittingly, a true Legend of the Tidewake.

// Lifetime-renown gate for a legend: the top rung's threshold (= infamy + standing).
export const LEGEND_AT = RANKS[RANKS.length - 1].at;

// The two crowns — each the top of its pole ladder, with a believable proclamation and a
// wink of comedy. Original to Tidewake. main.js/hud.js read these for the celebration beat.
export const LEGENDS = {
  pirate: {
    title: 'Terror of the Tidewake',
    icon: '⚔',
    proclaim: 'Feared in every port from here to the horizon.',
    flourish: 'Mothers now name storms after you. The storms are flattered.',
  },
  governor: {
    title: 'Governor of the Tidewake',
    icon: '⚖',
    proclaim: 'The isles, with one voice, proclaim you their own.',
    flourish: 'A commemorative biscuit has been struck in your honour — and is, by all accounts, edible.',
  },
};

/**
 * The celebration data for a freshly-earned legend, or null for an unknown pole.
 * @param {'pirate'|'governor'} which
 * @returns {{title:string, icon:string, proclaim:string, flourish:string} | null}
 */
export function legendBeat(which) {
  return LEGENDS[which] || null;
}

/**
 * Which legend(s) a ledger qualifies for RIGHT NOW. A point-in-time check: at any instant
 * the dominant pole crowns at most one, so the caller ORs the result into a persistent
 * flags object to accumulate both crowns over a voyage. Pure + junk-safe.
 * @param {number} infamy   pirate-path score
 * @param {number} standing governor-path score
 * @returns {{pirate:boolean, governor:boolean}}
 */
export function earnedLegend(infamy, standing) {
  const i = poleScore(infamy), s = poleScore(standing);
  const atTop = (i + s) >= LEGEND_AT;
  const pole = dominantPole(i, s);
  return {
    pirate: atTop && pole === 'pirate',
    governor: atTop && pole === 'governor',
  };
}

// Coin→standing conversion (#57). A sale's proceeds already bundle the cost basis, so
// gross-1:1 over-rewarded trade and dwarfed the duel pole. STANDING_PER_COIN scales the
// haul down to roughly its profit margin, so a strong sale (~400-700c) nets ~160-280
// standing — legible on the needle and ~comparable, per action, to a won duel's infamy.
export const STANDING_PER_COIN = 0.4;

/**
 * Renown earned from a single sale. Legend grows with the coin you pull in — bigger
 * hauls make a bigger name (STANDING_PER_COIN of the proceeds; junk / loss → 0).
 * Monotonic non-decreasing in proceeds.
 * @param {number} coinsEarned  the proceeds of the sale
 * @returns {number} renown to add (>= 0, integer)
 */
export function renownForSale(coinsEarned) {
  const c = Number.isFinite(coinsEarned) ? coinsEarned : 0;
  if (c <= 0) return 0;
  return Math.round(c * STANDING_PER_COIN);
}

// ---- Defeat ledger: the FIRST reputation-DECREMENT path (#164) ---------------
// Until now legend only ever GREW — Infamy and Standing were monotonic, and a lost fight
// cost a flat 14-coin repair toll and nothing else, so losing never stung. The owner's
// headline for the difficulty/stakes epic (#162): "games are too easy — a loss should COST
// points + fame." This is that cost, and the ONLY place a pole ever goes DOWN.
//
// BINDING owner decisions (#162, verbatim): the penalty is MEDIUM (stings, never a
// death-spiral); it is CONTEXT-BASED (a raiding loss dents Infamy, a governor-road loss
// dents Standing); coin is dented too; and you KEEP your ship (fame/coin only — no
// persisted ship field, so the save stays v17). Every pole FLOORS at 0 — one loss can
// wound a run but never wipe it, and a broke/green captain can't go negative.
//
// The magnitude SCALES BY FOE TIER (1..5, from src/ship-classes.js): losing to a
// man-o'-war is a real blow, losing to a sloop a shameful nick — the symmetric mirror of
// spoils, which already scale the WIN by the foe's hull. PURE + deterministic + junk-safe
// so the whole sting unit-tests under `node --test` (tier scaling, context routing, floor,
// no-death-spiral). battle.js calls it on a lost engagement; main.js applies the result to
// the already-persisted coin/infamy/standing and names the cost on the defeat card.

export const DEFEAT_MAX_TIER = 5;      // the ship-class threat ceiling (a warship man-o'-war)
export const DEFEAT_BASE_COIN = 8;     // a floor bite so even a sloop loss costs a little coin
export const DEFEAT_COIN_PER_TIER = 8; // + this much coin per foe tier (tier 1 → 16, tier 5 → 48)
export const DEFEAT_BASE_FAME = 6;     // a floor bite of fame — a loss always dents your name
export const DEFEAT_FAME_PER_TIER = 10;// + this much fame per foe tier (tier 1 → 16, tier 5 → 56)

/** Clamp a foe threat tier onto the [1, DEFEAT_MAX_TIER] scale; junk → the gentlest tier. */
function clampTier(tier) {
  const t = Math.round(Number(tier));
  if (!Number.isFinite(t)) return 1;
  return Math.max(1, Math.min(DEFEAT_MAX_TIER, t));
}

/**
 * Which fame pole a lost battle should dent — the CONTEXT of the loss (#162 owner-decision).
 * "Lose the pole you were pursuing": a captain building a pirate legend (Infamy-dominant, the
 * raiding road) has her Infamy dented; one building respectable Standing (governor road) has
 * her Standing dented. A balanced/green captain defaults to the raiding road — combat is the
 * pirate pole (#45), so an undecided loss reads as a raiding setback.
 * @param {number} infamy
 * @param {number} standing
 * @returns {'raid'|'governor'}
 */
export function defeatContext(infamy, standing) {
  return dominantPole(infamy, standing) === 'governor' ? 'governor' : 'raid';
}

/**
 * The stakes-on-loss ledger (#164) — the tier-scaled, context-based, floored deduction a lost
 * engagement lays on the captain's already-persisted coin + fame. PURE + deterministic.
 *
 *   • MEDIUM magnitude, SCALED BY FOE TIER (base + tier × per-tier) — monotonic in tier.
 *   • CONTEXT-BASED: context 'raid' dents Infamy, 'governor' dents Standing (anything else → raid).
 *   • Coin is dented too; every pole FLOORS at 0 (never negative, never a death-spiral / total wipe).
 *
 * Returns the NEW floored pole values (so a caller can assign them straight onto state) AND the
 * ACTUAL amounts deducted (old − new, so the defeat card names the true, honest cost — if you only
 * had 5 Infamy left it says −5, not the nominal −56). Junk-safe: junk ledger fields read as 0.
 *
 * @param {number} tier   the foe's threat tier (1..5, from src/ship-classes.js)
 * @param {'raid'|'governor'} context  which road the loss falls on (see defeatContext)
 * @param {{coins?:number, infamy?:number, standing?:number}} ledger  the captain's current ledger
 * @returns {{tier:number, context:'raid'|'governor', pole:'infamy'|'standing',
 *            coins:number, infamy:number, standing:number,
 *            coinLoss:number, fameLoss:number, nominalCoin:number, nominalFame:number}}
 */
export function defeatLedger(tier, context, ledger = {}) {
  const t = clampTier(tier);
  const nominalCoin = DEFEAT_BASE_COIN + t * DEFEAT_COIN_PER_TIER;
  const nominalFame = DEFEAT_BASE_FAME + t * DEFEAT_FAME_PER_TIER;
  const pole = context === 'governor' ? 'standing' : 'infamy';
  const curCoins = poleScore(ledger.coins);
  const curInfamy = poleScore(ledger.infamy);
  const curStanding = poleScore(ledger.standing);
  const coins = Math.max(0, curCoins - nominalCoin);
  const newInfamy = pole === 'infamy' ? Math.max(0, curInfamy - nominalFame) : curInfamy;
  const newStanding = pole === 'standing' ? Math.max(0, curStanding - nominalFame) : curStanding;
  return {
    tier: t,
    context: pole === 'standing' ? 'governor' : 'raid',
    pole,
    coins, infamy: newInfamy, standing: newStanding,
    coinLoss: curCoins - coins,                                        // actual coin lost (floored)
    fameLoss: pole === 'infamy' ? curInfamy - newInfamy : curStanding - newStanding, // actual fame lost
    nominalCoin, nominalFame,
  };
}
