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

// ---- The composition (D major, hornpipe lilt) ----

export const BEATS_PER_BAR = 4;
export const BARS = 8;
export const LOOP_BEATS = BARS * BEATS_PER_BAR; // 32-beat, 8-bar loop

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
  let master = null;      // shared master gain from audio.js
  let musicGain = null;   // our single sub-gain under the master (mute covers it)
  let leadBus = null;     // soft lowpass colouring the lead
  let started = false;
  let muted = false;
  let intensity = 0;      // 0..1, set by update() from ship speed
  let schedulerId = null;

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

  function buildSchedule() {
    leadByStep = Array.from({ length: TOTAL_STEPS }, () => []);
    bassByStep = Array.from({ length: TOTAL_STEPS }, () => []);
    chordByStep = Array.from({ length: TOTAL_STEPS }, () => []);

    // Lead melody → grid.
    let beat = 0;
    for (const note of melodyPattern()) {
      const s = Math.round(beat * 2) % TOTAL_STEPS;
      leadByStep[s].push({ deg: note.deg, durSec: note.beats * beatSec });
      beat += note.beats;
    }

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

  function voiceLead(time, freq, durSec) {
    const peak = 0.16 * (0.55 + 0.45 * intensity); // present at rest, fuller at speed
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    const end = time + durSec;
    env.gain.setValueAtTime(0.0001, time);
    env.gain.exponentialRampToValueAtTime(peak, time + 0.012);   // pluck attack
    env.gain.exponentialRampToValueAtTime(0.0001, end);          // decay/release
    osc.connect(env).connect(leadBus);
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
    osc.connect(env).connect(musicGain);
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
      osc.connect(env).connect(musicGain);
      osc.start(time);
      osc.stop(end + 0.02);
    }
  }

  function fireStep(s, time) {
    if (muted) return; // silent + cheap while muted; the grid clock keeps advancing
    try {
      for (const n of leadByStep[s]) voiceLead(time, degreeToFreq(n.deg, ROOT), n.durSec);
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
        fireStep(step, nextNoteTime);
        nextNoteTime += stepSec;
        step = (step + 1) % TOTAL_STEPS;
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

      leadBus = ctx.createGain();
      leadBus.gain.value = 1;
      const leadLP = ctx.createBiquadFilter();
      leadLP.type = 'lowpass';
      leadLP.frequency.value = 3200; // soften the triangle's edge into a sweeter lead
      leadBus.connect(leadLP).connect(musicGain);

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
      started = false;
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
      if (!ctx || !musicGain || muted) return;
      // Gentle overall swell with intensity, on top of the per-note adaptivity.
      musicGain.gain.setTargetAtTime(BASE_LEVEL * (0.85 + 0.15 * intensity), ctx.currentTime, 0.5);
    } catch {
      /* a bad frame must never throw */
    }
  }

  return { start, setMute, update };
}
