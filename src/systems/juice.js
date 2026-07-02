// Reactive-verb JUICE (#155) — renderer-only game-feel on the core combat verbs.
//
// The player just learned the battle verbs (#153 prompts / #154 earcons); this makes them
// FEEL like the deed they are. A fired broadside KICKS the view (recoil + a short shake), a
// landed hit FLASHES the hull, and a boarding LUNGES the camera forward. All of it is pure
// game-feel — it changes NOTHING in the simulation (logic + unit tests untouched, mirroring
// the #80 juice doctrine), rides existing combat events (fire / hit / board), and costs ~0
// draws: the shake is a camera-position offset, the flash a single DOM overlay's opacity.
//
// CREATIVE SPARK (Game Designer): juice must ECHO the mechanic, never mask it (Nijman, "The Art
// of Screenshake"). So the kick is EARNED — a clean beam shot with a heavy load kicks hardest, a
// wide shot barely nudges; taking her reply flushes your hull red, landing a clean hit flares
// gold. The feedback teaches weight by feel. Tasteful, arcade, never nauseating: every effect is
// CAPPED in magnitude + duration, and a reduce-motion preference switches the whole thing off.
//
// PURE on purpose — no THREE, no DOM, no globals. The decay/flash curves and the trigger edges
// are unit-tested under node (tests/unit/juice.test.mjs); main.js owns the wiring (it reads the
// live volley result, calls the triggers, and applies the 0-draw camera offset + flash each frame).

// ---- Tunables (the Game Designer's fun-shaping numbers) ---------------------
// Ceilings, not targets — arcade punch that never tips into nausea. World units are ~ship-scale;
// the chase camera sits ~95 units back, so a ~2-unit shake reads as a firm kick, not a earthquake.
export const MAX_SHAKE = 2.2;      // per-axis world-unit cap on the camera-shake offset
export const MAX_FLASH = 0.36;     // opacity cap on the hit-flash (never a full white/red-out)
export const SHAKE_SECONDS = 0.34; // a fire/recoil shake lives this long, then it's gone
export const LUNGE_SECONDS = 0.42; // a boarding lunge: a quick push-in that eases back
export const FLASH_SECONDS = 0.40; // a hit-flash rise-and-fade
export const MAX_SHAKES = 4;       // cap simultaneous shake impulses (a fire-spam can't stack to sea-sickness)

// #80 combat game-feel "juice" pass — make a hit LAND. Tunables for the impact-scaled shake + the
// hit-stop (a few-frame freeze on a solid strike). Ceilings, never targets: the freeze is a PUNCH, not
// a stall — hard-capped at ~5 frames and drained on real wall-clock time so it can never hang the loop.
export const DAMAGE_REF = 32;      // hull damage that reads as a "full" impact (≈ the flash-cap point)
export const MAX_HITSTOP = 0.09;   // hard ceiling on the freeze (~5 frames @60) — punchy, never a stall
export const MIN_HITSTOP = 0.03;   // the smallest freeze a SOLID hit earns (~2 frames); below it, none
export const HITSTOP_GRAZE = 0.22; // impacts below this normalised bite don't stop time (a graze ≠ a hit)
export const IMPACT_SHAKE_FLOOR = 0.35; // a solid hit's minimum shake fraction (a felt hit is always felt)

// ---- PURE curves ------------------------------------------------------------

/** Clamp helper (juice keeps its own — no shared dep). Pure. */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * A quadratic ease-out envelope in [0,1]: 1 at elapsed 0, 0 at (and past) `duration`. Pure.
 * The punchy "snap in, ease out" shape a camera kick / lunge wants.
 */
export function decay(elapsed, duration) {
  if (!(duration > 0) || !(elapsed >= 0) || elapsed >= duration) return 0;
  const t = elapsed / duration;
  return (1 - t) * (1 - t);
}

/**
 * A hit-flash envelope in [0,1]: a fast linear RISE over the first `attackFrac` of the window,
 * then a quadratic FADE to 0. Pure — the classic damage-flash shape (flare, then bleed away).
 */
export function flashEnvelope(elapsed, duration, attackFrac = 0.18) {
  if (!(duration > 0) || !(elapsed >= 0) || elapsed >= duration) return 0;
  const t = elapsed / duration;
  if (t < attackFrac) return attackFrac > 0 ? t / attackFrac : 1;
  const d = (t - attackFrac) / (1 - attackFrac); // 0..1 across the fade phase
  return (1 - d) * (1 - d);
}

/**
 * The 2D screen-shake offset [x, y] at time `elapsed`: decaying sinusoids, deterministic, each
 * axis bounded by |magnitude| (and never past MAX_SHAKE). At elapsed 0 the offset is 0 (sin 0),
 * so a shake reads as a jolt that whips out and settles, not a sudden teleport. Pure.
 */
export function shakeOffset(elapsed, { duration = SHAKE_SECONDS, magnitude = 1, freqX = 46, freqY = 38, phase = 1.7 } = {}) {
  const env = decay(elapsed, duration);
  if (env === 0) return [0, 0];
  const m = Math.min(Math.abs(magnitude), MAX_SHAKE) * env;
  return [m * Math.sin(elapsed * freqX), m * Math.sin(elapsed * freqY + phase)];
}

/**
 * Recoil magnitude for a volley: a clean beam shot (quality→1) firing a heavy load kicks hardest;
 * a wide/glancing shot barely nudges. Capped at MAX_SHAKE so a big gun can't heave the camera. Pure.
 */
export function recoilMagnitude(quality = 0, weight = 1) {
  const q = Math.max(0, Math.min(1, quality));
  return Math.min(MAX_SHAKE, 1.5 * q * Math.max(0, weight));
}

/** A felt "weight" for the recoil from an ammo's hull bite (heavy shot > swivel). Pure. */
export function ammoWeight(hullMult = 1) {
  return 0.6 + 0.5 * Math.max(0, hullMult);
}

/** Hit-flash PEAK opacity from damage dealt/taken, bounded by `cap`. Pure. */
export function flashPeak(damage = 0, scale = 0.011, cap = MAX_FLASH) {
  return Math.min(cap, Math.max(0, damage) * scale);
}

// ---- #80 impact scaling — a graze, a broadside, and a sinking each read differently ----------

/** A landed hit's felt IMPACT, normalised to [0,1] from the raw hull damage it dealt/took. Pure. */
export function impact01(damage = 0, ref = DAMAGE_REF) {
  return clamp((damage > 0 ? damage : 0) / (ref > 0 ? ref : DAMAGE_REF), 0, 1);
}

/**
 * Screen-shake magnitude for a LANDED impact (distinct from the fire recoil), scaled by normalised
 * bite and floored so a solid hit is always felt — capped at MAX_SHAKE so a man-o'-war can't heave
 * the camera. 0 for a zero impact. Pure.
 */
export function impactShakeMag(imp = 0, cap = MAX_SHAKE) {
  const i = clamp(imp, 0, 1);
  if (i <= 0) return 0;
  return Math.min(cap, MAX_SHAKE * (IMPACT_SHAKE_FLOOR + (1 - IMPACT_SHAKE_FLOOR) * i));
}

/**
 * Hit-stop freeze SECONDS for a landed impact: a graze (bite < HITSTOP_GRAZE) never stops time, a
 * solid hit freezes MIN→MAX by bite. ALWAYS bounded by MAX_HITSTOP — the freeze is a punch, never a
 * stall. Pure + deterministic (the whole point: unit-testable with no camera). Pure.
 */
export function hitStopDuration(imp = 0) {
  const i = clamp(imp, 0, 1);
  if (i < HITSTOP_GRAZE) return 0;
  const f = (i - HITSTOP_GRAZE) / (1 - HITSTOP_GRAZE); // 0..1 across the "solid" range
  return Math.min(MAX_HITSTOP, MIN_HITSTOP + (MAX_HITSTOP - MIN_HITSTOP) * f);
}

// ---- Controller (wired into main.js) ---------------------------------------
//
// Owns the transient effect state (SAVE-free — it's pure game-feel, never persisted). main.js
// triggers off live combat: fire() on a discharged broadside, hit() on landed damage, board() on
// a boarding; and #80's impact()/sink() to make a hit LAND (an impact-scaled screen-rock + a
// bounded hit-stop). Each frame main.js reads cameraOffset() (a 0-draw camera nudge) + flashLevel()
// (a single DOM overlay's opacity), and consumeHitStop(realDt) ONCE per rAF frame to freeze the sim
// for a few frames on a solid strike. A reduce-motion preference OR the runtime toggle (setEnabled)
// makes every trigger a clean no-op with zero residual motion — fully playable with the juice off.
//
// createJuice({ reducedMotion, enabled })

export function createJuice({ reducedMotion = false, enabled = true } = {}) {
  let shakes = [];    // [{ age, magnitude, duration }]  — the ONE camera-shake source (fire + impact + sink)
  let lunge = null;   // { age, magnitude, duration }
  let flash = null;   // { age, peak, duration, tint }
  let hitStopLeft = 0; // #80: seconds of sim-freeze still owed; drained ONLY by consumeHitStop (real time)
  const motionOff = !!reducedMotion; // hard accessibility off (from prefers-reduced-motion)
  let userOff = !enabled;            // runtime toggle off (the #73 settings switch)
  // Effective master switch: any trigger is a clean no-op while suppressed.
  function suppressed() { return motionOff || userOff; }

  // Push an impulse into the single shared shake stack (generalises the broadside kick — one effect,
  // never a second competing camera system), bounded so a fire/hit-spam can't stack to sea-sickness.
  function pushShake(magnitude) {
    if (!(magnitude > 0)) return;
    shakes.push({ age: 0, magnitude, duration: SHAKE_SECONDS });
    if (shakes.length > MAX_SHAKES) shakes.shift();
  }

  /** A fired broadside: recoil + a short shake, scaled by aim quality and shot weight. */
  function fire({ quality = 0, weight = 1 } = {}) {
    if (suppressed()) return;
    pushShake(recoilMagnitude(quality, weight));
  }

  /** A landed hit: a brief hull flash. `tint` 'red' = her reply bit YOU, 'gold' = a clean hit on HER. */
  function hit({ damage = 0, tint = 'red' } = {}) {
    if (suppressed()) return;
    const peak = flashPeak(damage, tint === 'red' ? 0.011 : 0.006);
    if (!(peak > 0)) return;
    flash = { age: 0, peak, duration: FLASH_SECONDS, tint };
  }

  /** A boarding: a quick forward camera lunge that eases back. */
  function board() {
    if (suppressed()) return;
    lunge = { age: 0, magnitude: 2.0, duration: LUNGE_SECONDS };
  }

  /**
   * #80 — a landed IMPACT lands: the screen ROCKS + a brief hit-stop, both scaled by the hull bite so
   * a graze, a solid hit, and a man-o'-war's full broadside read as different jolts. Generalises the
   * broadside kick to any solid strike (your shot biting HER, her reply raking YOU) using the SAME
   * shake stack + 0-draw cameraOffset — no second camera effect. `stop:false` withholds the freeze
   * (e.g. a light graze). The freeze takes the STRONGEST owed value; it never stacks past MAX_HITSTOP.
   */
  function impact({ damage = 0, stop = true } = {}) {
    if (suppressed()) return;
    const i = impact01(damage);
    pushShake(impactShakeMag(i));
    if (stop) {
      const d = hitStopDuration(i);
      if (d > hitStopLeft) hitStopLeft = d;
    }
  }

  /** #80 — a SINKING: the kill's punctuation, the strongest rock + the longest (capped) hit-stop. */
  function sink() {
    if (suppressed()) return;
    pushShake(impactShakeMag(1));
    hitStopLeft = MAX_HITSTOP;
  }

  /**
   * #80 — consume this REAL frame's hit-stop. Called ONCE per rAF frame with the real wall-clock dt
   * BEFORE the sim step; returns the fraction of dt the sim should advance: 0 while a freeze is owed
   * (the world holds on a solid hit), 1 otherwise. The freeze DRAINS on real time HERE — the ONLY
   * place hitStopLeft decreases — so it is BOUNDED and ALWAYS auto-resumes; the deterministic tw.step()
   * path never calls this, so the fixed sim / mesh-conservation gate (#121) is completely untouched.
   */
  function consumeHitStop(realDt = 0) {
    if (!(hitStopLeft > 0)) return 1;
    hitStopLeft = Math.max(0, hitStopLeft - Math.max(0, realDt));
    return 0;
  }

  /** #80 — the runtime toggle. Turning the juice OFF clears every live effect so there's NO residual motion. */
  function setEnabled(v) {
    userOff = !v;
    if (userOff) { shakes = []; lunge = null; flash = null; hitStopLeft = 0; }
    return !userOff;
  }

  /** Age every live effect on the sim clock; prune the spent ones. Deterministic + headless-safe. */
  function update(dt) {
    if (!(dt > 0)) return;
    if (shakes.length) {
      for (const s of shakes) s.age += dt;
      shakes = shakes.filter((s) => s.age < s.duration);
    }
    if (lunge) { lunge.age += dt; if (lunge.age >= lunge.duration) lunge = null; }
    if (flash) { flash.age += dt; if (flash.age >= flash.duration) flash = null; }
  }

  /**
   * The camera-local offset {x, y, z} to apply this frame (x = screen-right, y = screen-up,
   * z = along the view, negative = toward the look target). Shakes jolt x/y; a lunge pushes -z.
   * 0-draw: main.js translates the camera by this, renders, then restores it.
   */
  function cameraOffset() {
    let x = 0, y = 0, z = 0;
    for (const s of shakes) {
      const [ox, oy] = shakeOffset(s.age, { duration: s.duration, magnitude: s.magnitude });
      x += ox; y += oy;
    }
    if (lunge) {
      const e = decay(lunge.age, lunge.duration);
      z -= lunge.magnitude * e;        // push the camera forward, toward the foe
      y += 0.3 * lunge.magnitude * e;  // a small vertical settle so the lunge has heft
    }
    return { x, y, z };
  }

  /** The hit-flash overlay opacity + its tint for this frame. */
  function flashLevel() {
    if (!flash) return { level: 0, tint: 'red' };
    const level = Math.min(MAX_FLASH, flash.peak * flashEnvelope(flash.age, flash.duration));
    return { level, tint: flash.tint };
  }

  /** True while any effect is live — a JSON-safe read for the QA hook. */
  function active() {
    return shakes.length > 0 || lunge !== null || flash !== null || hitStopLeft > 0;
  }

  /** A plain snapshot for window.__tidewake (lets a headless test assert a fire produced a kick). */
  function snapshot() {
    const o = cameraOffset();
    const f = flashLevel();
    return {
      reducedMotion: motionOff,
      enabled: !userOff,
      active: active(),
      shakes: shakes.length,
      lunge: lunge !== null,
      offset: o,
      offsetMag: Math.hypot(o.x, o.y, o.z),
      flash: f.level,
      flashTint: f.tint,
      hitStop: hitStopLeft, // #80: seconds of sim-freeze still owed (0 = the world runs full)
    };
  }

  return {
    fire, hit, board, impact, sink, update,
    cameraOffset, flashLevel, consumeHitStop, setEnabled, active, snapshot,
  };
}
