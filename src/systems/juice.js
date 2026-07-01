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

// ---- PURE curves ------------------------------------------------------------

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

// ---- Controller (wired into main.js) ---------------------------------------
//
// Owns the transient effect state (SAVE-free — it's pure game-feel, never persisted). main.js
// triggers off live combat: fire() on a discharged broadside, hit() on landed damage, board() on
// a boarding; then each frame it reads cameraOffset() (a 0-draw camera nudge) + flashLevel() (a
// single DOM overlay's opacity). A reduce-motion preference makes every trigger a clean no-op.
//
// createJuice({ reducedMotion })

export function createJuice({ reducedMotion = false } = {}) {
  let shakes = [];  // [{ age, magnitude, duration }]
  let lunge = null; // { age, magnitude, duration }
  let flash = null; // { age, peak, duration, tint }

  /** A fired broadside: recoil + a short shake, scaled by aim quality and shot weight. */
  function fire({ quality = 0, weight = 1 } = {}) {
    if (reducedMotion) return;
    const magnitude = recoilMagnitude(quality, weight);
    if (!(magnitude > 0)) return;
    shakes.push({ age: 0, magnitude, duration: SHAKE_SECONDS });
    if (shakes.length > MAX_SHAKES) shakes.shift();
  }

  /** A landed hit: a brief hull flash. `tint` 'red' = her reply bit YOU, 'gold' = a clean hit on HER. */
  function hit({ damage = 0, tint = 'red' } = {}) {
    if (reducedMotion) return;
    const peak = flashPeak(damage, tint === 'red' ? 0.011 : 0.006);
    if (!(peak > 0)) return;
    flash = { age: 0, peak, duration: FLASH_SECONDS, tint };
  }

  /** A boarding: a quick forward camera lunge that eases back. */
  function board() {
    if (reducedMotion) return;
    lunge = { age: 0, magnitude: 2.0, duration: LUNGE_SECONDS };
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
    return shakes.length > 0 || lunge !== null || flash !== null;
  }

  /** A plain snapshot for window.__tidewake (lets a headless test assert a fire produced a kick). */
  function snapshot() {
    const o = cameraOffset();
    const f = flashLevel();
    return {
      reducedMotion,
      active: active(),
      shakes: shakes.length,
      lunge: lunge !== null,
      offset: o,
      offsetMag: Math.hypot(o.x, o.y, o.z),
      flash: f.level,
      flashTint: f.tint,
    };
  }

  return { fire, hit, board, update, cameraOffset, flashLevel, active, snapshot };
}
