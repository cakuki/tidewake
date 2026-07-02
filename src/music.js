// Procedural sailing theme — WebAudio only, fully synthesised, no asset downloads.
//
// The Musician's first activation (#27): a jaunty, sea-shanty-flavoured SAILING THEME
// that loops invisibly under the Sound Engineer's sea ambience. Original composition —
// a hornpipe-lilt melody in D major over a soft bass pulse and a chord pad that swells
// in as you make way. Warm, witty, a touch comic; never grating on the loop.
//
// Shares ONE graph with audio.js: it does NOT create its own AudioContext. It is handed
// the live { ctx, master } when the audio engine comes up on the first user gesture, and
// hangs a single sub-gain under that master — so the existing mute (M / the HUD toggle)
// silences the music too. Headless / no-gesture runs never call start(), so this module
// stays inert: no context, no nodes, no console noise.
//
// ADAPTIVE-READY (vertical layering): update(state) maps ship speed to an intensity in
// [0,1]; the lead fills out and the chord pad fades up with speed, calmer when nearly
// stopped. The per-note gains are read live at schedule time, leaving clean seams to add
// port / combat / calm mood layers later by branching on a `mood` field of state.
//
// Every PURE helper below (tempo math, scale-degree → frequency, the pattern generators,
// speed → intensity) is browser-free and exported for `node --test`. All AudioContext use
// lives inside createMusic()'s start()/scheduler.
//
// MODE-AWARE (#94): the sailing theme now lives under a named SEA layer-gain, with a parallel
// PORT layer-gain hosting a warm tavern drone. The pure resolver in music-director.js maps the
// player's context (mode + port distance) → target gains for those two layers; setMix() ramps
// them so the bed crossfades into a port on approach, settles for a fight, and returns at sea —
// all under the one shared { ctx, master } bus, so the existing mute still covers everything.

import { resolveMix } from './music-director.js';
import { varyMelodyPass, variationPlan, SEA_VARIATION_SEED } from './systems/melody-variation.js';
import { selectCue } from './systems/loop-cues.js';
import { harmonicMood, IONIAN } from './systems/harmonic-mood.js';
import { creakRate, creakGain, shouldCreak, creakGrain, CREAK_IDLE_RATE } from './systems/hull-creak.js';
import { battleLayer, crossfadeGains, nextTransition } from './systems/battle-score.js';

// Per-phase battle crossfade (#158): pre-baked constant-power (equal-power) gain curves the battle-
// layer crossfade rides — sampled from the PURE crossfadeGains() so a phase swap sums to unity loudness
// through the swap (no dip, no click). UP = the incoming act's gain 0→1, DOWN = the outgoing act's 1→0.
const BATTLE_XFADE_N = 33;
const BATTLE_XFADE_UP = new Float32Array(BATTLE_XFADE_N);
const BATTLE_XFADE_DOWN = new Float32Array(BATTLE_XFADE_N);
for (let i = 0; i < BATTLE_XFADE_N; i++) {
  const g = crossfadeGains(i / (BATTLE_XFADE_N - 1));
  BATTLE_XFADE_UP[i] = g.to;
  BATTLE_XFADE_DOWN[i] = g.from;
}

// ---- Pure, browser-free helpers (unit-tested) ----

/** Clamp to [0,1]. */
export function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

/** Seconds per beat (quarter note) for a tempo in BPM. Guards bpm <= 0. */
export function beatDuration(bpm) {
  return bpm > 0 ? 60 / bpm : 0;
}

/** Equal-temperament MIDI note number → frequency (A4/69 = 440 Hz). */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Semitone offsets of the major (Ionian) scale from its root. */
export const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];

const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Scientific note name (e.g. 'D4', 'F#4', 'Bb3') → MIDI number. C4 = 60. */
export function noteNameToMidi(name) {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(String(name).trim());
  if (!m) return 60;
  const letter = m[1].toUpperCase();
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const octave = parseInt(m[3], 10);
  return NOTE_BASE[letter] + accidental + (octave + 1) * 12;
}

/**
 * 1-based diatonic scale degree → MIDI number, wrapping octaves cleanly.
 * degree 1 = root, 3 = third, 8 = octave, 15 = two octaves up.
 * @param {number} degree   1-based scale degree (may exceed 7)
 * @param {number} rootMidi MIDI number of degree 1
 * @param {number[]} [scale] semitone offsets (defaults to major)
 */
export function scaleDegreeToMidi(degree, rootMidi, scale = MAJOR_SCALE) {
  const n = scale.length;
  const idx = Math.round(degree) - 1;
  const octave = Math.floor(idx / n);
  const within = ((idx % n) + n) % n;
  return rootMidi + octave * 12 + scale[within];
}

/** Convenience: scale degree → frequency. */
export function degreeToFreq(degree, rootMidi, scale = MAJOR_SCALE) {
  return midiToFreq(scaleDegreeToMidi(degree, rootMidi, scale));
}

/**
 * Ship speed → musical intensity in [0,1], monotonic non-decreasing. Drives the
 * adaptive layering: 0 = becalmed (lead only, pad silent), 1 = full sail (lead
 * fattens, pad swells in). Guards a zero/negative maxSpeed.
 */
export function speedToIntensity(speed, maxSpeed) {
  return clamp01(maxSpeed > 0 ? speed / maxSpeed : 0);
}

// --- Continuous WAKE/HELM water-bed (#150, the #81 cheap cousin) ---
// A soft, always-on procedural water wash whose loudness tracks how hard the ship is moving water:
// a gentle lap when becalmed, swelling to a full rush at speed, with extra churn thrown when the
// helm is over. Fun-shaping numbers (Game Designer's call) tuned so the wash is *present the moment
// you make way* (concave curve) and never silent (a living sea always laps).

/** Becalmed floor — the gentle lapping that's always there, even hove-to. Soft but audible. */
export const WAKE_FLOOR = 0.08;
/** How much a hard-over helm adds to the wash AT SPEED (churned wake on a turn). */
export const WAKE_HELM_CHURN = 0.14;

/**
 * PURE — ship motion → the wake water-bed's drive gain in [0,1]. Speed-driven (a concave rise that
 * fills early and saturates at full sail, so making way *immediately* sounds wetter) lifted off a
 * small becalmed FLOOR, plus a helm-churn term that only bites while moving (a turn at rest barely
 * laps). Monotonic non-decreasing in speed; clamped; junk/zero/negative inputs fail safe to the
 * floor — never NaN, never throws.
 * @param {number} speed     world units/sec
 * @param {number} maxSpeed  world units/sec at full sail
 * @param {number} [helm]    eased rudder, |helm| in [0,1] (0 = amidships, 1 = hard over)
 * @returns {number} drive gain in [WAKE_FLOOR, 1]
 */
export function wakeBedGain(speed, maxSpeed, helm = 0) {
  const sp = clamp01(maxSpeed > 0 ? (Number(speed) || 0) / maxSpeed : 0);
  const curve = Math.sqrt(sp);                       // concave: audible early, saturates at speed
  const h = clamp01(Math.abs(Number(helm) || 0));
  const churn = WAKE_HELM_CHURN * h * curve;         // a hard turn churns wash — but only when moving
  return clamp01(WAKE_FLOOR + (1 - WAKE_FLOOR) * curve + churn * (1 - curve));
}

// ---- The composition (D major, hornpipe lilt) ----

export const BEATS_PER_BAR = 4;
export const BARS = 8;
export const LOOP_BEATS = BARS * BEATS_PER_BAR; // 32-beat, 8-bar loop

/** Eighth-note grid steps per bar (the scheduler runs on an eighth-note grid). */
export const STEPS_PER_BAR = BEATS_PER_BAR * 2; // 8 grid steps = one bar

/**
 * Is this grid step a bar's downbeat (beat 1)? The bar-clock the landfall stinger quantises to:
 * the "we've made port" punch is held until the next downbeat so it lands ON the beat, never mid-
 * phrase (#102 phase 2). Pure + unit-tested; tolerant of negative/out-of-range steps.
 * @param {number} step grid-step index
 * @param {number} [stepsPerBar] grid steps in a bar
 * @returns {boolean}
 */
export function isDownbeat(step, stepsPerBar = STEPS_PER_BAR) {
  const n = Math.max(1, Math.trunc(stepsPerBar));
  return ((Math.trunc(step) % n) + n) % n === 0;
}

/**
 * The lead melody as a flat list of {deg, beats} events (degrees 1-based in D major,
 * degrees > 7 reach into the upper octave). An A phrase that climbs and a B phrase
 * that answers and cadences home — eight bars so a two-minute sail never tiles.
 */
export function melodyPattern() {
  return [
    // A — bars 1-4: a lilting rise
    { deg: 5, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 8, beats: 1 },
    { deg: 5, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 3, beats: 1 },
    { deg: 2, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 4, beats: 1 },
    { deg: 3, beats: 1 }, { deg: 1, beats: 1 },
    { deg: 5, beats: 0.5 }, { deg: 6, beats: 0.5 }, { deg: 8, beats: 1 },
    { deg: 10, beats: 0.5 }, { deg: 8, beats: 0.5 }, { deg: 7, beats: 1 },
    { deg: 6, beats: 1 }, { deg: 5, beats: 1 }, { deg: 3, beats: 1 }, { deg: 2, beats: 1 },
    // B — bars 5-8: an answering phrase that cadences home
    { deg: 1, beats: 0.5 }, { deg: 3, beats: 0.5 }, { deg: 5, beats: 1 },
    { deg: 6, beats: 0.5 }, { deg: 5, beats: 0.5 }, { deg: 3, beats: 1 },
    { deg: 4, beats: 0.5 }, { deg: 5, beats: 0.5 }, { deg: 6, beats: 1 },
    { deg: 5, beats: 1 }, { deg: 3, beats: 1 },
    { deg: 2, beats: 0.5 }, { deg: 4, beats: 0.5 }, { deg: 6, beats: 1 },
    { deg: 5, beats: 0.5 }, { deg: 4, beats: 0.5 }, { deg: 3, beats: 1 },
    { deg: 2, beats: 1 }, { deg: 5, beats: 1 }, { deg: 1, beats: 2 },
  ];
}

/**
 * One chord root per bar (1-based degrees in D major): a I–V–I–IV / vi–IV–V–I
 * progression — D A D G / Bm G A D — the harmonic backbone for bass + pad.
 */
export function bassPattern() {
  return [1, 5, 1, 4, 6, 4, 5, 1];
}

// ---- Audio engine (browser-only; nothing here runs at import time) ----

const ROOT = noteNameToMidi('D4'); // 62 — tune the whole theme from here
const TEMPO = 108; // BPM — a comfortable, jaunty sailing pace

/**
 * Create the music system. Returns:
 *   start(bus)    build the music graph under a shared { ctx, master } and run the loop
 *   setMute(b)    follow the shared mute (ramps the music sub-gain; pauses note scheduling)
 *   update(state) per-frame { speed, maxSpeed[, mood] } — maps speed → adaptive intensity
 *
 * Every method is a no-op until start() is handed a live context, and guarded so a
 * headless run (no gesture → no audio engine → start() never called) never throws.
 */
export function createMusic() {
  let ctx = null;
  let master = null;        // shared master gain from audio.js
  let musicGain = null;     // master music sub-gain under the bus (mute covers it)
  let seaLayerGain = null;  // the sailing theme lives here (mode-aware mix, #94)
  let recolourGain = null;  // the harmonic-needle recolour lead lives here (#132 Slice B); crossfades up with |lean|
  let recolourBus = null;   // the recolour lead's pre-gain bus (its own softening lowpass), parallel to leadBus
  let recolourState = { pole: 'neutral', blend: 0, scale: IONIAN }; // live modal-recolour cast (QA surface; headless-safe)
  // Per-phase battle signatures (#158): each raid act (⚔ Maneuver / 🪝 Boarding / 🗣 Duel) voices the
  // SAME lead melody a THIRD time in the act's distinct mode/register into a battle-layer bus, riding a
  // bar-quantised, constant-power crossfade on the phase transition — so you HEAR which act you're in.
  // Two parallel lead buses (A/B) let one act cross-fade OUT as the next fades IN. All under a battle
  // layer-gain hung off musicGain (NOT seaLayerGain — the honest bed ducks in a fight while THIS swells).
  let battleLayerGain = null;                 // overall battle-layer presence (drive-scaled; 0 at sea) → musicGain
  let battleBusA = null, battleBusB = null;   // the two parallel lead buses voiceLead() renders battle notes into
  let battleGainA = null, battleGainB = null; // the per-bus crossfade gains (constant-power A↔B on a swap)
  const battleBusScale = { A: IONIAN, B: IONIAN };  // the scale each bus is currently voicing
  const battleBusOctave = { A: 0, B: 0 };           // the register (octave shift) each bus is voicing
  let battleActiveBus = 'A';                  // which bus carries the committed act
  let committedBattleAct = null;              // the act currently SOUNDING (lags the live act until a downbeat)
  let pendingBattleAct = null;                // the act the fight is in this frame (from update(); the swap target)
  let battleOutBus = null;                    // the bus fading OUT during a crossfade (or null)
  let battleOutStepsLeft = 0;                 // grid steps still voicing the outgoing bus (the crossfade tail)
  let battleActState = battleLayer(null);     // QA surface: the live battle-layer cast {act,scale,drive,octave}; headless-safe
  const BATTLE_XFADE_STEPS = 4;               // crossfade span (half a bar) — both buses voiced through it
  let portLayerGain = null; // the tavern/port drone lives here (swells on approach, #94)
  let portLP = null;        // the port drone's lowpass — per-town timbre tint (#69)
  let portTremLfo = null;   // the bellows wheeze LFO — per-town tremolo rate (#69)
  let portChordOscs = null; // the 4 drone oscillators — re-tuned per town (transposition, #69)
  let currentTownTheme = null; // the last per-town identity set (applied on start once the engine is up)
  let leadBus = null;       // soft lowpass colouring the lead
  // Continuous WAKE/HELM water-bed (#150): one always-on filtered-noise wash under musicGain whose
  // gain is driven each frame from ship speed + helm — fuller at speed, a gentle lap when becalmed.
  // The pure drive (wakeBedGain) is computed every frame even headless (no ctx) and stored on
  // `wakeDrive` so a playtest can assert the wash tracks the helm WITHOUT opening an AudioContext.
  let wakeGain = null;      // the water-bed's own gain node under musicGain (mute covers it)
  let wakeDrive = WAKE_FLOOR; // QA surface: the last pure drive [0,1], headless-assertable
  // Procedural HULL-CREAK voice (#81): sparse resonant noise grains — the ship working in the swell —
  // layered UNDER the wake-bed. The pure creak RATE + grain GAIN (systems/hull-creak.js) are recomputed
  // every frame from speed + helm + wave, even headless (no ctx), and stored so a playtest can assert
  // the creak quickens with the drivers WITHOUT an AudioContext. The scheduler rolls the grains.
  let creakGain_ = null;    // the creak layer's own gain node under musicGain (mute covers it)
  let creakNoise = null;    // one shared noise buffer, the raw excitation for every grain
  let creakRateLive = CREAK_IDLE_RATE; // QA surface: the last pure creak rate (creaks/sec), headless-assertable
  let creakGainLive = 0;    // the last pure grain intensity [0,1], read at grain-schedule time
  let started = false;
  let muted = false;
  let intensity = 0;      // 0..1, set by update() from ship speed
  let schedulerId = null;
  let stingerArmed = false; // landfall "we've made port" punch, fired on the next downbeat (#102 ph2)
  // Reactive-loop diegetic cues (#116): a tiny pure recipe (listen/approach/payoff/loss) armed by
  // loopCue(name) and fired ON the next bar downbeat so it nods WITH the music, not over it. Only the
  // latest pending cue is held (loop beats are spaced — no queue needed). `lastLoopCue` records the
  // last cue NAME armed regardless of mute/engine state, so a headless playtest can assert which
  // beat sang without ever opening an AudioContext.
  let pendingCue = null;    // a render recipe from selectCue(), waiting for the next downbeat
  let pendingUnder = null;  // an optional layer (e.g. the coin chime) fired WITH pendingCue (#116 f/u)
  let lastLoopCue = null;   // QA surface: the name of the most recently armed loop cue
  let lastUnderCue = null;  // QA surface: the name of the most recently armed layered cue (or null)

  const beatSec = beatDuration(TEMPO);
  const stepSec = beatSec * 0.5;            // eighth-note scheduler grid
  const TOTAL_STEPS = LOOP_BEATS * 2;       // 64 grid steps
  const BASE_LEVEL = 0.55;                  // music sits under the sea ambience

  // Pre-baked per-step event lists, built once on start().
  let leadByStep = null;
  let bassByStep = null;
  let chordByStep = null;
  let step = 0;
  let nextNoteTime = 0;
  let pass = 0;                              // 0-based loop counter; drives seeded per-pass variation (#117)
  const variationSeed = SEA_VARIATION_SEED;  // deterministic: same seed → same variation sequence

  // (Re)lay the lead melody onto the eighth-note grid from a note list. Called once per pass with a
  // seeded per-pass variation (#117) so each 32-beat loop glints differently while staying in key —
  // only `deg` changes between passes, never timing, so the grid mapping is identical pass-to-pass.
  function buildLeadSchedule(notes) {
    for (let i = 0; i < TOTAL_STEPS; i++) leadByStep[i] = [];
    let beat = 0;
    for (const note of notes) {
      const s = Math.round(beat * 2) % TOTAL_STEPS;
      leadByStep[s].push({ deg: note.deg, durSec: note.beats * beatSec });
      beat += note.beats;
    }
  }

  function buildSchedule() {
    leadByStep = Array.from({ length: TOTAL_STEPS }, () => []);
    bassByStep = Array.from({ length: TOTAL_STEPS }, () => []);
    chordByStep = Array.from({ length: TOTAL_STEPS }, () => []);

    // Lead melody → grid. Pass 0 is the canonical, unvaried composition.
    buildLeadSchedule(varyMelodyPass(melodyPattern(), pass, { seed: variationSeed }));

    // Bass pulse (roots on beats 1 & 3) + chord pad (triad on the downbeat) per bar.
    const roots = bassPattern();
    for (let bar = 0; bar < BARS; bar++) {
      const rootDeg = roots[bar];
      const downbeat = bar * BEATS_PER_BAR;
      const s0 = Math.round(downbeat * 2) % TOTAL_STEPS;
      const s2 = Math.round((downbeat + 2) * 2) % TOTAL_STEPS;
      // Bass an octave below the lead's root register.
      bassByStep[s0].push({ deg: rootDeg - 7, durSec: 1.4 * beatSec });
      bassByStep[s2].push({ deg: rootDeg - 7, durSec: 1.2 * beatSec });
      // Diatonic triad (root, third, fifth) as a soft pad.
      chordByStep[s0].push({
        degs: [rootDeg, rootDeg + 2, rootDeg + 4],
        durSec: BEATS_PER_BAR * beatSec * 0.95,
      });
    }
  }

  // --- Voices ---

  // The lead voice. `bus` defaults to the neutral leadBus (the canonical D-major hornpipe); the
  // harmonic needle (#132 Slice B) renders a SECOND, identically-shaped voice of the SAME melody into
  // recolourBus, tuned to the pole's mode — the recolourGain crossfade (not a second timbre) carries it.
  function voiceLead(time, freq, durSec, bus = leadBus) {
    const peak = 0.16 * (0.55 + 0.45 * intensity); // present at rest, fuller at speed
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    const end = time + durSec;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.012);   // pluck attack
    env.gain.exponentialRampToValueAtTime(0.0001, end);          // decay/release
    osc.connect(env).connect(bus); // leadBus/recolourBus → seaLayerGain → musicGain (mute + port-duck cover it)
    osc.start(time);
    osc.stop(end + 0.02);
  }

  function voiceBass(time, freq, durSec) {
    const peak = 0.12 * (0.7 + 0.3 * intensity);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    const end = time + durSec;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(env).connect(seaLayerGain);
    osc.start(time);
    osc.stop(end + 0.02);
  }

  function voiceChord(time, freqs, durSec) {
    // The adaptive layer: silent when becalmed, swells in as you make way.
    const layer = clamp01((intensity - 0.12) / 0.88);
    if (layer <= 0.001) return;
    const peak = 0.045 * layer;
    const end = time + durSec;
    for (const f of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(peak, time + 0.08); // soft pad swell
      env.gain.setValueAtTime(peak, end - 0.12);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(env).connect(seaLayerGain);
      osc.start(time);
      osc.stop(end + 0.02);
    }
  }

  // A couple of seconds of white noise, looped — the raw material for the wake water-bed.
  function makeNoiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // The continuous WAKE/HELM water-bed (#150, the #81 cheap cousin): one always-on layer of
  // lowpassed looping noise — the rush of water under the hull — with a slow swell LFO so it breathes
  // and never tiles audibly. Built once on start() and left running; its gain rides the pure
  // wakeBedGain() drive (speed + helm) set each frame by update(). Routes through musicGain so the
  // existing mute AND the per-frame intensity swell already cover it. Cheap: one source + filter + LFO.
  const WAKE_PEAK = 0.16; // node-gain ceiling — the wash sits UNDER the melody, never masks it
  function buildWakeBed() {
    wakeGain = ctx.createGain();
    wakeGain.gain.value = WAKE_PEAK * wakeDrive; // start at the becalmed lap, not silent
    wakeGain.connect(musicGain);

    const noise = makeNoiseBuffer(2.0);
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 620;  // dark, watery — the wash under the hull, not hiss
    lp.Q.value = 0.5;
    src.connect(lp).connect(wakeGain);

    // A slow swell so the wash rises and falls like a living sea (detuned from audio.js's wave LFO
    // so the two never phase-lock into an audible loop).
    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = 0.085;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.02;
    swell.connect(swellDepth).connect(wakeGain.gain);
    swell.start();

    src.start();
  }

  // The HULL-CREAK layer (#81): build one gain node + a shared noise buffer, then let the scheduler
  // sprinkle short grains through it. A grain = a burst of that noise → a resonant bandpass at the
  // grain's hull-mode frequency → a fast-attack/short-decay envelope: a single soft wooden creak.
  // Routes through musicGain (mute + the intensity swell cover it); sits UNDER the wake-bed. Cheap:
  // one persistent node + a couple of throwaway nodes per (sparse) grain.
  const CREAK_PEAK = 0.11; // node-gain ceiling — a creak is felt more than heard, well under the melody
  function buildCreakBed() {
    creakGain_ = ctx.createGain();
    creakGain_.gain.value = CREAK_PEAK;
    creakGain_.connect(musicGain);
    creakNoise = makeNoiseBuffer(1.0);
  }

  // Render ONE creak grain at `time`: a short filtered-noise transient shaped by the pure grain
  // descriptor (freq/dur) and the live grain intensity. A bad grain must never break the frame.
  function voiceCreak(time, grain, gain) {
    if (muted || !ctx || !creakGain_ || !creakNoise) return;
    try {
      const dur = Number(grain?.dur) || 0.3;
      const freq = Number(grain?.freq) || 150;
      const src = ctx.createBufferSource();
      src.buffer = creakNoise;
      // Start at a random offset into the shared buffer so repeated grains never share a transient.
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = freq;
      bp.Q.value = 9;            // resonant — a pitched groan, not a hiss
      const env = ctx.createGain();
      const peak = Math.max(0.0001, CREAK_PEAK * clamp01(gain));
      const end = time + dur;
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(peak, time + 0.02); // a quick woody knock
      env.gain.exponentialRampToValueAtTime(0.0001, end);       // groan away
      src.connect(bp).connect(env).connect(creakGain_);
      src.start(time);
      src.stop(end + 0.03);
    } catch {
      /* a creak is ambience — never break the frame */
    }
  }

  // --- Port/tavern layer (#94): a warm, lowpassed D-major chord drone with a gentle
  // accordion-bellows tremolo — the "auditory image" of a harbour. Built once on start() and
  // left running; it stays silent (portLayerGain ≈ 0) until you near a port, when setMix()
  // swells it up. Cheap (a handful of sustained oscillators), shares the master + mute.
  function buildPortLayer() {
    portLayerGain = ctx.createGain();
    portLayerGain.gain.value = 0;        // silent until you approach a port
    portLayerGain.connect(musicGain);

    portLP = ctx.createBiquadFilter();
    portLP.type = 'lowpass';
    portLP.frequency.value = 1400;       // warm, woody default; per-town tint re-aims it (#69)
    portLP.connect(portLayerGain);

    // Accordion-bellows tremolo over the whole pad (its rate is a per-town flavour, #69).
    const trem = ctx.createGain();
    trem.gain.value = 0.7;
    trem.connect(portLP);
    portTremLfo = ctx.createOscillator();
    portTremLfo.type = 'sine';
    portTremLfo.frequency.value = 2.6;   // a cosy wheeze
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.18;
    portTremLfo.connect(lfoDepth).connect(trem.gain);
    portTremLfo.start();

    // A warm D-major chord drone (tonic / third / fifth / octave), softly detuned for body — the
    // DEFAULT key centre (matches the sailing theme). setTownTheme() re-tunes these four oscillators
    // per port so each town sounds like itself (#69); the oscillators persist (no clicks).
    const chord = [
      noteNameToMidi('D3'), noteNameToMidi('F#3'),
      noteNameToMidi('A3'), noteNameToMidi('D4'),
    ];
    const detunes = [-4, 3, -2, 5];
    portChordOscs = chord.map((midi, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = midiToFreq(midi);
      osc.detune.value = detunes[i];
      const g = ctx.createGain();
      g.gain.value = 0.05;               // each voice soft; the layer gain rides the swell
      osc.connect(g).connect(trem);
      osc.start();
      return osc;
    });
  }

  // Landfall stinger (#102 ph2): a bright, bell-like D-major arpeggio swell — the single "we've
  // made port" punch (DL#2 juice on the *transition*). Fired ONCE on the next bar downbeat so it
  // lands on the beat as the gesture eases ashore. Routes through musicGain, so the mute covers it.
  function voiceStinger(time) {
    if (muted) return;
    // A rising D-major spread (tonic→third→fifth→octave) with a soft mallet attack and long tail.
    const degs = [1, 3, 5, 8];
    degs.forEach((deg, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = degreeToFreq(deg, ROOT + 12); // an octave up — bright, bell-like
      const env = ctx.createGain();
      const at = time + i * 0.06;       // gentle upward roll
      const peak = 0.16 * (1 - i * 0.12);
      env.gain.setValueAtTime(0.0001, at);
      env.gain.exponentialRampToValueAtTime(peak, at + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, at + 1.2); // long shimmering tail
      osc.connect(env).connect(musicGain);
      osc.start(at);
      osc.stop(at + 1.3);
    });
  }

  // Reactive-loop cue renderer (#116): play a pure recipe (from src/systems/loop-cues.js) as a short
  // note gesture in the bed's own key — so the LISTEN/APPROACH/PAYOFF/LOSS beats sing diegetically
  // with the music. Routes through musicGain (the mute covers them). `degs` are diatonic D-major scale
  // degrees (bright, in-key); `semis` are raw chromatic semitone offsets from the root (the sour LOSS
  // stab steps OUT of the major). A bad recipe must never break the frame.
  function voiceLoopCue(recipe, time) {
    if (muted || !recipe) return;
    try {
      const oct = (Number(recipe.octave) || 0) * 12;
      const notes = Array.isArray(recipe.degs)
        ? recipe.degs.map((d) => degreeToFreq(d, ROOT + oct))
        : Array.isArray(recipe.semis)
          ? recipe.semis.map((s) => midiToFreq(ROOT + oct + s))
          : [];
      const step = Number(recipe.step) || 0.1;
      const dur = Number(recipe.dur) || 0.4;
      const tail = Number(recipe.tail) || 0.5;
      const peak = Number(recipe.gain) || 0.08;
      notes.forEach((freq, i) => {
        if (!Number.isFinite(freq) || freq <= 0) return;
        const osc = ctx.createOscillator();
        osc.type = recipe.type || 'sine';
        osc.frequency.value = freq;
        if (Number.isFinite(recipe.detune)) osc.detune.value = recipe.detune;
        const env = ctx.createGain();
        const at = time + i * step;
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(peak, at + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, at + dur + tail);
        // Optional darkening lowpass for the sour cue (a wry, muffled blunder colour).
        let sink = musicGain;
        if (Number.isFinite(recipe.lowpass)) {
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = recipe.lowpass;
          lp.connect(musicGain);
          sink = lp;
        }
        osc.connect(env).connect(sink);
        osc.start(at);
        osc.stop(at + dur + tail + 0.05);
      });
    } catch {
      /* a cue is a flourish — never break the frame */
    }
  }

  function fireStep(s, time) {
    if (muted) return; // silent + cheap while muted; the grid clock keeps advancing
    try {
      // The harmonic needle (#132 Slice B): when the recolour crossfade is audible, voice the SAME
      // lead melody a SECOND time in the pole's mode (read live from recolourState.scale) into the
      // recolourGain. The bass + chord pad below stay FIXED in D major (the DL#3 trap) — only the lead
      // recolours. Cheap when neutral (blend 0 → skip the extra oscillators entirely).
      const recolour = recolourState.blend > 0.001 && recolourState.scale && recolourState.scale !== IONIAN;
      // Per-phase battle layer (#158): when a raid act is committed, voice the SAME melody a third time
      // in the act's distinct mode + register into the active battle bus; during a crossfade, ALSO voice
      // the outgoing act's mode into the fading bus so the two acts overlap (a true equal-power swap).
      const inBattle = !!committedBattleAct;
      const activeBusNode = inBattle ? (battleActiveBus === 'A' ? battleBusA : battleBusB) : null;
      const activeScale = inBattle ? battleBusScale[battleActiveBus] : null;
      const activeOct = inBattle ? battleBusOctave[battleActiveBus] * 12 : 0;
      const fading = battleOutStepsLeft > 0 && battleOutBus;
      const outBusNode = fading ? (battleOutBus === 'A' ? battleBusA : battleBusB) : null;
      const outScale = fading ? battleBusScale[battleOutBus] : null;
      const outOct = fading ? battleBusOctave[battleOutBus] * 12 : 0;
      for (const n of leadByStep[s]) {
        voiceLead(time, degreeToFreq(n.deg, ROOT), n.durSec);
        if (recolour) voiceLead(time, degreeToFreq(n.deg, ROOT, recolourState.scale), n.durSec, recolourBus);
        if (inBattle && activeBusNode) voiceLead(time, degreeToFreq(n.deg, ROOT + activeOct, activeScale), n.durSec, activeBusNode);
        if (fading && outBusNode) voiceLead(time, degreeToFreq(n.deg, ROOT + outOct, outScale), n.durSec, outBusNode);
      }
      for (const n of bassByStep[s]) voiceBass(time, degreeToFreq(n.deg, ROOT), n.durSec);
      for (const c of chordByStep[s]) {
        voiceChord(time, c.degs.map((d) => degreeToFreq(d, ROOT)), c.durSec);
      }
    } catch {
      /* a bad note must never break the frame */
    }
  }

  // Lookahead scheduler: queue notes a hair ahead of the clock so the loop is seamless.
  function scheduler() {
    if (!ctx) return;
    try {
      const lookahead = 0.12;
      while (nextNoteTime < ctx.currentTime + lookahead) {
        // Landfall stinger (#102 ph2): when armed, fire ON the next bar downbeat, then disarm.
        if (stingerArmed && isDownbeat(step, STEPS_PER_BAR)) { voiceStinger(nextNoteTime); stingerArmed = false; }
        // Reactive-loop cue (#116): a pending listen/approach/payoff/loss recipe fires on the next
        // downbeat too, then disarms — so the diegetic feedback lands on the beat with the bed. An
        // optional layered cue (the coin chime, #116 f/u) rides the SAME downbeat under the primary.
        if (isDownbeat(step, STEPS_PER_BAR)) {
          if (pendingCue) { voiceLoopCue(pendingCue, nextNoteTime); pendingCue = null; }
          if (pendingUnder) { voiceLoopCue(pendingUnder, nextNoteTime); pendingUnder = null; }
          // Per-phase battle swap (#158): a raid act change is HELD until here, then fires ON the beat
          // (bar-quantised) — the constant-power layer crossfade lands like a composed cue, not a cut.
          const trans = nextTransition({ committed: committedBattleAct, target: pendingBattleAct, step, stepsPerBar: STEPS_PER_BAR });
          if (trans.fire) commitBattleAct(trans.act, stepSec * BATTLE_XFADE_STEPS);
        }
        fireStep(step, nextNoteTime);
        // Age the battle crossfade tail one step; when spent, stop voicing the outgoing act's bus (#158).
        if (battleOutStepsLeft > 0) { battleOutStepsLeft -= 1; if (battleOutStepsLeft === 0) battleOutBus = null; }
        // Hull-creak (#81): roll ONE sparse grain per grid step off the live pure rate — the ship
        // working in the swell, quicker under sail / a hard helm / a heavy sea. Muted covers it (the
        // grain routes through musicGain) but skip the roll when muted to stay cheap.
        if (!muted && creakRateLive > 0 && shouldCreak(creakRateLive, stepSec, Math.random())) {
          voiceCreak(nextNoteTime, creakGrain(Math.random), creakGainLive);
        }
        nextNoteTime += stepSec;
        const nextStep = (step + 1) % TOTAL_STEPS;
        // At the seam of a pass, re-lay the lead with the NEXT pass's seeded variation (#117) before
        // we schedule its first step — so each 32-beat loop of the sea theme differs subtly in key.
        if (nextStep === 0) {
          pass += 1;
          buildLeadSchedule(varyMelodyPass(melodyPattern(), pass, { seed: variationSeed }));
        }
        step = nextStep;
      }
    } catch {
      /* keep the clock alive even if a tick misfires */
    }
  }

  // --- Public API ---

  function start(bus) {
    if (started) return;
    try {
      if (!bus || !bus.ctx || !bus.master) return; // no shared engine → stay inert
      ctx = bus.ctx;
      master = bus.master;

      musicGain = ctx.createGain();
      musicGain.gain.value = muted ? 0.0001 : BASE_LEVEL;
      musicGain.connect(master);

      // The sailing theme lives under its own SEA layer-gain (full at sea); the PORT layer is
      // built silent and swells in on approach. setMix() crossfades the two (mode-aware, #94).
      seaLayerGain = ctx.createGain();
      seaLayerGain.gain.value = 1;
      seaLayerGain.connect(musicGain);

      leadBus = ctx.createGain();
      leadBus.gain.value = 1;
      const leadLP = ctx.createBiquadFilter();
      leadLP.type = 'lowpass';
      leadLP.frequency.value = 3200; // soften the triangle's edge into a sweeter lead
      leadBus.connect(leadLP).connect(seaLayerGain);

      // The harmonic-needle recolour lead (#132 Slice B): a parallel lead bus → its own softening
      // lowpass → recolourGain → seaLayerGain. Built SILENT (gain 0 = the honest D-major bed,
      // untouched at neutral); setMood() crossfades it up with |lean| while the neutral leadBus ducks
      // complementarily. Sits UNDER seaLayerGain → musicGain, so the mute AND the port-duck both cover it.
      recolourGain = ctx.createGain();
      recolourGain.gain.value = 0;
      recolourGain.connect(seaLayerGain);
      recolourBus = ctx.createGain();
      recolourBus.gain.value = 1;
      const recolourLP = ctx.createBiquadFilter();
      recolourLP.type = 'lowpass';
      recolourLP.frequency.value = 3200; // same softening as the neutral lead so they crossfade cleanly
      recolourBus.connect(recolourLP).connect(recolourGain);
      // Apply any lean set before the engine came up so the recolour is already cast on the first note.
      setMood(recolourState);

      // Per-phase battle layer (#158): one battle layer-gain off musicGain (silent at sea), with two
      // parallel lead buses (A/B) → their own softening lowpass → per-bus crossfade gains, so one raid
      // act can fade OUT while the next fades IN (constant-power). Voiced into musicGain directly, NOT
      // seaLayerGain, so a fight ducks the honest bed (resolveMix BATTLE) while THIS act layer swells.
      battleLayerGain = ctx.createGain();
      battleLayerGain.gain.value = 0;          // no battle layer until a raid act arms it
      battleLayerGain.connect(musicGain);
      const buildBattleBus = (startGain) => {
        const g = ctx.createGain();            // the crossfade gain (A↔B)
        g.gain.value = startGain;
        g.connect(battleLayerGain);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 3200;             // same softening as the neutral/recolour leads
        const bus = ctx.createGain();          // the input voiceLead() renders into
        bus.gain.value = 1;
        bus.connect(lp).connect(g);
        return { bus, gain: g };
      };
      { const a = buildBattleBus(1); battleBusA = a.bus; battleGainA = a.gain; }
      { const b = buildBattleBus(0); battleBusB = b.bus; battleGainB = b.gain; }

      buildWakeBed();
      buildCreakBed();
      buildPortLayer();
      // Apply any per-town identity chosen before the engine came up (#69) — so the drone is
      // already in the nearest port's key the instant the audio bus starts.
      if (currentTownTheme) setTownTheme(currentTownTheme);

      pass = 0;
      buildSchedule();
      step = 0;
      nextNoteTime = ctx.currentTime + 0.12;
      started = true;

      if (typeof setInterval === 'function') {
        schedulerId = setInterval(scheduler, 25);
      }
      scheduler();
    } catch {
      ctx = null;
      master = null;
      musicGain = null;
      seaLayerGain = null;
      recolourGain = null;
      recolourBus = null;
      battleLayerGain = null;
      battleBusA = null;
      battleBusB = null;
      battleGainA = null;
      battleGainB = null;
      wakeGain = null;
      creakGain_ = null;
      creakNoise = null;
      portLayerGain = null;
      portLP = null;
      portTremLfo = null;
      portChordOscs = null;
      started = false;
    }
  }

  // Ramp the two named layer-gains toward the resolver's target mix — the crossfade between the
  // open-sea bed and a port's tavern layer (and the settle for a fight). setTargetAtTime keeps
  // every change a smooth glide, never a click; a no-op until the engine is up.
  function setMix({ sea = 1, port = 0 } = {}) {
    if (!ctx || !seaLayerGain || !portLayerGain) return;
    try {
      const now = ctx.currentTime;
      seaLayerGain.gain.setTargetAtTime(clamp01(sea), now, 0.6);
      portLayerGain.gain.setTargetAtTime(clamp01(port), now, 0.6);
    } catch {
      /* a bad frame must never throw */
    }
  }

  // The harmonic reputation needle (#132 Slice B): recolour the lead's MODE off the signed reputation
  // lean. Stores the live cast (so the QA getter + a pre-engine call work headless), then — once the
  // engine is up — crossfades the ONE needle knob: ramp recolourGain → blend and duck the neutral
  // leadBus → 1-blend, complementarily, as a smooth setTargetAtTime glide (never a click). The scale
  // itself swaps only while that gain is near-silent (blend≈0 at neutral), so a pole flip never clashes.
  // The bass + chord/percussive bed are untouched (the DL#3 trap). Safe before the engine + on junk.
  function setMood(mood) {
    const m = mood && Array.isArray(mood.scale) ? mood : { pole: 'neutral', blend: 0, scale: IONIAN };
    recolourState = { pole: m.pole || 'neutral', blend: clamp01(Number(m.blend) || 0), scale: m.scale };
    if (!ctx || !recolourGain || !leadBus) return;
    try {
      const now = ctx.currentTime;
      recolourGain.gain.setTargetAtTime(recolourState.blend, now, 0.6);
      leadBus.gain.setTargetAtTime(clamp01(1 - recolourState.blend), now, 0.6); // a wisp of the honest theme survives
    } catch {
      /* a bad frame must never throw */
    }
  }

  // Per-phase battle signatures (#158): set the raid ACT the fight is in this frame (⚔ maneuver / 🪝
  // boarding / 🗣 duel — from raidPhaseModel().actKey, or null at sea). Stores the pure battle-layer
  // cast for the QA surface (headless-safe — no ctx needed) and arms it as the crossfade TARGET; the
  // scheduler commits the swap on the next bar downbeat (bar-quantised). Called every frame by update().
  function setBattleAct(actKey) {
    const layer = battleLayer(actKey);
    battleActState = layer;
    pendingBattleAct = layer.act; // null when outside a raid → the battle layer fades away
  }

  // Commit a phase swap (#158): the scheduler calls this ON a bar downbeat when the live act differs
  // from the sounding one. Voices the incoming act's mode/register into the idle bus, then cross-fades
  // the two per-bus gains along the pre-baked constant-power curves while the battle layer-gain rides to
  // the new act's drive — so the layer swap lands on the beat, equal-power, no click. The FIXED D-major
  // bass+pad below are untouched (the #132 discipline — no percussive bed, no loadTrack). Never throws.
  function commitBattleAct(act, xfadeSec) {
    const layer = battleLayer(act);
    const inc = battleActiveBus === 'A' ? 'B' : 'A';
    const out = battleActiveBus;
    battleBusScale[inc] = layer.scale;
    battleBusOctave[inc] = layer.octave;
    const gIn = inc === 'A' ? battleGainA : battleGainB;
    const gOut = out === 'A' ? battleGainA : battleGainB;
    try {
      const now = ctx.currentTime;
      const dur = Math.max(0.05, Number(xfadeSec) || 0.5);
      gIn.gain.cancelScheduledValues(now);
      gOut.gain.cancelScheduledValues(now);
      gIn.gain.setValueCurveAtTime(BATTLE_XFADE_UP, now, dur);
      gOut.gain.setValueCurveAtTime(BATTLE_XFADE_DOWN, now, dur);
      battleLayerGain.gain.setTargetAtTime(layer.drive, now, 0.35);
    } catch {
      // A curve can throw if it overlaps a prior one — fall back to a plain glide (never break the clock).
      try { gIn.gain.setTargetAtTime(1, ctx.currentTime, 0.3); gOut.gain.setTargetAtTime(0, ctx.currentTime, 0.3); battleLayerGain.gain.setTargetAtTime(layer.drive, ctx.currentTime, 0.35); } catch { /* ignore */ }
    }
    battleOutBus = layer.act ? out : out; // keep voicing the outgoing tail even when leaving battle
    battleOutStepsLeft = BATTLE_XFADE_STEPS;
    battleActiveBus = inc;
    committedBattleAct = layer.act;
  }

  // Per-town music identity (#69): re-voice the tavern drone toward a port's identity — transpose
  // the four chord oscillators to its key/mode (chordMidi), re-aim the lowpass to its timbre tint
  // and the LFO to its wheeze rate. Every change is a smooth setTargetAtTime GLIDE (a click-free
  // crossfade, debounced to the nearest port by the caller). TEMPO is untouched this slice (the
  // scheduler is left alone — TL constraint). Safe before the engine is up: it just stores the
  // identity, which start() applies once the bus exists. A bad identity never throws.
  function setTownTheme(identity) {
    if (!identity) return;
    currentTownTheme = identity;
    if (!ctx || !portChordOscs) return;
    try {
      const now = ctx.currentTime;
      const tc = 0.6; // glide ~matches the layer crossfade — re-keying a town never clicks
      const chord = Array.isArray(identity.chordMidi) ? identity.chordMidi : [];
      portChordOscs.forEach((osc, i) => {
        const f = midiToFreq(chord[i]);
        if (Number.isFinite(f) && f > 0) osc.frequency.setTargetAtTime(f, now, tc);
      });
      if (portLP && Number.isFinite(identity.lowpassHz)) {
        portLP.frequency.setTargetAtTime(identity.lowpassHz, now, tc);
      }
      if (portTremLfo && Number.isFinite(identity.tremoloHz)) {
        portTremLfo.frequency.setTargetAtTime(identity.tremoloHz, now, tc);
      }
    } catch {
      /* a bad theme must never break the frame */
    }
  }

  function setMute(b) {
    muted = !!b;
    if (!ctx || !musicGain) return;
    try {
      musicGain.gain.setTargetAtTime(muted ? 0.0001 : BASE_LEVEL, ctx.currentTime, 0.04);
    } catch {
      try {
        musicGain.gain.value = muted ? 0.0001 : BASE_LEVEL;
      } catch {
        /* ignore */
      }
    }
  }

  function update(state) {
    // Safe to call every frame, even before the engine is up.
    try {
      const speed = Number(state?.speed) || 0;
      const maxSpeed = Number(state?.maxSpeed) || 55;
      intensity = speedToIntensity(speed, maxSpeed);

      // Continuous WAKE/HELM water-bed (#150): the pure drive (speed + |helm|) is computed EVERY
      // frame, even headless (no ctx) — stored for the QA surface — BEFORE the engine-up early return,
      // so a playtest can swing the helm and assert the wash tracks it without an AudioContext.
      wakeDrive = wakeBedGain(speed, maxSpeed, state?.rudder);

      // Hull-creak (#81): the pure creak RATE + grain GAIN are recomputed EVERY frame from speed +
      // helm + wave height (the swell scale she's riding), even headless (no ctx) — stored here BEFORE
      // the engine-up early return so a playtest can make way / swing the helm and assert the creak
      // quickens without an AudioContext. The scheduler reads these to sprinkle grains when the bus is up.
      creakRateLive = creakRate(speed, maxSpeed, state?.rudder, state?.wave);
      creakGainLive = creakGain(speed, maxSpeed, state?.rudder, state?.wave);

      // Mode-aware mix (#94): the pure resolver maps WHERE the player is (mode + port distance)
      // → per-layer target gains; setMix ramps the sea/port crossfade. Safe with partial state
      // (defaults to the open-sea bed), so legacy callers keep the sailing theme unchanged.
      setMix(resolveMix({
        mode: state?.mode,
        portDistance: state?.portDistance,
        dockRadius: state?.dockRadius,
      }));

      // Harmonic reputation needle (#132 Slice B): the SAME signed lean (repLean) that grimes the hull
      // (Slice A) recolours the lead's mode. Pure map → live crossfade. Runs every frame, even headless
      // (no ctx → stores the cast for the QA surface, no audio), BEFORE the engine-up early return.
      setMood(harmonicMood(Number(state?.lean) || 0));

      // Per-phase battle signatures (#158): the raid act the fight is in (⚔/🪝/🗣, or null at sea) arms
      // the battle-layer crossfade target. Pure + headless-safe (stores the QA cast even with no ctx),
      // BEFORE the engine-up early return, so a playtest can drive a fight and assert the act→layer map.
      setBattleAct(state?.raidAct);

      if (!ctx || !musicGain || muted) return;
      // Gentle overall swell with intensity, on top of the per-note adaptivity.
      const now = ctx.currentTime;
      musicGain.gain.setTargetAtTime(BASE_LEVEL * (0.85 + 0.15 * intensity), now, 0.5);
      // Ride the wake water-bed to its speed/helm-driven drive — a smooth glide so a gust of speed
      // or a swung helm wells the wash up without zippering (#150).
      if (wakeGain) wakeGain.gain.setTargetAtTime(WAKE_PEAK * wakeDrive, now, 0.4);
    } catch {
      /* a bad frame must never throw */
    }
  }

  // Arm the landfall stinger (#102 ph2): the "we've made port" punch fires on the NEXT bar
  // downbeat (quantised to the bar-clock, so it lands on the beat). Safe to call before the engine
  // is up — it just arms a flag the scheduler reads once the music is running and unmuted.
  function stinger() { stingerArmed = true; }

  // Arm a reactive-loop diegetic cue (#116): listen / approach / payoff / loss (and the listen
  // colours). Resolves the pure recipe (src/systems/loop-cues.js) and holds it for the next bar
  // downbeat (the scheduler fires + disarms it). An optional `opts.under` arms a SECOND recipe (the
  // coin chime) layered on the SAME downbeat under the primary — armed together so it never rides a
  // later, unrelated cue. Records names regardless of mute/engine state so a headless playtest can
  // assert which beats sang. An unknown name is a no-op (selectCue fails open to null). Safe before
  // start().
  function loopCue(name, opts) {
    const recipe = selectCue(name);
    const under = opts && opts.under ? selectCue(opts.under) : null;
    if (recipe) { lastLoopCue = recipe.name; pendingCue = recipe; }
    // Arm WITH the primary (or clear): the layer is meaningful only riding its own primary cue.
    pendingUnder = under;
    lastUnderCue = under ? under.name : null;
  }

  // QA surface (#116): the name of the most recently armed loop cue (or null) — headless-assertable.
  function lastCue() { return lastLoopCue; }
  // QA surface (#116 f/u): the name of the most recently armed LAYERED cue (the coin chime, or null).
  function lastUnder() { return lastUnderCue; }

  // QA surface (#150): the continuous wake water-bed's current pure drive [0,1] — set every frame by
  // update() from ship speed + helm, even with NO AudioContext — so a headless playtest can make way /
  // swing the helm and assert the wash wells up and the becalmed lap settles, AudioContext-free.
  function wakeLevel() { return wakeDrive; }

  // QA surface (#81): the live hull-creak RATE (creaks/sec), recomputed every frame by update() from
  // ship speed + helm + wave height even with NO AudioContext — so a headless playtest can make way /
  // swing the helm and assert the creak quickens (and settles to its idle floor becalmed), AudioContext-free.
  function creakLevel() { return creakRateLive; }

  // Seeded per-pass variation QA surface (#117): the live seed + pass counter, plus the ornament
  // plan for the current (or any) pass. Pure + headless-safe — computable even before the audio
  // engine is up (pass stays 0), so a playtest can assert: same seed → same sequence (determinism),
  // pass 0 is canonical (empty plan), and later passes glint in-key. Exposed via window.__tidewake.
  function variation(forPass) {
    const p = forPass == null ? pass : Math.trunc(Number(forPass) || 0);
    return variationPlan(melodyPattern(), p, { seed: variationSeed });
  }

  // The harmonic reputation needle (#132 Slice B) QA surface: the live modal-recolour cast
  // { pole, blend, scale } the lead is currently wearing — headless-assertable (set by update() from
  // the lean every frame, even with no AudioContext), so a playtest can swing the ledger and assert
  // the score recolours (freygish toward Infamy, lydian toward Standing, Ionian at neutral).
  function mood() { return { pole: recolourState.pole, blend: recolourState.blend, scale: recolourState.scale }; }

  // Per-phase battle signatures (#158) QA surface: the live battle-layer cast — the raid ACT the fight
  // is in and its distinct { scale, drive, octave } (set from the raid act every frame, even with no
  // AudioContext), plus the act currently SOUNDING (committed; lags until a bar downbeat). Headless-
  // assertable, so a playtest can drive a fight and prove each act maps to a distinct musical layer.
  function battleScore() {
    return {
      act: battleActState.act,
      scale: battleActState.scale.slice(),
      drive: battleActState.drive,
      octave: battleActState.octave,
      committed: committedBattleAct,
    };
  }

  return { start, setMute, update, setMix, setMood, setBattleAct, setTownTheme, stinger, loopCue, lastCue, lastUnder, wakeLevel, creakLevel, variation, mood, battleScore };
}
