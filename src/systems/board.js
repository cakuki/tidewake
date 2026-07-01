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

// ── Hull damage → boarding odds — the act-1→act-2 coupling (#135, Option 4 slice 2) ────────────────
// The maneuvering/broadside phase (act 1) now MECHANICALLY feeds the boarding brawl (act 2): a foe you
// battered before you grappled boards like a wreck — half her deck has already yielded. Normalised
// across the boardable window [0 .. 30% hull] so that gunnery PAST the boarding line matters: grapple
// her the instant she's boardable and the boarders earn nothing extra; pound her to splinters first and
// they carry a real edge into the scrap. The largest edge is kept modest so crew nerve still dominates
// and the captain duel (#33) downstream is always a genuine fight.
export const MAX_BOARDING_EDGE = 0.35;

/**
 * How much your battering has SOFTENED the boarding, from the foe's hull at the moment you grapple. PURE.
 * 0 when she's boarded right on the ≤30% line (a spry deck); up to MAX_BOARDING_EDGE when she's a floating
 * wreck. This is the coupling: positioning + gunnery in the broadside phase now set up the brawl odds.
 * Fails safe on junk input (no edge, never negative).
 * @param {{foeHull?:number, maxHull?:number}} p
 * @returns {number} a positive brawl-margin bonus in [0, MAX_BOARDING_EDGE]
 */
export function boardingEdge({ foeHull = 0, maxHull = 0 } = {}) {
  if (!(maxHull > 0)) return 0;
  const window = maxHull * BOARD_HULL_FRACTION; // the boardable band: full battering credit spans this
  if (!(window > 0)) return 0;
  const frac = Math.max(0, Math.min(1, foeHull / window)); // 1 at the boarding line, 0 at a smashed hull
  return (1 - frac) * MAX_BOARDING_EDGE;
}

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
 * crew strength = your crew's nerve × a boarding-shot edge, PLUS the battering edge (#135 Option-4 slice 2)
 * — how far past the boarding line you pounded her hull; foe resistance = her remaining nerve plus a sliver
 * of fight left in a holed hull. A ±10% jitter keeps it lively but the maths stays honest.
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
  const edge = boardingEdge({ foeHull, maxHull: mh }); // act-1 gunnery → act-2 odds (#135 Option-4 slice 2)
  const jitter = 0.9 + rng() * 0.2; // ±10% fairness wobble (==1 when rng()==0.5)
  const margin = crew * jitter - foe + edge;
  const won = margin > 0;
  const advantage = Math.max(0, Math.min(1, margin));
  const n = rng() < 0.5 ? 2 : 3;
  const lines = pickLines(won ? BRAWL_LINES_WON : BRAWL_LINES_CLOSE, rng, n);
  return { won, advantage, margin, lines };
}

/** How shaken the ENEMY captain starts the duel, from the brawl advantage (0..MAX_BOARD_DENT). PURE. */
export function brawlMoraleDent(advantage) {
  return Math.round(Math.max(0, Math.min(1, advantage)) * MAX_BOARD_DENT);
}

// ── Crew casualties → duel confidence — the act-2→act-3 coupling (#135, Option 4 slice 3) ──────────
// Slice 2 chained act 1 (gunnery/hull) into act 2 (the boarding brawl). This chains act 2 into act 3
// (the captain's verbal duel): the brawl no longer only shakes HER captain (brawlMoraleDent above) —
// a boarding that COST you crew leaves YOUR captain shaken too, shifting the duel's OPENING footing.
// A clean runaway boards cheap and you stride into the shouting match fresh; a whisker-thin scrap (or
// one you lose outright) bleeds the deck and your voice cracks when you open your mouth.
//
// CREATIVE SPARK (Game Designer): the reactive verb is "the deck you barely held is the confidence you
// barely have." Nothing here trivialises the duel — your captain is rattled, never routed; the wit
// still decides it. But a reckless boarding you paid for in blood now genuinely tilts the first words.

// The margin at which a WON brawl's losses become negligible — a runaway this decisive costs almost no
// hands. Below it, the closer the scrap, the bloodier; a lost or even brawl is the bloodiest of all.
export const CASUALTY_CLEAN_MARGIN = 0.6;

// The largest confidence dent a ruinous boarding lays on YOUR OWN captain at the duel's open. Kept
// below MAX_BOARD_DENT (the enemy's ceiling) so a decisive boarding still nets in the boarder's
// favour, yet a bloody one genuinely tilts the opening footing — the duel stays the decider either way.
export const MAX_CONFIDENCE_DENT = 22;

/**
 * How bloody the boarding was, from the brawl outcome — the crew-casualty severity that shakes YOUR
 * captain going into the duel. PURE. 0 = a clean runaway (few hands lost); 1 = a desperate scrap or a
 * lost brawl (the deck ran red). Winning by a whisker OR losing outright both bleed the crew fully.
 * Fails safe: a "win" with no positive margin is a razor-edge boarding → maximally bloody; likewise a
 * junk/NaN margin sinks to that bloody floor rather than inventing a clean sweep.
 * @param {{won?:boolean, margin?:number}} p
 * @returns {number} casualty severity in [0, 1]
 */
export function brawlCasualties({ won = true, margin = 0 } = {}) {
  if (!won) return 1; // repelled — the bloodiest boarding, whatever the margin
  const m = Number.isFinite(margin) ? margin : 0; // junk margin → 0 → a razor-edge win → bloody
  if (m <= 0) return 1; // a win by no margin is the closest possible scrap — the deck ran red
  return Math.max(0, Math.min(1, 1 - m / CASUALTY_CLEAN_MARGIN));
}

/**
 * How shaken YOUR captain opens the duel, from the boarding's casualty severity (0..MAX_CONFIDENCE_DENT).
 * PURE. Mirrors brawlMoraleDent (which shakes HER captain from the brawl advantage) on the player's side.
 * @param {number} casualties — severity in [0,1] from brawlCasualties
 * @returns {number} a player-side opening morale dent
 */
export function duelConfidenceDent(casualties) {
  return Math.round(Math.max(0, Math.min(1, casualties)) * MAX_CONFIDENCE_DENT);
}

// ── Sink-or-spare — the FIRST phase-coupling beat of Option 4 (#135, "Three-Act Raid") ────────────
// You've beaten her hull, carried her deck, and out-jeered her captain across the wreck. The old
// code decided the prize FOR you (a boarded win was always a capture → Standing). Now the raid's
// climax is a DELIBERATE fork: put her to the deep for the pirate legend, or spare her crew and let
// them ransom her back for the governor's coin. Same won duel, two captains you could become.
//
// CREATIVE SPARK (Game Designer): the sword's already won it — this is the choice the whole raid was
// FOR. Sink = the cold, feared road (bonus Infamy, no ledger with the ports). Spare = the merciful
// road (a fat ransom purse + Standing, the swagger tempered). Neither is "correct"; each writes a
// line of who you are into the arc.
//
// PURE + testable: the won-duel base (coins+infamy) is already banked by the duel; this returns only
// the FORK delta to lay on top, so the two roads stay a genuine, unit-tested trade-off.

export const SINK_INFAMY_BONUS = 0.5;   // sinking her deepens the pirate legend — a ruthless flourish
export const SPARE_RANSOM_BONUS = 0.5;  // her crew buys her freedom — a fatter purse than a bare win
export const SPARE_MIN_STANDING = 8;    // the floor the old auto-capture already paid the governor pole

/**
 * The prize FORK laid on the won boarding-duel base (coins+infamy already banked). PURE.
 * SINK → the pirate road: bonus Infamy, no ransom, no Standing. SPARE → the governor road: a ransom
 * purse + Standing, the swagger left as-is. Unknown/absent choice defaults to SPARE (the merciful,
 * ledger-safe road) so a stray resolve can never quietly scuttle a ship.
 * @param {'sink'|'spare'} choice
 * @param {{coins?:number, infamy?:number}} base
 * @returns {{choice:'sink'|'spare', addCoins:number, addInfamy:number, addStanding:number, captured:boolean}}
 */
export function prizeFork(choice, { coins = 0, infamy = 0 } = {}) {
  const c = Math.max(0, Math.round(coins));
  const inf = Math.max(0, Math.round(infamy));
  if (choice === 'sink') {
    return { choice: 'sink', addCoins: 0, addInfamy: Math.round(inf * SINK_INFAMY_BONUS), addStanding: 0, captured: false };
  }
  return {
    choice: 'spare',
    addCoins: Math.round(c * SPARE_RANSOM_BONUS),
    addInfamy: 0,
    addStanding: Math.max(SPARE_MIN_STANDING, Math.round(inf * 0.5)),
    captured: true,
  };
}

// ── Early surrender / strike-colours short-circuit — Option 4 (#135, "Three-Act Raid") ────────────
// The reactive OUT. Slices 1–3 chained the three acts (sink-or-spare · hull→boarding odds · crew
// casualties→duel confidence). This adds the beat where you DON'T fight all three: when your
// broadsides break a foe's nerve AND wound her hull hard enough — mid-maneuver, BEFORE you ever
// grapple to board — she STRIKES HER COLOURS and OFFERS to yield: a ransom + capture WITHOUT the
// board→brawl→duel. You answer: ACCEPT her surrender (a quick capture — a ransom purse + Standing,
// the governor's merciful road; the engagement ends here) or PRESS THE ATTACK (refuse quarter — no
// prize now, and she fights to the bitter end toward a sinking or a boarding). A beaten enemy yields;
// how you answer is who you are.
//
// CREATIVE SPARK (Game Designer): the white flag is a TEMPTATION, not a gift — the quick, bloodless
// prize now, or the greedier, riskier finish (sink for Infamy / board for the duel's Standing). Refuse
// quarter and there is NO second flag: she sells her deck dear. The world yields to how you fight.
//
// The surrender THRESHOLD itself is cannons' strikesColours (nerve broken + hull genuinely hurt) —
// reused, never re-invented — surfaced here as the `yielded` flag; these two pure helpers decide
// WHETHER to open the offer and HOW the player's answer forks the engagement.

/**
 * Should a struck foe be OFFERED early surrender (the reactive out), rather than fought on to a board?
 * PURE. She offers the white flag only when your gunnery has actually broken her (`yielded`, from
 * cannons' strikesColours), she isn't ALREADY boarded (the board path has its own resolution), and you
 * haven't ALREADY refused her quarter this engagement — refuse once and she fights to the bitter end,
 * no second flag. Fails safe (no offer) on absent state.
 * @param {{yielded?:boolean, boarded?:boolean, quarterRefused?:boolean}} p
 * @returns {boolean}
 */
export function offersSurrender({ yielded = false, boarded = false, quarterRefused = false } = {}) {
  return !!yielded && !boarded && !quarterRefused;
}

/**
 * How you answer her white flag — the reward FORK. PURE.
 * ACCEPT → take her surrender: a quick capture (a ransom purse + Standing via captureSpoils, the
 *   governor's merciful road); the engagement ends here — no board, no brawl, no duel.
 * PRESS  → refuse quarter: no prize now, and she fights to the bitter end toward a sinking or a boarding.
 * Unknown/absent choice → ACCEPT (mercy is the ledger-safe default — a stray key never presses a
 * yielding ship into a needless bloodbath; the deliberate mirror of prizeFork's spare-by-default).
 * @param {'accept'|'press'} choice
 * @returns {{choice:'accept'|'press', accepted:boolean, captured:boolean}}
 */
export function surrenderFork(choice) {
  if (choice === 'press') return { choice: 'press', accepted: false, captured: false };
  return { choice: 'accept', accepted: true, captured: true };
}
