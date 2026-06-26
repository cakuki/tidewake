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

  // Mast (steps up through the deck, raked very slightly aft for character)
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 22, 8), woodLight);
  mast.position.set(0, 12, -1);
  mast.castShadow = true;
  group.add(mast);

  // --- Square-rigged mainsail -------------------------------------------------
  // The follow-camera sits astern (looking roughly toward the bow at +Z), so the
  // sail's broad face must point fore/aft (normal along Z), NOT broadside (X).
  // A subdivided plane is bellied out into a wind-filled curve so it reads as a
  // taut "tall ship" sail rather than a flat card.
  const sailW = 12;
  const sailH = 13;
  const sailGeo = new THREE.PlaneGeometry(sailW, sailH, 16, 14);
  const pos = sailGeo.attributes.position;
  const halfW = sailW / 2;
  const halfH = sailH / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    // Belly amount: zero at the side edges (laced to mast/leech) and zero at the
    // top edge (laced to the yard), full in the lower-middle where wind pools.
    const across = Math.cos((x / halfW) * (Math.PI / 2));      // 1 centre -> 0 edges
    const down = Math.cos(((y - halfH) / sailH) * Math.PI);    // small at head, full near foot
    const belly = 3.2 * across * Math.max(0, down);
    // Push the cloth toward the bow (+Z) as if filled by a following wind.
    pos.setZ(i, belly);
  }
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 13, -1);
  sail.castShadow = true;
  group.add(sail);

  // Yard (horizontal spar the head of the sail is bent onto), across the X axis
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, sailW + 2, 6), woodLight);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 13 + halfH, -1);
  yard.castShadow = true;
  group.add(yard);

  // Boom (foot spar) — kept for the lower spar silhouette
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, sailW, 6), woodLight);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(0, 13 - halfH, -1);
  group.add(boom);

  // --- Jib (small fore-and-aft headsail at the bow) ---------------------------
  // A triangular canvas running from near the masthead down to the bowsprit.
  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);     // tack (low, forward)
  jibShape.lineTo(0, 9);     // head (high, near mast)
  jibShape.lineTo(7, 0);     // clew (low, toward bow)
  jibShape.lineTo(0, 0);
  const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), sailMat);
  // Trimmed off the centreline so the canvas presents its face to the astern
  // camera (a dead fore/aft jib would be edge-on and invisible from behind).
  jib.rotation.y = -Math.PI / 2 + 0.55;
  jib.position.set(-0.4, 6.5, 3);
  jib.castShadow = true;
  group.add(jib);

  // --- Rigging lines (thin stays from masthead) -------------------------------
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x2b2622, roughness: 1 });
  function rigLine(from, to, radius = 0.06) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const line = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 4), ropeMat);
    line.position.copy(from).add(to).multiplyScalar(0.5);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    group.add(line);
  }
  const mastTop = new THREE.Vector3(0, 22, -1);
  rigLine(mastTop, new THREE.Vector3(0, 2, 11));   // forestay to the bow
  rigLine(mastTop, new THREE.Vector3(-2.6, 1, -7)); // port backstay
  rigLine(mastTop, new THREE.Vector3(2.6, 1, -7));  // starboard backstay
  rigLine(new THREE.Vector3(-halfW - 1, 13 + halfH, -1), new THREE.Vector3(0, 19, -1), 0.05); // yard lift port
  rigLine(new THREE.Vector3(halfW + 1, 13 + halfH, -1), new THREE.Vector3(0, 19, -1), 0.05);  // yard lift stbd

  // Flag
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), new THREE.MeshStandardMaterial({ color: 0x14110f, side: THREE.DoubleSide }));
  flag.position.set(1.5, 21.5, -1);
  group.add(flag);

  group.userData.flag = flag;
  return group;
}
