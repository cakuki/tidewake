// Legible odds — SKILL sets the odds, LUCK swings the margin (#166, the fair-fight READ of epic #162).
//
// The owner's binding model (#162): **fair = clear, consistent rules WITH a bounded luck element.**
//   • SKILL sets the ODDS — deterministic: the class matchup (your hull vs hers, her gunnery) + your aim
//     GEOMETRY (how well you're abeam, from broadsideAim) + your loaded shot (ammo hull/return mult). The
//     player can READ and PREDICT it: line up your broadside and the odds visibly climb.
//   • LUCK sets only the MARGIN — the EXISTING bounded ±20% per-volley jitter (`0.8 + rng()*0.4` in
//     src/cannons.js). It swings whether an exchange goes a bit better or worse than expected; it adds
//     TENSION, not coin-flips, and it must NEVER flip a strongly-favoured fight.
//
// This module is the PURE, read-only ODDS MODEL that turns those deterministic combat inputs into a
// legible verdict + a margin BAND. It changes NO combat maths and touches NO luck bounds — it only READS
// the same numbers resolveBroadside/resolveBroadside consume and reports what they IMPLY, so the player
// can see their footing before and during a fight. DOM-free + THREE-free → unit-tested under `node --test`.
//
// The coefficients below MIRROR src/cannons.js resolveBroadside (BASE, the 1.5 player-broadside and 0.9
// foe-reply multipliers, the 0.8/1.2 jitter bounds). A unit test cross-checks the model's expected damage
// AND its margin band against resolveBroadside's ACTUAL output, so the two can never silently drift apart.

// --- the combat coefficients this model READS off (kept in step with cannons.js; cross-checked in tests) ---
const BASE = 22;                 // cannons.js BASE
const PLAYER_BROADSIDE = 1.5;    // your clean-beam broadside bite: round(BASE * 1.5 * quality * hullMult * jitter)
const FOE_REPLY = 0.9;           // her return volley:              round(BASE * 0.9 * gunnery * returnMult * jitter)

// The EXACT bounds of the ±20% per-volley luck jitter (cannons.js: `0.8 + rng()*0.4` ⇒ [0.8, 1.2]).
// The margin BAND shown to the player is derived straight from these, so "the band == the luck bounds"
// is true by construction (and asserted against the real math in the tests).
export const LUCK_LO = 0.8;
export const LUCK_HI = 1.2;
export const LUCK_MARGIN_PCT = Math.round((LUCK_HI - 1) * 100); // 20 — the "±20%" the readout shows

// How far luck can swing the EDGE (your dmg at its floor ÷ hers at its ceiling, and vice-versa). This is
// the whole point: a strongly-favoured fight is one where even MAX-adverse luck (you roll 0.8 every
// volley, she rolls 1.2) STILL wins — so luck can only ever move the MARGIN, never the outcome direction.
const LUCK_RATIO = LUCK_HI / LUCK_LO; // 1.5

// Verdict tiers on the deterministic EDGE (Vyou / Vher — see combatOdds). The strong cuts are tied to the
// luck ratio so a 'dominant' read is EXACTLY "luck can't flip it" (worstEdge ≥ 1) and 'dire' is EXACTLY
// "luck can't save it" (bestEdge ≤ 1). The three middle tiers are where the margin genuinely decides.
const STRONG_CUT = LUCK_RATIO;       // edge ≥ 1.5  ⇒ dominant (worstEdge ≥ 1: luck can't flip)
const HOPELESS_CUT = 1 / LUCK_RATIO; // edge ≤ 0.667 ⇒ dire     (bestEdge ≤ 1: luck can't save)
const EVEN_LO = 0.9;                 // [0.9, 1.111] straddles a coin — the margin is the drama
const EVEN_HI = 1 / EVEN_LO;         // ≈ 1.111

// Plain-language verdict headlines — ORIGINAL to Tidewake, salt-crusted, legible at a glance.
const VERDICTS = {
  dominant: 'You outclass her',
  favoured: 'You hold the edge',
  even:     'An even match',
  risky:    'She has the edge — risky',
  dire:     'She outguns you — reckless',
};

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function num(n, dflt) {
  const x = Number(n);
  return Number.isFinite(x) ? x : dflt;
}

// A forgiving shot (light) lifts a glancing angle toward a clean one — MIRRORS resolveBroadside's
// `q = q0 + (1 - q0) * aimForgive`. Round shot forgives nothing (q === q0).
function liftQuality(q0, aimForgive) {
  const q = clamp01(q0);
  const f = clamp01(aimForgive);
  return q + (1 - q) * f;
}

// Map an edge (0..∞, 1 = even) onto a 0..1 bar position: even sits dead-centre (0.5), your favour pulls
// right, hers pulls left. `e/(e+1)` is a clean, monotone squash with x(1)=0.5, x(0)=0, x(∞)=1 — so the
// margin BAND [worstEdge..bestEdge] renders as a segment whose side of centre = favoured-or-not and whose
// straddling of centre = "luck can flip this". PURE.
function barPos(e) {
  const x = Math.max(0, num(e, 0));
  return x / (x + 1);
}

function tierFor(edge) {
  if (edge >= STRONG_CUT) return 'dominant';
  if (edge >= EVEN_HI) return 'favoured';
  if (edge >= EVEN_LO) return 'even';
  if (edge > HOPELESS_CUT) return 'risky';
  return 'dire';
}

// A data-driven reason clause — WHICH lever leads (echoes the brief's "she has the guns, you have the
// crew"). Built from the two deterministic levers the player can act on: broadside bite + hull staying-power.
function reasonFor(yourGuns, yourHull) {
  if (yourGuns && yourHull) return 'your guns bite harder and your hull holds longer';
  if (!yourGuns && !yourHull) return 'her guns bite harder and her hull holds longer';
  if (yourGuns && !yourHull) return 'you have the guns, she has the hull';
  return 'she has the guns, you have the hull';
}

/**
 * The legible odds READ for a broadside engagement (#166). PURE, read-only — reports what the EXISTING
 * combat math implies; changes nothing. SKILL (aim geometry + class matchup + ammo) sets the deterministic
 * `edge`; LUCK is the bounded ±20% margin BAND around it.
 *
 * The edge is `Vyou / Vher` — how many volleys she needs to sink YOU vs how many you need to sink HER, at
 * expected (mean-luck) damage. You hold the initiative (you fire first), so `edge ≥ 1` ⇒ you win at
 * expectation. The band is that edge scaled by the exact luck bounds: worst = edge·(LO/HI), best =
 * edge·(HI/LO). A 'dominant' verdict is precisely `worst ≥ 1` — even max-adverse luck still wins.
 *
 * @param {{playerHull?:number, enemyHull?:number, gunnery?:number,
 *          ammo?:{hullMult?:number,returnMult?:number,aimForgive?:number},
 *          aimQuality?:number}} inputs
 *   playerHull — your current hull (staying-power)
 *   enemyHull  — her current hull (what you must chew through)
 *   gunnery    — her return-fire multiplier (from her class × role — src/ship-classes.js)
 *   ammo       — the LOADED shot profile (hullMult/returnMult/aimForgive — src/systems/ammo.js)
 *   aimQuality — how well your broadside bears (0..1 from broadsideAim). null ⇒ guns fully bearing (1),
 *                so a pre-fight read shows your POTENTIAL; a live read tracks the angle as you maneuver.
 * @returns {{edge:number, tier:string, verdict:string, reason:string,
 *            favoured:boolean, stronglyFavoured:boolean, hopeless:boolean, couldLuckFlip:boolean,
 *            yourDamage:number, herDamage:number, yourVolleys:number, herVolleys:number,
 *            luck:{lo:number,hi:number,marginPct:number},
 *            band:{expected:number, worst:number, best:number},
 *            bar:{lo:number, hi:number, expected:number, even:number}}}
 */
export function combatOdds({
  playerHull = BASE, enemyHull = BASE, gunnery = 1, ammo = {}, aimQuality = null,
} = {}) {
  const pHull = Math.max(0, num(playerHull, 0));
  const eHull = Math.max(0, num(enemyHull, 0));
  const g = Math.max(0, num(gunnery, 1));
  const hullMult = Math.max(0, num(ammo && ammo.hullMult, 1));
  const returnMult = Math.max(0, num(ammo && ammo.returnMult, 1));
  const aimForgive = num(ammo && ammo.aimForgive, 0);
  // aimQuality null ⇒ the matchup at full bearing (potential); else the live geometry (skill in motion).
  const q = liftQuality(aimQuality == null ? 1 : aimQuality, aimForgive);

  // Expected (mean-luck, jitter == 1) per-volley damage — the SAME formulae resolveBroadside applies.
  const yourDmg = BASE * PLAYER_BROADSIDE * q * hullMult; // your clean-beam broadside bite
  const herDmg = BASE * FOE_REPLY * g * returnMult;       // her return volley

  // Volleys-to-sink at expectation. Guard a zero-damage side (bow-on with round shot ⇒ you can't hurt her
  // right now ⇒ an infinite edge against you) so the read stays sane and legible.
  const vHer = yourDmg > 0 ? eHull / yourDmg : Infinity; // volleys YOU need to sink HER
  const vYou = herDmg > 0 ? pHull / herDmg : Infinity;   // volleys SHE needs to sink YOU
  let edge = vHer === Infinity ? 0 : (vYou === Infinity ? Infinity : vYou / vHer);
  if (!Number.isFinite(edge) && edge !== Infinity) edge = 0;

  // The luck BAND — the edge swung by the EXACT ±20% jitter bounds (your dmg floored / hers ceilinged, and
  // the mirror). This is the whole "skill = odds, luck = margin" contract, made visible.
  const worst = edge === Infinity ? Infinity : edge * (LUCK_LO / LUCK_HI);
  const best = edge === Infinity ? Infinity : edge * (LUCK_HI / LUCK_LO);

  const favoured = edge >= 1;
  const stronglyFavoured = worst >= 1;   // even MAX-adverse luck still wins ⇒ luck can NOT flip it
  const hopeless = best <= 1;            // even MAX-lucky rolls still lose ⇒ luck can NOT save it
  const couldLuckFlip = !stronglyFavoured && !hopeless; // the margin genuinely decides — the tension zone

  const tier = tierFor(edge);
  const reason = reasonFor(yourDmg > herDmg, pHull >= eHull);

  return {
    edge,
    tier,
    verdict: VERDICTS[tier],
    reason,
    favoured,
    stronglyFavoured,
    hopeless,
    couldLuckFlip,
    yourDamage: Math.round(yourDmg),
    herDamage: Math.round(herDmg),
    yourVolleys: Number.isFinite(vHer) ? Math.max(1, Math.ceil(vHer)) : Infinity,
    herVolleys: Number.isFinite(vYou) ? Math.max(1, Math.ceil(vYou)) : Infinity,
    luck: { lo: LUCK_LO, hi: LUCK_HI, marginPct: LUCK_MARGIN_PCT },
    band: { expected: edge, worst, best },
    bar: { lo: barPos(worst), hi: barPos(best), expected: barPos(edge), even: 0.5 },
  };
}

/**
 * Compose the legible readout STRINGS for the aim-indicator's `.aim-odds` slot from a combatOdds result
 * (#166). PURE — presentation glue, no combat state. `sub` surfaces the legible damage-per-volley + the
 * bounded ±20% margin; an OPTIONAL stake hint (#164 defeatLedger nominals) names what a loss here would
 * cost, so the odds also read the STAKE — "reckless, and a loss stings this much".
 * @param {ReturnType<typeof combatOdds>} odds
 * @param {{stakeCoin?:number, stakeFame?:number}} [stake]
 * @returns {{text:string, sub:string, tier:string}}
 */
export function oddsReadout(odds, { stakeCoin, stakeFame } = {}) {
  if (!odds) return { text: '', sub: '', tier: 'even' };
  const yd = Number.isFinite(odds.yourDamage) ? odds.yourDamage : 0;
  const hd = Number.isFinite(odds.herDamage) ? odds.herDamage : 0;
  let sub = `~${yd} vs ${hd}/volley · luck ±${odds.luck.marginPct}%`;
  if (Number.isFinite(stakeCoin) && Number.isFinite(stakeFame) && (stakeCoin > 0 || stakeFame > 0)) {
    sub += ` · a loss costs ~${Math.round(stakeCoin)}c, ${Math.round(stakeFame)} fame`;
  }
  return { text: odds.verdict, sub, tier: odds.tier };
}
