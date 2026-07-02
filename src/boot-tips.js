// Boot tips (#15) — the game's VOICE, before you even sail. PURE, DOM-free and three.js-free so
// the pool + the anti-repeat picker are node-testable in isolation (same pure-split idiom as
// curio-math.js / duel.js line pools). main.js is the thin shell that draws one line into the
// #boot loading overlay on cast-off; the CHOICE and the never-twice-running guarantee live here.
//
// THE BEAT (Game Designer): the first thing the sea says to you is a wry aside — a tip that is
// half advice, half wink. Before the hull even settles you've half-smiled at a line about rum, or
// the Crown, or the horizon that won't stop running. It sets the whole tone in one breath: this is
// a world that takes the sailing seriously and itself not at all. Kind to the player, self-aware,
// swashbuckling — and different (almost) every boot, so a returning captain gets a fresh grin.
//
// Voice is the Ballad's / Rumours' (#78/#103): warm, in-character, a wink of comedy, ORIGINAL to
// Tidewake — never a franchise reference. Anti-repeat guaranteed by the shared pickLine picker.

import { pickLine } from './curio-math.js';

// The pool — 20 original one-liners. Each stands alone, fits a single boot line, and lands a smile.
// Extend freely: add a string, nothing else to touch (the picker reads the live length).
export const BOOT_TIPS = Object.freeze([
  'A wise captain fears three things: the deep, the Crown, and running out of rum. Mostly the rum.',
  'The horizon is not running away. It only wants to be chased.',
  "Wind's free, cannonballs aren't. Aim like a miser.",
  'Every port smells of opportunity, fish, or trouble. Usually all three.',
  'A full hold is heavy; an empty hold is heavier on the heart. Trade wisely.',
  'The sea keeps no grudges and no promises. Sail accordingly.',
  'Loyalty is bought with rum and kept with fair shares. Your crew is counting both.',
  'If a deal seems too good, count your fingers after the handshake.',
  "Storms pass. Reputations don't. Choose your broadsides with care.",
  'A pirate who never fled a fight is a pirate who never lived to tell it.',
  "The Crown's coin spends the same as any other. So does the pirate's.",
  'No map marks the good taverns. That knowledge is earned, cup by cup.',
  'Steer by the stars, not by the sea-monster you thought you saw. Probably driftwood. Probably.',
  'Coin sinks, songs float. Be the sort of captain they sing about.',
  'The tide waits for no one — hence the name, and the hurry.',
  'Board with courage, retreat with grace, and never confuse the two.',
  'A calm sea makes a poor sailor and a bored crew. Go find weather.',
  "Two rules of the account: don't get caught, and don't run out of powder. Order negotiable.",
  "Governor or gallows — it's mostly a matter of who's telling the story.",
  'First to blink loses the duel. Second to blink loses the ship.',
]);

/**
 * Pick the next boot-tip index, never the one just shown (so a reload never repeats back-to-back),
 * while every other line stays reachable. Thin wrapper over the shared #70 anti-repeat picker.
 * PURE: (lastIndex, rand) in → index out. Returns 0 for a single-line pool, -1 for an empty one.
 *   pickTip(lastIndex, rand?) -> number
 */
export function pickTip(lastIndex, rand = Math.random) {
  return pickLine(BOOT_TIPS.length, lastIndex, rand);
}

/** Safe lookup: the tip string at an index, or '' if out of range. Keeps the shell trivial. */
export function tipAt(index) {
  return (index >= 0 && index < BOOT_TIPS.length) ? BOOT_TIPS[index] : '';
}
