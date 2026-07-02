// Per-town music identity — the PURE, deterministic descriptor that gives each port its own
// musical character (#69, #94 phase 3; first slice = transposition-first).
//
// CREATIVE SPARK (Musician): every harbour should sound like ITSELF. You should hear a town before
// you can see its jetty — the tavern wheeze drifting across the water already in that port's key,
// its mode (a bright welcoming Saltpurse vs. a moody minor Barnacle Bottom), its timbre (close and
// woody, or airy and bright). Making landfall at a new town FEELS like somewhere new; sailing back
// to one you know greets you in the same key it always had. No new assets, no full tracks — we
// re-voice the existing tavern drone (music.js port layer) by transposing/re-colouring it.
//
// TECH LEAD constraint (#69 feasibility): TRANSPOSITION-FIRST. Keep the TEMPO FIXED this slice —
// live tempo changes glitch the scheduler. So a town's identity is { root, mode, tint, tremolo }
// keyed deterministically to its name; music.setTownTheme() ramps the drone's chord frequencies,
// lowpass colour and tremolo rate toward it (a click-free crossfade), debounced to the nearest port.
//
// PURE on purpose — no THREE, no DOM, no AudioContext, no game state. A port name in, a plain
// descriptor out, identical every call. Unit-tested under node (tests/unit/town-theme.test.mjs);
// the audio engine (music.js) just follows the numbers, so the per-town CHOICE is provable headless.

import { noteNameToMidi } from './music.js';

/** Warm low chord roots — towns sit in different keys but all in a cosy tavern register. */
export const TOWN_ROOTS = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3'];

/** A town's emotional colour: the third (major/minor) sets bright-vs-shadowed at a glance. */
export const TOWN_MODES = Object.freeze([
  { name: 'major', third: 4 },       // bright, welcoming
  { name: 'minor', third: 3 },       // moody, shadowed
  { name: 'dorian', third: 3 },      // wistful, salty
  { name: 'mixolydian', third: 4 },  // jaunty, folk
]);

/** A town's timbre: how the drone is filtered — close & woody, hushed & lamplit, or airy & bright. */
export const TOWN_TINTS = Object.freeze([
  { name: 'woody', lowpassHz: 1100, leadType: 'triangle' }, // close, indoors
  { name: 'mellow', lowpassHz: 800, leadType: 'sine' },     // hushed, lamplit
  { name: 'bright', lowpassHz: 2200, leadType: 'triangle' },// airy, open square
]);

/**
 * The DOCKED-CUE motif shapes (#129): a short per-town flourish that rings on making landfall — a
 * settled "you're moored here, and this is where" greeting distinct from the approach swell. Each
 * shape is a 4-note order over the town's own chord degrees [root, third, fifth, octave] (indices
 * 0..3), so the SAME cue always sounds in the town's key + mode (its major/minor colour comes free
 * from the chord's third). A town's shape is picked deterministically off its name — so one harbour
 * greets you with a rising peal, another with a lilting call, and it's always the same one.
 */
export const TOWN_CUE_SHAPES = Object.freeze([
  { name: 'rise', steps: [0, 1, 2, 3] }, // a clean rising spread — root→third→fifth→octave
  { name: 'peal', steps: [0, 2, 3, 2] }, // rise to the octave then settle — a little bell peal
  { name: 'call', steps: [3, 2, 1, 0] }, // a descending "welcome home" call from the octave down
  { name: 'lilt', steps: [0, 2, 1, 3] }, // a jaunty, skipping lilt up to the octave
]);

/** FNV-1a 32-bit hash — a stable, well-spread integer from a port name (deterministic). */
function hashName(name) {
  const s = typeof name === 'string' ? name : String(name ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * Resolve a port name → its deterministic musical identity. Same name always yields the same
 * descriptor (a town always sounds like itself); different names spread across the key/mode/tint
 * palettes. Junk/empty input is safe (hashes the coerced string → a valid identity, never throws).
 *
 * @param {string} portName the port's name (ports.js PORT_NAMES)
 * @returns {{
 *   port:string, seed:number,
 *   root:string, rootMidi:number,
 *   mode:string, thirdInterval:number,
 *   tint:string, lowpassHz:number, leadType:string,
 *   tremoloHz:number, chordMidi:number[]
 * }}
 */
export function townMusicIdentity(portName) {
  const seed = hashName(portName);
  const root = TOWN_ROOTS[seed % TOWN_ROOTS.length];
  const mode = TOWN_MODES[(seed >>> 4) % TOWN_MODES.length];
  const tint = TOWN_TINTS[(seed >>> 8) % TOWN_TINTS.length];
  // A cosy bellows wheeze, 2.0..3.2 Hz — a little faster/slower per town for extra character.
  const tremoloHz = 2.0 + ((seed >>> 12) % 13) / 10;

  const rootMidi = noteNameToMidi(root);
  // Tavern drone voicing: root · mode-third · perfect fifth · octave (matches music.js port layer).
  const chordMidi = [rootMidi, rootMidi + mode.third, rootMidi + 7, rootMidi + 12];

  return {
    port: typeof portName === 'string' ? portName : String(portName ?? ''),
    seed,
    root,
    rootMidi,
    mode: mode.name,
    thirdInterval: mode.third,
    tint: tint.name,
    lowpassHz: tint.lowpassHz,
    leadType: tint.leadType,
    tremoloHz,
    chordMidi,
  };
}

/**
 * Resolve a port → its DOCKED CUE (#129): the pure, deterministic descriptor of the short musical
 * flourish that rings ONCE on making landfall there — a settled "you've moored, and THIS is the place"
 * greeting, distinct from the approach swell. Voiced in the town's own key + mode (a rising bell peal
 * off its chord, an octave up so it's bright) and coloured by the town's timbre (leadType). Different
 * towns get a different motif SHAPE + key + timbre, so each harbour greets you like somewhere with
 * character; the same town always greets you the same way. PURE — no AudioContext (the audio engine
 * just voices these numbers); accepts either a port NAME or an already-resolved identity. Junk-safe.
 *
 * @param {string|object} portNameOrIdentity a port name, or a townMusicIdentity() descriptor
 * @returns {{
 *   port:string, mode:string, shape:string,
 *   notes:number[], type:string,
 *   rollSec:number, peak:number, tailSec:number
 * }}
 */
export function townDockedCue(portNameOrIdentity) {
  const id = portNameOrIdentity && Array.isArray(portNameOrIdentity.chordMidi)
    ? portNameOrIdentity
    : townMusicIdentity(portNameOrIdentity);
  const shape = TOWN_CUE_SHAPES[(id.seed >>> 16) % TOWN_CUE_SHAPES.length];
  // Ring the town's chord an octave up — bright + bell-like, above the warm drone. The shape orders
  // the four chord degrees into the town's little motif; the third carries its major/minor colour.
  const notes = shape.steps.map((i) => id.chordMidi[i] + 12);
  return {
    port: id.port,
    mode: id.mode,
    shape: shape.name,
    notes,
    type: id.leadType,   // the town's timbre (fife-bright triangle vs. lamplit sine) — instrument character
    rollSec: 0.07,       // a gentle roll between the flourish's notes
    peak: 0.16,          // matches the old landfall stinger's presence — sits under the melody
    tailSec: 1.2,        // a long shimmering tail as the ship glides to her moorings
  };
}
