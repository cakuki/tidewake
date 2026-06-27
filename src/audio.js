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
export function createAudio() {
  let ctx = null;
  let master = null;
  let waveGainNode = null;
  let windGainNode = null;
  let windFilter = null;
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

  // Bring the engine up on the first real user gesture (autoplay gate).
  function start() {
    if (started) return;
    try {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return; // no WebAudio (headless) — stay inert, no error
      ctx = new AC();
      buildGraph();
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
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
      const onGesture = () => {
        start();
        // After the first gesture the resume is settled; drop the one-shot.
        globalThis.removeEventListener?.('pointerdown', onGesture);
        globalThis.removeEventListener?.('keydown', onGesture);
      };
      globalThis.addEventListener?.('pointerdown', onGesture, { passive: true });
      globalThis.addEventListener?.('keydown', onGesture);

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

  return { init, setMute, isMuted, update, attachMusic };
}
