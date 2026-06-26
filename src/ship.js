import * as THREE from 'three';

// A small sloop built from primitives. No external art needed for v0 — the
// graphic-designer agent will later swap this for proper models.
export function createShip() {
  const group = new THREE.Group();

  const woodDark = new THREE.MeshStandardMaterial({ color: 0x5a3b1e, roughness: 0.8 });
  const woodLight = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.9, side: THREE.DoubleSide });

  // Hull — a tapered box-ish shape
  const hull = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 16), woodDark);
  hull.position.y = 0.5;
  hull.castShadow = true;
  group.add(hull);

  // Bow wedge
  const bow = new THREE.Mesh(new THREE.ConeGeometry(3, 6, 4), woodDark);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.5, 10.5);
  bow.scale.set(1, 1, 0.6);
  group.add(bow);

  // Deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 15), woodLight);
  deck.position.y = 2.1;
  group.add(deck);

  // Mast
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 22, 8), woodLight);
  mast.position.set(0, 12, -1);
  mast.castShadow = true;
  group.add(mast);

  // Sail
  const sail = new THREE.Mesh(new THREE.PlaneGeometry(9, 13), sailMat);
  sail.position.set(0, 12, -1.4);
  sail.rotation.y = Math.PI / 2;
  group.add(sail);

  // Boom
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 12, 6), woodLight);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(0, 5.5, -1);
  group.add(boom);

  // Flag
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshStandardMaterial({ color: 0x14110f, side: THREE.DoubleSide }));
  flag.position.set(1.5, 21.5, -1);
  group.add(flag);

  group.userData.flag = flag;
  return group;
}
