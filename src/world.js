import * as THREE from 'three';
import { BASE_PALETTE, islandStyle } from './systems/island-style.js';

// Sky dome + a scatter of islands so there are landmarks to sail toward.
//
// Islands TLC (#71): each isle now has a FACE. Its tones, silhouette and prop scatter are derived
// from its index by the pure, deterministic selector in systems/island-style.js — so an isle is
// the same warm sandy cay or cooler peaked rock every voyage (it pairs with the named-island lore
// in islands.js #19). The repeated dressing (rocks / palms / driftwood / grass tufts) is INSTANCED
// per type across the WHOLE archipelago, so a far richer coast is only a handful of draw calls —
// the perf mandate (≤130 draws / ≤150k tris). The warm sand is tuned to read against the luminous
// Caribbean sea (#61).
export function createWorld(scene) {
  // Bright sunny Caribbean sky via a big inverted sphere — a clear blue up high
  // softening to a warm, bright haze at the horizon that ties into the sunny sea.
  const skyGeo = new THREE.SphereGeometry(3000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x2f8fd8) },    // clear sunny sky-blue up high
      bottom: { value: new THREE.Color(0xe6eef0) }, // bright warm horizon haze
    },
    vertexShader: `varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vp; uniform vec3 top; uniform vec3 bottom;
      void main(){ float h = normalize(vp).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0,0.7,h)),1.0);} `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
  // Expose the sky-dome tint uniforms so the optional day-night cycle (#58) can shift the
  // sky through dawn/dusk/night without rebuilding the dome.
  const sky = skyMat.uniforms;

  // Bright sunny horizon haze (matches the ocean haze + sky band). Pushed back a
  // touch so the foreground water stays vividly turquoise.
  scene.fog = new THREE.Fog(0xbfe8e6, 800, 2800);

  const islands = new THREE.Group();
  // Shared base materials — per-isle bodies CLONE these and hue-jitter via offsetHSL (#71), the
  // same trick the NPC fleet uses (npc.js), so each isle gets a distinct tone for free.
  const sandMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.sand, roughness: 1 });
  const sandDarkMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.sandDark, roughness: 1 });
  const grassMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.grass, roughness: 1 });
  const grassDarkMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.grassDark, roughness: 1 });
  const hutWallMat = new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 1 });
  const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x6e5128, roughness: 1 });
  // Shared dressing materials — one per instanced prop type (rock / trunk / leaf / grass tuft).
  const rockMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.rock, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.trunk, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.leaf, roughness: 1 });
  const tuftMat = new THREE.MeshStandardMaterial({ color: BASE_PALETTE.grass, roughness: 1 });

  // Apply a role's HSL offset to a clone of a base material — a gentle tonal nudge, not a recolour.
  const tint = (mat, off) => { const m = mat.clone(); m.color.offsetHSL(off.h, off.s, off.l); return m; };

  // tiny deterministic RNG so each island's lone hut is varied but stable across reloads.
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

  // ---- Unit dressing geometries (instanced once across the whole archipelago) -----------------
  // Each prop type is ONE geometry, instanced per-isle placement → one draw call per type total.
  const rockGeo = new THREE.DodecahedronGeometry(3, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.9, 1.6, 16, 6); trunkGeo.translate(0, 8, 0); // base at y=0
  const leafGeo = new THREE.SphereGeometry(5.5, 8, 6); leafGeo.scale(1, 0.5, 1); leafGeo.translate(0, 17, 0); // crown atop a unit palm
  const driftGeo = new THREE.CylinderGeometry(0.8, 1.0, 9, 6); driftGeo.rotateZ(Math.PI / 2); driftGeo.translate(0, 0.9, 0); // a log lying on its side
  const tuftGeo = new THREE.ConeGeometry(1.3, 2.6, 5); tuftGeo.translate(0, 1.3, 0);

  // [x, z, radius] anchors around the spawn; per-isle character derived from its index.
  const spots = [
    [320, -260, 60], [-480, 220, 90], [180, 640, 75],
    [-700, -520, 110], [820, 380, 85], [-260, -780, 70],
  ];

  const styles = []; // serialisable per-isle look, exposed for QA (#71)
  // Gathered instance transforms per dressing type, across ALL isles (filled per-isle below).
  const dressBuckets = { rock: [], palm: [], driftwood: [], tuft: [] };
  const _e = new THREE.Euler();
  const _q = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();

  spots.forEach(([x, z, r], si) => {
    const style = islandStyle(si, r);
    const { palette, silhouette: sil, dressing } = style;
    const { sx, sz, rot, tall, hillScale, peak, peakScale, lean } = sil;
    const isle = new THREE.Group();

    // Beach: a low sandy ring, squashed/rotated so no two islands share a shape.
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, 14, 28), tint(sandMat, palette.sand));
    base.position.y = -2; base.scale.set(sx, 1, sz); base.rotation.y = rot;
    base.receiveShadow = true;
    isle.add(base);
    // a slightly higher, darker sand shelf to soften beach -> interior (the "blending" TLC).
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.92, 5, 24), tint(sandDarkMat, palette.sandDark));
    shelf.position.y = 2; shelf.scale.set(sx, 1, sz); shelf.rotation.y = rot;
    isle.add(shelf);

    // Interior grass — sometimes a broad mound, sometimes a taller hill peak. A gentle lean
    // tilts the whole interior a touch so even the land feels weathered, not lathe-turned.
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r * (0.45 + hillScale * 0.25), 18, 14), tint(grassMat, palette.grass));
    hill.scale.set(sx, tall ? 0.75 : 0.4, sz);
    hill.position.y = tall ? 8 : 4;
    hill.rotation.z = lean;
    hill.receiveShadow = true;
    isle.add(hill);
    if (peak) {
      const pk = new THREE.Mesh(new THREE.ConeGeometry(r * peakScale, r * 0.45, 12), tint(grassDarkMat, palette.grassDark));
      pk.position.y = 8 + r * 0.18; pk.rotation.z = lean;
      isle.add(pk);
    }

    // Gather this isle's dressing into the shared instance buckets (world-space transforms).
    for (const d of dressing) {
      _e.set(d.tilt || 0, d.rotY || 0, (d.tilt || 0) * 0.5);
      _q.setFromEuler(_e);
      _p.set(x + d.x, d.y, z + d.z);
      _s.setScalar(d.scale);
      _m.compose(_p, _q, _s);
      dressBuckets[d.type].push(_m.clone());
    }

    // Roughly half the islands get a lone weathered hut for a lived-in hint (deterministic).
    const hutRng = rng(si * 9973 + 17);
    if (hutRng() > 0.45) {
      const hut = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 9), hutWallMat);
      walls.position.y = 3; walls.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 5, 4), hutRoofMat);
      roof.position.y = 8.5; roof.rotation.y = Math.PI / 4;
      hut.add(walls, roof);
      const a = hutRng() * Math.PI * 2;
      hut.position.set(Math.cos(a) * r * 0.35 * sx, tall ? 6 : 4, Math.sin(a) * r * 0.35 * sz);
      hut.rotation.y = hutRng() * Math.PI;
      isle.add(hut);
    }

    isle.position.set(x, 0, z);
    isle.userData.radius = r;
    // Beach footprint scale (squash) so collision can treat the island as its real, possibly
    // squashed, shoreline ellipse rather than a circle (#76 beach fix, physics.js).
    isle.userData.sx = sx;
    isle.userData.sz = sz;
    islands.add(isle);

    styles.push({
      index: si, sand: palette.sand, sx, sz, tall, peak,
      props: dressing.reduce((acc, d) => { acc[d.type] = (acc[d.type] || 0) + 1; return acc; }, {}),
    });
  });

  // Build one InstancedMesh per dressing type for the whole archipelago — a lush coast for a
  // handful of draw calls. (Rocks/palms/driftwood/tufts are tiny + low-poly, so the always-drawn
  // instance cost stays a sliver of the triangle budget; no per-isle culling needed.)
  //
  // IMPORTANT: dressing lives in its OWN group, NOT under `islands` — many systems iterate
  // world.islands.children as the isle bodies (collision/physics.js, naming islands.js,
  // NPC/fauna/minimap avoidance), so a stray InstancedMesh there would read as a phantom isle.
  const dressing = new THREE.Group();
  function addInstanced(geo, mat, mats, { cast = true, receive = false } = {}) {
    if (!mats.length) return;
    const inst = new THREE.InstancedMesh(geo, mat, mats.length);
    inst.castShadow = cast; inst.receiveShadow = receive;
    mats.forEach((m, i) => inst.setMatrixAt(i, m));
    inst.instanceMatrix.needsUpdate = true;
    dressing.add(inst);
  }
  addInstanced(rockGeo, rockMat, dressBuckets.rock, { receive: true });
  addInstanced(trunkGeo, trunkMat, dressBuckets.palm);          // palm trunk + crown share a transform
  addInstanced(leafGeo, leafMat, dressBuckets.palm);
  addInstanced(driftGeo, trunkMat, dressBuckets.driftwood);
  addInstanced(tuftGeo, tuftMat, dressBuckets.tuft, { cast: false });

  scene.add(islands);
  scene.add(dressing);

  return { islands, sky, styles, dressing };
}
