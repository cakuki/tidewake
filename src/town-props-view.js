import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  TOWN_PROP_KINDS, TOWN_PROP_CULL_RADIUS, townPropPlacements, clusterVisible,
} from './systems/town-props.js';

// Loose town / harbour props (#101, props phase 3) — the three.js half. Dresses every port with
// glowing LANTERNS striding down the jetty + a little cluster of market STALLS at its foot, so a
// port reads as a PLACE people live rather than a bare marker. Each kind is ONE InstancedMesh per
// port (one draw regardless of count), and each port's cluster is hidden wholesale beyond
// TOWN_PROP_CULL_RADIUS — so the loose dressing costs at most TWO extra draws, only when you're at
// the town, and the open sea costs NOTHING. The seeded placement/cull math is PURE in
// systems/town-props.js; this is the thin reveal (the port-growth-view.js pattern).
//
// CREATIVE SPARK (Graphic Designer): the lanterns GLOW (warm emissive amber), so an evening landfall
// has lamps burning down the quay; the stalls carry a red canopy over a timber counter. Cheap
// procedural low-poly meshes in the sunny kit palette — no new assets, no fetch, always shippable.
//
// Mesh conservation (#121): ONE shared merged geometry + material per kind, reused across every
// instance and every port; vertex colours carry the two-tone look in a single draw. No per-instance
// geometry, no per-frame allocation.

// Warm palette. Lantern glass glows; its post is a dim warm timber. Stall canopy is market red over
// a timber counter/posts. Vertex colours let each merged mesh be two-tone in ONE instanced draw.
const LANTERN_GLASS = 0xffd98a;
const LANTERN_POST = 0x6b4a2a;
const STALL_CLOTH = 0xb5432f;
const STALL_TIMBER = 0x7a5230;

// Paint a whole geometry a single vertex colour (so heterogeneous sub-parts merge into one two-tone
// mesh). Adds a `color` attribute matching the position count — required for mergeGeometries to keep
// attribute layouts identical across the parts.
function paint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// A lantern: a slim post with a lamp box on top. Base sits on y=0 so the caller drops it on the deck.
function makeLanternGeo() {
  const post = new THREE.CylinderGeometry(0.11, 0.14, 3.0, 6);
  post.translate(0, 1.5, 0);
  paint(post, LANTERN_POST);
  const lamp = new THREE.BoxGeometry(0.55, 0.7, 0.55);
  lamp.translate(0, 3.35, 0);
  paint(lamp, LANTERN_GLASS);
  return mergeGeometries([post, lamp], false);
}

// A market stall: a timber counter, two back posts and a canopy over them. Base on y=0.
function makeStallGeo() {
  const counter = new THREE.BoxGeometry(2.4, 0.9, 1.0);
  counter.translate(0, 0.45, 0);
  paint(counter, STALL_TIMBER);
  const postL = new THREE.CylinderGeometry(0.08, 0.08, 2.1, 5);
  postL.translate(-1.05, 1.05, -0.4);
  paint(postL, STALL_TIMBER);
  const postR = new THREE.CylinderGeometry(0.08, 0.08, 2.1, 5);
  postR.translate(1.05, 1.05, -0.4);
  paint(postR, STALL_TIMBER);
  const canopy = new THREE.BoxGeometry(2.9, 0.22, 2.3);
  canopy.translate(0, 2.15, 0.15);
  paint(canopy, STALL_CLOTH);
  return mergeGeometries([counter, postL, postR, canopy], false);
}

/**
 * Build the loose-props dressing for all ports and return a handle.
 * `ports` = ports.js portPlacements ([{name,x,z,angle}]). update(shipPos) culls each port's cluster
 * by distance; snapshot() is the SEE assertion for the gate.
 * @param {{ports: Array<{name:string,x:number,z:number,angle:number}>}} o
 */
export function createTownProps({ ports = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'town-props';

  const geo = { lantern: makeLanternGeo(), stall: makeStallGeo() };
  const mat = {
    // The lantern GLOWS — warm emissive amber so lamps read as lit on the quay, day or dusk.
    lantern: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffb347, emissiveIntensity: 0.9, roughness: 0.5, metalness: 0.0 }),
    stall: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 }),
  };

  const clusters = []; // { node, portPos } — one per port, toggled by distance
  let total = 0;

  // Reused scratch — no per-call allocation.
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3(1, 1, 1);
  const _e = new THREE.Euler();

  for (const port of ports) {
    const node = new THREE.Group();
    const places = townPropPlacements(port);
    for (const kind of TOWN_PROP_KINDS) {
      const list = places[kind];
      if (!list || !list.length) continue;
      const inst = new THREE.InstancedMesh(geo[kind], mat[kind], list.length);
      inst.frustumCulled = false; // we cull whole clusters by distance ourselves
      inst.castShadow = true;
      inst.receiveShadow = true;
      list.forEach((pl, i) => {
        _p.set(pl.x, pl.y, pl.z);
        _e.set(0, pl.rotY, 0);
        _q.setFromEuler(_e);
        _m.compose(_p, _q, _s);
        inst.setMatrixAt(i, _m);
      });
      inst.instanceMatrix.needsUpdate = true;
      node.add(inst);
      total += list.length;
    }
    group.add(node);
    clusters.push({ node, portPos: { x: port.x, z: port.z } });
  }

  let visibleInstances = 0;
  /** Cull each port's cluster by distance (0 draws at open sea). */
  function update(shipPos) {
    if (!shipPos) return;
    visibleInstances = 0;
    for (const c of clusters) {
      const on = clusterVisible(shipPos, c.portPos, TOWN_PROP_CULL_RADIUS);
      c.node.visible = on;
      if (on) visibleInstances += c.node.children.reduce((n, mesh) => n + mesh.count, 0);
    }
  }

  /** The dressing the world actually draws — the SEE assertion the playtest reads. */
  function snapshot() {
    return { count: total, visible: visibleInstances, clusters: clusters.length, kinds: TOWN_PROP_KINDS.slice() };
  }

  // Prime visibility once so the first frame (and the QA snapshot) is correct before update().
  update([0, 0, 0]);
  return { group, update, snapshot };
}
