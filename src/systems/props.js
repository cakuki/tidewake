// CC0 Pirate Kit world dressing (#101) — PURE placement & culling math.
//
// DOM-free and three.js-free so the layout/transform/cull logic is node-testable without a
// browser (same pattern as systems/harbour.js + fauna-math.js). src/props.js consumes these
// to instance the Kenney Pirate Kit props (barrels / crates / palms) at each port.
//
// One coherent "working harbour" dressing pass: barrels & crates ride the jetty planks as
// cargo waiting to be loaded, and a pair of palms frame the landward foot of the dock — so a
// port reads as MADE, not prototyped. Repeated props are InstancedMesh'd (one draw per type
// per port) and each port's cluster is distance-culled wholesale, so the open sea stays free.

// Local marker-frame dressing for ONE port. The frame matches ports.js buildMarker:
//   • +z points SEAWARD (toward open water / spawn); the island is at -z.
//   • +x is to starboard of the jetty; y is height above the calmed sea.
// The jetty deck top sits at ~3.1 (deck box y=2.4, half-height 0.7), so cargo rides at z along
// the planks (deck spans z≈0..38, x≈-4..4); the palms sit on the beach just landward (-z).
export const PORT_DRESSING = [
  // Cargo on the dock — barrels & crates waiting on the planks.
  { type: 'barrel', x: -2.4, y: 3.1, z: 9,  rot: 0.3 },
  { type: 'barrel', x: -1.9, y: 3.1, z: 12, rot: 1.1 },
  { type: 'barrel', x:  2.4, y: 3.1, z: 10, rot: 2.4 },
  { type: 'crate',  x:  2.1, y: 3.1, z: 14, rot: 0.6 },
  { type: 'crate',  x: -2.6, y: 3.1, z: 16, rot: 2.0 },
  // Palms framing the foot of the jetty, rooted on the beach.
  { type: 'palm',   x: -11, y: 2.0, z: -4, rot: 0.0 },
  { type: 'palm',   x:  12, y: 2.0, z: -6, rot: 1.6 },
];

// The prop types this dressing pass uses, in a stable order (one InstancedMesh per type).
export const PROP_TYPES = ['barrel', 'crate', 'palm'];

// Target world HEIGHT (units) per prop type — the loader scales each GLB to this from its
// measured bounding box, so the size is robust to whatever native units the kit ships. The
// hero hull is ~16 units long; these keep the kit's relative proportions readable beside it.
export const TARGET_HEIGHT = { barrel: 2.4, crate: 1.6, palm: 16 };

// Within this distance (units) of a port, its dressing is drawn; beyond it the whole cluster
// is hidden (0 draw calls) — aggressive wholesale culling so empty sea costs nothing.
export const PROP_CULL_RADIUS = 520;

// Uniform scale that maps a prop's measured native height onto its target world height.
export function scaleForHeight(measuredHeight, target) {
  if (!(measuredHeight > 0)) return 1;
  return target / measuredHeight;
}

// Rotate a local marker-frame offset (lx, lz) by the jetty bearing `angle` and translate to
// the port's world position (px, pz). Matches a THREE.Object3D with rotation.y = angle:
//   x' = lx·cosθ + lz·sinθ ;  z' = -lx·sinθ + lz·cosθ   (three.js Y-rotation convention).
export function localToWorld(lx, lz, angle, px, pz) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: px + lx * c + lz * s, z: pz - lx * s + lz * c };
}

// World placement of one dressing entry at a given port. `port` = { x, z, angle }. Returns the
// world position, the prop's world Y-rotation (jetty bearing + the entry's own spin), and type.
export function propWorldPlacement(entry, port) {
  const { x, z } = localToWorld(entry.x, entry.z, port.angle, port.x, port.z);
  return { type: entry.type, x, y: entry.y, z, rotY: port.angle + entry.rot };
}

// All world placements for one port's dressing, filtered to a single prop type (so each type
// becomes one InstancedMesh per port).
export function placementsForType(port, type, dressing = PORT_DRESSING) {
  return dressing.filter((d) => d.type === type).map((d) => propWorldPlacement(d, port));
}

// Is a port's cluster within drawing range of the ship? Pure distance check (XZ plane).
export function clusterVisible(shipPos, portPos, radius = PROP_CULL_RADIUS) {
  const sx = Array.isArray(shipPos) ? shipPos[0] : shipPos.x;
  const sz = Array.isArray(shipPos) ? shipPos[shipPos.length - 1] : shipPos.z;
  const dx = sx - portPos.x, dz = sz - portPos.z;
  return Math.hypot(dx, dz) <= radius;
}
