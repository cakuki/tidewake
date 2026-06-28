// Crew morale / loyalty (#124, DL #4/#5 — DL #1's "earned mutiny") — a reactive meter fed by your
// CHOICES. PURE, DOM-free and three.js-free so the whole model unit-tests under `node --test`.
//
// The Captain's Ledger (#45) tracks how the WORLD sees you (Infamy ↔ Standing). This tracks how your
// own CREW sees you — a separate, single 0..100 meter moved only by the deeds you choose: haul souls
// from a foundering wreck and they love you; leave that crew to a cold row and loyalty curdles; chase a
// tip that pays and they share a good day; pile up reckless groundings and they grumble at the helm. It
// makes who-you-are COST something (the #124 pitch) without touching combat (battle #100 is owner-held).
//
// Two felt thresholds, edge-triggered so they ring on the CROSSING, never every frame:
//   * LOW_MORALE  → a low-morale GRUMBLE (the crew mutters; you've slack to recover).
//   * MUTINY_RISK → a very-low MUTINY-RISK WARNING (loyalty is failing — the consequence beat is filed
//     as a follow-up; this slice ships the WARNING, not the mutiny itself).
//
// CREATIVE SPARK (Game Designer): a crew is a mirror you can't flag your way past. The sea may fear a
// black flag, but the men at the capstan answer to whether you're worth following — and they will tell
// you, in a grumble first and a harder word after. Asset-light: a clamped number + state-driven lines.
//
// FOLLOW-UPS (file): the full mutiny CONSEQUENCE (desertion / a turned crew); richer inputs (plunder
// split, rationing, time at sea, a fair-dealing sale streak); a loyal-crew sailing/boarding BONUS; a
// warm-banter line pool that brightens as morale climbs; a small HUD meter once index.html grows a slot.

export const MORALE_MIN = 0;
export const MORALE_MAX = 100;
// A willing-but-not-fanatical crew at the start of a voyage — room to rise on good deeds and to fall on
// bad ones, so the meter reads as EARNED in both directions rather than starting pinned at either end.
export const MORALE_START = 60;
// The crew mutters below this; a recoverable slump.
export const LOW_MORALE = 30;
// Loyalty is failing below this — a mutiny-risk warning beat (the consequence itself is a follow-up).
export const MUTINY_RISK = 12;

// Event → morale delta. Keyed to a FEW real, already-wired events so the meter moves on deeds the
// player actually chooses. Tuned (Game Designer's first-class output) so a single deed is a visible
// rung but no one deed swings the whole meter: from the 60 start it takes a run of bad choices to reach
// the grumble, and a deeper run to reach the warning — the slump has to be EARNED.
export const MORALE_EVENTS = {
  rescue: 12,      // souls hauled from a foundering wreck — the crew loves a captain with a heart (#125)
  rumourWin: 6,    // a chased tip ran true, coin shared round — a good day at sea (#112)
  harbourGrow: 8,  // a prospering home port — wages paid, warm berths kept (#118)
  plunder: -10,    // a helpless crew left to a cold row — cruelty curdles loyalty (#125)
  aground: -8,     // a reckless grounding — they grumble at the helm (#76)
  missedRescue: -5, // you sailed past souls in distress — a cold thing to watch (#125 despawn)
};

function isNum(n) { return typeof n === 'number' && Number.isFinite(n); }

/**
 * PURE — clamp any value to the legal morale range. Junk (non-finite / non-number) → the START
 * baseline, so a corrupt input never produces a NaN meter. Never throws.
 * @param {unknown} n
 * @returns {number}
 */
export function clampMorale(n) {
  if (!isNum(n)) return MORALE_START;
  return Math.max(MORALE_MIN, Math.min(MORALE_MAX, n));
}

/** A fresh crew's morale at the start of a voyage. */
export function freshMorale() { return MORALE_START; }

/**
 * PURE — sanitise a raw morale value read back from a save (or anywhere): a finite number → clamped
 * into range; anything else → the START baseline. Fail-open like the other save flourishes — never
 * throws, never rejects a save. (An ABSENT field is the caller's concern; here junk → START.)
 * @param {unknown} raw
 * @returns {number}
 */
export function sanitizeMorale(raw) {
  return clampMorale(raw);
}

/**
 * PURE — the morale delta for a named event (0 for an unknown event, so a stray call is a no-op).
 * @param {string} event
 * @returns {number}
 */
export function moraleDelta(event) {
  const d = MORALE_EVENTS[event];
  return isNum(d) ? d : 0;
}

/**
 * PURE — apply an event to a morale value, returning the NEW clamped morale. Deterministic; an unknown
 * event leaves morale unchanged. Never throws, never mutates.
 * @param {number} morale
 * @param {string} event
 * @returns {number}
 */
export function applyMorale(morale, event) {
  return clampMorale(clampMorale(morale) + moraleDelta(event));
}

/** PURE — is the crew at or below the grumble line? */
export function isLow(morale) { return clampMorale(morale) <= LOW_MORALE; }

/** PURE — is the crew at or below the mutiny-risk line? */
export function atMutinyRisk(morale) { return clampMorale(morale) <= MUTINY_RISK; }

/**
 * PURE — the categorical morale tier for a value. Used by the QA snapshot + (later) banter selection.
 * 'mutiny' ⊂ 'low'; a value at/below MUTINY_RISK reports the deepest tier it qualifies for.
 * @param {number} morale
 * @returns {'mutiny'|'low'|'steady'|'high'}
 */
export function moraleTier(morale) {
  const m = clampMorale(morale);
  if (m <= MUTINY_RISK) return 'mutiny';
  if (m <= LOW_MORALE) return 'low';
  if (m >= 80) return 'high';
  return 'steady';
}

// The grumble pool — the crew muttering as morale slumps below LOW_MORALE. Original to Tidewake, warm
// with a wink (Constitution): grousing, not yet mutinous.
export const GRUMBLE_LINES = [
  'The crew are muttering at the capstan, Captain — short rations of patience and shorter looks your way.',
  'A sullen quiet has settled over the deck. The bosun says the men are "discussing the articles" again.',
  'You catch the watch trading dark glances. Morale is low, Captain — best give them something to cheer.',
];

// The mutiny-risk warning pool — loyalty is failing as morale crosses below MUTINY_RISK. Sharper: a
// real warning, not a grumble. The consequence itself (desertion / a turned crew) is a filed follow-up.
export const MUTINY_LINES = [
  'MUTINY IN THE WIND, Captain — the crew are gathered aft, voices low and eyes hard. Win them back, or lose the ship.',
  'The bosun grips your arm: "They\'re past grumbling now, Cap\'n. One more cold turn and they\'ll take the wheel themselves."',
  'A knife stands quivering in the mast by the watch-bill. Loyalty is failing — the next deed had better be a kind one.',
];

/**
 * PURE — the morale BEAT to ring, given the morale BEFORE and AFTER an event. Edge-triggered: fires
 * ONLY when a threshold is freshly crossed DOWNWARD (so it rings on the crossing, never every frame and
 * never on the way back up). Returns null when no line was crossed. The caller picks a line from the
 * returned `lines` pool and flashes the banner. Deterministic; never throws.
 * @param {number} prev  morale before the event
 * @param {number} next  morale after the event
 * @returns {{tier:'mutiny'|'low', title:string, lines:string[]}|null}
 */
export function moraleBeat(prev, next) {
  const p = clampMorale(prev);
  const n = clampMorale(next);
  if (n <= MUTINY_RISK && p > MUTINY_RISK) {
    return { tier: 'mutiny', title: '☠ Mutiny in the wind!', lines: MUTINY_LINES };
  }
  if (n <= LOW_MORALE && p > LOW_MORALE) {
    return { tier: 'low', title: '😠 The crew grumbles…', lines: GRUMBLE_LINES };
  }
  return null;
}
