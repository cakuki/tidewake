// Pure sailing physics — no three.js, no DOM. Plain numbers in, numbers out.
// Extracted from main.js's update() so the model can be unit-tested in isolation
// and shared with the renderer (main.js) and the wake (wake.js). Keeping this
// dependency-free is the whole point: it runs under `node --test`.

/**
 * Wind multiplier on achievable speed. Sailing with the wind (downwind) is
 * faster than sailing into it (upwind).
 * @param {number} heading  ship heading in radians (0 = +Z)
 * @param {number} windDir  wind direction in radians
 * @returns {number} multiplier in [0.55, 1.0] — 1.0 downwind, 0.55 upwind
 */
export function windFactor(heading, windDir) {
  const intoWind = Math.cos(heading - windDir); // 1 downwind, -1 upwind
  return 0.55 + 0.45 * (intoWind * 0.5 + 0.5);
}

/**
 * Steady-state speed the ship eases toward for a given throttle + wind angle.
 * @param {number} throttle  0..1
 * @param {number} maxSpeed  world units/sec at full throttle, perfect wind
 * @param {number} heading   radians
 * @param {number} windDir   radians
 * @returns {number} target speed in world units/sec
 */
export function targetSpeed(throttle, maxSpeed, heading, windDir) {
  return throttle * maxSpeed * windFactor(heading, windDir);
}

/**
 * Frame-rate independent exponential easing of a value toward a target.
 * Never overshoots while dt*rate <= 1. Used for speed easing (rate 1.5).
 * @param {number} current  current value
 * @param {number} target   target value
 * @param {number} dt        timestep in seconds
 * @param {number} rate      approach rate (per second)
 * @returns {number} eased value
 */
export function approach(current, target, dt, rate) {
  return current + (target - current) * Math.min(1, dt * rate);
}

/**
 * Per-second heading change per unit of steer input. Turning is sluggish at
 * rest (small floor so you can still nudge the bow) and firms up with speed,
 * capped once you're moving well.
 * @param {number} speed  world units/sec
 * @returns {number} radians/sec of heading change at steer = 1
 */
export function steerRate(speed) {
  return 0.9 * Math.min(1, speed / 12 + 0.15);
}

/**
 * Smallest angle between the ship's heading and the wind's "downwind" direction
 * (the way windDir points). 0 = sailing dead downwind (running), PI = pointed
 * straight into the wind (in irons). Always folded to [0, PI], so port and
 * starboard tacks at the same offset read identically.
 * @param {number} heading  ship heading in radians
 * @param {number} windDir  wind direction in radians (0 == fastest heading)
 * @returns {number} angle in [0, PI]
 */
export function relativeWindAngle(heading, windDir) {
  const d = heading - windDir;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); // wrap to [-PI,PI], fold
}

/**
 * Point of sail given heading vs wind: a readable label, an efficiency band for
 * colouring (good → fair → poor), and the underlying speed multiplier. Driven by
 * relativeWindAngle: dead downwind reads "Running" (best), dead upwind "In irons"
 * (worst), abeam "Reaching".
 * @param {number} heading  ship heading in radians
 * @param {number} windDir  wind direction in radians
 * @returns {{label: string, band: 'good'|'fair'|'poor', efficiency: number, angle: number}}
 */
export function pointOfSail(heading, windDir) {
  const angle = relativeWindAngle(heading, windDir);
  const efficiency = windFactor(heading, windDir);
  let label, band;
  if (angle < 0.30 * Math.PI) { label = 'Running'; band = 'good'; }
  else if (angle < 0.55 * Math.PI) { label = 'Reaching'; band = 'good'; }
  else if (angle < 0.78 * Math.PI) { label = 'Close-hauled'; band = 'fair'; }
  else { label = 'In irons'; band = 'poor'; }
  return { label, band, efficiency, angle };
}

/**
 * Normalized wake/foam intensity from speed. 0 at rest, monotonically rising,
 * clamped to [0,1]. Mirrors wake.js's speed->intensity mapping so the foam
 * model and the physics model stay consistent.
 * @param {number} speed     world units/sec
 * @param {number} maxSpeed  world units/sec at full speed
 * @returns {number} intensity in [0,1]
 */
export function wakeIntensity(speed, maxSpeed) {
  return Math.min(1, Math.max(0, speed / maxSpeed));
}

// ---- Ports & arrival (data-driven, three.js/DOM-free so it unit-tests) ----
// A "port" is plain data: { name, x, z }. The horizontal (x,z) plane is the sea;
// height (y) is irrelevant to docking, so it's ignored.

/**
 * Nearest port to a position, by horizontal distance.
 * @param {{x:number,z:number}} pos  ship position (y ignored)
 * @param {Array<{name:string,x:number,z:number}>} ports
 * @returns {{port: object, distance: number} | null} null if no ports
 */
export function nearestPort(pos, ports) {
  let best = null, bestD = Infinity;
  for (const p of ports) {
    const d = Math.hypot(pos.x - p.x, pos.z - p.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { port: best, distance: bestD } : null;
}

/**
 * Whether a position is within a port's docking radius (inclusive boundary).
 * @param {{x:number,z:number}} pos
 * @param {{x:number,z:number}} port
 * @param {number} radius  docking radius in world units
 * @returns {boolean}
 */
export function isDocked(pos, port, radius) {
  return Math.hypot(pos.x - port.x, pos.z - port.z) <= radius;
}

/**
 * One step of the arrival state machine. Given the name of the port we were
 * docked at last step (or null), report which port we're docked at now and
 * whether this step is a *fresh* arrival (entered a port we weren't already at).
 * Leaving a port sets dockedName back to null, which re-arms the next arrival —
 * so arrival fires exactly once per visit, and again if you leave and return.
 * @param {string|null} prevDockedName
 * @param {{x:number,z:number}} pos
 * @param {Array<{name:string,x:number,z:number}>} ports
 * @param {number} radius
 * @returns {{dockedName: string|null, dockedPort: object|null, arrived: boolean}}
 */
export function dockingUpdate(prevDockedName, pos, ports, radius) {
  const near = nearestPort(pos, ports);
  const dockedPort = near && near.distance <= radius ? near.port : null;
  const dockedName = dockedPort ? dockedPort.name : null;
  const arrived = dockedName !== null && dockedName !== prevDockedName;
  return { dockedName, dockedPort, arrived };
}

// ---- Arcade island collision (#76 a1) -------------------------------------------------
// Islands stop you — but soft and arcade-y, never a brick wall. We collide the hull
// against a forgiving CIRCLE per island (its world.js radius), not the jagged beach mesh:
// cheaper AND fairer (no snagging on a stray palm). On contact the hull is pushed back out
// to the coast and, because the push is purely radial, the ship naturally SLIDES along the
// shoreline frame-to-frame instead of slamming dead-stop or sticking. Research-backed feel
// (Game Developer, Rocket League's single box collider): "precise collisions would have made
// the game feel more random and complicated."

/** Ship's forgiving collision radius (world units). The hull is ~16 long / 6 abeam; a single
 *  circle a touch over the half-beam keeps grazes fair and snag-free. */
export const SHIP_RADIUS = 7;
/** Fraction of an island's visual radius treated as *solid*. Slightly under 1 so you graze the
 *  beach instead of catching on open water (island footprints are squashed ellipses; an under-
 *  radius circle never juts out past the sand). */
export const ISLAND_HITBOX = 0.9;

/**
 * Push a point out of any overlapping island circles to their solid boundary. Pure: numbers
 * in, numbers out. A point inside a circle is shoved radially out to `r*hitbox + shipR` —
 * never past, never left buried. Runs a couple of relaxation passes so a hull wedged between
 * two overlapping isles settles instead of ping-ponging. A dead-centre hull (zero distance)
 * is ejected along +x rather than dividing by zero.
 *
 * @param {{x:number,z:number}} p  hull centre on the x/z sea plane
 * @param {Array<{x:number,z:number,r:number}>} circles  island circles (world radius)
 * @param {{shipR?:number, hitbox?:number}} [opts]
 * @returns {{x:number, z:number, hit:boolean}}
 */
export function resolveCircleCollision(p, circles, opts = {}) {
  const shipR = opts.shipR ?? SHIP_RADIUS;
  const hitbox = opts.hitbox ?? ISLAND_HITBOX;
  let x = p.x, z = p.z, hit = false;
  for (let iter = 0; iter < 2; iter++) {
    let moved = false;
    for (const c of circles) {
      const R = c.r * hitbox + shipR;
      let dx = x - c.x, dz = z - c.z;
      let d = Math.hypot(dx, dz);
      if (d < R) {
        if (d < 1e-6) { dx = 1; dz = 0; d = 1; } // dead-centre: eject along +x
        const nx = dx / d, nz = dz / d;          // unit outward normal
        x = c.x + nx * R;                         // snap the hull onto the coast boundary
        z = c.z + nz * R;
        hit = true; moved = true;
      }
    }
    if (!moved) break;
  }
  return { x, z, hit };
}

/**
 * Swept arcade island collision. Resolves the hull's motion from `prev` to `next`, advancing
 * in sub-steps no larger than half the smallest solid radius so a FAST ship can't tunnel
 * clean through a small island in one frame — each sub-step advances then pushes back out, so
 * a head-on charge piles up against the near coast (it never pops out the far side) while a
 * glancing pass slides along and keeps most of its way on.
 *
 * @param {{x:number,z:number}} prev  position before this step
 * @param {{x:number,z:number}} next  integrated position (pre-collision)
 * @param {Array<{x:number,z:number,r:number}>} circles
 * @param {{shipR?:number, hitbox?:number, maxStep?:number}} [opts]
 * @returns {{x:number, z:number, hit:boolean}}
 */
export function sweepIslandCollision(prev, next, circles, opts = {}) {
  const shipR = opts.shipR ?? SHIP_RADIUS;
  const hitbox = opts.hitbox ?? ISLAND_HITBOX;
  let minR = Infinity;
  for (const c of circles) minR = Math.min(minR, c.r * hitbox + shipR);
  const maxStep = opts.maxStep ?? (Number.isFinite(minR) ? Math.max(2, minR * 0.5) : Infinity);
  const dx = next.x - prev.x, dz = next.z - prev.z;
  const dist = Math.hypot(dx, dz);
  const steps = Number.isFinite(maxStep) ? Math.max(1, Math.ceil(dist / maxStep)) : 1;
  const stepX = dx / steps, stepZ = dz / steps;
  let x = prev.x, z = prev.z, hit = false;
  for (let i = 0; i < steps; i++) {
    x += stepX; z += stepZ;
    const r = resolveCircleCollision({ x, z }, circles, { shipR, hitbox });
    x = r.x; z = r.z;
    if (r.hit) hit = true;
  }
  return { x, z, hit };
}
