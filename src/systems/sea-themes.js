// Rotating sea themes (#94 phase 2) — the open sea EVOLVES over a long voyage.
//
// #94 phase 1 (#109) gave the open water ONE mode-aware bed; #117 glints each 32-beat pass with
// seeded octave ornaments. But over long stretches the sea's HARMONY is still static — the same key,
// the same mode, voyage after voyage. This rotates it through a small set of DISTINCT sea themes: a
// mode + transposition RECOLOUR of the SAME procedural bed (like #132's needle and #158's battle
// layers — NOT a percussive bed, NOT loadTrack), cross-faded in on the bar-clock every so often.
//
// CREATIVE SPARK (Musician): a long day at sea should breathe. A shanty crew doesn't hold one tune
// for hours — the wind shifts, the mood turns, and a new air rises. So the sea moves through a handful
// of AIRS: the bright home hornpipe you cast off in; a salty MIXOLYDIAN trade-wind roll; a wistful
// DORIAN deep-water air a fourth down; an airy LYDIAN fair-horizon lift a whole step up. Each swaps in
// ON a downbeat, seeded so the same voyage always sails the same sequence — variety with momentum,
// never a loop, never random noise. Town and battle OWN the mix when they come; the rotation freezes
// under them and resumes on the same air when you're back under sail.
//
// PURE on purpose — no WebAudio, no THREE, no game state, no import from music.js (music.js imports
// THIS). (barsAtSea, seed) in → a theme cast { name, scale, rootOffset } out, identical every call.
// Unit-tested under node (tests/unit/sea-themes.test.mjs); music.js is the thin shell that voices the
// returned cast (transpose ROOT by rootOffset, voice the sea bed in `scale`) on a bar downbeat, so the
// per-bar CHOICE and the bar-quantised swap are BOTH provable headless.

// Scale degrees as semitone offsets from the (transposed) root. Kept LOCAL (like battle-score.js) so
// this module stays dependency-light and there is no load-time cycle back through music.js. IONIAN is
// byte-identical to music.js MAJOR_SCALE (a unit test guards it). All modes share [0]=root, [4]=fifth
// so, layered under the shared { ctx, master } bus, they stay phase-coherent — a swap never clashes.
const IONIAN     = [0, 2, 4, 5, 7, 9, 11]; // the honest hornpipe — bright major
const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10]; // salty flat-7 — a trade-wind roll
const DORIAN     = [0, 2, 3, 5, 7, 9, 10]; // minor with a raised 6th — wistful, not sad
const LYDIAN     = [0, 2, 4, 6, 7, 9, 11]; // raised 4th — airy, open, hopeful

/**
 * The set of sea themes. Each is a RECOLOUR of the same procedural bed: a `scale` (mode) plus a
 * `rootOffset` (semitone transposition of the D root). Index 0 is HOME — the untouched Ionian
 * hornpipe in the shipped key (rootOffset 0), so a fresh sail (bar 0) opens exactly as before.
 * A small, hand-tuned handful (Game Designer's call) — enough that a long voyage has variety and
 * momentum, few enough that each stays a recognisable AIR rather than mush.
 */
export const SEA_THEMES = Object.freeze([
  Object.freeze({ name: 'home',    scale: IONIAN,     rootOffset: 0 }),  // the canonical bed — cast off here
  Object.freeze({ name: 'trade',   scale: MIXOLYDIAN, rootOffset: 0 }),  // salty trade-wind roll, same key
  Object.freeze({ name: 'deep',    scale: DORIAN,     rootOffset: -5 }), // a fourth down — wistful deep water
  Object.freeze({ name: 'horizon', scale: LYDIAN,     rootOffset: 2 }),  // a whole step up — a fair-horizon lift
]);

/** The deterministic seed for the sea-theme rotation stream ("sea theme" → 0x5EA7). */
export const SEA_THEME_SEED = 0x5EA7 >>> 0;

/**
 * Bars between rotations. 8 bars = one full melodic pass (~18s at the 108-BPM sailing tempo): the tune
 * comes round once in its air, THEN the wind changes and a new air rises — a natural, musical cadence
 * that aligns with the #117 per-pass seam, so a swap lands cleanly on a loop boundary. Long enough that
 * each air reads as its own stretch, short enough that a multi-minute voyage moves through several. A
 * Game-Designer fun-shaping number, not a physical constant.
 */
export const ROTATE_BARS = 8;

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/**
 * PURE — a seeded rotation STRIDE over `n` themes, guaranteed coprime with `n` so that stepping by it
 * visits every theme before repeating (a full cycle = full variety) and no two consecutive rotation
 * steps land on the same theme. The seed picks WHICH coprime stride, so the order genuinely varies with
 * the seed while staying deterministic. Junk/edge → a safe stride of 1. Never throws.
 * @param {number} seed
 * @param {number} n number of themes
 * @returns {number} stride in [1, n-1], coprime with n
 */
export function seededStride(seed, n) {
  const count = Math.max(1, Math.trunc(Number(n) || 1));
  if (count <= 2) return 1;
  const coprimes = [];
  for (let k = 1; k < count; k++) if (gcd(k, count) === 1) coprimes.push(k);
  if (coprimes.length === 0) return 1;
  const s = Math.trunc(Number(seed) || 0);
  const idx = ((s % coprimes.length) + coprimes.length) % coprimes.length;
  return coprimes[idx];
}

/**
 * PURE — the theme INDEX for a given whole-bar count at sea. Bar 0 (a fresh sail) is always the HOME
 * theme (index 0); every `rotateBars` the index advances by a seeded coprime stride, so the sequence
 * is deterministic, consecutive-distinct, and cycles through every theme. Negative/junk bars fail safe
 * to 0. Never throws, never NaN.
 * @param {number} barsAtSea whole bars elapsed under sail (frozen during town/battle)
 * @param {{seed?:number, rotateBars?:number}} [opts]
 * @returns {number} index into SEA_THEMES
 */
export function seaThemeIndexAt(barsAtSea, { seed = SEA_THEME_SEED, rotateBars = ROTATE_BARS } = {}) {
  const n = SEA_THEMES.length;
  const bars = Math.max(0, Math.trunc(Number(barsAtSea) || 0));
  const per = Math.max(1, Math.trunc(Number(rotateBars) || ROTATE_BARS));
  const stepN = Math.floor(bars / per);
  const stride = seededStride(seed, n);
  return ((stepN * stride) % n + n) % n; // step 0 → index 0 (home)
}

/**
 * PURE — the theme CAST for a given whole-bar count at sea. See seaThemeIndexAt.
 * @param {number} barsAtSea
 * @param {{seed?:number, rotateBars?:number}} [opts]
 * @returns {{name:string, scale:number[], rootOffset:number}}
 */
export function seaThemeAt(barsAtSea, opts = {}) {
  return SEA_THEMES[seaThemeIndexAt(barsAtSea, opts)];
}

/**
 * PURE — the bar-quantised rotation planner (the sea-theme twin of battle-score's nextTransition).
 * Given the currently COMMITTED theme, the whole-bar count at sea, and whether the player is AT SEA,
 * decide whether a swap to a new theme should FIRE. When NOT at sea (town/battle own the mix) the
 * rotation is HELD — never fires, keeps the committed theme — so the swap yields cleanly and resumes on
 * the same air on return to sea. Junk-safe; never throws.
 * @param {{committed?:object|null, barsAtSea?:number, atSea?:boolean, seed?:number, rotateBars?:number}} p
 * @returns {{fire:boolean, theme:{name:string,scale:number[],rootOffset:number}}}
 */
export function nextSeaTheme({ committed = null, barsAtSea = 0, atSea = true, seed = SEA_THEME_SEED, rotateBars = ROTATE_BARS } = {}) {
  const theme = seaThemeAt(barsAtSea, { seed, rotateBars });
  if (!atSea) return { fire: false, theme: committed || theme };
  const fire = !committed || committed.name !== theme.name;
  return { fire, theme };
}
