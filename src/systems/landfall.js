// Landfall — the crafted mode-transition gesture (#102, DL #3 "the transition IS the drama").
//
// Making port (SAILING→TOWN) and setting sail (TOWN→SAILING) used to SNAP: the mode flipped, the
// town screen appeared, the camera teleported. The DL #3 research had every discipline converge on
// the same note — the *moment of changing modes* should be a deliberate multi-sensory gesture, not
// a load screen. This is the small PURE controller that owns the WHEN and the HOW-FAR of that
// gesture: a phase/ease/duration state machine yielding a single `blend` 0→1 the wiring maps onto
// the camera (ease to a moored "ashore" framing), the grade (warm "golden harbour" glow), and the
// town view (which only takes the screen once we're truly ashore).
//
// CREATIVE SPARK (Game Designer): "make landfall" should *feel like arriving* — the helm goes
// quiet, the ship glides to her moorings and the light turns gold, THEN the town opens around you.
// Set Sail is the mirror: the town falls away first, the bow swings seaward, the open light returns.
//
// PURE on purpose — no THREE, no DOM, no game state, no wall-clock. It advances on dt SECONDS
// (driven by the sim's deterministic tw.step, never rAF), so the gesture is provable under node and
// SAFE headless. Unit-tested in tests/unit/landfall.test.mjs; main.js owns the camera/grade wiring.

export const PHASES = Object.freeze({
  IDLE: 'idle',       // under sail, no transition (blend 0)
  LANDING: 'landing', // making port: blend easing 0→1
  ASHORE: 'ashore',   // moored, town view owns the screen (blend 1)
  LEAVING: 'leaving', // setting sail: blend easing 1→0
});

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Clamped smoothstep — the gesture's easing curve. Gentle at both ends (a ship doesn't start or
 * stop on a dime), symmetric, monotonic. easeInOut(0)=0, easeInOut(1)=1, easeInOut(0.5)=0.5.
 * @param {number} x raw progress
 * @returns {number} eased progress in [0,1]
 */
export function easeInOut(x) {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/**
 * Glassy "moored" swell settle (#102 phase 2) — the ocean's swell amplitude eases toward a calm,
 * glassy value as you come to rest ashore, then back to full open-water life as you set sail. A
 * reactive verb: the paused helm = still water. PURE — reads off the gesture's eased `blend`, so
 * the wiring just multiplies the swell (GPU uniform + CPU sampler) by this one number.
 *   mooredSwellScale(0) === 1 (open sea, untouched) · mooredSwellScale(1) === glassy (moored calm).
 * Monotonic-decreasing in blend; clamps blend to [0,1] so a bad frame never amplifies the sea.
 * @param {number} blend  eased ashore-ness 0..1 (landfall.blend)
 * @param {number} [glassy] the moored amplitude multiplier at full ashore (default 0.2)
 * @returns {number} swell amplitude multiplier in [glassy, 1]
 */
export function mooredSwellScale(blend, glassy = 0.2) {
  const g = clamp01(glassy);
  return 1 - (1 - g) * clamp01(blend);
}

/**
 * Create a landfall transition controller.
 *   createLandfall({ landMs = 900, leaveMs = 700 }) -> {
 *     phase,                 // PHASES.* — the current stance of the gesture
 *     blend,                 // eased "ashore-ness" 0..1 (camera/grade drive off this)
 *     raw,                   // un-eased progress through the active timed phase (0..1)
 *     active,                // true while a transition is in flight (landing|leaving)
 *     townReady,             // phase === ASHORE — only then may the town view take the screen
 *     land(),                // begin making port (no-op if already landing/ashore)
 *     leave(),               // begin setting sail (no-op if already leaving/idle)
 *     skip(),                // complete the active transition instantly (skippable gesture)
 *     step(dtSeconds),       // advance deterministically by dt seconds
 *     reset(),               // snap back to idle (a fresh voyage starts under sail)
 *   }
 * Interruptions ease CONTINUOUSLY: bailing out mid-landing starts the reverse from the exact blend
 * you'd reached, so the camera/grade never snap. Durations (not frame counts) drive the timing.
 */
export function createLandfall({ landMs = 900, leaveMs = 700 } = {}) {
  const landS = Math.max(1e-3, landMs / 1000);
  const leaveS = Math.max(1e-3, leaveMs / 1000);

  let phase = PHASES.IDLE;
  let from = 0;     // blend at the moment the active transition began (continuity on interrupt)
  let p = 0;        // raw progress [0,1] through the active timed phase
  let blend = 0;    // current eased blend [0,1]

  function recompute() {
    if (phase === PHASES.LANDING) blend = from + (1 - from) * easeInOut(p);
    else if (phase === PHASES.LEAVING) blend = from * (1 - easeInOut(p));
    else if (phase === PHASES.ASHORE) blend = 1;
    else blend = 0; // IDLE
  }

  return {
    get phase() { return phase; },
    get blend() { return blend; },
    get raw() { return p; },
    get active() { return phase === PHASES.LANDING || phase === PHASES.LEAVING; },
    get townReady() { return phase === PHASES.ASHORE; },

    land() {
      if (phase === PHASES.LANDING || phase === PHASES.ASHORE) return false;
      from = blend; p = 0; phase = PHASES.LANDING; recompute();
      return true;
    },
    leave() {
      if (phase === PHASES.LEAVING || phase === PHASES.IDLE) return false;
      from = blend; p = 0; phase = PHASES.LEAVING; recompute();
      return true;
    },
    skip() {
      if (phase === PHASES.LANDING) { phase = PHASES.ASHORE; p = 1; recompute(); return true; }
      if (phase === PHASES.LEAVING) { phase = PHASES.IDLE; p = 1; from = 0; recompute(); return true; }
      return false;
    },
    step(dtSeconds) {
      if (phase !== PHASES.LANDING && phase !== PHASES.LEAVING) return;
      const dt = Number.isFinite(dtSeconds) ? Math.max(0, dtSeconds) : 0;
      const dur = phase === PHASES.LANDING ? landS : leaveS;
      p = clamp01(p + dt / dur);
      recompute();
      if (p >= 1) {
        if (phase === PHASES.LANDING) { phase = PHASES.ASHORE; blend = 1; }
        else { phase = PHASES.IDLE; blend = 0; from = 0; }
      }
    },
    reset() { phase = PHASES.IDLE; from = 0; p = 0; blend = 0; },
  };
}
