// Procedural sea ambience — WebAudio only, zero asset downloads, no build step.
//
// Diegetic-first (studio/agents/sound-engineer.md): a believable sea anchored in
// source-placed sound — a slow wave wash, a soft wind layer, the occasional gull —
// synthesized live so the static site stays tiny and nothing ever loops audibly.
//
// One graph, one bus: everything routes through a single AudioContext + master gain
// for clean mute. The whole graph is built lazily and only on a real user gesture
// (browsers block autoplay), so in a headless / no-audio environment this module is
// inert: no context, no nodes, no console noise.
//
// The pure helpers below (gain maps, gull scheduling math) carry NO browser deps so
// they run under `node --test`. All AudioContext / DOM use lives inside createAudio().

// ---- Pure helpers (browser-free, unit-tested) ----

/** Clamp to [0,1]. */
export function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

/**
 * Target gain for the wave-wash layer from ship speed. There's always a gentle
 * wash at rest; it swells a touch as you make way. Subtle by design.
 * @param {number} speed     world units/sec
 * @param {number} maxSpeed  world units/sec at full speed
 * @returns {number} gain in [0.10, 0.32]
 */
export function seaGain(speed, maxSpeed) {
  const n = clamp01(maxSpeed > 0 ? speed / maxSpeed : 0);
  return 0.10 + 0.22 * n;
}

/**
 * Target gain for the wind layer. Quieter than the wash at rest, brightens and
 * lifts more noticeably with speed (apparent wind over the deck).
 * @param {number} speed     world units/sec
 * @param {number} maxSpeed  world units/sec at full speed
 * @returns {number} gain in [0.035, 0.155]
 */
export function windGain(speed, maxSpeed) {
  const n = clamp01(maxSpeed > 0 ? speed / maxSpeed : 0);
  return 0.035 + 0.12 * n;
}

/**
 * Seconds until the next gull cry. Maps a 0..1 random into [min,max] so cries
 * land irregularly and never feel metronomic.
 * @param {number} rand  random value in [0,1] (clamped)
 * @param {number} [min] shortest gap, seconds
 * @param {number} [max] longest gap, seconds
 * @returns {number} delay in seconds
 */
export function nextGullDelay(rand, min = 12, max = 34) {
  return min + clamp01(rand) * (max - min);
}

/**
 * Equal-temperament frequency for a number of semitones above (or below) A4.
 * The duel stingers tune their flourishes from this — keeps the note maths pure
 * and unit-testable while the WebAudio plumbing stays inside createAudio().
 * @param {number} semitonesFromA4  0 = A4 (440 Hz), 12 = A5, -12 = A3
 * @param {number} [a4]             reference pitch in Hz
 * @returns {number} frequency in Hz
 */
export function semitoneToFreq(semitonesFromA4, a4 = 440) {
  return a4 * Math.pow(2, semitonesFromA4 / 12);
}

/**
 * The user-gesture events that can unlock WebAudio. iOS Safari (tab AND installed PWA) only
 * resumes a suspended AudioContext inside a REAL gesture handler, and historically wants a
 * touch event specifically — so we listen broadly (touch + pointer + mouse + click + key) and
 * unlock on whichever fires first. Pure + exported so the set is unit-testable.
 * @returns {string[]} event names to bind for the first-gesture unlock
 */
export function unlockEventNames() {
  return ['touchstart', 'touchend', 'pointerdown', 'mousedown', 'click', 'keydown'];
}

/**
 * Given an AudioContext's `state`, does it still need an unlock attempt? 'running' is unlocked;
 * 'suspended' / 'interrupted' (iOS) / anything unknown still needs a gesture-driven resume. Pure
 * so the iOS unlock-state logic can be unit-tested without a real AudioContext.
 * @param {string|undefined} state  ctx.state
 * @returns {boolean}
 */
export function needsUnlock(state) {
  return state !== 'running';
}

// ---- Audio system (browser-only; nothing here runs at import time) ----

const MUTE_KEY = 'tidewake.muted';

/**
 * Create the audio system. Returns a small API used by main.js:
 *   init()        wire the autoplay-gate gesture listener + mute controls (safe to call once)
 *   setMute(b)    mute/unmute (ramped, persisted to localStorage)
 *   isMuted()     current mute state
 *   update(state) called each frame with { speed, maxSpeed } — ramps layer gains
 *
 * Every method is a clean no-op until a real user gesture has created the context,
 * and resilient if called before init(). Guarded so a headless run never throws.
 */
export function createAudio(opts = {}) {
  // One-time charm beat when the audio first unlocks (#76 follow-up creative spark). Optional.
  const onUnlock = typeof opts.onUnlock === 'function' ? opts.onUnlock : null;
  let unlockedOnce = false;
  let gestureBound = false;
  let ctx = null;
  let master = null;
  let waveGainNode = null;
  let windGainNode = null;
  let windFilter = null;
  let sfxGain = null; // one-shot duel stingers hang here, under the master (mute covers them)
  let started = false;
  let muted = readMutePref();
  let gullTimer = null;
  let last = { speed: 0, maxSpeed: 55 };
  let music = null; // optional Musician layer sharing this context + master + mute

  function readMutePref() {
    try {
      return globalThis.localStorage?.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  }
  function writeMutePref(b) {
    try {
      globalThis.localStorage?.setItem(MUTE_KEY, b ? '1' : '0');
    } catch {
      /* private mode / no storage — ignore */
    }
  }

  function makeNoiseBuffer(seconds) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = muted ? 0.0001 : 1;
    master.connect(ctx.destination);

    // Duel SFX sub-bus: sits a touch under the ambience/music so the comedy
    // stingers punctuate without fatiguing. Mute rides on the master above it.
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);

    // A couple of seconds of noise, looped — the raw material for sea + wind.
    const noise = makeNoiseBuffer(2.0);

    // --- Wave wash: dark, filtered noise that breathes with a slow swell LFO ---
    const waveSrc = ctx.createBufferSource();
    waveSrc.buffer = noise;
    waveSrc.loop = true;
    const waveLP = ctx.createBiquadFilter();
    waveLP.type = 'lowpass';
    waveLP.frequency.value = 460;
    waveLP.Q.value = 0.5;
    waveGainNode = ctx.createGain();
    waveGainNode.gain.value = seaGain(0, last.maxSpeed);
    waveSrc.connect(waveLP).connect(waveGainNode).connect(master);

    // Swell: a slow LFO gently rocks the wash gain so it rises and falls.
    const swell = ctx.createOscillator();
    swell.type = 'sine';
    swell.frequency.value = 0.11;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.045;
    swell.connect(swellDepth).connect(waveGainNode.gain);
    swell.start();

    // --- Wind: brighter band-passed noise with a slow gust wobble on the band ---
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noise;
    windSrc.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 1050;
    windFilter.Q.value = 0.45;
    windGainNode = ctx.createGain();
    windGainNode.gain.value = windGain(0, last.maxSpeed);
    windSrc.connect(windFilter).connect(windGainNode).connect(master);

    const gust = ctx.createOscillator();
    gust.type = 'sine';
    gust.frequency.value = 0.06;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 320; // Hz of band wander
    gust.connect(gustDepth).connect(windFilter.frequency);
    gust.start();

    waveSrc.start();
    windSrc.start();
  }

  // One gull cry: a pair of detuned oscillators with a quick up-then-down pitch
  // glide and a sharp envelope, panned somewhere off the bow. Varied each time so
  // it never sounds tiled. Sometimes a quick double-cry.
  function playGull() {
    if (!ctx || ctx.state !== 'running' || !master) return;
    try {
      const cries = Math.random() < 0.45 ? 2 : 1;
      for (let c = 0; c < cries; c++) {
        const t0 = ctx.currentTime + c * (0.22 + Math.random() * 0.12);
        const dur = 0.16 + Math.random() * 0.1;
        const base = 900 + Math.random() * 500; // cry pitch
        const pan = Math.random() * 1.6 - 0.8;

        const out = ctx.createGain();
        out.gain.setValueAtTime(0.0001, t0);
        out.gain.exponentialRampToValueAtTime(0.06 + Math.random() * 0.04, t0 + 0.03);
        out.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        let tail = out;
        if (ctx.createStereoPanner) {
          const panner = ctx.createStereoPanner();
          panner.pan.value = pan;
          out.connect(panner);
          tail = panner;
        }
        tail.connect(master);

        for (let i = 0; i < 2; i++) {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          const detune = i === 0 ? 0 : 18 + Math.random() * 22;
          osc.frequency.setValueAtTime(base * 0.8, t0);
          osc.frequency.exponentialRampToValueAtTime(base, t0 + dur * 0.35);
          osc.frequency.exponentialRampToValueAtTime(base * 0.7, t0 + dur);
          osc.detune.value = detune;
          // soften the saw a touch so it's a cry, not a buzz
          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = 2600;
          osc.connect(lp).connect(out);
          osc.start(t0);
          osc.stop(t0 + dur + 0.02);
        }
      }
    } catch {
      /* never let a gull break the frame */
    }
  }

  function scheduleGull() {
    if (typeof setTimeout !== 'function') return;
    const delay = nextGullDelay(Math.random()) * 1000;
    gullTimer = setTimeout(() => {
      playGull();
      scheduleGull();
    }, delay);
  }

  // ---- Duel stingers (Insult Broadside, #48) -------------------------------
  //
  // Short, comedic, fully-synthesised one-shots that punctuate the wit-combat —
  // the universal "osc/noise → filter → gain-envelope" recipe from the research
  // log. All hang off sfxGain (under the master), so the existing mute silences
  // them too. Every voice is guarded; a stinger must never break the game.

  // A single enveloped oscillator note (optional pitch glide), routed to `dest`.
  function tone(t0, dur, peak, type, f0, f1, dest, attack = 0.012) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    if (f1 != null && f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    }
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(attack, dur * 0.4));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(env).connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
    return osc;
  }

  // A short band-passed noise burst — the neutral "tick" / crack material.
  function noiseTick(t0, dur, peak, freq, Q, dest) {
    const src = ctx.createBufferSource();
    src.buffer = makeNoiseBuffer(dur + 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = Q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp).connect(env).connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.03);
  }

  // CUTTING hit: a sharp upward zinger pluck + a tiny comedic crowd "ooooh".
  function sfxCut(t0, dest) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 1.2;
    bp.connect(dest);
    tone(t0, 0.14, 0.20, 'sawtooth', 520, 1300, bp, 0.008); // the "zing"
    // the crowd: two detuned voices rising softly, lowpassed into an "ooh"
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.connect(dest);
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.detune.value = i === 0 ? -6 : 7;
      const ot = t0 + 0.05;
      osc.frequency.setValueAtTime(300, ot);
      osc.frequency.linearRampToValueAtTime(430, ot + 0.18);
      osc.frequency.linearRampToValueAtTime(400, ot + 0.42);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, ot);
      env.gain.linearRampToValueAtTime(0.07, ot + 0.16);
      env.gain.setValueAtTime(0.07, ot + 0.30);
      env.gain.exponentialRampToValueAtTime(0.0001, ot + 0.46);
      osc.connect(env).connect(lp);
      osc.start(ot);
      osc.stop(ot + 0.5);
    }
  }

  // BACKFIRE: a deflating sad-trombone "womp" — muted descending notes with a
  // light vibrato wah and a final downward bend.
  function sfxBackfire(t0, dest) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    lp.connect(dest);
    const vib = ctx.createOscillator();
    vib.type = 'sine';
    vib.frequency.value = 6.5;
    const vibDepth = ctx.createGain();
    vibDepth.gain.value = 7; // Hz of warble
    vib.connect(vibDepth);
    vib.start(t0);
    vib.stop(t0 + 1.0);
    const notes = [311, 277, 247, 220];
    let t = t0;
    notes.forEach((f, i) => {
      const last = i === notes.length - 1;
      const dur = last ? 0.34 : 0.16;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, t);
      if (last) osc.frequency.exponentialRampToValueAtTime(165, t + dur); // the womp
      vibDepth.connect(osc.frequency);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(env).connect(lp);
      osc.start(t);
      osc.stop(t + dur + 0.03);
      t += dur * 0.92;
    });
  }

  // GLANCING: a small neutral tick — a clipped noise crack + a tiny blip.
  function sfxGlance(t0, dest) {
    noiseTick(t0, 0.05, 0.07, 1500, 1.0, dest);
    tone(t0, 0.045, 0.06, 'triangle', 760, 620, dest, 0.004);
  }

  // WIN: a short triumphant rising flourish (D major arpeggio) + a high sparkle.
  function sfxWin(t0, dest) {
    const freqs = [5, 9, 12, 17].map((s) => semitoneToFreq(s)); // D5 F#5 A5 D6
    freqs.forEach((f, i) => {
      const t = t0 + i * 0.085;
      const last = i === freqs.length - 1;
      tone(t, last ? 0.5 : 0.13, last ? 0.17 : 0.13, 'triangle', f, f, dest, 0.01);
      tone(t, last ? 0.45 : 0.1, 0.05, 'square', f, f, dest, 0.01); // bright doubling
    });
    tone(t0 + freqs.length * 0.085, 0.4, 0.04, 'sine', 1760, 2349, dest, 0.02);
  }

  // LOSE: a comic descending defeat run that lands on a low womp.
  function sfxLose(t0, dest) {
    const freqs = [3, 1, -1, -4].map((s) => semitoneToFreq(s)); // C5 Bb4 G#4 F4
    freqs.forEach((f, i) => {
      tone(t0 + i * 0.12, 0.16, 0.13, 'triangle', f, f, dest, 0.008);
    });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(dest);
    tone(t0 + freqs.length * 0.12, 0.4, 0.17, 'sawtooth', 196, 110, lp, 0.02);
  }

  // CHALLENGE: a light bugle "ta-DAA" when a duel is hailed.
  function sfxChallenge(t0, dest) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
    lp.Q.value = 0.7;
    lp.connect(dest);
    const call = [
      { f: 392, t: t0, dur: 0.12, peak: 0.13 },         // G4 pickup
      { f: 523, t: t0 + 0.13, dur: 0.34, peak: 0.16 },  // C5 held
    ];
    for (const n of call) {
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.detune.value = i === 0 ? 0 : 6;
        osc.frequency.setValueAtTime(n.f, n.t);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, n.t);
        env.gain.exponentialRampToValueAtTime(n.peak, n.t + 0.025);
        env.gain.setValueAtTime(n.peak, n.t + n.dur * 0.6);
        env.gain.exponentialRampToValueAtTime(0.0001, n.t + n.dur);
        osc.connect(env).connect(lp);
        osc.start(n.t);
        osc.stop(n.t + n.dur + 0.03);
      }
    }
  }

  /**
   * Play a duel stinger. No-op until a real gesture has the engine running, so a
   * headless run (no context) is silent and never throws.
   * @param {'cut'|'backfire'|'glance'|'win'|'lose'|'challenge'} kind
   */
  function playDuelHit(kind) {
    if (!ctx || ctx.state !== 'running' || !master) return;
    try {
      const dest = sfxGain || master;
      const t0 = ctx.currentTime + 0.005;
      switch (kind) {
        case 'cut': sfxCut(t0, dest); break;
        case 'backfire': sfxBackfire(t0, dest); break;
        case 'glance': sfxGlance(t0, dest); break;
        case 'win': sfxWin(t0, dest); break;
        case 'lose': sfxLose(t0, dest); break;
        case 'challenge': sfxChallenge(t0, dest); break;
        default: /* unknown kind — stay silent */ break;
      }
    } catch {
      /* a stinger must never break the game */
    }
  }

  // Build the engine once (graph + ambience + music). Does NOT resume — unlock() drives the
  // gesture-bound resume/unlock so the iOS policy is satisfied inside a real gesture handler.
  function start() {
    if (started) return;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return; // no WebAudio (headless) — stay inert, no error
      ctx = new AC();
      buildGraph();
      started = true;
      scheduleGull();
      // Bring the music up on the same gesture, sharing this graph + master bus.
      try {
        music?.start({ ctx, master });
        music?.setMute(muted);
      } catch {
        /* music must never break the sea */
      }
    } catch {
      // Anything goes wrong → remain silent and harmless.
      ctx = null;
      master = null;
      started = false;
    }
  }

  // iOS WebAudio unlock: a 1-sample silent buffer played INSIDE the user gesture satisfies
  // Safari's unlock (belt-and-braces alongside resume()). Works in a Safari tab and an installed
  // PWA alike. Guarded; a no-op in headless (no ctx) and never throws.
  function playSilentBuffer() {
    if (!ctx) return;
    try {
      const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      (src.start || src.noteOn)?.call(src, 0);
    } catch {
      /* ignore — the resume() below is the primary path */
    }
  }

  function removeGestureListeners() {
    if (!gestureBound) return;
    try {
      // Must pass the SAME capture flag used at bind time or the removal is a no-op.
      for (const ev of unlockEventNames()) globalThis.removeEventListener?.(ev, onGesture, { capture: true });
    } catch {
      /* ignore */
    }
    gestureBound = false;
  }

  function notifyUnlocked() {
    if (unlockedOnce) return;
    unlockedOnce = true;
    try {
      onUnlock?.();
    } catch {
      /* a creative beat must never break audio */
    }
  }

  // Bring the engine up AND unlock it on a real user gesture. Idempotent and safe to call on
  // every gesture: builds the graph once, then resumes + plays the silent buffer until the
  // context is actually 'running' (iOS can hand back 'suspended'/'interrupted' the first time,
  // so we keep the listeners bound and retry on the next gesture until it sticks).
  function onGesture() {
    try {
      start(); // one-time graph build (no-op once started)
      if (!ctx) return; // headless / no WebAudio — nothing to unlock
      if (needsUnlock(ctx.state)) {
        playSilentBuffer(); // iOS: silent buffer on the gesture
        const settle = () => {
          if (ctx && ctx.state === 'running') {
            removeGestureListeners();
            notifyUnlocked();
          }
        };
        if (ctx.resume) ctx.resume().then(settle).catch(() => {});
        else settle();
      } else {
        removeGestureListeners();
        notifyUnlocked();
      }
    } catch {
      /* never throw from a gesture handler */
    }
  }

  function applyMuteRamp() {
    if (!ctx || !master) return;
    try {
      master.gain.setTargetAtTime(muted ? 0.0001 : 1, ctx.currentTime, 0.04);
    } catch {
      try {
        master.gain.value = muted ? 0.0001 : 1;
      } catch {
        /* ignore */
      }
    }
  }

  function refreshButton() {
    try {
      const btn = globalThis.document?.getElementById('audio-toggle');
      if (!btn) return;
      btn.textContent = muted ? '\u{1F507}' : '\u{1F50A}'; // 🔇 / 🔊
      btn.setAttribute('aria-pressed', String(muted));
      btn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      btn.title = muted ? 'Unmute (m)' : 'Mute (m)';
    } catch {
      /* ignore */
    }
  }

  // ---- Public API ----

  function setMute(b) {
    muted = !!b;
    writeMutePref(muted);
    applyMuteRamp();
    try {
      music?.setMute(muted);
    } catch {
      /* ignore */
    }
    refreshButton();
  }

  // Attach the Musician layer so it shares ONE context + master + mute. If the engine
  // is already running, bring the music up immediately; otherwise it starts on gesture.
  function attachMusic(m) {
    music = m || null;
    if (started && ctx && master && music) {
      try {
        music.start({ ctx, master });
        music.setMute(muted);
      } catch {
        /* ignore */
      }
    }
  }

  function isMuted() {
    return muted;
  }

  function update(state) {
    if (!ctx || ctx.state !== 'running' || !waveGainNode || !windGainNode) return;
    try {
      const speed = Number(state?.speed) || 0;
      const maxSpeed = Number(state?.maxSpeed) || last.maxSpeed || 55;
      last = { speed, maxSpeed };
      const now = ctx.currentTime;
      // Ramp toward targets so speed changes never zipper.
      waveGainNode.gain.setTargetAtTime(seaGain(speed, maxSpeed), now, 0.6);
      windGainNode.gain.setTargetAtTime(windGain(speed, maxSpeed), now, 0.5);
    } catch {
      /* a bad frame must never throw */
    }
  }

  function init() {
    try {
      // First-gesture unlock. Bind BROADLY (touch + pointer + mouse + click + key) so iOS Safari
      // and an installed iOS PWA both resume + unlock inside a real gesture, whichever fires first.
      // CAPTURE phase (#77 follow-up): the on-screen touch buttons call preventDefault() and could
      // otherwise swallow the gesture before it bubbles up here — a capture-phase listener on the
      // window runs FIRST, before any control's handler, so a tap on a steer/fire button unlocks
      // audio too. (input.js also calls unlock() directly as a belt-and-braces.)
      for (const ev of unlockEventNames()) {
        globalThis.addEventListener?.(ev, onGesture, { passive: true, capture: true });
      }
      gestureBound = true;

      // iOS suspends audio when the tab/PWA is backgrounded; re-resume when it returns to the
      // foreground so the music doesn't stay dead after switching apps.
      globalThis.document?.addEventListener?.('visibilitychange', () => {
        try {
          if (
            globalThis.document.visibilityState === 'visible' &&
            started && ctx && needsUnlock(ctx.state)
          ) {
            ctx.resume?.().catch(() => {});
          }
        } catch {
          /* ignore */
        }
      });

      // 'm' toggles mute (independent of the gesture gate).
      globalThis.addEventListener?.('keydown', (e) => {
        if ((e.key || '').toLowerCase() === 'm') setMute(!muted);
      });

      // HUD mute button.
      const btn = globalThis.document?.getElementById('audio-toggle');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          setMute(!muted);
        });
      }
      refreshButton();
    } catch {
      /* init must never throw in a headless context */
    }
  }

  // Directly drive the gesture-unlock (belt-and-braces for the on-screen touch controls,
  // which call this from their own handlers so audio unlocks even if the window-level
  // listener is somehow missed). Idempotent + guarded; a no-op in headless.
  function unlock() {
    onGesture();
  }

  return { init, setMute, isMuted, update, attachMusic, playDuelHit, unlock };
}
