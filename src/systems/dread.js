// Dread — the world FEARS you (#172, epic #168 "The Rise", slice 4).
//
// Slices #169–#171 let you grow notorious (renown ranks) and BIG (buy up a ship class). This slice
// makes the world NOTICE: a much-outclassed, much-feared captain should make weaker ships blink —
// turn and RUN before you even engage, or STRIKE HER COLOURS early once the fight starts. The dread
// scales by the GAP (your notoriety + your hull class vs HERS): a merchant sloop bolts from a feared
// frigate captain, but a fellow warship — a peer — doesn't flinch, and the deep-sea apex (#167) still
// stands and fights. That last part is load-bearing: dread must NEVER empty the sea of real fights.
//
// PURE data + math. No THREE, no DOM, no game state — the whole "does the sea part before me?" question
// unit-tests under `node --test`. This module only DECIDES; it invents no new combat system. npc.js
// reuses its existing flee steering for flee-on-sight; battle.js feeds strikesEarly() straight into the
// EXISTING board.offersSurrender() white-flag path, so accept/press/board/refuse all compose unchanged.
//
// CREATIVE SPARK (Game Designer): dread is something you WATCH happen on the water, not a stat in a
// panel. You crest the horizon as a feared Corsair in a frigate and a merchant sloop hauls her wind
// and runs — you SEE the sea part, and you FEEL that the Infamy you banked changed the sea's manners.

// ── Notoriety — how feared your NAME is, read off Infamy (the pirate pole, #45) ─────────────────────
// Anchored near colours.js MENACE_TIERS (feared ≈ 200, terror ≈ 1200) but its own soft→hard ramp so
// dread grows smoothly rather than in three steps. Below the floor your name means nothing to the sea;
// at/above the ceiling it empties the horizon of weak sails.
export const FEAR_FLOOR = 120;   // infamy below which a passing hull doesn't know your name
export const FEAR_FULL = 600;    // infamy at/above which your notoriety fully saturates

// ── The dread weights — how a feared NAME and a bigger HULL each build the sea's fear of you ─────────
export const W_NOTORIETY = 0.6;  // weight of your reputation (a whispered name)
export const W_CLASS = 0.5;      // weight of a size advantage (you dwarf her)
export const CLASS_FULL_GAP = 2; // a +2 tier advantage (a frigate over a merchant sloop) maxes the class term

// ── Foe firmness — the bar your dread must clear for HER to break, per her tier + role ───────────────
// A darting merchant folds easily; a warship holds firm; a warship man-o'-war (tier 5) never breaks to
// dread alone (firmness > 1 ≥ any possible dread), so the deep-sea apex always stands (protects #167).
export const MAX_FOE_TIER = 5;    // the ship-class threat ceiling (src/ship-classes.js)
export const FLEE_BASE = 0.15;    // the gentlest hull's baseline nerve
export const FLEE_PER_TIER = 0.13;// + this much firmness per foe tier
export const WARSHIP_STIFFEN = 0.25; // a warship (built to fight) holds firmer than a trader of her class
export const FLEE_MARGIN = 0.05;  // dread must EXCEED firmness by this before she bolts (a knife-edge peer holds)

// ── Early strike — a dreaded foe hauls down her colours SOONER than a fearless one would ─────────────
export const MORALE_BREAK_FRAC = 0.25; // the vanilla morale-break line (cannons.MORALE_BREAK / MORALE_MAX)
export const EARLY_STRIKE_LIFT = 0.35; // dread lifts that line by up to this (she yields at higher morale)
export const EARLY_STRIKE_HULL_CEIL = 0.6; // …but only once her hull is at least somewhat hurt (never fresh)
export const EARLY_STRIKE_MIN_PRESSURE = 0.05; // she must GENUINELY dread you — peers never strike early

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const finite = (n, d = 0) => (Number.isFinite(n) ? n : d);

/** Clamp a foe threat tier onto [1, MAX_FOE_TIER]; junk → the gentlest tier. */
function clampTier(tier) {
  const t = Math.round(finite(tier, 1));
  return Math.max(1, Math.min(MAX_FOE_TIER, t));
}

/**
 * How feared your NAME is, from Infamy — a [0,1] ramp from FEAR_FLOOR to FEAR_FULL. Junk / below the
 * floor → 0; saturates at 1. Monotonic non-decreasing. PURE.
 * @param {number} infamy
 * @returns {number} notoriety in [0,1]
 */
export function notoriety(infamy) {
  const i = Math.max(0, finite(infamy, 0));
  if (i <= FEAR_FLOOR) return 0;
  return clamp01((i - FEAR_FLOOR) / (FEAR_FULL - FEAR_FLOOR));
}

/**
 * How much your HULL dwarfs hers, from the tier gap — a [0,1] ramp. Only a BIGGER player counts (a
 * smaller or equal hull earns no size dread); a +CLASS_FULL_GAP advantage saturates. PURE.
 * @param {number} playerTier  your ship-class tier (sloop 1 … frigate 3)
 * @param {number} foeTier     her ship-class tier (1..5)
 * @returns {number} class advantage in [0,1]
 */
export function classAdvantage(playerTier, foeTier) {
  return clamp01((finite(playerTier, 1) - finite(foeTier, 1)) / CLASS_FULL_GAP);
}

/**
 * The total dread a captain projects onto a given foe — the GAP: your notoriety + your class advantage.
 * PURE, in [0,1].
 * @param {{playerInfamy?:number, playerTier?:number, foeTier?:number}} p
 * @returns {number} dread in [0,1]
 */
export function dreadScore({ playerInfamy = 0, playerTier = 1, foeTier = 1 } = {}) {
  return clamp01(W_NOTORIETY * notoriety(playerInfamy) + W_CLASS * classAdvantage(playerTier, foeTier));
}

/**
 * How firm the foe's nerve is — the bar your dread must clear before she breaks. Rises with her tier
 * and a warship stiffener. A warship man-o'-war reads > 1 so no dread can ever break her. PURE.
 * @param {number} foeTier
 * @param {string} [foeRole]  'warship' | 'merchant'
 * @returns {number} firmness (0..~1.05)
 */
export function foeFirmness(foeTier = 1, foeRole = 'warship') {
  const t = clampTier(foeTier);
  return FLEE_BASE + t * FLEE_PER_TIER + (foeRole === 'warship' ? WARSHIP_STIFFEN : 0);
}

/**
 * How far your dread EXCEEDS her nerve — the single scalar the flee + early-strike gates read. Positive
 * ⇒ she fears you more than she can bear; negative ⇒ she holds. PURE.
 * @param {{playerInfamy?:number, playerTier?:number, foeTier?:number, foeRole?:string}} p
 * @returns {number} dread pressure (dreadScore − foeFirmness), can be negative
 */
export function dreadPressure({ playerInfamy = 0, playerTier = 1, foeTier = 1, foeRole = 'warship' } = {}) {
  return dreadScore({ playerInfamy, playerTier, foeTier }) - foeFirmness(foeTier, foeRole);
}

/**
 * Does this foe TURN AND RUN the moment she sights you (before you ever engage)? True only when your
 * dread clears her nerve by FLEE_MARGIN — so weak prey bolts, a peer holds, and the apex man-o'-war
 * always stands (protecting #167 challenge-on-demand). PURE.
 * @param {{playerInfamy?:number, playerTier?:number, foeTier?:number, foeRole?:string}} p
 * @returns {boolean}
 */
export function fleesOnSight(p = {}) {
  return dreadPressure(p) >= FLEE_MARGIN;
}

/**
 * The morale fraction at/below which a foe under this much dread strikes her colours — the vanilla break
 * line LIFTED by dread pressure (a dreaded crew loses heart sooner). Never lifts below the vanilla line.
 * PURE.
 * @param {number} pressure  from dreadPressure
 * @returns {number} morale-break fraction in [MORALE_BREAK_FRAC, MORALE_BREAK_FRAC + EARLY_STRIKE_LIFT]
 */
export function earlyStrikeMoraleLine(pressure) {
  return MORALE_BREAK_FRAC + clamp01(finite(pressure, 0)) * EARLY_STRIKE_LIFT;
}

/**
 * Does a dreaded foe STRIKE HER COLOURS EARLY this volley — sooner than a fearless crew would? True only
 * when she genuinely dreads you (pressure past a floor so peers/apex never trigger), her hull is at least
 * somewhat hurt (never a fresh ship), and her nerve has fallen below the dread-lifted morale line. Fed
 * straight into board.offersSurrender() as an extra `yielded` reason — it reuses the EXISTING white-flag
 * path, never a new one. Fails safe (no early strike) on junk / no dread. PURE.
 * @param {{moraleFrac?:number, hullFrac?:number, pressure?:number}} p
 * @returns {boolean}
 */
export function strikesEarly({ moraleFrac = 1, hullFrac = 1, pressure = 0 } = {}) {
  const pr = finite(pressure, 0);
  if (pr <= EARLY_STRIKE_MIN_PRESSURE) return false;      // no genuine dread → fall back to vanilla strikesColours
  if (finite(hullFrac, 1) > EARLY_STRIKE_HULL_CEIL) return false; // a fresh/lightly-scratched hull never yields early
  return finite(moraleFrac, 1) <= earlyStrikeMoraleLine(pr);
}
