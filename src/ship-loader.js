import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createShip } from './ship.js';
import {
  GLB_Z_MIN, GLB_Z_MAX, TARGET_LENGTH,
  computeScaleToLength, centrePivotOffset,
} from './ship-loader-math.js';

// Pure integration math (scale/centre constants + helpers) lives in ship-loader-math.js —
// a three.js-free module so the logic is node-testable without a browser. Re-exported here
// for convenience/back-compat.
export { GLB_Z_MIN, GLB_Z_MAX, TARGET_LENGTH, computeScaleToLength, centrePivotOffset };

const GLB_PATH = 'assets/ships/ship-pirate-small.glb';

// loadShip() — async equivalent of createShip(). Returns a THREE.Group with the same
// API: bow toward +Z, length ~16, userData.flag = {children:[pennant, skull]}.
// Falls back to the procedural hull on any load error so the game stays playable.
export async function loadShip() {
  try {
    return await loadGltfShip();
  } catch (err) {
    console.warn('[ship-loader] GLB failed, using procedural hull:', err.message);
    return createShip();
  }
}

async function loadGltfShip() {
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => loader.load(GLB_PATH, resolve, undefined, reject));

  const root = gltf.scene;

  // Scale so the hull length matches the integration contract (~16 units).
  const glbLength = GLB_Z_MAX - GLB_Z_MIN;
  const scale = computeScaleToLength(glbLength, TARGET_LENGTH);
  root.scale.setScalar(scale);

  // Minor Z centering: shift the root so the keel midpoint sits at group origin.
  root.position.z = centrePivotOffset(GLB_Z_MIN, GLB_Z_MAX, scale);

  // Resolve all descendant world matrices before we query positions below.
  root.updateMatrixWorld(true);

  root.traverse(obj => {
    if (obj.isMesh) { obj.castShadow = true; obj.receiveShadow = true; }
  });

  const group = new THREE.Group();
  group.add(root);

  // Hide the GLB's built-in flag meshes — they're replaced by our procedural pennant
  // which colours.js and main.js depend on: children[0]=pennant, children[1]=skull.
  // Use flag-b's world position (masthead flag) as the pennant mount point.
  let flagY = 8.84 * scale;
  let flagZ = root.position.z + (-0.62 * scale);
  root.traverse(obj => {
    if (obj.name === 'flag-b') {
      const wp = new THREE.Vector3();
      obj.getWorldPosition(wp);
      flagY = wp.y;
      flagZ = wp.z;
      obj.visible = false;
    }
    if (obj.name === 'flag-a') obj.visible = false;
  });

  const pennantGroup = buildPennant();
  pennantGroup.position.set(0.45, flagY, flagZ);
  group.add(pennantGroup);
  group.userData.flag = pennantGroup;

  return group;
}

// Procedural pennant reproduced from ship.js — two children required by colours.js:
//   children[0] = pennant mesh (tinted by flagColor)
//   children[1] = skull dot   (hidden while disguised)
function buildPennant() {
  const flag = new THREE.Group();
  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, -0.8);
  pennantShape.lineTo(0, 0.8);
  pennantShape.lineTo(3.4, 0.45);
  pennantShape.lineTo(2.6, 0.0);
  pennantShape.lineTo(3.4, -0.45);
  pennantShape.lineTo(0, -0.8);
  const pennant = new THREE.Mesh(
    new THREE.ShapeGeometry(pennantShape),
    new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.95, side: THREE.DoubleSide })
  );
  flag.add(pennant);
  const skull = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9, side: THREE.DoubleSide })
  );
  skull.position.set(1.1, 0, 0.02);
  flag.add(skull);
  return flag;
}
