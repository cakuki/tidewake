// Rendered cannonballs — the broadside made VISIBLE (#161 slice 4, the marquee "see the shot" win).
//
// Until now a broadside was pure MATH: press SPACE, numbers changed, a camera kick (juice.js), and a
// word in the HUD ("ABEAM") — but NOTHING flew. The owner's verdict: "we should see the cannon balls,
// the angles should matter." This is that: a fired volley SPAWNS a spread of round-shot that arcs from
// your guns toward the foe, a muzzle PUFF barks at the gunports, and each ball CRACKS into a bright
// spark on a clean hit or SPLASHES pale in open water on a wide shot — so a good angle and a bad one
// read completely differently. The fight stops being a spreadsheet and becomes a thing you watch.
//
// DRIVEN BY the existing resolution, NOT a rewrite of it: main.js hands us the resolved volley (from
// broadsideAim's inArc + resolveBroadside's enemyHit) and we only VISUALISE it — a `hit` volley lands
// its splash-of-sparks ON the foe, a `miss` (wide / out of arc) lands SHORT and off to the side so the
// shot literally sails past. The combat maths in cannons.js/battle.js is untouched.
//
// PERF is the risk (#52 draw-budget · #121 mesh-conservation), so this module is a PURE, DOM-free,
// THREE-free controller over a FIXED POOL — it never allocates a mesh, never grows, just recycles slots.
// The trajectory/interpolation/time-of-flight/hit-vs-miss classification are all deterministic and unit-
// tested under node (tests/unit/projectiles.test.mjs); main.js owns the thin THREE shell (three reused
// InstancedMeshes — cannonballs, muzzle/impact puffs — each ONE draw, written from eachBall/eachFx).
//
// CREATIVE SPARK (Game Designer): the ball is the FEEDBACK. A clean beam volley is a tight fistful of
// iron that thuds home in a shower of sparks; a wide shot is the same iron sailing past to splash in
// empty sea — the miss is legible, almost funny, and it TEACHES the beam angle without a word of UI.

// ---- Tunables (the Game Designer's fun-shaping numbers) ---------------------
export const BALL_POOL = 24;         // max cannonballs in flight (a few overlapping volleys)
export const FX_POOL = 24;           // max muzzle/impact puffs alive at once
export const BALLS_PER_VOLLEY = 5;   // a broadside is a fistful of iron, not one dot
export const SHOT_SPEED = 340;       // world-units/sec — a brisk, readable flight
export const MIN_TOF = 0.34;         // seconds — a point-blank shot still reads as a shot
export const MAX_TOF = 1.15;         // seconds — a long shot arcs but never dawdles
export const MUZZLE_LIFE = 0.16;     // the gunport bark — a quick bright pop
export const HIT_LIFE = 0.42;        // the spark burst on a clean strike
export const SPLASH_LIFE = 0.55;     // the water plume on a wide shot (lingers a touch longer)
export const VOLLEY_SPREAD = 7;      // lateral scatter of a volley at the guns (world units)
export const LAND_SPREAD = 9;        // scatter of the landing points (a shower, not a laser)
export const MISS_LEAD = 30;         // a wide shot lands this far BEYOND the foe along the line…
export const MISS_SIDE = 34;         // …and this far off to one side — clearly past her

// ---- PURE trajectory helpers ------------------------------------------------

/** Clamp helper. */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Flight time for a shot over `dist` world-units at `speed`, bounded so even a point-blank or a
 * long-range volley reads as a distinct arc (never instant, never a lob). PURE.
 */
export function timeOfFlight(dist, speed = SHOT_SPEED) {
  const d = Math.max(0, dist);
  return clamp(d / (speed || SHOT_SPEED), MIN_TOF, MAX_TOF);
}

/** Arc apex (metres above the straight line) — lifts with range, capped so it never balloons. PURE. */
export function apexHeight(dist) {
  return clamp((Math.max(0, dist)) * 0.14, 6, 46);
}

/**
 * The world position [x,y,z] of a shot at normalised flight `t` (0=muzzle, 1=landing): a straight
 * lerp in x/z, plus a parabolic lift in y that is 0 at both ends and `apex` at mid-flight. PURE.
 */
export function arcPoint(from, to, tRaw, apex = 0) {
  const t = clamp(tRaw, 0, 1);
  const x = from[0] + (to[0] - from[0]) * t;
  const z = from[2] + (to[2] - from[2]) * t;
  const yLine = from[1] + (to[1] - from[1]) * t;
  const y = yLine + apex * 4 * t * (1 - t); // parabola peaking at t=0.5
  return [x, y, z];
}

/**
 * Classify a resolved volley for the VISUAL only (#161 slice 4): a clean beam shot that BIT the foe is
 * a 'hit' (sparks on the hull); anything wide/out-of-arc or that dealt no damage is a 'miss' (a splash
 * in open water). Reads straight off the existing resolution — inArc (broadsideAim) + enemyHit
 * (resolveBroadside) — so the picture can never disagree with the maths. PURE + deterministic.
 */
export function classifyShot({ inArc = false, enemyHit = 0 } = {}) {
  return (inArc && enemyHit > 0) ? 'hit' : 'miss';
}

/**
 * The landing point for a volley. A HIT lands ON the foe; a MISS lands BEYOND her and off to a side so
 * the shot visibly sails past into empty sea (that's how the angle reads as "wide"). PURE + injectable
 * rng so it's deterministic under test. Returns [x,y,z].
 */
export function missLanding(from, to, rng = Math.random) {
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const len = Math.hypot(dx, dz) || 1;
  const fwdX = dx / len, fwdZ = dz / len;         // toward the foe
  const sideX = fwdZ, sideZ = -fwdX;              // perpendicular (either beam)
  const sign = rng() < 0.5 ? -1 : 1;
  const lead = MISS_LEAD * (0.6 + rng() * 0.8);   // short-to-long past her
  const side = MISS_SIDE * (0.6 + rng() * 0.8) * sign;
  return [
    to[0] + fwdX * lead + sideX * side,
    to[1],                                        // splashes at the waterline near her
    to[2] + fwdZ * lead + sideZ * side,
  ];
}

/**
 * A pop-and-fade envelope in [0,1] for a muzzle/spark/splash puff: a fast rise to full, then an ease
 * back to 0. 0 at age 0 and at/after `life`. Drives the puff's SCALE in the shell (a scale-0 instance
 * is invisible — no per-instance opacity juggling, cheap + leak-free). PURE.
 */
export function popEnvelope(age, life) {
  if (!(life > 0) || !(age >= 0) || age >= life) return 0;
  const t = age / life;
  const rise = 0.28;
  if (t < rise) return t / rise;
  const d = (t - rise) / (1 - rise); // 0..1 across the fade
  return 1 - d;
}

// Base puff radius (world units) by kind — the muzzle is a tight bright bark, a splash a broad plume.
export const FX_SIZE = { muzzle: 6, hit: 7, splash: 9 };

// ---- Controller (wired into main.js) ---------------------------------------
//
// Owns the transient pool (SAVE-free — pure VFX, never persisted). main.js calls fire() on a discharged
// broadside with the resolved outcome, update(dt) each frame to advance flight + spawn impacts, then
// eachBall()/eachFx() to write the reused InstancedMesh matrices. A reduced-motion preference makes
// fire() a clean no-op. Nothing here touches THREE or the DOM.
//
// createProjectiles({ rng, reducedMotion })

export function createProjectiles({ rng = Math.random, reducedMotion = false } = {}) {
  // Fixed pools — allocated ONCE, forever recycled (the #121 mesh-conservation contract in data form).
  const balls = Array.from({ length: BALL_POOL }, () => ({
    active: false, age: 0, tof: 1, apex: 0, from: [0, 0, 0], to: [0, 0, 0], hit: false,
  }));
  const fx = Array.from({ length: FX_POOL }, () => ({
    active: false, age: 0, life: 1, kind: 'muzzle', pos: [0, 0, 0],
  }));
  let ballCursor = 0, fxCursor = 0;
  // Cumulative spawn tallies — monotone counters so a headless test can assert "a hit produced a spark,
  // a miss produced a splash" without racing the exact frame the impact appears.
  const spawned = { balls: 0, muzzles: 0, hits: 0, splashes: 0 };
  let lastShot = null;

  function nextBall() { const s = balls[ballCursor]; ballCursor = (ballCursor + 1) % BALL_POOL; return s; }
  function nextFx() { const s = fx[fxCursor]; fxCursor = (fxCursor + 1) % FX_POOL; return s; }

  function spawnFx(kind, pos, life) {
    const s = nextFx();
    s.active = true; s.age = 0; s.life = life; s.kind = kind;
    s.pos = [pos[0], pos[1], pos[2]];
  }

  /**
   * Discharge a VISIBLE volley from `from` (the gunport) toward `to` (the foe). `hit` decides the whole
   * picture: a hit rains iron ON her and sparks; a miss lands short-and-wide and splashes. No-op under
   * reduced-motion. Returns a small marker (or null) so a caller/QA can tell a volley left the guns.
   */
  function fire({ from, to, hit = false, count = BALLS_PER_VOLLEY } = {}) {
    if (reducedMotion || !from || !to) return null;
    const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const tof = timeOfFlight(dist);
    const apex = apexHeight(dist);
    // Where the shower lands: on the foe for a hit, sailing past for a miss.
    const target = hit ? to : missLanding(from, to, rng);
    const n = Math.max(1, Math.min(BALL_POOL, count | 0));
    for (let i = 0; i < n; i++) {
      const b = nextBall();
      b.active = true; b.age = 0; b.tof = tof; b.hit = hit;
      b.apex = apex * (0.85 + rng() * 0.4);
      // Scatter the muzzles a touch across the gun line, and the landings into a shower.
      b.from = [
        from[0] + (rng() - 0.5) * VOLLEY_SPREAD,
        from[1] + (rng() - 0.5) * VOLLEY_SPREAD * 0.4,
        from[2] + (rng() - 0.5) * VOLLEY_SPREAD,
      ];
      b.to = [
        target[0] + (rng() - 0.5) * LAND_SPREAD,
        target[1],
        target[2] + (rng() - 0.5) * LAND_SPREAD,
      ];
      spawned.balls++;
    }
    // The gunport bark, right where the iron leaves.
    spawnFx('muzzle', from, MUZZLE_LIFE);
    spawned.muzzles++;
    lastShot = { hit, count: n, from: [from[0], from[1], from[2]], to: [target[0], target[1], target[2]] };
    return lastShot;
  }

  /** Age every live ball + puff on the sim clock; land impacts; prune spent slots. Deterministic. */
  function update(dt) {
    if (!(dt > 0)) return;
    for (const b of balls) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age >= b.tof) {
        b.active = false;
        // The ball arrives: a spark on the hull (hit) or a plume in the water (miss).
        if (b.hit) { spawnFx('hit', b.to, HIT_LIFE); spawned.hits++; }
        else { spawnFx('splash', b.to, SPLASH_LIFE); spawned.splashes++; }
      }
    }
    for (const s of fx) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.life) s.active = false;
    }
  }

  /**
   * Walk the WHOLE ball pool (active + idle) in stable slot order, so the shell can write one
   * InstancedMesh matrix per slot. `cb(index, pos|null)` — pos is the live arc position, null when idle
   * (the shell scales that instance to 0). The math lives here; THREE stays in main.js.
   */
  function eachBall(cb) {
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      cb(i, b.active ? arcPoint(b.from, b.to, b.age / b.tof, b.apex) : null);
    }
  }

  /** Walk the WHOLE fx pool: `cb(index, pos|null, scale, kind)`. scale is the pop envelope (0 when idle). */
  function eachFx(cb) {
    for (let i = 0; i < fx.length; i++) {
      const s = fx[i];
      cb(i, s.active ? s.pos : null, s.active ? popEnvelope(s.age, s.life) : 0, s.active ? s.kind : null);
    }
  }

  /** How many balls / puffs are live right now. */
  function activeBalls() { return balls.reduce((a, b) => a + (b.active ? 1 : 0), 0); }
  function activeFx() { return fx.reduce((a, s) => a + (s.active ? 1 : 0), 0); }
  function active() { return activeBalls() > 0 || activeFx() > 0; }

  /** Clear the whole pool (a new voyage / a fight ends) — no meshes freed, just slots deactivated. */
  function clear() {
    for (const b of balls) b.active = false;
    for (const s of fx) s.active = false;
  }

  /** A JSON-safe snapshot for the window.__tidewake QA hook — proves a fire spawned + hits≠misses. */
  function snapshot() {
    return {
      reducedMotion,
      active: active(),
      balls: activeBalls(),
      fx: activeFx(),
      // Monotone tallies: a headless test fires an abeam (hit) volley and a wide (miss) one and asserts
      // hits and splashes each climbed — hit and miss read differently, off the resolved shot.
      spawned: { ...spawned },
      lastShot: lastShot ? { hit: lastShot.hit, count: lastShot.count } : null,
    };
  }

  return { fire, update, eachBall, eachFx, activeBalls, activeFx, active, clear, snapshot };
}
