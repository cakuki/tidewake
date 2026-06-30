// Boarding → crew brawl (#135, slice 4 of the owner's battle lane).
//
// Slices 1–3 gave the deliberate BATTLE stance its real-time broadside and a fitted shot locker.
// Once you've beaten a foe's hull down she's grappled and BOARDABLE — your crew swarms over the
// rail for a quick, comic deck brawl, and that brawl is the BRIDGE into the climax: the verbal
// captain's duel (#33, reused — never reinvented). Sink her for Infamy, take her deck for Standing.
//
// CREATIVE SPARK (Game Designer): the brawl is the breath between the cannon-thunder and the
// wordplay — two crews tangle rail to rail with cutlasses, ladles and the odd fainting parrot, and
// then it all narrows to the two captains trading insults across a wrecked deck. The fight you won
// with iron you must FINISH with wit. Crew × morale × loadout decides how the scrap goes; a clean
// rush leaves their captain already rattled when the shouting starts.
//
// PURE on purpose — no THREE, no DOM, no game state. Board-eligibility, the brawl resolution and the
// duel-handoff dent are all unit-tested under node (tests/unit/board.test.mjs). battle.js owns the
// controller wiring; main.js hands the softened foe to duel.tryChallenge for the climax.

// A foe is grappled and boardable once her hull is beaten to this fraction of full — the "≤30% hull"
// Board! prompt the owner asked for. Tuned so boarding is the FINISHER, not an opener.
export const BOARD_HULL_FRACTION = 0.30;

// Some shot you fit at the workshop (#135 slice 3) is anti-personnel — grape sweeps the deck, swivels
// rattle it — so a crew that loaded them boards with an edge. Hull/rigging shot grants no brawl bonus.
const BOARDING_SHOT_BONUS = { grape: 0.18, swivel: 0.10 };

// The largest opening morale dent a runaway brawl can hand the captain duel — kept modest so the duel
// (#33) is always a real fight, never a walkover. Slice 5 / Option 4 deepen the casualties→confidence link.
const MAX_BOARD_DENT = 30;

// Comic brawl beats — ORIGINAL to Tidewake, family-friendly, swashbuckling, slightly daft. 2–3 are
// shown per boarding (anti-repeat within the beat). WON narrates a deck carried; CLOSE a near-run scrap.
export const BRAWL_LINES_WON = [
  'Grapples bite, planks slap down, and your crew pours over the rail with a roar.',
  'The bosun trips their first mate into a herring barrel and the fight goes clean out of them.',
  'Cutlasses clack, someone’s parrot faints, and the enemy deck is yours in a dozen heartbeats.',
  'Your cook swings a soup ladle like a boarding axe — three of theirs surrender to the broth.',
  'They braced for a fight; they got your whole crew and one very cross goat. The deck folds.',
];

export const BRAWL_LINES_CLOSE = [
  'It’s elbows and oaths the length of the deck — you win it by a whisker and a chipped tooth.',
  'Boots skid on wet planks, barrels go over the side, and the brawl tips your way at the last.',
  'Two crews tangle rail to rail — for a heartbeat it’s anyone’s deck, then theirs gives an inch.',
  'Someone’s hat is alight and nobody will admit it’s theirs; the scrap grinds to your narrow favour.',
];

/** Is the foe beaten down enough to grapple and board? PURE; fails safe on junk input. */
export function canBoard({ enemyHull, maxHull } = {}) {
  if (!(maxHull > 0)) return false;
  return enemyHull <= maxHull * BOARD_HULL_FRACTION;
}

// Pick `n` distinct lines from a pool. PURE + injectable rng; defends against a short pool.
function pickLines(pool, rng, n) {
  const copy = pool.slice();
  const out = [];
  for (let k = 0; k < n && copy.length; k++) {
    const i = Math.min(copy.length - 1, Math.floor(rng() * copy.length));
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

/**
 * Resolve the deck brawl that bridges a boarded foe to the captain's duel. PURE: returns the outcome,
 * a narrow/runaway margin, and 2–3 comic lines — never mutates. The brawl ALWAYS carries through to the
 * verbal duel (the duel is the decider); a won brawl just hands the captain an opening morale dent.
 *
 * crew strength = your crew's nerve × a boarding-shot edge; foe resistance = her remaining nerve plus a
 * sliver of fight left in a holed hull. A ±10% jitter keeps it lively but the maths stays honest.
 *
 * @param {{crewMorale?:number, maxMorale?:number, loadout?:string[], foeMorale?:number, foeHull?:number, maxHull?:number}} p
 * @param {() => number} [rng]
 * @returns {{won:boolean, advantage:number, margin:number, lines:string[]}}
 */
export function resolveBrawl(
  { crewMorale = 60, maxMorale = 100, loadout = ['round'], foeMorale = 100, foeHull = 30, maxHull = 100 } = {},
  rng = Math.random,
) {
  const mm = maxMorale > 0 ? maxMorale : 100;
  const mh = maxHull > 0 ? maxHull : 100;
  const shotBonus = (Array.isArray(loadout) ? loadout : []).reduce((b, id) => b + (BOARDING_SHOT_BONUS[id] || 0), 0);
  const crew = (Math.max(0, crewMorale) / mm) * (1 + shotBonus);
  const foe = (Math.max(0, foeMorale) / mm) * 0.85 + (Math.max(0, foeHull) / mh) * 0.25;
  const jitter = 0.9 + rng() * 0.2; // ±10% fairness wobble (==1 when rng()==0.5)
  const margin = crew * jitter - foe;
  const won = margin > 0;
  const advantage = Math.max(0, Math.min(1, margin));
  const n = rng() < 0.5 ? 2 : 3;
  const lines = pickLines(won ? BRAWL_LINES_WON : BRAWL_LINES_CLOSE, rng, n);
  return { won, advantage, margin, lines };
}

/** How shaken the captain starts the duel, from the brawl advantage (0..MAX_BOARD_DENT). PURE. */
export function brawlMoraleDent(advantage) {
  return Math.round(Math.max(0, Math.min(1, advantage)) * MAX_BOARD_DENT);
}
