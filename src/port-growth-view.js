import * as THREE from 'three';
import {
  GROWTH_KINDS, growthTier, revealCounts, piecesOfKind, pieceWorldPlacement,
} from './systems/port-growth.js';

// Governor-pole symmetry — the VISIBLE payoff of investing in your home port (#174, epic #168 "The
// Rise", the finale). When you sink coin into your home port (home-port.js invest → harbour.level up),
// the coast around it PROSPERS: new warehouses rise on the shore, more boats ride at anchor, more masts
// crowd the quay — the governor's mirror of buying a bigger ship. The pure tier→dressing model lives in
// systems/port-growth.js; this is the thin three.js reveal (the deck-guns.js pattern).
//
// Mesh conservation (#121): ONE InstancedMesh per growth kind (warehouse box · moored-boat hull · mast),
// each placed ONCE at the home port in tier order; `applyGrowth(harbour)` just sets each pool's drawn
// `.count` to the earned tier — a bought piece is included, an unearned one simply isn't drawn. The whole
// cluster is distance-culled wholesale (group.visible=false) when you're away, and hidden entirely with no
// home claimed — so a grown port costs at most THREE instanced draws, only when you're near home, and the
// open sea / an unclaimed voyage costs nothing. No new geometry per piece; no per-frame allocation.

// How far from the home port the growth cluster is drawn (beyond it → hidden, 0 draws). Generous enough
// to read the grown port on the approach; matches the spirit of the CC0 dressing cull.
export const GROWTH_CULL_RADIUS = 640;

const BUILDING_H = 7;   // warehouse block height (units) — reads beside the ~16u hero hull
const BOAT_H = 1.3;     // moored-boat hull height
const MAST_H = 9;       // mast height rising off each moored boat

/**
 * Build the home-port growth cluster and return a handle. `ports` = the ports.js placements
 * (portPlacements: [{name,x,z,angle}]). applyGrowth(harbour) re-homes + re-tiers the dressing;
 * update(shipPos) culls it wholesale by distance; shownCounts() is the SEE assertion for the gate.
 * @param {{ports: Array<{name:string,x:number,z:number,angle:number}>}} o
 */
export function createPortGrowth({ ports = [] } = {}) {
  const group = new THREE.Group();
  group.name = 'port-growth';
  group.visible = false; // nothing until a home port is claimed

  // ONE shared geometry + material per kind — reused across every instance (no per-piece geometry).
  const buildingGeo = new THREE.BoxGeometry(9, BUILDING_H, 7);
  const boatGeo = new THREE.BoxGeometry(2.6, BOAT_H, 6.4);
  const mastGeo = new THREE.CylinderGeometry(0.16, 0.22, MAST_H, 6);
  // Warm, prospering-port palette: tan stone warehouses, dark timber hulls, pale wood masts.
  const buildingMat = new THREE.MeshStandardMaterial({ color: 0xcbb9a6, roughness: 0.85 });
  const boatMat = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0xb79a6a, roughness: 0.7 });

  const buildingPieces = piecesOfKind('building');
  const boatPieces = piecesOfKind('boat');

  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, buildingPieces.length);
  const boats = new THREE.InstancedMesh(boatGeo, boatMat, boatPieces.length);
  const masts = new THREE.InstancedMesh(mastGeo, mastMat, boatPieces.length);
  for (const inst of [buildings, boats, masts]) {
    inst.frustumCulled = false; // we cull the whole cluster ourselves by distance
    inst.castShadow = true;
    inst.count = 0;             // nothing revealed until applyGrowth
  }
  group.add(buildings, boats, masts);

  // Reused scratch — no per-call allocation.
  const _m = new THREE.Matrix4();
  const _pos = new THREE.Vector3();
  const _quat = new THREE.Quaternion();
  const _eul = new THREE.Euler();
  const _one = new THREE.Vector3(1, 1, 1);

  let homePos = null; // {x,z} of the claimed home port, or null

  function placePool(inst, pieces, port, yLift) {
    for (let i = 0; i < pieces.length; i++) {
      const wp = pieceWorldPlacement(pieces[i], port);
      _pos.set(wp.x, wp.y + yLift, wp.z);
      _eul.set(0, wp.rotY, 0);
      _quat.setFromEuler(_eul);
      _m.compose(_pos, _quat, _one);
      inst.setMatrixAt(i, _m);
    }
    inst.instanceMatrix.needsUpdate = true;
  }

  /**
   * Re-home + re-tier the growth cluster from the persisted harbour record. Places every piece at the
   * home port ONCE (in tier order) and reveals the count earned at the current level via each pool's
   * `.count`. No home / junk → everything hidden. Returns the revealed counts (the SEE assertion).
   * @param {{name:string, level:number}|null} harbour
   */
  function applyGrowth(harbour) {
    const name = harbour && typeof harbour === 'object' ? harbour.name : null;
    const port = name ? ports.find((p) => p.name === name) : null;
    if (!port) {
      homePos = null;
      buildings.count = boats.count = masts.count = 0;
      group.visible = false;
      return { building: 0, boat: 0, mast: 0 };
    }
    homePos = { x: port.x, z: port.z };
    placePool(buildings, buildingPieces, port, BUILDING_H / 2);
    placePool(boats, boatPieces, port, BOAT_H / 2);
    placePool(masts, boatPieces, port, BOAT_H + MAST_H / 2);
    const tier = growthTier(harbour, name);
    const c = revealCounts(tier);
    buildings.count = c.building;
    boats.count = c.boat;
    masts.count = c.mast;
    group.visible = tier > 0; // refined by update()'s distance cull
    return c;
  }

  /** Cull the whole cluster by distance to the home port (0 draws when away / no home claimed). */
  function update(shipPos) {
    if (!homePos || (buildings.count === 0 && boats.count === 0)) { group.visible = false; return; }
    const sx = Array.isArray(shipPos) ? shipPos[0] : shipPos.x;
    const sz = Array.isArray(shipPos) ? shipPos[shipPos.length - 1] : shipPos.z;
    const dx = sx - homePos.x, dz = sz - homePos.z;
    group.visible = Math.hypot(dx, dz) <= GROWTH_CULL_RADIUS;
  }

  /** The counts actually SHOWN — the SEE assertion the playtest reads (tier reflected in the world). */
  function shownCounts() {
    return {
      building: buildings.count,
      boat: boats.count,
      mast: masts.count,
      total: buildings.count + boats.count,
      visible: group.visible,
    };
  }

  return { group, applyGrowth, update, shownCounts, kinds: GROWTH_KINDS };
}
