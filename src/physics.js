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

// ---- Eased rudder (#20) ----------------------------------------------------------------
// CREATIVE SPARK (Game Designer): the helm should feel like a real wheel, not a switch. Hold
// the rudder over and the turn ACCELERATES in (the bow swings harder the longer you hold);
// let go and it SETTLES smoothly back amidships. The yaw a step applies is the eased rudder
// times the speed-scaled steerRate — so the turn-in and turn-out are gentle ramps, never the
// old instant constant-yaw snap. (A soft wheel-creak SFX as the rudder swings is the natural
// audio companion — noted for the Sound Engineer, not built here.) Pure + frame-rate
// independent: it reuses approach()'s clamped exponential ease, so a big frame hitch can never
// fling the rudder past the input. Research-backed feel: "ease state with rates, don't snap it."

/** How fast the rudder swings toward the held steer input (per second). Tuned weighty-but-
 *  responsive: a quick tap nudges the bow, holding hard-over reaches near-full rudder in ~0.8s,
 *  releasing centres it just as smoothly. (If turning feels twitchy/sluggish, retune here.) */
export const RUDDER_RATE = 3.5;

/**
 * Ease a rudder value toward the held steer input. `input` is the raw steer command in [-1,1]
 * (1 = hard a-port, -1 = hard a-starboard, 0 = released/neutral); `rudder` is the current eased
 * position. Holding an input ramps the rudder IN toward it; releasing (input 0) settles it back
 * to neutral. Never overshoots the input (clamped step via approach()), so it's safe at any dt.
 * @param {number} rudder  current eased rudder position in [-1,1]
 * @param {number} input   commanded steer in [-1,1]
 * @param {number} dt      timestep in seconds
 * @param {number} [rate]  easing rate per second (defaults to RUDDER_RATE)
 * @returns {number} the eased rudder position
 */
export function easeRudder(rudder, input, dt, rate = RUDDER_RATE) {
  return approach(rudder, input, dt, rate);
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

// ---- Arcade tangential slide (#76 a2) -------------------------------------------------
// The polish that makes contact feel arcade-smooth: when the hull touches a coast or another
// hull at an ANGLE, it should SLIDE along the surface and keep its way — losing only the part of
// its velocity heading INTO the surface (the normal component), never the part skimming ALONG it
// (the tangential component). A head-on hit (velocity straight into the surface) loses everything
// and bleeds to a stop; a glancing graze (velocity nearly parallel) loses almost nothing and
// glides on. This is the single shared rule both the island and the ship-vs-ship resolvers feed
// their speed through, so coasts and hulls feel identical underfoot. Pure: numbers in, numbers
// out. Research-backed feel (Game Developer): "a coast should graze and bleed speed / slide the
// hull along the shoreline, not halt it dead."

/**
 * Strip the into-the-surface (normal) component from a velocity, keeping the tangential (sliding)
 * component intact — the heart of the arcade slide. `(nx,nz)` is the OUTWARD contact normal (the
 * direction the hull was pushed out of the surface), as the resolvers return it. Velocity heading
 * AWAY from the surface (or exactly along it) is returned untouched — contact only resists motion
 * pressing INTO the surface. A zero/degenerate normal (no real contact) is a no-op.
 *
 * @param {number} vx  velocity x
 * @param {number} vz  velocity z
 * @param {number} nx  outward contact normal x (need not be unit length)
 * @param {number} nz  outward contact normal z
 * @returns {{vx:number, vz:number}} velocity with the into-surface component removed
 */
export function slideVelocity(vx, vz, nx, nz) {
  const nLen = Math.hypot(nx, nz);
  if (nLen < 1e-9) return { vx, vz };          // no contact normal → nothing to slide against
  const ux = nx / nLen, uz = nz / nLen;        // unit outward normal
  const vn = vx * ux + vz * uz;                // velocity component along the OUTWARD normal
  if (vn >= 0) return { vx, vz };              // moving away/along the surface → keep all of it
  return { vx: vx - vn * ux, vz: vz - vn * uz }; // remove only the into-surface (negative) part
}

// ---- Arcade island collision (#76 a1 + beach fix) -------------------------------------
// Islands stop you — but soft and arcade-y, never a brick wall. We collide the hull against
// a simple SHAPE per island (its visible shoreline), not the jagged beach mesh: cheaper AND
// fairer (no snagging on a stray palm). On contact the hull is pushed back out to the coast
// and, because the push is purely radial (in the shape's own space), the ship naturally
// SLIDES along the shoreline frame-to-frame instead of slamming dead-stop or sticking.
// Research-backed feel (Game Developer, Rocket League's single box collider): "precise
// collisions would have made the game feel more random and complicated."
//
// #76 beach fix (owner P1): the original 0.9·r hitbox sat WELL INSIDE the visible beach, so
// the shoreline was sailable — the hull slid onto the sand. Islands are now SOLID to their
// real coastline: the beach cylinder (world.js) reaches ~1.107·r at the waterline, so the
// solid boundary is set THERE (ISLAND_HITBOX), plus the hull's half-size so the hull EDGE —
// not its centre — comes to rest at the sand. Footprints are squashed ellipses (world.js
// scales the beach by sx,sz per island); when those scales are supplied the resolver follows
// the ellipse, so the coast is solid on every bearing without walling open water on the
// narrow axis. Circles (no sx/sz) reduce to the original radial case.
//
// #76 owner follow-up: "I can still go into a bit of sand — increase the collision model a bit
// more." The catch is the BOW: the hull's visible bow reaches ~8 ahead of centre (ship.js
// halfLen) while the collision circle only guards SHIP_RADIUS=7, so at 1.12·r the bow tip still
// kissed the waterline (1.107·r + bow overhang) on the smaller isles. Nudged the factor to
// 1.18·r so the hull EDGE rests a clear hull's-width off the sand and the visible bow stops in
// the water on every island — without it feeling like an invisible wall out in open sea.

/** Ship's forgiving collision radius (world units). The hull is ~16 long / 6 abeam; a single
 *  circle a touch over the half-beam keeps grazes fair and snag-free. */
export const SHIP_RADIUS = 7;
/** Multiplier on an island's `r` giving its SOLID visible shoreline. world.js's beach cylinder
 *  reaches ~1.107·r at the waterline; 1.18 keeps a clear hull's-width of water so the bow stops
 *  OFF the sand (the bow overhangs the collision circle — see the #76 follow-up note above),
 *  not so far out it walls open water. (If the beach geometry in world.js changes, retune this.) */
export const ISLAND_HITBOX = 1.18;

/**
 * Push a point out of any overlapping island footprints to their solid shoreline boundary.
 * Pure: numbers in, numbers out. Each island's solid region is the ellipse with semi-axes
 * `r*hitbox*sx + shipR` (x) and `r*hitbox*sz + shipR` (z) — a circle when sx=sz=1 (or absent).
 * A point inside is shoved out along its bearing in the ellipse's own (unit-circle) space —
 * never past, never left buried — which preserves the bearing so the hull slides along the
 * coast. Runs a couple of relaxation passes so a hull wedged between two overlapping isles
 * settles instead of ping-ponging. A dead-centre hull is ejected along +x (no divide-by-zero).
 *
 * Also returns the OUTWARD contact normal `(nx,nz)` — the unit direction the point was net-pushed
 * out of the surface — so the caller can slide velocity along the coast (#76 a2). Zero when no hit.
 *
 * @param {{x:number,z:number}} p  hull centre on the x/z sea plane
 * @param {Array<{x:number,z:number,r:number,sx?:number,sz?:number}>} circles  island footprints
 * @param {{shipR?:number, hitbox?:number}} [opts]
 * @returns {{x:number, z:number, hit:boolean, nx:number, nz:number}}
 */
export function resolveCircleCollision(p, circles, opts = {}) {
  const shipR = opts.shipR ?? SHIP_RADIUS;
  const hitbox = opts.hitbox ?? ISLAND_HITBOX;
  let x = p.x, z = p.z, hit = false;
  for (let iter = 0; iter < 2; iter++) {
    let moved = false;
    for (const c of circles) {
      // Solid shoreline semi-axes (ellipse when squashed; circle when sx=sz=1), hull-inflated.
      const ax = c.r * hitbox * (c.sx ?? 1) + shipR;
      const az = c.r * hitbox * (c.sz ?? 1) + shipR;
      const dx = x - c.x, dz = z - c.z;
      let ux = dx / ax, uz = dz / az;           // into the ellipse's unit-circle space
      let du = Math.hypot(ux, uz);
      if (du < 1) {                              // inside the solid footprint
        if (du < 1e-6) { ux = 1; uz = 0; du = 1; } // dead-centre: eject along +x
        const k = 1 / du;                        // scale the bearing out to the boundary
        x = c.x + ux * k * ax;                    // snap the hull onto the coast boundary
        z = c.z + uz * k * az;
        hit = true; moved = true;
      }
    }
    if (!moved) break;
  }
  // Outward contact normal = the unit direction of the net push-out (#76 a2 slide).
  let nx = 0, nz = 0;
  if (hit) {
    const pxv = x - p.x, pzv = z - p.z, pl = Math.hypot(pxv, pzv);
    if (pl > 1e-9) { nx = pxv / pl; nz = pzv / pl; }
  }
  return { x, z, hit, nx, nz };
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
 * @param {Array<{x:number,z:number,r:number,sx?:number,sz?:number}>} circles
 * Also returns the OUTWARD contact normal `(nx,nz)` of the LAST sub-step that touched — the
 * surface the hull is pressing against at the end of the step — so the caller can slide velocity
 * along it (#76 a2). Zero when nothing was hit.
 *
 * @param {{shipR?:number, hitbox?:number, maxStep?:number}} [opts]
 * @returns {{x:number, z:number, hit:boolean, nx:number, nz:number}}
 */
export function sweepIslandCollision(prev, next, circles, opts = {}) {
  const shipR = opts.shipR ?? SHIP_RADIUS;
  const hitbox = opts.hitbox ?? ISLAND_HITBOX;
  // Sub-step no larger than the SMALLEST solid semi-axis so a fast hull can't tunnel a thin
  // island (use the narrow axis of a squashed footprint, not just its `r`).
  let minR = Infinity;
  for (const c of circles) {
    minR = Math.min(minR, c.r * hitbox * (c.sx ?? 1) + shipR, c.r * hitbox * (c.sz ?? 1) + shipR);
  }
  const maxStep = opts.maxStep ?? (Number.isFinite(minR) ? Math.max(2, minR * 0.5) : Infinity);
  const dx = next.x - prev.x, dz = next.z - prev.z;
  const dist = Math.hypot(dx, dz);
  const steps = Number.isFinite(maxStep) ? Math.max(1, Math.ceil(dist / maxStep)) : 1;
  const stepX = dx / steps, stepZ = dz / steps;
  let x = prev.x, z = prev.z, hit = false, nx = 0, nz = 0;
  for (let i = 0; i < steps; i++) {
    x += stepX; z += stepZ;
    const r = resolveCircleCollision({ x, z }, circles, { shipR, hitbox });
    x = r.x; z = r.z;
    if (r.hit) { hit = true; nx = r.nx; nz = r.nz; } // keep the LAST contact's outward normal
  }
  return { x, z, hit, nx, nz };
}

// ---- Arcade ship-vs-ship collision (#76 b) --------------------------------------------
// The player ship should BUMP other vessels, not sail clean through them. We reuse the exact
// circle-hitbox push-out/slide the island resolver uses — an NPC is just a moving circle. The
// boundary is the two hulls' forgiving radii summed (SHIP_RADIUS + NPC_RADIUS), so the hulls
// come to rest gunwale-to-gunwale instead of interpenetrating; a head-on charge piles up and
// bleeds speed (arcade-soft, not a brick wall) while a glancing approach slides along and keeps
// most of its way on. PLAYER-ONLY resolution keeps the NPC wander AI deterministic and untouched
// — the player is shoved off the other captain, the other captain sails on. Pure: numbers in,
// numbers out, so the whole bump model unit-tests under node. Research-backed feel (Game
// Developer): forgiving circle hitboxes beat precise ones, and a collision should graze/recover,
// never dead-stop.

/** Forgiving collision radius for an NPC vessel (world units). NPC hulls are ~12 long; a single
 *  circle a touch over the half-length keeps ship-vs-ship bumps fair and snag-free, matching the
 *  player's own SHIP_RADIUS. Summed with SHIP_RADIUS the two hulls rest gunwale-to-gunwale. */
export const NPC_RADIUS = 9;

/**
 * Build flat collision circles from NPC snapshots (`{ pos:[x,z] }`, as `npcs.snapshot()` returns).
 * Pure. Skips any malformed entry so a transient missing vessel never throws in the sim step.
 * @param {Array<{pos:[number,number]}>} npcs
 * @param {number} [r=NPC_RADIUS]  forgiving per-vessel radius
 * @returns {Array<{x:number,z:number,r:number}>}
 */
export function shipCircles(npcs, r = NPC_RADIUS) {
  const out = [];
  if (!npcs) return out;
  for (const n of npcs) {
    if (n && Array.isArray(n.pos) && n.pos.length >= 2) out.push({ x: n.pos[0], z: n.pos[1], r });
  }
  return out;
}

/**
 * Swept arcade ship-vs-ship collision. Resolves the PLAYER hull's motion from `prev` to `next`
 * against other vessels (circles), pushing it out + sliding it along — a thin wrapper over
 * `sweepIslandCollision` with a `hitbox` of 1, because an NPC circle's `r` already IS its
 * forgiving radius (no shoreline inflation): the solid boundary is exactly `r + shipR`. The
 * sweep's sub-stepping still forbids a fast charge tunnelling clean through a smaller vessel.
 * Returns the same shape as `sweepIslandCollision`, including the outward contact normal
 * `(nx,nz)` so the player's velocity slides along the other hull (#76 a2).
 * @param {{x:number,z:number}} prev  position before this step
 * @param {{x:number,z:number}} next  integrated position (pre-collision)
 * @param {Array<{x:number,z:number,r:number}>} ships  other vessels' circles (shipCircles())
 * @param {{shipR?:number, maxStep?:number}} [opts]
 * @returns {{x:number, z:number, hit:boolean, nx:number, nz:number}}
 */
export function sweepShipCollision(prev, next, ships, opts = {}) {
  return sweepIslandCollision(prev, next, ships, { hitbox: 1, ...opts });
}

// ---- Arcade slow-to-stop for harbouring & fighting (#76 c) ----------------------------
// Arriving at a berth or squaring up for a fight should FEEL like the ship carries momentum:
// it coasts in and settles, it doesn't teleport-freeze. The decel is an EASE — approach()
// toward a lowered target, the very same easing the throttle/wind model already uses — never
// a snap. Research-backed arcade feel (Game Developer): "ease speed with forces, don't snap
// state." Pure: numbers in, numbers out, so the whole settle model unit-tests under node.

/** Approach rate (per second) for easing the ship down to settle for harbour/fight. Gentle
 *  enough to read as a deliberate glide, firm enough that the ship squares up promptly. */
export const SETTLE_RATE = 1.6;

/**
 * Speed multiplier as the hull enters a harbour's settling band. At/beyond `radius` it's 1
 * (full control, open water); inside, it eases smoothly down to 0 at the berth so the ship
 * coasts in and settles instead of barrelling through. Smoothstep gives a soft knee at both
 * ends — barely-there at the harbour mouth, gentle at the berth. Pure.
 * @param {number} distance  distance from the port point
 * @param {number} radius    radius at which settling begins (e.g. DOCK_RADIUS)
 * @returns {number} multiplier in [0,1]
 */
export function harbourSlowFactor(distance, radius) {
  if (!(radius > 0) || distance >= radius) return 1;
  const t = Math.max(0, distance / radius);   // 0 at the berth, 1 at the harbour mouth
  return t * t * (3 - 2 * t);                  // smoothstep: soft at both ends
}

/**
 * The speed the ship should EASE toward this step, given the player's desired (throttle/wind)
 * target and any active settle reason. A fight forces a near-stop (target 0 — sails reefed,
 * the crew's at the guns); approaching a harbour scales the desired target down by
 * harbourSlowFactor so the hull coasts in. Whichever reason slows more wins. Pure: the actual
 * easing is approach(speed, this, dt, SETTLE_RATE) at the call site, so it never overshoots.
 * @param {number} desired  the throttle/wind steady-state speed (targetSpeed())
 * @param {{fighting?:boolean, harbourDistance?:number, harbourRadius?:number}} [opts]
 * @returns {number} the (possibly lowered) target speed, in [0, desired]
 */
export function settledTargetSpeed(desired, opts = {}) {
  if (opts.fighting) return 0; // battle stations — coast to a halt regardless of the helm
  const f = harbourSlowFactor(opts.harbourDistance ?? Infinity, opts.harbourRadius ?? 0);
  return desired * f;
}
