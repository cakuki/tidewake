// Renown — the Captain's Ledger. PURE, DOM-free and three.js-free legend math so the
// whole reputation track unit-tests under `node --test`. Renown is a single ascending
// score: your legend only ever grows. You earn it by *doing* — chiefly turning a profit
// in the port economy (economy.js bumps it on every sale) — and you climb a ladder of
// titles the world will (one day) say aloud when you make port.
//
// TWO-POLES SEAM: for v1 this is a single pirate-leaning ladder. The north-star splits
// into feared **pirate** ↔ respected **governor**. When deeds gain an alignment, branch
// here: keep `index`/`progress` as the shared spine and swap the *title* per pole (e.g.
// a governor-lean "Harbour Lord / Magistrate / Governor" mirror of the dread ladder).
// Nothing downstream (HUD, save) needs to change — they read {title, index, progress}.

// The ladder. Thresholds are lifetime-renown gates; titles are original to Tidewake and
// tuned so a first profitable round-trip already lifts a green hand off the bilge.
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
// TWO-POLES SEAM (see top of file): today a single pirate-leaning scale. When deeds gain
// an alignment, the *reaction* should diverge even at the same tier — a feared Infamy
// captain gets nervous, cowering ports; a respected Standing captain gets honoured ones.
// Branch the GREETINGS pools (e.g. GREETINGS.renowned.pirate / .governor) and let
// renownTier carry the pole; tiers + price favour can stay shared. Don't build it now.

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
};

/**
 * Pick the harbourmaster's arrival greeting for the player's current tier, with {port}
 * and {title} substituted. Pure + injectable RNG so it unit-tests deterministically.
 * @param {number} renown
 * @param {string} portName
 * @param {() => number} [rnd]  defaults to Math.random
 * @returns {string}
 */
export function greetPlayer(renown, portName, rnd = Math.random) {
  const { key } = renownTier(renown);
  const pool = GREETINGS[key];
  const title = rankForRenown(renown).title;
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
