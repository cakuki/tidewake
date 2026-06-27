import * as THREE from 'three';

// Sky dome + a scatter of islands so there are landmarks to sail toward.
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
  // Shared palette — a couple of sand/grass/rock tones to blend beach into hill.
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xd8bd84, roughness: 1 });
  const sandDarkMat = new THREE.MeshStandardMaterial({ color: 0xc2a468, roughness: 1 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 });
  const grassDarkMat = new THREE.MeshStandardMaterial({ color: 0x3c6230, roughness: 1 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7669, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6d3a, roughness: 1 });
  const hutWallMat = new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 1 });
  const hutRoofMat = new THREE.MeshStandardMaterial({ color: 0x6e5128, roughness: 1 });

  // tiny deterministic RNG so each island is varied but stable across reloads
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

  // [x, z, radius] anchors around the spawn; per-isle character derived from seed
  const spots = [
    [320, -260, 60], [-480, 220, 90], [180, 640, 75],
    [-700, -520, 110], [820, 380, 85], [-260, -780, 70],
  ];

  spots.forEach(([x, z, r], si) => {
    const rand = rng(si * 9973 + 17);
    const isle = new THREE.Group();

    // Beach: a low sandy ring, squashed/rotated so no two islands share a shape.
    const sx = 0.8 + rand() * 0.5, sz = 0.8 + rand() * 0.5;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, 14, 28), sandMat);
    base.position.y = -2; base.scale.set(sx, 1, sz); base.rotation.y = rand() * Math.PI;
    base.receiveShadow = true;
    isle.add(base);
    // a slightly higher, darker sand shelf to blend beach -> interior
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.92, 5, 24), sandDarkMat);
    shelf.position.y = 2; shelf.scale.set(sx, 1, sz); shelf.rotation.y = base.rotation.y;
    isle.add(shelf);

    // Interior grass — sometimes a broad mound, sometimes a taller hill peak.
    const tall = rand() > 0.5;
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r * (0.55 + rand() * 0.2), 18, 14), grassMat);
    hill.scale.set(sx, tall ? 0.75 : 0.4, sz);
    hill.position.y = tall ? 8 : 4;
    hill.receiveShadow = true;
    isle.add(hill);
    if (tall) {
      const peak = new THREE.Mesh(new THREE.ConeGeometry(r * 0.32, r * 0.45, 12), grassDarkMat);
      peak.position.y = 8 + r * 0.18;
      isle.add(peak);
    }

    // Scattered rocks around the shoreline.
    const nRocks = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < nRocks; i++) {
      const a = rand() * Math.PI * 2;
      const rr = r * (0.85 + rand() * 0.35);
      const rk = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rand() * 4, 0), rockMat);
      rk.position.set(Math.cos(a) * rr * sx, rand() * 2, Math.sin(a) * rr * sz);
      rk.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      rk.scale.y = 0.6 + rand() * 0.5;
      rk.castShadow = true;
      isle.add(rk);
    }

    // Palms — varied count, height and a jaunty lean.
    const nPalms = 3 + Math.floor(rand() * 4);
    for (let i = 0; i < nPalms; i++) {
      const palm = new THREE.Group();
      const ht = 13 + rand() * 8;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, ht, 6), trunkMat);
      trunk.position.y = ht / 2;
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(5 + rand() * 2, 8, 6), leafMat);
      leaves.scale.y = 0.5; leaves.position.y = ht + 1;
      palm.add(trunk, leaves);
      const a = (i / nPalms) * Math.PI * 2 + rand() * 0.6;
      const pr = r * (0.3 + rand() * 0.25);
      palm.position.set(Math.cos(a) * pr * sx, 5, Math.sin(a) * pr * sz);
      palm.rotation.z = (rand() - 0.5) * 0.4;   // lean
      palm.rotation.y = rand() * Math.PI;
      isle.add(palm);
    }

    // Roughly half the islands get a lone weathered hut for a lived-in hint.
    if (rand() > 0.45) {
      const hut = new THREE.Group();
      const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 6, 9), hutWallMat);
      walls.position.y = 3; walls.castShadow = true;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 5, 4), hutRoofMat);
      roof.position.y = 8.5; roof.rotation.y = Math.PI / 4;
      hut.add(walls, roof);
      const a = rand() * Math.PI * 2;
      hut.position.set(Math.cos(a) * r * 0.35 * sx, tall ? 6 : 4, Math.sin(a) * r * 0.35 * sz);
      hut.rotation.y = rand() * Math.PI;
      isle.add(hut);
    }

    isle.position.set(x, 0, z);
    isle.userData.radius = r;
    // Beach footprint scale (squash) so collision can treat the island as its real, possibly
    // squashed, shoreline ellipse rather than a circle (#76 beach fix, physics.js).
    isle.userData.sx = sx;
    isle.userData.sz = sz;
    islands.add(isle);
  });
  scene.add(islands);

  return { islands, sky };
}
