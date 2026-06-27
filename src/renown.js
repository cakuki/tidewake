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
