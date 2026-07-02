// Negative space (#179) — the held breath before the payoff. PURE, DOM-free and three.js-free
// game-feel that makes ALREADY-SHIPPED climaxes land BIGGER for ~0 draws, by reserving peak intensity:
// a beat of calm right before the peak. Three cheap beats on shipped moments:
//   (a) a HUSH — combat audio ducks to near-silence for ~0.6s BEFORE a surrender sting, so "she strikes
//       her colours" cracks into re-opened air (pairs with the #80 camera-settle).
//   (b) a SWELL — a ~0.8s rising build that RELEASES on a bass "thunk" as a rank-up (#169) snaps.
//   (c) a colour-grade PULSE — a single full-screen warm flare on a big win (rank-up / notorious kill).
//
// Built on the #80 juice DOCTRINE, not a new mechanic: it reuses the #80 envelope machinery
// (flashEnvelope for the grade flare), and — exactly like the #80 hit-stop/slow-mo — every beat is
// BOUNDED, drains on REAL wall-clock time (consume, the ONLY place a beat ages), and ALWAYS auto-resumes
// so it can never stall the loop. Crucially it owns NO sim freeze: it is audio/visual only, so the
// deterministic tw.step() path is completely untouched (#121) and the world clock never desyncs. A
// prefers-reduced-motion preference OR the runtime Combat-feel toggle makes every trigger a clean pass-
// through: the payoff fires IMMEDIATELY (never lost), with no hush/swell/pulse.
//
// SAVE-FREE (stays v18): pure transient game-feel, never persisted. The pure curves + the controller's
// event→beat→decay→suppression are unit-tested headless (tests/unit/negative-space.test.mjs); main.js is
// the thin shell that ducks the audio master, drives the grade overlay, and defers the real stings.

import { flashEnvelope } from './juice.js';

// ---- Tunables (the Game Designer / Sound Engineer fun-shaping numbers) -----------------------
// Ceilings, not targets — a beat of calm that sharpens the peak, never a drag on the pace.
export const HUSH_SECONDS = 0.6;   // the anticipatory near-silence before a surrender sting (bounded)
export const HUSH_FLOOR = 0.12;    // combat audio ducks to this fraction — a hush, NEVER a dead mute
export const HUSH_ATTACK = 0.28;   // fraction of the window spent ducking DOWN (fast), then held low
export const SWELL_SECONDS = 0.8;  // a rank-up's rising build before the triumphant bass thunk (bounded)
export const PULSE_SECONDS = 0.7;  // the colour-grade flare's life
export const MAX_PULSE = 0.5;      // opacity cap on the warm grade pulse — never a full white-out

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ---- PURE curves ----------------------------------------------------------------------------

/**
 * The audio-DUCK multiplier over a hush window, in [floor, 1]: eases from full (1) DOWN to `floor`
 * fast (over the first `attack` fraction), then HOLDS at the floor — a held breath — and returns to
 * full (1) at and past `duration` (released, so the sting cracks into re-opened air). Pure.
 */
export function hushGain(elapsed, duration, floor = HUSH_FLOOR, attack = HUSH_ATTACK) {
  const f = clamp(floor, 0, 1);
  if (!(duration > 0) || !(elapsed >= 0) || elapsed >= duration) return 1;
  const t = elapsed / duration;
  if (t < attack && attack > 0) return 1 - (1 - f) * (t / attack); // ease 1 → floor
  return f;                                                        // hold at the floor
}

/**
 * The rank-up SWELL level in [0,1]: 0 at the start, easing UP (t² — tension back-loads) to 1 at (and
 * past) `duration`, the point the bass "thunk" releases. Pure.
 */
export function swellRise(elapsed, duration) {
  if (!(duration > 0) || !(elapsed >= 0)) return 0;
  if (elapsed >= duration) return 1;
  const t = elapsed / duration;
  return t * t;
}

/** The colour-grade flare in [0,1] — reuses the #80 hit-flash shape (fast rise, quadratic fade). Pure. */
export function pulseEnvelope(elapsed, duration) {
  return flashEnvelope(elapsed, duration, 0.22);
}

// ---- Controller (wired into main.js) --------------------------------------------------------
//
// createNegativeSpace({ reducedMotion, enabled })
export function createNegativeSpace({ reducedMotion = false, enabled = true } = {}) {
  let hush = null;   // { age, duration, fire, fired } — (a) the pre-surrender-sting silence
  let swell = null;  // { age, duration, fire, fired } — (b) the pre-rank-up-thunk build
  let pulse = null;  // { age, duration }              — (c) the colour-grade flare
  const motionOff = !!reducedMotion; // hard accessibility off (prefers-reduced-motion)
  let userOff = !enabled;            // runtime Combat-feel toggle off (#80/#73 switch)
  function suppressed() { return motionOff || userOff; }

  /** Fire a deferred payoff exactly once, guarded — a beat must NEVER break the loop. */
  function firePayoff(o) {
    if (!o || o.fired) return;
    o.fired = true;
    try { if (typeof o.fire === 'function') o.fire(); } catch { /* a beat must never break the loop */ }
  }
  /** Fire a payoff NOW (the suppressed path — the moment still lands, just without the calm). */
  function fireNow(fire) {
    try { if (typeof fire === 'function') fire(); } catch { /* a beat must never break the loop */ }
  }

  /**
   * (a) SURRENDER — open a beat of anticipatory HUSH (the audio ducks to near-silence), holding the
   * surrender sting until the calm releases. Suppressed → the sting cracks NOW (payoff never lost). A
   * fresh anticipation flushes any pending sting first, so a rapid double-strike never swallows one.
   */
  function anticipate(fire) {
    if (suppressed()) { fireNow(fire); return; }
    if (hush) firePayoff(hush);
    hush = { age: 0, duration: HUSH_SECONDS, fire, fired: false };
  }

  /**
   * (b) RANK-UP — open a rising SWELL (and the (c) colour-grade pulse on the same beat), holding the
   * triumphant thunk until the swell peaks. Suppressed → the thunk lands NOW (payoff never lost).
   */
  function charge(fire) {
    if (suppressed()) { fireNow(fire); return; }
    if (swell) firePayoff(swell);
    swell = { age: 0, duration: SWELL_SECONDS, fire, fired: false };
    pulse = { age: 0, duration: PULSE_SECONDS };
  }

  /** (c) A standalone colour-grade PULSE on a big win (e.g. a notorious kill). Suppressed → no-op. */
  function flare() {
    if (suppressed()) return;
    pulse = { age: 0, duration: PULSE_SECONDS };
  }

  /**
   * Drain every live beat on REAL wall-clock dt — the ONLY place a hush/swell/pulse ages. Each window
   * is bounded, so when it elapses its payoff fires exactly once and it clears: BOUNDED + ALWAYS auto-
   * resuming (a monster frame gap releases in one step, never a hang). Touches NO sim state — the
   * deterministic tw.step() path never calls this, so the fixed-sim gate (#121) stays pristine.
   */
  function consume(realDt = 0) {
    const dt = Math.max(0, realDt);
    if (hush) { hush.age += dt; if (hush.age >= hush.duration) { firePayoff(hush); hush = null; } }
    if (swell) { swell.age += dt; if (swell.age >= swell.duration) { firePayoff(swell); swell = null; } }
    if (pulse) { pulse.age += dt; if (pulse.age >= pulse.duration) pulse = null; }
  }

  /** The runtime toggle. Turning OFF flushes any pending payoff NOW (never lose a sting) + clears all. */
  function setEnabled(v) {
    userOff = !v;
    if (userOff) {
      if (hush) { firePayoff(hush); hush = null; }
      if (swell) { firePayoff(swell); swell = null; }
      pulse = null;
    }
    return !userOff;
  }

  /** The combat-audio duck multiplier this frame (1 = full; dips toward the floor during a hush). */
  function audioDuck() { return hush ? hushGain(hush.age, hush.duration) : 1; }
  /** The rank-up swell level this frame in [0,1] (0 = none). */
  function swellLevel() { return swell ? swellRise(swell.age, swell.duration) : 0; }
  /** The colour-grade pulse opacity this frame (0 = none), bounded by MAX_PULSE. */
  function gradeLevel() { return pulse ? Math.min(MAX_PULSE, MAX_PULSE * pulseEnvelope(pulse.age, pulse.duration)) : 0; }
  /** True while any beat is live. */
  function active() { return hush !== null || swell !== null || pulse !== null; }

  /** A plain snapshot for window.__tidewake (lets a headless test assert the beats). */
  function snapshot() {
    return {
      reducedMotion: motionOff,
      enabled: !userOff,
      active: active(),
      hush: hush !== null,
      swell: swell !== null,
      pulse: pulse !== null,
      audioDuck: audioDuck(),
      swellLevel: swellLevel(),
      gradeLevel: gradeLevel(),
    };
  }

  return { anticipate, charge, flare, consume, setEnabled, audioDuck, swellLevel, gradeLevel, active, snapshot };
}
