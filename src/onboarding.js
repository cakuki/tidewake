// Onboarding — invisible first-session teaching (#60). PURE, DOM-free, three.js-free so
// the whole decision machine unit-tests under `node --test`. It owns NO DOM: given a tiny
// bag of progress flags + an event, it decides which nudge/beat (if any) to surface next.
// The renderer (hud.js) draws what this returns; main.js watches the world for the events.
//
// The contract is "learn by doing, with a nudge + applause — never a lecture":
//   * A fresh captain (no meaningful save) gets ONE small, diegetic GOAL nudge that names
//     the loop: sail to a port, trade for profit, make your name. It clears once they act
//     (their first dock), never blocks input, and a returning captain never sees it.
//   * A few FIRST-TIME beats fire ONCE EVER, each celebrating a milestone the moment it
//     first happens: first dock, first profitable trade, first rank climbed. The flags
//     persist in the save (save.js), so a returning captain is applauded zero times more.
//
// All copy original to Tidewake — warm, witty, swashbuckling; tight by design.

// The seeded first goal. Surfaced as a small dismissable card the instant a brand-new
// captain casts off; it names the whole loop in one breath and clears on their first dock.
export const GOAL = {
  title: '🧭 Chart your course',
  line: 'Open the chart (Tab), pick a port, and sail there. Buy low, sell high — and make your name.',
};

// The once-ever first-win beats, keyed by the flag they set. Each is a little burst of
// applause in tone: realism in the lesson, comedy in the telling.
export const BEATS = {
  firstDock: {
    title: '⚓ Your first port!',
    line: 'Buy low here, sell it dear elsewhere — the whole trick of the trade in one breath.',
  },
  firstTrade: {
    title: '⛃ First coin earned!',
    line: "A captain's career begins. Well, well — the bilge-rat made a profit.",
  },
  firstRank: {
    title: '⚑ Your name travels',
    line: 'Word of you reaches the next harbour before your sails do. Onward, Captain.',
  },
};

// Which flag each world event sets (and thus which beat it can fire, once).
const EVENT_KEY = { dock: 'firstDock', profit: 'firstTrade', rank: 'firstRank' };

// The canonical flag set. `goal` tracks whether the seeded goal has been satisfied/cleared;
// the rest track whether each first-win beat has already fired.
const FLAG_KEYS = ['goal', 'firstDock', 'firstTrade', 'firstRank'];

/** A brand-new captain's flags — nothing seen yet, goal still to do. */
export function freshFlags() {
  return { goal: false, firstDock: false, firstTrade: false, firstRank: false };
}

/** A captain who is past onboarding entirely — used for returning players. */
export function completedFlags() {
  return { goal: true, firstDock: true, firstTrade: true, firstRank: true };
}

/**
 * Coerce arbitrary input into a safe, complete flags object (every key a real boolean).
 * Junk / missing / partial input never throws — absent keys default to false.
 * @param {unknown} raw
 * @returns {{goal:boolean, firstDock:boolean, firstTrade:boolean, firstRank:boolean}}
 */
export function normalizeFlags(raw) {
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : {};
  const out = {};
  for (const k of FLAG_KEYS) out[k] = !!src[k];
  return out;
}

/**
 * Should the seeded goal nudge be on screen right now? Only for a captain who hasn't yet
 * dismissed it AND hasn't yet made their first port (docking is "acting on the goal").
 * @param {object} flags
 * @returns {boolean}
 */
export function shouldShowGoal(flags) {
  const f = normalizeFlags(flags);
  return !f.goal && !f.firstDock;
}

/** Every first-win beat has fired and the goal is cleared — onboarding is over. */
export function onboardingComplete(flags) {
  const f = normalizeFlags(flags);
  return FLAG_KEYS.every((k) => f[k]);
}

/**
 * Apply a world event to the flags. Returns the beat to fire (or null if the event is
 * unknown or its beat already fired), the resulting flags, and whether anything changed.
 * Pure — never mutates the input. Docking also satisfies/clears the seeded goal.
 * @param {object} flags  current progress flags
 * @param {'dock'|'profit'|'rank'} event
 * @returns {{beat:({title:string,line:string})|null, flags:object, changed:boolean}}
 */
export function applyEvent(flags, event) {
  const f = normalizeFlags(flags);
  const key = EVENT_KEY[event];
  if (!key || f[key]) return { beat: null, flags: f, changed: false };
  const next = { ...f, [key]: true };
  if (event === 'dock') next.goal = true; // reaching a port completes the seeded goal
  return { beat: BEATS[key], flags: next, changed: true };
}

/**
 * A coarse QA/inspection summary: which step the captain is on next.
 * @param {object} flags
 * @returns {'goal'|'firstDock'|'firstTrade'|'firstRank'|'done'}
 */
export function currentStep(flags) {
  const f = normalizeFlags(flags);
  if (!f.goal && !f.firstDock) return 'goal';
  if (!f.firstDock) return 'firstDock';
  if (!f.firstTrade) return 'firstTrade';
  if (!f.firstRank) return 'firstRank';
  return 'done';
}
