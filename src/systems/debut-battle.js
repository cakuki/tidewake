// The Bosun's First Duel (#157) — a one-shot, scaffolded SOFT debut battle on a cold save's very
// first engagement. PURE, DOM-free, three.js-free so the whole trigger/scaffold decision machine
// unit-tests under `node --test`. It owns NO DOM and NO game state: given the save's one-shot flag
// and a battle snapshot, it decides (a) whether this first fight is the scaffolded debut, (b) how to
// SOFTEN the foe so it's winnable, and (c) which verb the bosun calls aloud next. main.js does the
// wiring (softening the foe on engage, flashing the bosun cue on each phase change, and marking the
// save flag the moment the debut is spent so it NEVER repeats).
//
// The contract mirrors the invisible-onboarding doctrine (onboarding.js): teach by DOING, once —
// a fresh captain's first fight is forgiving and the crew calls each phase's verb aloud as it becomes
// legal (maneuver→fire→board→duel); a returning captain is never scaffolded again. The raid stays
// FULLY player-driven — the debut softens the foe and narrates the verbs, it never auto-plays them.
//
// All copy original to Tidewake — warm, witty, swashbuckling; tight by design.

import { MAX_HULL, MORALE_MAX } from '../cannons.js'; // eslint-disable-line no-unused-vars

// ---- Game Designer's fun-shaping numbers (a soft, WINNABLE, LEGIBLE first fight) -----------------
// Her guns barely sting (you can't really lose your first fight)…
export const DEBUT_GUNNERY_MULT = 0.4;
// …and she squares up already softened, so a volley or two brings the BOARD window into reach — the
// arc reads fast. Her NERVE is deliberately left intact (no early strike-colours), so the debut teaches
// the core arc maneuver→board→duel rather than short-circuiting to a surrender on the first shot.
export const DEBUT_HULL_FRAC = 0.55;

/**
 * Should the NEXT engagement be the scaffolded debut? Pure read of the save's one-shot flag: a captain
 * who hasn't yet spent the debut (flag falsy) still gets it; once it's set, it never fires again.
 * @param {boolean|undefined} debutDone  the persisted one-shot flag (true = already spent)
 * @returns {boolean}
 */
export function debutPending(debutDone) {
  return !debutDone;
}

/**
 * Soften a freshly-made foe for the debut so a new captain's first fight is winnable and legible.
 * Returns a NEW foe (never mutates); a non-debut engagement passes the foe straight through unchanged.
 * Reduces her gunnery (a forgiving fight) and starts her already battered (the boarding window is near),
 * and flags her `debut: true` so the HUD/QA can tell this is the scaffolded first fight. Her morale is
 * deliberately untouched — she fights the arc, she doesn't fold on the first volley.
 * @param {{gunnery?:number, hull?:number, maxHull?:number}} foe
 * @param {boolean} pending  whether this engagement is the debut
 * @returns {object} the (possibly softened) foe
 */
export function softenDebutFoe(foe, pending) {
  if (!pending || !foe || typeof foe !== 'object') return foe;
  const maxHull = foe.maxHull || MAX_HULL;
  return {
    ...foe,
    gunnery: (foe.gunnery || 1) * DEBUT_GUNNERY_MULT,
    hull: Math.max(1, Math.round(maxHull * DEBUT_HULL_FRAC)),
    debut: true,
  };
}

/**
 * The teaching phase of a LIVE debut battle, derived from the battle snapshot. PURE. Returns null when
 * no battle is live. Order matters: a struck white flag is answered before anything, then the boarding
 * window, else the opening maneuver (bring-her-abeam-and-fire).
 * @param {{active?:boolean, canBoard?:boolean, surrenderPending?:boolean}|null} b  battle.snapshot()
 * @returns {'maneuver'|'board'|'surrender'|null}
 */
export function debutPhase(b) {
  if (!b || !b.active) return null;
  if (b.surrenderPending) return 'surrender';
  if (b.canBoard) return 'board';
  return 'maneuver';
}

// The bosun's scripted call for each phase — she names the verb aloud, in-world, warm + swashbuckling.
// This is the "theatre, not a pop-up": the crew talks you through your first fight as it unfolds.
const CUES = {
  maneuver: {
    verb: 'fire',
    line: '“First blood, Captain — steady now! Bring her abeam and give ’em the guns. SPACE when she bears.”',
  },
  board: {
    verb: 'board',
    line: '“She’s reeling! Grapples away — press F and board her, lads! Take the deck!”',
  },
  surrender: {
    verb: 'accept',
    line: '“Look sharp — her colours are coming down! Press 1 to take her quarter, or 2 to press it home.”',
  },
};

/**
 * The bosun's scripted call for a phase — names the verb aloud. Returns {verb, line} or null for an
 * unknown/absent phase (fail-open — a missing cue never throws).
 * @param {string|null} phase
 * @returns {{verb:string, line:string}|null}
 */
export function debutCue(phase) {
  return (phase && CUES[phase]) || null;
}

// The phases the bosun narrates, in the order they teach the fight.
export const DEBUT_PHASES = ['maneuver', 'board', 'surrender'];
