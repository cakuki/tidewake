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
//
// SHIPPED LATER STILL (#116 follow-up — the RIVAL-SAIL-SIGHTED sting): the world's own "uh-oh,
// company" beat. When a HOSTILE (outlaw) sail first crosses the sighting horizon, ring a short, tense
// LOW sting (the `rivalSail` recipe) — dark, lowpassed, a rising tritone creeping up from below — that
// primes an encounter/battle, ahead of any hail/cannon. A hysteresis latch (sightingEdge) fires it
// ONCE per sighting and re-arms only after the sail draws back off the horizon, so a loitering rival
// never spams it. Pure + headless: the sighting edge-detect and the cue are browser-free + unit-tested.
// STILL QUEUED (not built here): the continuous #81 hull-creak SFX (the last drop in the reservoir).

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

// Encounter cue (#116 follow-up — the RIVAL-SAIL-SIGHTED sting): not a loop BEAT nor a player VERB
// but the WORLD's own warning — the "uh-oh, company" beat when a hostile sail first crests the
// horizon. Deliberately the opposite of every bright cue above: LOW (an octave down), DARK
// (heavily lowpassed), a touch FLAT (detuned), and stepping OUT of the bright major on a RISING
// tritone (semis 0 → 6, the brooding "devil's interval" creeping up from below) — so the ear reads
// THREAT instantly, distinct from the high sour LOSS droop (a FALLING tritone) and the bright PAYOFF.
// Modest gain: it primes the encounter, it doesn't jump-scare. Same pure-recipe discipline as CUES.
const ENCOUNTER_CUES = {
  rivalSail: { semis: [0, 6], octave: -1, type: 'sawtooth', gain: 0.12, step: 0.16, dur: 0.55, tail: 0.8, lowpass: 760, detune: -10 },
};

/** The encounter-cue NAME for the rival-sail-sighted sting — the magic-string-free handle main.js arms. */
export const RIVAL_SAIL_CUE = 'rivalSail';

// Battle-verb availability EARCONS (#154) — the AUDIO half of #153's contextual key-prompts. When an
// in-battle verb-window opens (guns bear / boardable / colours struck) a short, distinct earcon rings
// so the captain learns WHICH verb and WHEN by ear, not just by reading the HUD. Fired on the SAME
// availability EDGE the visual prompt appears on (and, like it, ONCE — the learn-filtered edge below),
// quantised to the next downbeat + routed through musicGain like every #116 cue (so mute covers them).
// Three registers/directions so the ear tells them apart instantly:
//   • fireReady     — a brisk rising FIFTH, mid register: "she'll bear — FIRE." (a call to action)
//   • boardable     — a low, weighty FALLING grab, an octave down + darkened: "close and grapple."
//   • surrenderOffer— a high, HANGING rising step: "her colours strike — a decision awaits." (unresolved)
const BATTLE_EARCON_CUES = {
  fireReady:      { degs: [1, 5],  octave: 0,  type: 'triangle', gain: 0.09, step: 0.07, dur: 0.20, tail: 0.30 },
  boardable:      { degs: [3, 1],  octave: -1, type: 'triangle', gain: 0.11, step: 0.10, dur: 0.30, tail: 0.42, lowpass: 1300 },
  surrenderOffer: { degs: [8, 10], octave: 1,  type: 'triangle', gain: 0.09, step: 0.09, dur: 0.24, tail: 0.55 },
};

/** The battle-verb earcon NAMES — the magic-string-free handles the key-prompts wiring arms. */
export const BATTLE_EARCON_NAMES = Object.keys(BATTLE_EARCON_CUES);

// Which earcon does each #153 availability PHASE wear? The phase is the top (highest-priority) contextual
// key-prompt's `tone` — 'fire' while maneuvering for the broadside, 'board' in the boarding window,
// 'surrender' once she strikes her colours — so the earcon can never drift from the visual prompt.
const EARCON_BY_PHASE = { fire: 'fireReady', board: 'boardable', surrender: 'surrenderOffer' };

/**
 * PURE — the earcon to ring when the battle-verb availability PHASE advances to a NEW verb-window this
 * frame. An EDGE trigger: a non-null cue only on the frame the phase CHANGES to a fresh armable phase,
 * so it rings ONCE as the window opens, never every frame it stays open (and — since the phase is read
 * off the learn-FILTERED #153 prompts — never again once the verb has been used). A phase that clears
 * (→ null) or holds is silent. Unknown phases fail open to null. Deterministic; never throws.
 * @param {string|null} prevPhase  last frame's availability phase ('fire'|'board'|'surrender'|null)
 * @param {string|null} curPhase   this frame's availability phase
 * @returns {'fireReady'|'boardable'|'surrenderOffer'|null}
 */
export function battleEarcon(prevPhase, curPhase) {
  if (curPhase && curPhase !== prevPhase && EARCON_BY_PHASE[curPhase]) return EARCON_BY_PHASE[curPhase];
  return null;
}

// Every renderable cue, by name — the four loop beats, the interaction reactions, the encounter sting,
// and the three battle-verb availability earcons (#154).
const ALL_CUES = { ...CUES, ...INTERACTION_CUES, ...ENCOUNTER_CUES, ...BATTLE_EARCON_CUES };

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

/**
 * How near (world units) a hostile sail must come before it is "sighted" and the RIVAL-SAIL-SIGHTED
 * sting rings. Sits OUTSIDE both the chased-pin "drawing near" nod (APPROACH_RADIUS = 200) and the
 * port-music bloom horizon (260), so a rival is spotted FAR off — the warning primes the encounter
 * long before any hail/cannon/battle, never the moment you're already on top of each other.
 */
export const RIVAL_SIGHT_RADIUS = 340;

/**
 * Hysteresis (Schmitt) band for the sighting latch: a sighted sail must draw back off past
 * RIVAL_SIGHT_RADIUS × this before a fresh sighting can re-arm. > 1, so the re-arm distance sits
 * OUTSIDE the sighting radius — a rival jittering across the horizon line stings ONCE, not every frame.
 */
export const RIVAL_REARM_FACTOR = 1.3;

/**
 * PURE — advance the rival-sail SIGHTING latch one frame and say whether to ring the sting NOW. A
 * hysteresis latch over the distance to the NEAREST hostile sail: while ARMED, the first frame the
 * nearest hostile is at/inside `radius` fires ONCE and disarms; it re-arms only after that nearest
 * hostile draws back off past `rearm` (= radius × RIVAL_REARM_FACTOR) — so a rival loitering on the
 * horizon can't spam the cue. No hostile in the world at all (non-finite dist) counts as "drawn off"
 * → quietly re-armed. Session-scoped state lives in the caller (one boolean); this is the transition.
 * Deterministic; never throws.
 * @param {boolean} armed   the latch's current state (true = ready to sting on the next sighting)
 * @param {number} dist     distance to the NEAREST hostile sail (Infinity when none exist)
 * @param {number} [radius] sighting radius (defaults to RIVAL_SIGHT_RADIUS)
 * @param {number} [rearm]  re-arm distance (defaults to radius × RIVAL_REARM_FACTOR)
 * @returns {{armed: boolean, fire: boolean}} the next latch state + whether to ring the sting this frame
 */
export function sightingEdge(armed, dist, radius = RIVAL_SIGHT_RADIUS, rearm) {
  const r = Number.isFinite(radius) ? radius : RIVAL_SIGHT_RADIUS;
  const off = Number.isFinite(rearm) ? rearm : r * RIVAL_REARM_FACTOR;
  const a = !!armed;
  const d = Number(dist);
  if (!Number.isFinite(d)) return { armed: true, fire: false }; // no hostile anywhere → re-armed, silent
  if (a && d <= r) return { armed: false, fire: true };          // a sail crosses the horizon → sting once
  if (!a && d > off) return { armed: true, fire: false };        // it draws off past the band → re-arm
  return { armed: a, fire: false };                              // hold (loitering, or still beyond)
}
