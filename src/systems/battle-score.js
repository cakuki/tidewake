// Per-phase battle musical signatures (#158) — the score becomes the tutorial timer.
//
// The shipped #135 raid-phase model (src/ui/raid-phases.js) names WHICH ACT of a raid you're in —
// ⚔ Maneuver › 🪝 Boarding › 🗣 Duel. This makes the SCORE wear that act: each phase gets a DISTINCT
// musical LAYER (a different church-mode recolour + register + drive — NOT merely louder), and a
// phase transition triggers a bar-quantised, constant-power crossfade to the new layer. So you HEAR
// when the fight changes act before you read the HUD — a driving chase, a dark grapple, a sharp duel.
//
// CREATIVE SPARK (Musician + Sound Engineer): "the fight is scored." A raid shouldn't be one flat
// combat drone — it should breathe the three-beat story. The maneuver ROLLS (a propulsive mixolydian
// chase); the boarding BITES (a dark freygish tension as the grapples fly); the duel SHARPENS (a
// bright, pointed lydian a register up as the captains trade insults). Each act cross-fades in ON the
// downbeat, so the transition lands like a composed cue, never a mid-phrase cut.
//
// PURE on purpose — no WebAudio, no THREE, no game state (the #132 discipline). It recolours the LEAD
// over the FIXED D-major bass+pad (all three act-scales share root/major-3rd/5th so they stay
// consonant with that bed) — NO percussive bed added, NO loadTrack. music.js is the thin shell that
// voices the returned scale into a battle-layer bus and rides the crossfade on its bar-clock.

// Fully self-contained (NO import from music.js) — music.js imports THIS + bakes its crossfade curves
// from crossfadeGains() at module top level, so a back-edge to music.js would be a load-time cycle.

// The neutral D-major (Ionian) bed the honest hornpipe plays — the silent-rest fallback outside a raid.
// Byte-identical to music.js MAJOR_SCALE (a unit test guards it) but kept local to break the cycle.
const NEUTRAL_SCALE = [0, 2, 4, 5, 7, 9, 11];

// The three act LAYERS. Scale = semitone offsets from the D root, sharing [0]=root, [2]=major-3rd,
// [4]=fifth (phase-coherent over the FIXED bed); only the COLOUR tones (2/4/6/7) change between acts.

/** ⚔ Maneuver — the chase: a propulsive MIXOLYDIAN roll (flat-7). Bright, driving, mid-register. */
export const DRIVE_SCALE  = [0, 2, 4, 5, 7, 9, 10];
/** 🪝 Boarding — the grapple: a dark FREYGISH bite (flat-2 + flat-6 + flat-7). Heaviest, tensest. */
export const MENACE_SCALE = [0, 1, 4, 5, 7, 8, 10];
/** 🗣 Duel — the verbal standoff: a sharp LYDIAN edge (raised-4th), a register up. Pointed, bright. */
export const EDGE_SCALE   = [0, 2, 4, 6, 7, 9, 11];

// The grid steps in a bar — the bar-clock a phase swap quantises to (matches music.js STEPS_PER_BAR:
// BEATS_PER_BAR 4 × 2 eighth-note steps). Kept local so this module stays dependency-light + pure.
export const BATTLE_STEPS_PER_BAR = 8;

/**
 * The per-act layer param sets — the single source of truth the pure resolver + music.js both read.
 * Each act carries a distinct { scale, drive, octave }: a different mode COLOUR, a different energy
 * (drive → the layer's target gain), and a different register (octave), so the acts are unmistakably
 * distinct — not one loop turned louder.
 */
export const BATTLE_ACTS = {
  maneuver: { act: 'maneuver', scale: DRIVE_SCALE,  drive: 0.55, octave: 0 }, // rolling propulsion
  boarding: { act: 'boarding', scale: MENACE_SCALE, drive: 0.80, octave: 0 }, // dark, heavy grapple
  duel:     { act: 'duel',     scale: EDGE_SCALE,   drive: 1.00, octave: 1 }, // sharp, high, pointed
};

// The silent rest — no raid act (at sea, or a plain hailed duel): the battle layer is absent and the
// honest D-major bed plays alone. A fresh object each call so callers can never mutate the shared map.
const REST = () => ({ act: null, scale: NEUTRAL_SCALE.slice(), drive: 0, octave: 0 });

/**
 * PURE — the battle-layer param set for a raid act key (raidPhaseModel().actKey). Returns the act's
 * distinct { act, scale, drive, octave } for 'maneuver' / 'boarding' / 'duel', or a silent REST for
 * null / unknown / junk (outside a raid → no battle layer, the neutral bed alone). Reads the shipped
 * phase model; invents no mechanics. Never throws; returns a fresh, safe-to-hold object.
 * @param {string|null} actKey
 * @returns {{act:string|null, scale:number[], drive:number, octave:number}}
 */
export function battleLayer(actKey) {
  const layer = actKey && BATTLE_ACTS[actKey];
  if (!layer) return REST();
  return { act: layer.act, scale: layer.scale.slice(), drive: layer.drive, octave: layer.octave };
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * PURE — constant-power (equal-power sin/cos) crossfade gains for a normalised progress t in [0,1].
 * At t=0 the outgoing layer is full (from=1, to=0); at t=1 the incoming layer is full (from=0, to=1);
 * from²+to²===1 throughout, so the two act-layers sum to unity perceived loudness through the swap —
 * no dip, no click. Junk / out-of-range t clamps into [0,1]; never NaN, never throws.
 * @param {number} t 0..1 crossfade progress
 * @returns {{from:number, to:number}}
 */
export function crossfadeGains(t) {
  const x = clamp01(Number.isFinite(t) ? t : 0) * (Math.PI / 2);
  return { from: Math.cos(x), to: Math.sin(x) };
}

// Is this grid step a bar's downbeat? The same bar-clock quantisation the landfall stinger (#102) and
// the reactive-loop cues (#116) use — a pending phase swap is HELD until the next downbeat so the
// layer crossfade lands ON the beat, never mid-phrase. Tolerant of negative/junk steps.
function onDownbeat(step, stepsPerBar) {
  const n = Math.max(1, Math.trunc(Number(stepsPerBar) || BATTLE_STEPS_PER_BAR));
  const s = Math.trunc(Number(step) || 0);
  return ((s % n) + n) % n === 0;
}

/**
 * PURE — the bar-quantised phase-transition planner. Given the currently COMMITTED battle act, the
 * TARGET act the fight is now in (from battleLayer/raidPhaseModel), and the live bar-clock step,
 * decide whether the crossfade to the new act should FIRE this step. A pending change is held until
 * the next downbeat, so every act swap (enter, act→act, and leave) lands on the beat. No pending
 * change (target === committed) → never fires. Junk-safe; never throws.
 * @param {{committed:string|null, target:string|null, step:number, stepsPerBar?:number}} p
 * @returns {{fire:boolean, act:string|null}} act = the act to become committed (unchanged unless fired)
 */
export function nextTransition({ committed = null, target = null, step = 0, stepsPerBar = BATTLE_STEPS_PER_BAR } = {}) {
  if (target === committed) return { fire: false, act: committed };
  if (onDownbeat(step, stepsPerBar)) return { fire: true, act: target };
  return { fire: false, act: committed };
}
