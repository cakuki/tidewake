// Fear you can SEE on your own ship (#177) — your notoriety, rendered on your OWN rigging.
//
// #132 made the player's hull MOOD mirror the Infamy↔Standing pole (a gentle grime/glow). This is
// the sharper, prouder half: as your INFAMY climbs the ship visibly DRESSES the part of a feared
// vessel — the sails darken toward a tarred pirate BLACK, and captured TROPHY pennants run up the
// rigging at milestones. Glance at your own deck and you SEE how feared you've become; lose a fight
// and — because a #164 defeat DENTS your Infamy — a trophy is struck from the rigging, fear knocked
// back. Reversible: climb again and it flies again.
//
// DERIVED from the already-persisted Infamy value ALONE — nothing new is stored (save stays v18).
// PURE on purpose: no THREE, no DOM, no game state. The mapping lives here (unit-tested); main.js
// toggles the trophy meshes' visibility and composes `sailDarken` as ONE extra multiplier the single
// ship-aura sail writer applies AFTER #132's cast — so the two layers stack (feared = grimy AND dark)
// without ever fighting over the same write. The trophies are children of the ship group, so #171's
// class scale carries them with the hull for free.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Sails: untouched until a captain is clearly making a name (keeps the honest starting sloop bright),
// then ramp linearly to a full tarred black by SAIL_BLACK_AT infamy.
export const SAIL_DARK_START = 60;   // below this the sails are left to #132's gentle cast alone
export const SAIL_BLACK_AT = 360;    // infamy at which the sails reach full pirate black

// Trophy pennants: captured colours run up the rigging at two Infamy milestones. Kept to TWO so the
// budget stays trivial (≤2 tiny meshes, hidden = not drawn) and a defeat that dents Infamy past a
// milestone visibly strikes one.
export const TROPHY1_AT = 120;       // first captured pennant
export const TROPHY2_AT = 320;       // second captured pennant
export const MAX_TROPHIES = 2;

// Figurehead: the carved beast at the PROW grows fiercer as the legend does. A plain prow at the
// honest start; a carved beast head emerges once a captain is making a name; a snarling beast rears
// as she climbs toward Dread Captain. Kept to TWO tiers so the budget stays trivial (a couple of
// small toggled meshes, only the earned one drawn — ≤1 extra draw, hidden = not drawn). A defeat
// that dents Infamy past a milestone softens the prow a step, exactly like the trophy-strip.
export const FIGUREHEAD1_AT = 80;    // a carved beast head emerges (just past the sail-dark floor)
export const FIGUREHEAD2_AT = 240;   // a snarling beast rears — nearing Dread Captain
export const MAX_FIGUREHEAD = 2;

// The deep tarred black the sails multiply toward (a colour MULTIPLIER can only darken; near-black
// leaves a whisper of timber so the canvas still reads as cloth, not a void).
export const FEAR_SAIL_BLACK = 0x101014;

/**
 * The fear-features a captain's Infamy dresses her ship in. PURE + deterministic + junk-safe.
 * Monotonic non-decreasing in infamy; infamy 0 (or junk/negative) → a bare, humble ship.
 * @param {number} infamy the persisted pirate-path score (junk / negative → 0)
 * @returns {{infamy:number, sailDarken:number, trophies:number, figurehead:number}}
 *   sailDarken ∈ [0,1] (blend toward FEAR_SAIL_BLACK); trophies ∈ {0..MAX_TROPHIES};
 *   figurehead ∈ {0..MAX_FIGUREHEAD} (the fierceness tier of the carved prow).
 */
export function fearRigging(infamy) {
  const inf = Number.isFinite(infamy) && infamy > 0 ? infamy : 0;
  const span = SAIL_BLACK_AT - SAIL_DARK_START;
  const sailDarken = span > 0 ? clamp01((inf - SAIL_DARK_START) / span) : (inf >= SAIL_BLACK_AT ? 1 : 0);
  let trophies = 0;
  if (inf >= TROPHY1_AT) trophies = 1;
  if (inf >= TROPHY2_AT) trophies = 2;
  let figurehead = 0;
  if (inf >= FIGUREHEAD1_AT) figurehead = 1;
  if (inf >= FIGUREHEAD2_AT) figurehead = 2;
  return { infamy: inf, sailDarken, trophies, figurehead };
}
