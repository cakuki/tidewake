import * as THREE from 'three';
import {
  GULL_COUNT, FLOCK_HEIGHT, CULL_RADIUS,
  gullParams, gullPosition, flapScale, roostTarget, easeTowards, shouldCull,
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

// createFauna({ world, count }) -> { group, update(dt, t, ctx), snapshot() }
//   ctx: { shipPos:{x,z}|[x,..,z], focus:{x,z}|null }
export function createFauna({ world, count = GULL_COUNT } = {}) {
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
    return { count, visible, nearLand, center: [center.x, center.z], height: center.y };
  }

  return { group, update, snapshot };
}
