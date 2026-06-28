// Seeded per-pass melody variation — kill the sail-loop fatigue (#117, DL #4/#5).
//
// CREATIVE SPARK (Musician): the sailing theme is the most-heard music in the game, and today it
// is ONE fixed 8-bar loop that audibly tiles on a long sail — the ear locks onto the seam and the
// charm curdles into wallpaper. This is the smallest cure that still feels composed, not random: a
// shanty player never plays the verse identically twice — they glint a phrase up an octave here,
// drop a high note into the chest voice there. So each 32-beat PASS of the sea theme gets a few
// seeded OCTAVE ORNAMENTS: a handful of lead notes lifted (or dropped) an octave, deterministically
// chosen per pass. The melody, its rhythm and its cadence are untouched — only the register glints.
//
// WHY OCTAVE-ONLY (in-key BY CONSTRUCTION): shifting a diatonic degree by a whole octave (±7 scale
// degrees) preserves its pitch class exactly — it is always still the same chord/scale tone, just in
// a different register. So the variation is *provably* in-key and always consonant; it can never play
// a wrong note. Timing is never touched (durations are copied verbatim), so the loop still fills the
// 32-beat bar exactly and the bass/pad/cadence land where they always did. Pass 0 is the canonical,
// unvaried composition — the variation accrues from there, so a fresh sail always opens in the home
// version. A small ornament cap + a protected entry/cadence note keep it subtle: a shimmer on the
// repeat, never a jarring re-composition.
//
// PURE on purpose — no THREE, no DOM, no AudioContext, no game state. (base notes, pass, seed) in,
// a plain varied note list out, identical every call. Unit-tested under node
// (tests/unit/melody-variation.test.mjs); music.js just rebuilds its lead schedule from the numbers
// at each pass boundary, so the per-pass CHOICE is provable headless.

/** The default deterministic seed for the sea-theme variation stream ("sea" → 0x5EA). */
export const SEA_VARIATION_SEED = 0x5EA5A11 >>> 0;

/** Register window (1-based diatonic degrees) a displaced note must stay within — keeps the glint
 *  sweet, never shrill up top nor muddy down against the bass. Base melody spans deg 1..10. */
export const MIN_DEG = 1;
export const MAX_DEG = 13;

/** At most this many notes are ornamented per pass — a shimmer, not a re-composition. */
export const MAX_ORNAMENTS = 3;

/**
 * mulberry32 — a tiny, fast, well-distributed seeded PRNG. Deterministic: the same seed always
 * yields the same stream. Returns a function producing floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The octave shift (in scale degrees) to apply to a note of degree `deg`, or 0 if it cannot be
 * displaced while staying in the register window. Low/mid notes glint UP an octave; already-high
 * notes drop DOWN an octave for warmth.
 */
function displaceDir(deg) {
  if (deg <= 7 && deg + 7 <= MAX_DEG) return +7; // lift the low/mid notes — a bright glint
  if (deg - 7 >= MIN_DEG) return -7;             // drop the high notes into the chest voice
  if (deg + 7 <= MAX_DEG) return +7;
  return 0;                                       // can't move without leaving the window
}

/**
 * Plan the ornaments for one pass: WHICH lead notes get octave-displaced and by how much. Pure and
 * deterministic in (baseNotes, passIndex, seed). Pass 0 is always the canonical, unvaried version.
 *
 * Never touches the phrase-entry note (index 0) nor the cadence/landing note (last index), so each
 * pass still opens and resolves home. Picks 1..MAX_ORNAMENTS distinct displaceable notes.
 *
 * @param {{deg:number, beats:number}[]} baseNotes the canonical melody
 * @param {number} passIndex 0-based pass counter (0 = canonical)
 * @param {{seed?:number}} [opts]
 * @returns {{passIndex:number, seed:number, displaced:{index:number, from:number, to:number, delta:number}[]}}
 */
export function variationPlan(baseNotes, passIndex, opts = {}) {
  const seed = (opts.seed ?? SEA_VARIATION_SEED) >>> 0;
  const notes = Array.isArray(baseNotes) ? baseNotes : [];
  const p = Math.trunc(Number(passIndex) || 0);
  if (p <= 0 || notes.length < 3) return { passIndex: p, seed, displaced: [] };

  // Candidate notes: anything but the entry/cadence note that can move within the register window.
  const last = notes.length - 1;
  const candidates = [];
  for (let i = 1; i < last; i++) {
    const dir = displaceDir(notes[i].deg);
    if (dir !== 0) candidates.push({ index: i, delta: dir });
  }
  if (candidates.length === 0) return { passIndex: p, seed, displaced: [] };

  // Mix the seed with the pass index so each pass draws its own independent ornament set.
  const rng = makeRng((seed ^ Math.imul(p, 0x9E3779B9)) >>> 0);

  const want = Math.min(MAX_ORNAMENTS, candidates.length, 1 + Math.floor(rng() * MAX_ORNAMENTS));
  // Partial Fisher–Yates: pick `want` distinct candidates deterministically.
  const pool = candidates.slice();
  const picked = [];
  for (let k = 0; k < want; k++) {
    const j = k + Math.floor(rng() * (pool.length - k));
    const tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
    picked.push(pool[k]);
  }

  const displaced = picked
    .map(({ index, delta }) => ({
      index,
      from: notes[index].deg,
      to: notes[index].deg + delta,
      delta,
    }))
    .sort((a, b) => a.index - b.index); // stable, index-ordered output

  return { passIndex: p, seed, displaced };
}

/**
 * Apply a pass's ornament plan to the base melody, returning a NEW note list (the input is never
 * mutated). Only `deg` changes (by whole octaves); every `beats` is copied verbatim, so the varied
 * pass has identical timing and still fills the loop exactly.
 *
 * @param {{deg:number, beats:number}[]} baseNotes
 * @param {number} passIndex
 * @param {{seed?:number}} [opts]
 * @returns {{deg:number, beats:number}[]}
 */
export function varyMelodyPass(baseNotes, passIndex, opts = {}) {
  const notes = Array.isArray(baseNotes) ? baseNotes : [];
  const out = notes.map((n) => ({ deg: n.deg, beats: n.beats }));
  const { displaced } = variationPlan(notes, passIndex, opts);
  for (const d of displaced) out[d.index].deg = d.to;
  return out;
}
