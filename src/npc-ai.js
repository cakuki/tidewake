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

// ── Arena foe helm — the dedicated BATTLE maneuvering brain (#135, Option-4 final slice) ──────────
// Open-sea NPCs wander between waypoints; that made a boarded/engaged foe drift inertly the moment you
// squared up. This is the foe's DUEL brain instead: a PURE helm decision — no THREE, no state, no rng —
// that turns her relative position + her broken-ness (crew nerve) into a single desired heading + a
// throttle, so she actively sails to FIGHT. Four readable stances:
//   flee   — nerve broken: bolt straight downwind of the fight, every stitch of sail out.
//   close  — too far to trade shot: bear straight down on you to shorten the range.
//   open   — fouling-close: fall off to open the range back to a fighting stand-off.
//   beam   — in the fighting band: make for a station square off YOUR beam at hold-range, so she
//            crosses to rake you rather than bowing straight on — the duel circles.
// Convention matches the sim: forward = (sin h, cos h), starboard = (cos h, −sin h).
//
// ARENA_FLEE_MORALE sits BELOW the 0.25 "strike her colours" line (cannons.MORALE_BREAK): a foe you're
// beating STRIKES (offers surrender) before she'd ever reach the flee branch, so flee is the flavour of
// a nerve-shattered-but-unholed ship breaking contact — it never pre-empts the surrender/board couplings.
export const ARENA_HOLD_RANGE = 150; // the stand-off she fights at — close enough to trade broadsides
export const ARENA_RANGE_BAND = 45;  // slack around it before she closes/opens (a dead-band, no jitter)
export const ARENA_FLEE_MORALE = 0.2; // nerve fraction at/below which she breaks contact and runs

export function arenaHelm(
  { foeX, foeZ, foeHeading = 0, playerX, playerZ, playerHeading = 0, moraleFrac = 1 },
  { holdRange = ARENA_HOLD_RANGE, band = ARENA_RANGE_BAND, fleeMorale = ARENA_FLEE_MORALE } = {},
) {
  const dx = playerX - foeX, dz = playerZ - foeZ;
  const dist = Math.hypot(dx, dz) || 1e-6;
  const toPlayer = Math.atan2(dx, dz);            // headingTo(foe → player)
  const awayFromPlayer = wrapAngle(toPlayer + Math.PI);

  // Nerve broken → run for the horizon (all sail).
  if (moraleFrac <= fleeMorale) {
    return { state: 'flee', desiredHeading: awayFromPlayer, throttle: 1 };
  }
  // Out of fighting range → close, bows on.
  if (dist > holdRange + band) {
    return { state: 'close', desiredHeading: toPlayer, throttle: 1 };
  }
  // Fouling close → fall off and open the range back up.
  if (dist < holdRange - band) {
    return { state: 'open', desiredHeading: awayFromPlayer, throttle: 0.55 };
  }
  // In the band → seek a station square off the player's beam at hold-range; commit to whichever hand
  // (port/starboard of the player) she already lies nearer, so the engagement reads as a circling duel.
  const beamR = wrapAngle(playerHeading + Math.PI / 2); // player's starboard beam direction
  const bx = Math.sin(beamR), bz = Math.cos(beamR);
  const stbdX = playerX + bx * holdRange, stbdZ = playerZ + bz * holdRange;
  const portX = playerX - bx * holdRange, portZ = playerZ - bz * holdRange;
  const dStbd = Math.hypot(stbdX - foeX, stbdZ - foeZ);
  const dPort = Math.hypot(portX - foeX, portZ - foeZ);
  const [tx, tz] = dStbd <= dPort ? [stbdX, stbdZ] : [portX, portZ];
  return { state: 'beam', desiredHeading: headingTo(foeX, foeZ, tx, tz), throttle: 0.75 };
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
