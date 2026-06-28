import * as THREE from 'three';
import {
  GULL_COUNT, FLOCK_HEIGHT, CULL_RADIUS,
  gullParams, gullPosition, flapScale, roostTarget, easeTowards, shouldCull,
  DOLPHIN_COUNT, BREACH_DURATION, BREACH_SPAN, POD_SWIM_SPEED, MIN_SAIL_SPEED,
  nextPodDelay, dolphinParams, dolphinPosition, podSpawnOrigin,
} from './fauna-math.js';

// Living sea fauna (#97) — the first beat: a small flock of GULLS that keeps the ship
// company. The whole flock is ONE InstancedMesh (one draw call) of a tiny two-triangle gull
// silhouette; each frame we rewrite the per-bird instance matrix (wheel position + facing +
// a wing-beat squash) from the PURE model in fauna-math.js. The flock wheels over the ship
// at sea and DRIFTS to hang over the shore as you raise an island — a reactive verb, the
// world answering "where are you". When it drifts beyond the cull radius the mesh is hidden
// wholesale (0 draw calls), so a living sky costs almost nothing.
//
// CREATIVE SPARK (Game Designer + Graphic Designer): gulls trail your wake hunting galley
// scraps, then peel off to ride the updraughts over a raised island — company at sea, a
// welcoming committee at the coast. Pairs with the existing gull SFX (#68).

// A single gull silhouette: two triangles meeting at the body, wings swept up into a shallow
// dihedral "M" so a Y-scale wing-beat reads as flapping. Local +Z is forward (flight
// direction); X is wingspan. Tiny on purpose — a fleck of life on the horizon.
function makeGullGeometry() {
  const W = 3.4;   // half-wingspan
  const D = 0.9;   // wing-tip dihedral (rise) — what the wing-beat modulates
  const F = 1.2;   // body length fore/aft
  const verts = new Float32Array([
    // left wing triangle: body-front, body-back, left tip
    0, 0, F, 0, 0, -F * 0.6, -W, D, -0.2,
    // right wing triangle: body-back, body-front, right tip
    0, 0, -F * 0.6, 0, 0, F, W, D, -0.2,
  ]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

// A compact dolphin silhouette: a tapered body (elongated bipyramid along +Z = forward), a
// swept-back dorsal fin, and a horizontal tail fluke. Tiny triangle count on purpose — the
// whole pod is ONE InstancedMesh, so a leaping pod costs a single draw call. Local +Z is
// forward (so a yaw maps via x=sin,z=cos like the rest of the game); +Y is up.
function makeDolphinGeometry() {
  const L = 3.4;   // half body length (nose at +Z, tail at -Z)
  const R = 0.85;  // body radius at the mid ring
  // Body bipyramid: nose & tail tips, a 4-point mid ring (top/bottom/left/right).
  const nose = [0, 0, L], tail = [0, 0, -L];
  const top = [0, R, 0], bot = [0, -R, 0], lft = [-R, 0, 0], rgt = [R, 0, 0];
  const tri = (a, b, c) => [...a, ...b, ...c];
  const verts = [
    // nose → ring (4 faces)
    ...tri(nose, rgt, top), ...tri(nose, top, lft), ...tri(nose, lft, bot), ...tri(nose, bot, rgt),
    // tail → ring (4 faces, wound the other way)
    ...tri(tail, top, rgt), ...tri(tail, lft, top), ...tri(tail, bot, lft), ...tri(tail, rgt, bot),
    // dorsal fin: a thin triangle standing on the back, swept aft
    ...tri([0, R, 0.5], [0, R, -1.0], [0, R + 1.3, -0.6]),
    // tail fluke: a low horizontal V behind the tail
    ...tri([0, 0, -L + 0.3], [-1.5, 0, -L - 0.7], [1.5, 0, -L - 0.7]),
  ];
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();
  return geo;
}

// createFauna({ world, count }) -> { group, update(dt, t, ctx), snapshot() }
//   ctx: { shipPos:{x,z}|[x,..,z], focus:{x,z}|null, heading?:number, speed?:number,
//          sampleHeight?:(x,z)=>y }
export function createFauna({ world, count = GULL_COUNT, podCount = DOLPHIN_COUNT, seed = 0x10110 } = {}) {
  const group = new THREE.Group();

  // Flat islands as {x,z} so the flock can find the nearest coast to roost over.
  const islands = [];
  if (world && world.islands) {
    for (const isle of world.islands.children) {
      islands.push({ x: isle.position.x, z: isle.position.z, r: isle.userData.radius || 80 });
    }
  }

  const params = [];
  for (let i = 0; i < count; i++) params.push(gullParams(i, count));

  // Off-white gull, lit so wheeling birds catch the sun and read against the blue sky. Fog
  // (on by default) fades distant birds into the horizon haze. DoubleSide so the thin
  // silhouette never vanishes edge-on. One material, one geometry → one draw call.
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeef3f6, roughness: 0.9, metalness: 0,
    side: THREE.DoubleSide, transparent: true, opacity: 0.96,
  });
  const mesh = new THREE.InstancedMesh(makeGullGeometry(), mat, count);
  mesh.frustumCulled = false; // instances roam; we cull the whole flock by distance ourselves
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  group.add(mesh);

  // Live flock centre — eased between the ship (at sea) and a coast roost (near land).
  const center = { x: 0, y: FLOCK_HEIGHT, z: 0 };
  let nearLand = false;
  let visible = true;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  // ── Dolphin pod (#110) ──────────────────────────────────────────────────────
  // A small pod that occasionally surfaces alongside the MOVING ship and arcs through a breach,
  // then slips back under. The whole pod is ONE InstancedMesh (≤1 draw call), hidden wholesale
  // (0 draws) between appearances and when distance-culled. The cadence + arc geometry is pure
  // (fauna-math.js); here we own the live pod state + the seeded, deterministic spawn schedule.
  const dolMat = new THREE.MeshStandardMaterial({
    color: 0x4a6b80, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide,
  });
  const dolMesh = new THREE.InstancedMesh(makeDolphinGeometry(), dolMat, podCount);
  dolMesh.frustumCulled = false; // the pod roams; we cull it by distance ourselves
  dolMesh.castShadow = false;
  dolMesh.receiveShadow = false;
  dolMesh.visible = false;       // hidden until a pod surfaces → 0 draw calls at rest
  group.add(dolMesh);

  const dolParams = [];
  for (let i = 0; i < podCount; i++) dolParams.push(dolphinParams(i, podCount));

  // Deterministic, reproducible spawn cadence (mulberry32) — a seeded controller surfaces the
  // pod at the same stepped times every headless run, so the playtest can assert a breach fires.
  let rngState = seed >>> 0;
  function rng() {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let x = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  const pod = {
    active: false,
    progress: 0,                 // 0..1 across BREACH_DURATION
    timer: nextPodDelay(rng()),  // seconds until the next pod surfaces
    breaches: 0,                 // total pods surfaced (QA: a breach fired on schedule)
    surfaced: false,             // any dolphin currently above water (QA: catch a mid-arc shot)
    origin: { x: 0, y: 0, z: 0 },
    heading: 0,
  };
  const dq = new THREE.Quaternion();
  const pq = new THREE.Quaternion();
  const RIGHT = new THREE.Vector3(1, 0, 0);

  function updatePod(dt, ctx, focus) {
    const ship = readXZ(ctx.shipPos);
    const speed = ctx.speed || 0;
    const heading = ctx.heading || 0;
    const seaY = (x, z) => (ctx.sampleHeight ? ctx.sampleHeight(x, z) : 0);

    if (!pod.active) {
      pod.surfaced = false;
      dolMesh.visible = false;
      pod.timer -= dt;
      if (pod.timer <= 0) {
        if (speed >= MIN_SAIL_SPEED) {
          // Surface a fresh pod ahead of the bow, off a random beam, riding the ship's heading.
          const side = rng() < 0.5 ? 1 : -1;
          const o = podSpawnOrigin(ship, heading, side, seaY(ship.x, ship.z));
          pod.origin.x = o.x; pod.origin.y = o.y; pod.origin.z = o.z;
          pod.heading = heading;
          pod.active = true;
          pod.progress = 0;
          pod.breaches++;
        } else {
          // Moored / drifting → no pod; re-check again shortly (they only ride while under way).
          pod.timer = 1.5;
        }
      }
      return;
    }

    // Slide the pod forward so it PACES the ship (its own speed, min POD_SWIM_SPEED) and keeps
    // riding alongside the bow instead of being overtaken as the ship sails on.
    const slide = Math.max(speed, POD_SWIM_SPEED);
    pod.origin.x += Math.sin(pod.heading) * slide * dt;
    pod.origin.z += Math.cos(pod.heading) * slide * dt;
    pod.origin.y = seaY(pod.origin.x, pod.origin.z);
    pod.progress += dt / BREACH_DURATION;

    if (pod.progress >= 1) {
      pod.active = false;
      pod.surfaced = false;
      dolMesh.visible = false;
      pod.timer = nextPodDelay(rng());
      return;
    }

    // Distance-cull the whole pod → 0 draw calls when off-stage.
    if (shouldCull(pod.origin, focus, CULL_RADIUS)) { dolMesh.visible = false; return; }
    dolMesh.visible = true;

    let anySurfaced = false;
    for (let i = 0; i < podCount; i++) {
      const d = dolphinPosition(dolParams[i], pod.origin, pod.heading, pod.progress);
      if (d.surfaced) anySurfaced = true;
      pos.set(d.x, d.y, d.z);
      dq.setFromAxisAngle(UP, d.yaw);            // face along the heading
      pq.setFromAxisAngle(RIGHT, -d.pitch);      // then pitch the nose up/down along the arc
      dq.multiply(pq);
      m.compose(pos, dq, scl.set(1, 1, 1));
      dolMesh.setMatrixAt(i, m);
    }
    dolMesh.instanceMatrix.needsUpdate = true;
    pod.surfaced = anySurfaced;
  }

  function nearestIsland(x, z) {
    let best = null, bd = Infinity;
    for (const isle of islands) {
      const d = Math.hypot(isle.x - x, isle.z - z);
      if (d < bd) { bd = d; best = isle; }
    }
    return best;
  }

  function readXZ(p) {
    if (!p) return { x: center.x, z: center.z };
    if (Array.isArray(p)) return { x: p[0], z: p[p.length - 1] }; // [x,z] or [x,y,z]
    return { x: p.x, z: p.z };
  }

  function update(dt, t, ctx = {}) {
    const ship = readXZ(ctx.shipPos);
    const focus = ctx.focus ? readXZ(ctx.focus) : ship;

    // The dolphin pod runs on its own schedule + cull, independent of the gull flock's cull.
    updatePod(dt, ctx, focus);

    // Pick the roost target (ship at sea / shore near land) and glide the centre toward it.
    const target = roostTarget(ship, nearestIsland(ship.x, ship.z));
    nearLand = target.nearLand;
    center.x = easeTowards(center.x, target.x, dt);
    center.z = easeTowards(center.z, target.z, dt);
    center.y = FLOCK_HEIGHT;

    // Distance-cull the WHOLE flock → 0 draw calls when off-stage. Cheap living sky.
    visible = !shouldCull(center, focus, CULL_RADIUS);
    mesh.visible = visible;
    if (!visible) return;

    for (let i = 0; i < count; i++) {
      const p = params[i];
      const g = gullPosition(p, center, t);
      const flap = flapScale(p, t);
      pos.set(g.x, g.y, g.z);
      q.setFromAxisAngle(UP, g.yaw);
      scl.set(1, flap, 1); // wing-beat: Y-squash lifts/drops the dihedral wing-tips
      m.compose(pos, q, scl);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  function snapshot() {
    return {
      count, visible, nearLand, center: [center.x, center.z], height: center.y,
      // Dolphin pod (#110) QA surface: pod size, whether it's mid-breach + drawn, the running
      // breach tally (a pod fired on schedule), and whether any dolphin is above water now.
      dolphins: podCount,
      pod: {
        active: pod.active,
        drawn: dolMesh.visible,
        progress: pod.progress,
        breaches: pod.breaches,
        surfaced: pod.surfaced,
        center: [pod.origin.x, pod.origin.z],
      },
    };
  }

  return { group, update, snapshot };
}
