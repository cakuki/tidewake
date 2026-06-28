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

// ── Dolphins (#110, phase 2) ─────────────────────────────────────────────────
// The second fauna beat: a small POD of dolphins that occasionally surfaces alongside the
// MOVING ship and arcs through a breach (leap → dive) before slipping back under. Same
// cheapness rules as the gulls — ONE extra InstancedMesh (≤1 draw call), distance-culled,
// hidden wholesale (0 draws) between appearances. Reactive verb: they only ride along while
// you're actually under way. All the spawn cadence + arc geometry is PURE + node-testable
// here; the three.js pod controller in fauna.js consumes it.

export const DOLPHIN_COUNT = 4;        // a small, believable pod — cheap, reads as "alive"
export const POD_SPAWN_MIN = 14;       // seconds: shortest gap between pod appearances
export const POD_SPAWN_MAX = 40;       // longest gap — irregular (Poisson-ish), never metronomic
export const BREACH_DURATION = 2.4;    // seconds the whole pod's leap cascade takes
export const BREACH_HEIGHT = 5.5;      // metres the arc peaks above the waterline
export const BREACH_FORWARD = 14;      // metres a dolphin travels forward across its own leap
export const BREACH_SPAN = 0.7;        // fraction of the pod window one dolphin's leap occupies
export const POD_AHEAD = 42;           // metres ahead of the bow the pod surfaces (close enough to read)
export const POD_BEAM = 34;            // metres off to one side (port/starboard) — arcs alongside
export const POD_SPACING = 7;          // lateral gap between pod members
export const POD_SWIM_SPEED = 9;       // metres/sec the pod slides forward while breaching
export const MIN_SAIL_SPEED = 1.5;     // only appear when the ship is genuinely under way

function clampUnit(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/**
 * Seconds until the next pod surfaces. Maps a 0..1 random into [min,max] so appearances
 * land irregularly and never feel metronomic (the same idiom as audio.js nextGullDelay). Pure.
 *   nextPodDelay(rand, min?, max?) -> number
 */
export function nextPodDelay(rand, min = POD_SPAWN_MIN, max = POD_SPAWN_MAX) {
  return min + clampUnit(rand) * (max - min);
}

/**
 * Deterministic per-dolphin pod offsets from its index: a lateral lane within the pod, a
 * small fore/aft stagger, and a leap DELAY so members cascade out of the water rather than
 * breaching in unison. Pure: same index → same dolphin.
 *   dolphinParams(i, count) -> { lateral, along, delay }
 */
export function dolphinParams(i, count = DOLPHIN_COUNT) {
  const mid = (count - 1) / 2;
  return {
    lateral: (i - mid) * POD_SPACING,
    along: ((i % 2) ? 1 : -1) * (3 + (i % 3) * 2),  // slight fore/aft scatter, not a rigid line
    delay: count > 1 ? (i / (count - 1)) * (1 - BREACH_SPAN) : 0, // 0..(1-span): a cascade
  };
}

/**
 * A single dolphin's breach arc at local progress u in [0,1]: it rises from the waterline to
 * BREACH_HEIGHT at u=0.5 and slips back under at u=1, the body PITCHING nose-up on the way out
 * and nose-down on the dive (the tangent of the arc). Pure.
 *   breachArc(u) -> { rise, pitch }
 */
export function breachArc(u) {
  const c = clampUnit(u);
  const rise = Math.sin(Math.PI * c) * BREACH_HEIGHT;
  // Vertical velocity ∝ cos(pi*c) (BREACH_HEIGHT·pi); horizontal ∝ BREACH_FORWARD. The body
  // points along its velocity, so pitch = atan2(vY, vX): >0 climbing out, <0 diving back.
  const vY = Math.cos(Math.PI * c) * BREACH_HEIGHT * Math.PI;
  const pitch = Math.atan2(vY, BREACH_FORWARD);
  return { rise, pitch };
}

/**
 * Where a pod dolphin is, given the live pod ORIGIN (a waterline anchor sliding forward with
 * the ship), the pod HEADING (radians, 0=+Z), and the overall pod PROGRESS in [0,1]. Applies
 * the dolphin's lane offset + its staggered breach arc. Returns world pos + facing (yaw along
 * heading, pitch from the arc) + whether it's currently above water. Pure + deterministic.
 *   dolphinPosition(p, origin, heading, progress) -> { x, y, z, yaw, pitch, surfaced }
 */
export function dolphinPosition(p, origin, heading, progress) {
  const u = clampUnit((progress - p.delay) / BREACH_SPAN);
  const { rise, pitch } = breachArc(u);
  const fwd = p.along + u * BREACH_FORWARD;
  const sinH = Math.sin(heading), cosH = Math.cos(heading);
  // (sinH, cosH) is forward along the heading; (cosH, -sinH) is the perpendicular (beam).
  return {
    x: origin.x + sinH * fwd + cosH * p.lateral,
    z: origin.z + cosH * fwd - sinH * p.lateral,
    y: origin.y + rise,
    yaw: heading,
    pitch,
    surfaced: rise > 0.05,
  };
}

/**
 * The waterline anchor where a new pod surfaces: POD_AHEAD ahead of the bow and POD_BEAM off
 * to one `side` (+1 starboard / -1 port), at sea level `seaY`. Pure; the factory advances this
 * forward (POD_SWIM_SPEED) as the pod swims while breaching.
 *   podSpawnOrigin(ship, heading, side, seaY?) -> { x, y, z }
 */
export function podSpawnOrigin(ship, heading, side, seaY = 0) {
  const sinH = Math.sin(heading), cosH = Math.cos(heading);
  const s = side < 0 ? -1 : 1;
  return {
    x: ship.x + sinH * POD_AHEAD + cosH * POD_BEAM * s,
    z: ship.z + cosH * POD_AHEAD - sinH * POD_BEAM * s,
    y: seaY,
  };
}
