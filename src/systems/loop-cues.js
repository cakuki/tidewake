// Reactive-loop diegetic cues (#116, DL #4 — Music + Sound convergence) — the PURE cue VOCABULARY + the
// pure decisions about WHICH cue a reactive-loop beat plays. No THREE, no DOM, no AudioContext: the
// *recipe* and the *selection* are browser-free and unit-tested under node, and music.js just renders
// the chosen recipe through the shared bus (so the existing mute covers them). Same loop event →
// same cue, deterministically — so a headless playtest can listen/approach/claim and assert the
// right cue fired without ever opening an AudioContext.
//
// CREATIVE SPARK (Musician + Sound Engineer): the rumour→chase→reward loop works but lands MUTE.
// Give it three little in-character gestures sung in the bed's own key (D major), so they nod with
// the music rather than fight it:
//   • LISTEN  — cup-an-ear: a soft, curious rising lean-in as the room leaks you a word.
//   • APPROACH— the horizon nods you onward: a hopeful rising fifth→octave as you draw near the pin.
//   • PAYOFF  — a satisfied major flourish that lands HOME when the tip pays off.
//   • LOSS    — a wry, sour blunder-stab (chromatic, out of the bright major) for a rival's smug wake.
// PAYOFF and LOSS are deliberately OPPOSITE in colour (diatonic-bright vs chromatic-sour) so the ear
// knows instantly whether you won the prize or arrived to a rival's wake.
//
// SHIPPED LATER (#116 follow-up): per-rumour-kind LISTEN colour (the room leans in differently for a
// trade tip vs a reputation whisper vs danger on the water vs your own deed echoing back) + a bright
// coin-chime layered UNDER the payoff when a tip actually pays coin. Same pure-recipe discipline.
// STILL QUEUED (not built here): a distinct "rival sail sighted" sting + a continuous wake/helm
// water-bed SFX. This module ships the four loop-beat cues, the listen colours, and the coin chime.

/**
 * How near (world units) the chased target you must come before the "drawing near" cue rings. Sits
 * inside the music bed's port-cue horizon (260) but outside the dock radius (90), so the nod lands
 * while you're closing on the pin, well before arrival resolves the chase.
 */
export const APPROACH_RADIUS = 200;

// Each cue is a tiny PURE recipe music.js renders: a short note gesture in the bed's key. `degs` are
// 1-based diatonic scale degrees (D major) — bright, in-key; `semis` are raw chromatic semitone
// offsets from the root — used by the sour loss cue to step OUT of the major. `octave` shifts the
// whole gesture in octaves; the envelope fields (`gain`/`step`/`dur`/`tail`) and `type` shape it;
// `lowpass`/`detune` are optional colour for the darker cue. Kept modest so a cue rides over the bed.
const CUES = {
  // Listen — a soft, curious rising lean-in (minor-third up), intimate + quiet so it leans INTO the
  // tavern murmur, never over it. Two gentle sine notes.
  listen: { degs: [3, 5], octave: 0, type: 'sine', gain: 0.07, step: 0.10, dur: 0.34, tail: 0.42 },
  // Approach — a hopeful horizon bell: a rising perfect fifth → octave, bright but soft, the world
  // nodding you onward as the pin draws near.
  approach: { degs: [5, 8], octave: 0, type: 'triangle', gain: 0.09, step: 0.12, dur: 0.45, tail: 0.7 },
  // Payoff — a satisfied, resolved major flourish that lands HOME: tonic→fifth→octave→tenth (the high
  // major-third crown), warm + bright, an octave up. Distinct from the landfall stinger by shape.
  payoff: { degs: [1, 5, 8, 10], octave: 1, type: 'triangle', gain: 0.13, step: 0.075, dur: 0.5, tail: 1.1 },
  // Loss — a sour blunder-stab: a tritone droop (G# → G against a D-major bed) out of the bright key,
  // dark + lowpassed + a touch flat, the wry "wah-wahmp" of a rival's smug wake.
  loss: { semis: [6, 5], octave: 0, type: 'sawtooth', gain: 0.10, step: 0.13, dur: 0.45, tail: 0.55, lowpass: 1000, detune: -12 },
};

// Interaction cues (#116 follow-up): not loop BEATS but reactions to a player VERB. The LISTEN cue
// now takes a colour from the kind of word the room leaks (so cupping an ear feels different for a
// trade tip vs a reputation whisper vs danger on the water vs your own deed echoing back), and a
// bright COIN chime rides under the payoff when a tip actually pays coin. Kept under the loop-beat
// cues in gain so they nod, never shout — same pure-recipe discipline as CUES.
const INTERACTION_CUES = {
  // Trade tip — a hopeful rising sixth (A → high F#), the ear pricking up at a heading worth chasing.
  listenTrade: { degs: [5, 10], octave: 0, type: 'triangle', gain: 0.07, step: 0.10, dur: 0.32, tail: 0.5 },
  // Danger/prize on the water — a wary, muffled falling step (E → D), darker, leaning into the hush.
  listenSea: { degs: [2, 1], octave: 0, type: 'sine', gain: 0.06, step: 0.11, dur: 0.36, tail: 0.45, lowpass: 1400 },
  // Your own deed echoing back — a warm settle home (D → F#), a soft fond nod at your own tale.
  listenDeed: { degs: [1, 3], octave: 0, type: 'sine', gain: 0.06, step: 0.12, dur: 0.40, tail: 0.6 },
  // Coin chime — a bright, glassy high tinkle (octave-up → tenth) layered UNDER the payoff flourish
  // when the tip actually pays coin: the "ka-ching" the ear waits for, soft enough to ride beneath.
  coin: { degs: [8, 12], octave: 2, type: 'triangle', gain: 0.05, step: 0.05, dur: 0.16, tail: 0.45 },
};

// Every renderable cue, by name — the four loop beats plus the interaction reactions.
const ALL_CUES = { ...CUES, ...INTERACTION_CUES };

/** The known reactive-loop cue names, in loop order. */
export const LOOP_CUE_NAMES = Object.keys(CUES);

/** The LISTEN cue family, in rumour-kind order (rep / trade / sea / deed). */
export const LISTEN_CUE_NAMES = ['listen', 'listenTrade', 'listenSea', 'listenDeed'];

/**
 * PURE — resolve a reactive-loop cue name to its render recipe, or null for an unknown/junk name.
 * Returns a COPY (with `name` folded in) so a caller can never mutate the shared recipe. Never throws.
 * @param {string} name  one of LOOP_CUE_NAMES / LISTEN_CUE_NAMES / 'coin'
 * @returns {object|null}
 */
export function selectCue(name) {
  if (typeof name !== 'string') return null;
  const spec = ALL_CUES[name];
  return spec ? { name, ...spec } : null;
}

// Which LISTEN colour does each rumour kind wear? rep keeps the intimate base cup-an-ear cue; the
// other kinds get their own tint. Anything unknown fails open to the base 'listen'.
const LISTEN_BY_KIND = { rep: 'listen', trade: 'listenTrade', sea: 'listenSea', deed: 'listenDeed' };

/**
 * PURE — the LISTEN interaction cue for a surfaced rumour's KIND (rep/trade/sea/deed). Unknown or
 * missing kind fails open to the base 'listen' cue, so a listen always sings something. Never throws.
 * @param {string} [kind]  one of 'rep' | 'trade' | 'sea' | 'deed'
 * @returns {'listen'|'listenTrade'|'listenSea'|'listenDeed'}
 */
export function listenCueName(kind) {
  return (typeof kind === 'string' && LISTEN_BY_KIND[kind]) || 'listen';
}

/**
 * PURE — does a chased-rumour payoff also ring the coin chime? Only an HONEST win that actually paid
 * coin gets the bright tinkle: a rival-claimed (zero-coin) loss does not, nor does a zero-coin win.
 * Deterministic; never throws.
 * @param {{claimed?:boolean, coins?:number}} [outcome]
 * @returns {boolean}
 */
export function coinChimes(outcome = {}) {
  return !!(outcome && !outcome.claimed && Number(outcome.coins) > 0);
}

/**
 * PURE — which cue does a chased rumour's resolution play? A rival who already CLAIMED the prize
 * (#133) gets the sour LOSS stab; an honest payoff (or any uncontested win) gets the bright PAYOFF
 * flourish. Deterministic; never throws.
 * @param {{claimed?:boolean}} [outcome]
 * @returns {'payoff'|'loss'}
 */
export function payoffCueName(outcome = {}) {
  return outcome && outcome.claimed ? 'loss' : 'payoff';
}

/**
 * PURE — has the ship just CROSSED inward through the approach radius toward the chased target this
 * frame? An EDGE trigger: true only on the frame the distance drops from outside the radius to at/
 * inside it, so the "drawing near" cue rings ONCE per approach, not every frame. Non-finite prev/cur
 * distance (e.g. the first frame of a fresh chase) is safe → false. Never throws.
 * @param {number} prevDist  the previous frame's distance to the target
 * @param {number} dist      this frame's distance to the target
 * @param {number} [radius]  the approach radius (defaults to APPROACH_RADIUS)
 * @returns {boolean}
 */
export function approachCrossed(prevDist, dist, radius = APPROACH_RADIUS) {
  if (!Number.isFinite(prevDist) || !Number.isFinite(dist) || !Number.isFinite(radius)) return false;
  return prevDist > radius && dist <= radius;
}
