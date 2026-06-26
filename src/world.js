import * as THREE from 'three';

// Sky dome + a scatter of islands so there are landmarks to sail toward.
export function createWorld(scene) {
  // Sky gradient via a big inverted sphere
  const skyGeo = new THREE.SphereGeometry(3000, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(0x2b6aa3) },
      bottom: { value: new THREE.Color(0xbfe0ee) },
    },
    vertexShader: `varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
    fragmentShader: `varying vec3 vp; uniform vec3 top; uniform vec3 bottom;
      void main(){ float h = normalize(vp).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, smoothstep(0.0,0.7,h)),1.0);} `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  scene.fog = new THREE.Fog(0x9ec6d8, 600, 2600);

  const islands = new THREE.Group();
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xcdb27a, roughness: 1 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6d3a, roughness: 1 });

  // deterministic-ish placement around the spawn
  const spots = [
    [320, -260, 60], [-480, 220, 90], [180, 640, 75],
    [-700, -520, 110], [820, 380, 85], [-260, -780, 70],
  ];
  for (const [x, z, r] of spots) {
    const isle = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.3, 14, 24), sandMat);
    base.position.y = -2;
    isle.add(base);
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r * 0.7, 16, 12), grassMat);
    hill.scale.y = 0.4; hill.position.y = 4;
    isle.add(hill);
    // a couple palms
    for (let i = 0; i < 4; i++) {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, 16, 6), trunkMat);
      trunk.position.y = 12;
      const leaves = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), leafMat);
      leaves.scale.y = 0.5; leaves.position.y = 20;
      palm.add(trunk, leaves);
      const a = (i / 4) * Math.PI * 2;
      palm.position.set(Math.cos(a) * r * 0.4, 6, Math.sin(a) * r * 0.4);
      isle.add(palm);
    }
    isle.position.set(x, 0, z);
    isle.userData.radius = r;
    islands.add(isle);
  }
  scene.add(islands);

  return { islands };
}
