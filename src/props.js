import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  PROP_TYPES, TARGET_HEIGHT, PROP_CULL_RADIUS,
  scaleForHeight, placementsForType, clusterVisible,
} from './systems/props.js';

// CC0 Pirate Kit world dressing (#101) — the three.js half. Loads the Kenney Pirate Kit prop
// GLBs (barrel / crate / palm) the SAME way the hero hull (#32) loads, then dresses every port
// as a working harbour: barrels & crates as dock cargo, palms framing the jetty foot. Each prop
// type becomes ONE InstancedMesh per port (one draw call regardless of how many), and each
// port's cluster is hidden wholesale beyond PROP_CULL_RADIUS — so a dressed world stays nearly
// free and the open sea costs nothing. The placement/cull math is PURE in systems/props.js.
//
// CREATIVE SPARK (Graphic Designer): a port stops being an abstract marker and becomes a place —
// cargo stacked on the planks, palms leaning over the berth — so every approach reads as landfall
// on somewhere lived-in, and every screenshot/clip looks MADE rather than prototyped.
//
// Resilience (the "always shippable" rule): the dressing loads async and NEVER rejects — if a
// GLB fetch fails the world simply sails bare (undressed but fully playable), exactly like the
// hull's procedural fallback.

const PROP_FILES = {
  barrel: 'assets/props/barrel.glb',
  crate: 'assets/props/crate.glb',
  palm: 'assets/props/palm-straight.glb',
};

// loadProps({ ports }) -> { group, update(shipPos), snapshot() }
//   ports: [{ name, x, z, angle }] — the full port placements (ports.js portPlacements).
export async function loadProps({ ports = [] } = {}) {
  try {
    return await buildDressing(ports);
  } catch (err) {
    console.warn('[props] dressing failed, sailing bare:', err.message);
    return emptyDressing();
  }
}

function emptyDressing() {
  const group = new THREE.Group();
  return { group, update() {}, snapshot: () => ({ count: 0, visible: 0, clusters: 0 }) };
}

async function buildDressing(ports) {
  const loader = new GLTFLoader();

  // Load each prop type once; pull out its (single) mesh geometry + material, scaled to the
  // type's target world height. Baking the mesh's world matrix into the cloned geometry keeps
  // the prop's base on y=0 regardless of any node transform the kit ships.
  const protoEntries = await Promise.all(PROP_TYPES.map(async (type) => {
    const gltf = await new Promise((res, rej) => loader.load(PROP_FILES[type], res, undefined, rej));
    gltf.scene.updateMatrixWorld(true);
    let mesh = null;
    gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o; });
    if (!mesh) throw new Error(`${type}: no mesh in GLB`);
    const geometry = mesh.geometry.clone();
    geometry.applyMatrix4(mesh.matrixWorld);
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;
    const scale = scaleForHeight(bb.max.y - bb.min.y, TARGET_HEIGHT[type]);
    const material = mesh.material; // Kenney "colormap" MeshStandardMaterial — reused as-is
    return [type, { geometry, material, scale }];
  }));
  const protos = Object.fromEntries(protoEntries);

  const group = new THREE.Group();
  const clusters = []; // { node, portPos } — one per port, toggled by distance
  let total = 0;

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);

  for (const port of ports) {
    const node = new THREE.Group();
    for (const type of PROP_TYPES) {
      const proto = protos[type];
      const places = placementsForType(port, type);
      if (!places.length) continue;
      const inst = new THREE.InstancedMesh(proto.geometry, proto.material, places.length);
      inst.castShadow = true;
      inst.receiveShadow = true;
      inst.frustumCulled = false; // we cull whole clusters by distance ourselves
      places.forEach((p, i) => {
        pos.set(p.x, p.y, p.z);
        q.setFromAxisAngle(UP, p.rotY);
        scl.setScalar(proto.scale);
        m.compose(pos, q, scl);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      node.add(inst);
      total += places.length;
    }
    group.add(node);
    clusters.push({ node, portPos: { x: port.x, z: port.z } });
  }

  let visibleInstances = 0;
  function update(shipPos) {
    if (!shipPos) return;
    visibleInstances = 0;
    for (const c of clusters) {
      const on = clusterVisible(shipPos, c.portPos, PROP_CULL_RADIUS);
      c.node.visible = on;
      if (on) visibleInstances += c.node.children.reduce((n, mesh) => n + mesh.count, 0);
    }
  }

  function snapshot() {
    return { count: total, visible: visibleInstances, clusters: clusters.length };
  }

  // Prime visibility once so the first frame (and the QA snapshot) is correct before update().
  update([0, 0, 0]);
  return { group, update, snapshot };
}
