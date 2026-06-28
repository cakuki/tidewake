// Living sea fauna (#97) — PURE flock math. No three.js, no DOM, no game state: plain
// numbers in, numbers out, so the spawn / wheel / cull / drift model is node-testable in
// isolation (same pure-split pattern as npc-ai.js, physics.js, ship-loader-math.js). The
// three.js InstancedMesh factory lives in fauna.js and consumes these.
//
// The first fauna beat (#97 phase 1): a small flock of GULLS that wheels overhead and
// keeps the ship company — a reactive verb, the world answering "where are you / what are
// you doing". They trail your wake hunting galley scraps out at sea, and DRIFT to hang over
// the shore as you raise an island. One InstancedMesh = one draw call for the whole flock,
// and the flock is hidden wholesale (0 draws) when it drifts beyond the cull radius — so a
// living sky costs almost nothing.

export const GULL_COUNT = 7;          // a small, believable flock — cheap, reads as "alive"
export const FLOCK_HEIGHT = 46;       // metres the flock wheels above the sea
export const ROOST_RANGE = 520;       // within this of a coast, the flock drifts to wheel over land
export const CULL_RADIUS = 900;       // beyond this from the camera focus → hide the whole mesh (0 draws)
export const WHEEL_MIN_R = 55;        // tightest wheel radius
export const WHEEL_SPAN_R = 70;       // spread of wheel radii across the flock
export const FLAP_DEPTH = 0.42;       // how much the wing-beat squashes the silhouette (0..1)

const GOLDEN_ANGLE = 2.399963229728653; // spread phases so birds never clump into a rigid ring

/**
 * Deterministic per-gull flight parameters from its index — a LOOSE flock (varied radius,
 * altitude, phase, wing-beat) rather than a rigid carousel. Pure: same index → same bird.
 *   gullParams(i, count) -> { phase, radius, height, angSpeed, bobPhase, bobAmp, flapPhase, flapRate }
 */
export function gullParams(i, count = GULL_COUNT) {
  const f = count > 1 ? i / (count - 1) : 0;
  return {
    phase: (i * GOLDEN_ANGLE) % (Math.PI * 2),
    radius: WHEEL_MIN_R + f * WHEEL_SPAN_R,        // inner birds tight, outer birds wide
    height: ((i * 7) % 13) - 6,                    // staggered -6..+6 around FLOCK_HEIGHT
    angSpeed: 0.28 + 0.05 * (i % 3),               // all wheel the same way, gently smeared
    bobPhase: i * 1.7,
    bobAmp: 2.0 + (i % 2) * 1.2,
    flapPhase: i * 2.3,
    flapRate: 7 + (i % 3),                          // wing-beats are quick + slightly varied
  };
}

/**
 * Where a single gull is at time `t`, wheeling around the flock `center` ({x,y,z}).
 * Returns world position + the yaw it should face (tangent to its wheel = its flight
 * direction). Pure + deterministic.
 *   gullPosition(p, center, t) -> { x, y, z, yaw }
 */
export function gullPosition(p, center, t) {
  const a = p.phase + p.angSpeed * t;
  const ca = Math.cos(a), sa = Math.sin(a);
  return {
    x: center.x + ca * p.radius,
    z: center.z + sa * p.radius,
    y: center.y + p.height + Math.sin(t * 0.6 + p.bobPhase) * p.bobAmp,
    // Velocity of (cos a, sin a) is (-sin a, cos a); face along it. The game's yaw maps
    // local +Z forward via (x=sin yaw, z=cos yaw), so yaw = atan2(velX, velZ).
    yaw: Math.atan2(-sa, ca),
  };
}

/**
 * The wing-beat squash for a gull at time `t`, in [1-FLAP_DEPTH, 1]. The factory applies it
 * to the silhouette so the wings appear to beat. Pure.
 */
export function flapScale(p, t) {
  const beat = 0.5 + 0.5 * Math.sin(p.flapPhase + p.flapRate * t);
  return 1 - FLAP_DEPTH * beat;
}

/**
 * The TARGET the flock wants to wheel over, given where the ship is and the nearest island
 * (or null). Gulls keep the ship company at sea, but hug the SHORE when one is near — the
 * reactive beat. Returns the {x,z} target + whether it's a coast roost. Pure; the factory
 * eases the live center toward this each frame (see easeTowards) so the drift is smooth.
 *   roostTarget(shipPos, island, range?) -> { x, z, nearLand }
 *   shipPos: {x,z}   island: {x,z}|null
 */
export function roostTarget(shipPos, island, range = ROOST_RANGE) {
  if (island) {
    const dx = island.x - shipPos.x, dz = island.z - shipPos.z;
    if (dx * dx + dz * dz <= range * range) {
      return { x: island.x, z: island.z, nearLand: true };
    }
  }
  return { x: shipPos.x, z: shipPos.z, nearLand: false };
}

/**
 * Frame-rate-independent ease of `cur` toward `target` (exponential smoothing). Used to glide
 * the flock center between the ship and a coast roost so it never snaps. Pure.
 *   easeTowards(cur, target, dt, rate?) -> number
 */
export function easeTowards(cur, target, dt, rate = 0.9) {
  if (!(dt > 0)) return cur;
  const k = 1 - Math.exp(-rate * dt);
  return cur + (target - cur) * k;
}

/**
 * Distance-cull: should the whole flock mesh be hidden? True when the flock `center` is
 * farther than `radius` from the camera `focus` (so it costs 0 draw calls when off-stage).
 * Pure.
 *   shouldCull(center, focus, radius?) -> boolean
 */
export function shouldCull(center, focus, radius = CULL_RADIUS) {
  const dx = center.x - focus.x, dz = center.z - focus.z;
  return dx * dx + dz * dz > radius * radius;
}
