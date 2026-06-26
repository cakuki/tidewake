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
