// Procedural HULL-CREAK voice (#81) — the smallest always-working slice of the DL#2 "creak engine".
//
// A living wooden hull working in the swell: occasional soft creaks — short resonant noise grains —
// whose RATE and INTENSITY rise with ship speed, a hard-over helm, and the wave height she's riding.
// No new audio assets: each creak is a tiny filtered-noise transient rendered through the existing
// music bus (music.js), layered UNDER the wake-bed (#150) so the two paint a believable timber hull.
//
// Everything here is PURE + browser-free (the curve + the grain/scheduling decision), so `node --test`
// can prove the rate/gain rise with the drivers and the grain scheduling is deterministic — the
// WebAudio rendering lives in music.js and a headless run (no AudioContext) drives only these pure
// functions via the QA surface.

const clampUnit = (x) => Math.min(1, Math.max(0, Number(x) || 0));

/** Creaks/sec at anchor, helm amidships, glassy water — a lone timber settling now and then. */
export const CREAK_IDLE_RATE = 0.05;
/** Creaks/sec working hard (full sail + hard helm + heavy swell): busy but still "occasional". */
export const CREAK_MAX_RATE = 1.3;
/** Grain-intensity floor — even an idle settle is audible (but soft, under the wake-bed). */
export const CREAK_GAIN_FLOOR = 0.35;
/** Hull resonance bands (Hz): low groans → higher stick-slip creaks. A grain picks one, low-biased. */
export const CREAK_MODES = [110, 150, 190, 260, 340];

/**
 * PURE — how hard the hull is WORKING, in [0,1]. Speed is the main driver; a hard helm only groans
 * WHILE making way (timber loads on a turn under power, not at rest); the swell works the hull
 * independent of speed (a becalmed ship still rolls in a sea). Junk/zero/negative inputs fail safe
 * to 0 — never NaN, never throws.
 * @param {number} speed     world units/sec
 * @param {number} maxSpeed  world units/sec at full sail
 * @param {number} [helm]    eased rudder, |helm| in [0,1] (0 = amidships, 1 = hard over)
 * @param {number} [wave]    wave-height proxy in [0,1] (e.g. ocean swell scale: 1 at sea, ~0 moored)
 * @returns {number} work factor in [0,1]
 */
export function creakDrive(speed, maxSpeed, helm = 0, wave = 0) {
  const max = Number(maxSpeed) || 0;
  const sp = max > 0 ? clampUnit((Number(speed) || 0) / max) : 0;
  const h = clampUnit(Math.abs(Number(helm) || 0));
  const wv = clampUnit(wave);
  // Weights deliberately sum > 1 so the three drivers TOGETHER can saturate the hull's groan.
  return clampUnit(0.55 * sp + 0.30 * h * sp + 0.25 * wv);
}

/**
 * PURE — creak RATE in creaks/sec, from the idle floor up to the busy max. Monotonic non-decreasing
 * in each driver; at rest/amidships/glassy it is exactly CREAK_IDLE_RATE.
 */
export function creakRate(speed, maxSpeed, helm = 0, wave = 0) {
  const d = creakDrive(speed, maxSpeed, helm, wave);
  return CREAK_IDLE_RATE + (CREAK_MAX_RATE - CREAK_IDLE_RATE) * d;
}

/**
 * PURE — per-grain INTENSITY in [CREAK_GAIN_FLOOR, 1]: louder, fuller groans the harder she works.
 * sqrt for presence (a little work already colours the grain). Bounded; junk fails safe to the floor.
 */
export function creakGain(speed, maxSpeed, helm = 0, wave = 0) {
  const d = creakDrive(speed, maxSpeed, helm, wave);
  return clampUnit(CREAK_GAIN_FLOOR + (1 - CREAK_GAIN_FLOOR) * Math.sqrt(d));
}

/**
 * PURE — the per-tick scheduling DECISION: given a creak rate (creaks/sec) and the tick length dt,
 * should a grain fire this tick? A Poisson-thin roll: fire-probability = clamp(rate*dt) (≤ 1 grain
 * per tick), compared against a supplied random sample in [0,1). Deterministic for a given `rand`,
 * so it's unit-testable; junk dt/rate → no fire, never throws.
 * @param {number} rate creaks/sec (from creakRate)
 * @param {number} dt   tick length in seconds
 * @param {number} rand a sample in [0,1) (e.g. Math.random())
 * @returns {boolean}
 */
export function shouldCreak(rate, dt, rand) {
  const p = clampUnit((Number(rate) || 0) * (Number(dt) || 0));
  const r = Number.isFinite(rand) ? rand : 1; // junk → never fire
  return r < p;
}

/**
 * PURE — pick a creak grain's timbre: a hull-mode frequency (low groans favoured) jittered in pitch,
 * and a length from a short stick-slip to a longer groan. Deterministic given the `rand` source, so a
 * seeded stub proves the variation; a junk source fails safe to the lowest mode. No audio here — the
 * returned descriptor drives the filtered-noise grain in music.js.
 * @param {() => number} [rand] returns samples in [0,1)
 * @returns {{ freq: number, dur: number }}
 */
export function creakGrain(rand = Math.random) {
  const r = () => {
    const x = typeof rand === 'function' ? rand() : NaN;
    return Number.isFinite(x) ? Math.min(0.999999, Math.max(0, x)) : 0;
  };
  // r()*r() biases the pick toward the low groans (the index lands low far more often than high).
  const idx = Math.min(CREAK_MODES.length - 1, Math.floor(r() * r() * CREAK_MODES.length));
  const detune = 1 + (r() - 0.5) * 0.3;   // ±15% pitch jitter so it never tiles
  const freq = CREAK_MODES[idx] * detune;
  const dur = 0.16 + r() * 0.42;          // 0.16–0.58s
  return { freq, dur };
}
