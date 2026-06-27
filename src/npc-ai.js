// Pure, three-free steering + waypoint math for NPC ships.
// Kept in its own module (no `import * as THREE`) so it is unit-testable in plain
// node and reusable by anything that needs cheap "sail toward a point" behaviour.
//
// Heading convention matches the rest of Tidewake (ship.js / wake.js):
//   forward vector = (sin(heading), cos(heading))
// so heading 0 points toward +Z, +PI/2 toward +X.

const TAU = Math.PI * 2;

// Normalise an angle to (-PI, PI].
export function wrapAngle(a) {
  a = a % TAU;
  if (a <= -Math.PI) a += TAU;
  else if (a > Math.PI) a -= TAU;
  return a;
}

// Rotate `heading` toward `targetHeading` by at most `maxRate * dt` radians,
// taking the shortest way around the circle and never overshooting. The result
// is always normalised.
export function steerToward(heading, targetHeading, maxRate, dt) {
  const diff = wrapAngle(targetHeading - heading);
  const step = maxRate * dt;
  if (Math.abs(diff) <= step) return wrapAngle(targetHeading);
  return wrapAngle(heading + Math.sign(diff) * step);
}

// Heading that points from (fromX,fromZ) toward (toX,toZ).
export function headingTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

// Pick a random waypoint within an axis-aligned box. `rng` is a 0..1 generator.
export function pickWaypoint(rng, bounds) {
  return {
    x: bounds.minX + rng() * (bounds.maxX - bounds.minX),
    z: bounds.minZ + rng() * (bounds.maxZ - bounds.minZ),
  };
}

// Has a ship at (x,z) reached the waypoint at (wx,wz)? (<= radius counts.)
export function hasArrived(x, z, wx, wz, radius) {
  const dx = wx - x;
  const dz = wz - z;
  return dx * dx + dz * dz <= radius * radius;
}

// Crude, allocation-free island avoidance. Given a desired heading, if an island
// (with a safety margin) lies roughly ahead within `lookahead`, nudge the heading
// to the side it is offset from so the ship curves around instead of beaching.
// Returns the (possibly deflected) desired heading, normalised.
export function avoidObstacles(x, z, desired, islands, lookahead) {
  let steer = 0;
  const fx = Math.sin(desired);
  const fz = Math.cos(desired);
  for (let i = 0; i < islands.length; i++) {
    const isle = islands[i];
    const dx = isle.x - x;
    const dz = isle.z - z;
    const dist = Math.hypot(dx, dz);
    const safe = isle.r + 60; // hull + comfortable berth
    if (dist > lookahead + safe || dist < 1e-3) continue;
    // forward distance toward the island along the desired heading
    const ahead = dx * fx + dz * fz;
    if (ahead <= 0) continue; // island is behind us
    // signed sideways offset (starboard positive): right = (cos h, -sin h)
    const side = dx * Math.cos(desired) - dz * Math.sin(desired);
    // how directly the island blocks our path, weighted by proximity
    const closeness = 1 - dist / (lookahead + safe);
    const urgency = closeness * Math.max(0, ahead / dist);
    // turn AWAY from the side the island sits on; if dead-ahead, pick a side
    const dir = Math.abs(side) < 1e-3 ? 1 : -Math.sign(side);
    steer += dir * urgency;
  }
  if (steer === 0) return wrapAngle(desired);
  // cap the deflection so steering stays smooth
  const maxDeflect = 1.2;
  const deflect = Math.max(-maxDeflect, Math.min(maxDeflect, steer));
  return wrapAngle(desired + deflect);
}
