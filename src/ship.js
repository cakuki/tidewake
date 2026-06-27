import * as THREE from 'three';

// The player's sloop — still 100% procedural (no external art), but carved from
// shaped geometry rather than a stack of boxes. createShip() returns a THREE.Group
// with userData.flag preserved (main.js/sailing.js animate flag.rotation.z), and
// keeps the same scale/orientation (bow toward +Z, length ~16) so the wake,
// follow-camera and physics still line up.
export function createShip() {
  const group = new THREE.Group();

  // --- Layered wood + canvas materials ---------------------------------------
  const woodHull = new THREE.MeshStandardMaterial({ color: 0x4a2f18, roughness: 0.85, metalness: 0.02, side: THREE.DoubleSide });
  const woodDeck = new THREE.MeshStandardMaterial({ color: 0x9a6b38, roughness: 0.7 });
  const woodTrim = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.75 });
  const woodSpar = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.7 });
  const ironMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.6 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xf2ead6, roughness: 0.9, side: THREE.DoubleSide });

  // --- Carved hull -----------------------------------------------------------
  // Parametric hull: a normalized cross-section (port gunwale -> keel -> stbd
  // gunwale) swept along the keel, tapering to a pointed bow and a narrower
  // transom stern, with a raised sheer at the ends for a jaunty, lively profile.
  const L = 16, halfLen = L / 2;
  const maxBeam = 3.0;      // half-beam amidships (full beam 6, matches old hull)
  const maxDepth = 3.3;     // hull depth (gunwale -> keel)
  const topY = 2.0;         // gunwale base height
  const profile = [
    [-1.00, 0.00], [-0.98, -0.30], [-0.82, -0.62], [-0.45, -0.90],
    [0.00, -1.00],
    [0.45, -0.90], [0.82, -0.62], [0.98, -0.30], [1.00, 0.00],
  ];
  const K = profile.length;
  const nStations = 18;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const beamAt = (t) => {
    let b = maxBeam;
    if (t > 0.5) b *= clamp(1 - Math.pow((t - 0.5) / 0.5, 1.4), 0.04, 1); // pointed bow
    if (t < 0.18) b *= 0.55 + 0.45 * (t / 0.18);                          // narrow transom
    return b;
  };
  const depthAt = (t) => maxDepth * (0.55 + 0.45 * Math.sin(Math.PI * clamp(t, 0, 1)));
  const sheerAt = (t) => {
    let y = topY + 0.95 * Math.pow(Math.abs(t - 0.5) * 2, 2.2);
    if (t > 0.5) y += 0.6 * Math.pow((t - 0.5) / 0.5, 2); // extra-proud bow
    return y;
  };

  const verts = [];
  for (let i = 0; i < nStations; i++) {
    const t = i / (nStations - 1);
    const b = beamAt(t), d = depthAt(t), sh = sheerAt(t);
    const z = -halfLen + t * L;
    for (let j = 0; j < K; j++) {
      verts.push(profile[j][0] * b, sh + profile[j][1] * d, z);
    }
  }
  // bow + stern apex caps
  const sternApex = verts.length / 3;
  verts.push(0, sheerAt(0) - depthAt(0) * 0.55, -halfLen - 0.2);
  const bowApex = verts.length / 3;
  verts.push(0, sheerAt(1) - depthAt(1) * 0.35, halfLen + 0.6);

  const idx = [];
  for (let i = 0; i < nStations - 1; i++) {
    for (let j = 0; j < K - 1; j++) {
      const a = i * K + j, b = (i + 1) * K + j;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  for (let j = 0; j < K - 1; j++) idx.push(sternApex, j, j + 1);                                  // stern fan
  for (let j = 0; j < K - 1; j++) idx.push(bowApex, (nStations - 1) * K + j + 1, (nStations - 1) * K + j); // bow fan

  const hullGeo = new THREE.BufferGeometry();
  hullGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  hullGeo.setIndex(idx);
  hullGeo.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeo, woodHull);
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  // --- Gunwale rail (caps the hull's open top edge, follows the sheer) --------
  const railPts = [];
  for (let side = 0; side < 2; side++) {
    const sgn = side === 0 ? 1 : -1;
    for (let i = 0; i < nStations; i++) {
      const t = i / (nStations - 1);
      railPts.push(new THREE.Vector3(sgn * beamAt(t), sheerAt(t) + 0.05, -halfLen + t * L));
    }
  }
  // two rails, port + starboard, as thin tubes following the sheer line
  for (let side = 0; side < 2; side++) {
    const pts = railPts.slice(side * nStations, side * nStations + nStations);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.16, 5, false), woodTrim);
    rail.castShadow = true;
    group.add(rail);
  }

  // --- Shaped deck (matches the hull plan) -----------------------------------
  const deckShape = new THREE.Shape();
  const inset = 0.86;
  deckShape.moveTo(beamAt(0) * inset, -halfLen);
  for (let i = 1; i < nStations; i++) {
    const t = i / (nStations - 1);
    deckShape.lineTo(beamAt(t) * inset, -halfLen + t * L);
  }
  for (let i = nStations - 1; i >= 0; i--) {
    const t = i / (nStations - 1);
    deckShape.lineTo(-beamAt(t) * inset, -halfLen + t * L);
  }
  const deckGeo = new THREE.ShapeGeometry(deckShape);
  deckGeo.rotateX(-Math.PI / 2);
  const deck = new THREE.Mesh(deckGeo, woodDeck);
  deck.position.y = topY + 0.02;
  deck.receiveShadow = true;
  group.add(deck);

  // a few darker plank seams across the deck for texture-free grain
  for (let s = -6; s <= 6; s += 2) {
    const seam = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.03, 0.08), woodTrim);
    seam.position.set(0, topY + 0.05, s);
    group.add(seam);
  }

  // --- Deck furniture: wheel, capstan, barrel, crate -------------------------
  // Ship's wheel (mounted aft, raised on a small binnacle)
  const wheel = new THREE.Group();
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 8, 16), woodTrim);
  wheel.add(wheelRim);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 5), woodTrim);
    spoke.rotation.z = (i / 6) * Math.PI;
    wheel.add(spoke);
  }
  wheel.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 8), ironMat));
  wheel.rotation.x = Math.PI / 2.4;
  const binnacle = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.1, 8), woodTrim);
  binnacle.position.set(0, topY + 0.6, -5.6);
  group.add(binnacle);
  wheel.position.set(0, topY + 1.5, -5.6);
  group.add(wheel);

  // Capstan (forward of the wheel)
  const capstan = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 1.0, 10), woodTrim);
  capstan.position.set(0, topY + 0.5, -3.2);
  capstan.castShadow = true;
  group.add(capstan);

  // Barrel + crate lashed amidships
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.3, 12), woodSpar);
  barrel.position.set(1.1, topY + 0.65, 2.2);
  barrel.castShadow = true;
  group.add(barrel);
  for (let h = -0.4; h <= 0.4; h += 0.4) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.57, 0.04, 6, 12), ironMat);
    hoop.rotation.x = Math.PI / 2; hoop.position.set(1.1, topY + 0.65 + h, 2.2);
    group.add(hoop);
  }
  const crate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 1.1), woodTrim);
  crate.position.set(-1.0, topY + 0.5, 3.0);
  crate.rotation.y = 0.3;
  crate.castShadow = true;
  group.add(crate);

  // --- Stubby cannons + hinted gun-ports -------------------------------------
  for (let side = 0; side < 2; side++) {
    const sgn = side === 0 ? 1 : -1;
    for (const z of [-0.5, 3.0]) {
      const t = (z + halfLen) / L;
      const x = beamAt(t) * 0.78;
      const barrelC = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 1.6, 8), ironMat);
      barrelC.rotation.z = Math.PI / 2;
      barrelC.position.set(sgn * (x + 0.4), topY + 0.45, z);
      group.add(barrelC);
      const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), woodTrim);
      carriage.position.set(sgn * x, topY + 0.25, z);
      group.add(carriage);
      // hinted gun-port: a small dark inset square on the topside
      const port = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.6), ironMat);
      port.position.set(sgn * (beamAt(t) + 0.02), topY - 0.3, z);
      port.rotation.y = sgn * Math.PI / 2;
      group.add(port);
    }
  }

  // --- Mast (raked very slightly aft for character) --------------------------
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 22, 8), woodSpar);
  mast.position.set(0, 12, -1);
  mast.castShadow = true;
  group.add(mast);

  // --- Square-rigged mainsail (bellied into a wind-filled curve) --------------
  const sailW = 12;
  const sailH = 13;
  const sailGeo = new THREE.PlaneGeometry(sailW, sailH, 16, 14);
  const pos = sailGeo.attributes.position;
  const halfW = sailW / 2;
  const halfH = sailH / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const across = Math.cos((x / halfW) * (Math.PI / 2));
    const down = Math.cos(((y - halfH) / sailH) * Math.PI);
    const belly = 3.2 * across * Math.max(0, down);
    pos.setZ(i, belly);
  }
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 13, -1);
  sail.castShadow = true;
  group.add(sail);

  // Yard (head spar) + boom (foot spar)
  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, sailW + 2, 6), woodSpar);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 13 + halfH, -1);
  yard.castShadow = true;
  group.add(yard);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, sailW, 6), woodSpar);
  boom.rotation.z = Math.PI / 2;
  boom.position.set(0, 13 - halfH, -1);
  group.add(boom);

  // --- Jib (small fore-and-aft headsail at the bow) ---------------------------
  const jibShape = new THREE.Shape();
  jibShape.moveTo(0, 0);
  jibShape.lineTo(0, 9);
  jibShape.lineTo(7, 0);
  jibShape.lineTo(0, 0);
  const jib = new THREE.Mesh(new THREE.ShapeGeometry(jibShape), sailMat);
  jib.rotation.y = -Math.PI / 2 + 0.55;
  jib.position.set(-0.4, 6.5, 3);
  jib.castShadow = true;
  group.add(jib);

  // Bowsprit (spar projecting from the proud bow, anchors the jib + forestay)
  const bowsprit = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 5, 6), woodSpar);
  bowsprit.rotation.x = Math.PI / 2 - 0.25;
  bowsprit.position.set(0, 3.4, 9);
  group.add(bowsprit);

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
  rigLine(mastTop, new THREE.Vector3(0, 3.6, 11));   // forestay to bowsprit tip
  rigLine(mastTop, new THREE.Vector3(-2.6, 2, -7));  // port backstay
  rigLine(mastTop, new THREE.Vector3(2.6, 2, -7));   // starboard backstay
  rigLine(new THREE.Vector3(-halfW - 1, 13 + halfH, -1), new THREE.Vector3(0, 19, -1), 0.05);
  rigLine(new THREE.Vector3(halfW + 1, 13 + halfH, -1), new THREE.Vector3(0, 19, -1), 0.05);

  // --- Jaunty pirate pennant --------------------------------------------------
  // A long swallow-tailed pennant on a Group so sailing.js can swing its
  // rotation.z for a lively flap. A small bone-white skull dot gives it cheek.
  const flag = new THREE.Group();
  const pennantShape = new THREE.Shape();
  pennantShape.moveTo(0, -0.8);
  pennantShape.lineTo(0, 0.8);
  pennantShape.lineTo(3.4, 0.45);
  pennantShape.lineTo(2.6, 0.0);   // swallow-tail notch
  pennantShape.lineTo(3.4, -0.45);
  pennantShape.lineTo(0, -0.8);
  const pennant = new THREE.Mesh(new THREE.ShapeGeometry(pennantShape),
    new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 0.95, side: THREE.DoubleSide }));
  flag.add(pennant);
  const skull = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.9, side: THREE.DoubleSide }));
  skull.position.set(1.1, 0, 0.02);
  flag.add(skull);
  flag.position.set(0.45, 21.4, -1);
  group.add(flag);

  group.userData.flag = flag;
  return group;
}
