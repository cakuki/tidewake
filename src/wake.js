import * as THREE from 'three';

// Bow wake + trailing foam, built entirely from a GPU point cloud — no textures,
// no external assets. Foam is spawned in WORLD space at the ship's bow and stern,
// then left behind: because the hull sails away from it, the points naturally form
// a V at the bow and a fading ribbon astern, and they curve correctly as you turn.
// Each point rides the live swell via ocean.sampleHeight, so the foam sits on the
// water instead of floating. Emission scales with speed and stops at rest.
export function createWake(ocean, { maxParticles = 320 } = {}) {
  const N = maxParticles;

  // Per-particle CPU state (ring buffer — oldest slot is reused on overflow).
  const px = new Float32Array(N);
  const pz = new Float32Array(N);
  const age = new Float32Array(N);
  const life = new Float32Array(N); // 0 => dead/unused
  const seed = new Float32Array(N); // 0..1, drives size/twinkle variety

  let head = 0;        // next slot to write
  let spawnAcc = 0;    // fractional emission accumulator

  // GPU buffers.
  const positions = new Float32Array(N * 3);
  const aAlpha = new Float32Array(N);
  const aSize = new Float32Array(N);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(aAlpha, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
  geo.setDrawRange(0, N);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uFoam: { value: new THREE.Color(0xf4fbff) },
    },
    vertexShader: /* glsl */ `
      attribute float aAlpha;
      attribute float aSize;
      varying float vAlpha;
      uniform float uPixelRatio;
      void main() {
        vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // perspective size attenuation, clamped so near foam stays believable
        float s = aSize * uPixelRatio * (260.0 / max(-mv.z, 1.0));
        gl_PointSize = clamp(s, 1.0, 64.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      precision mediump float;
      varying float vAlpha;
      uniform vec3 uFoam;
      void main() {
        // soft round foam fleck
        vec2 d = gl_PointCoord - 0.5;
        float r = dot(d, d);
        if (r > 0.25) discard;
        float soft = smoothstep(0.25, 0.02, r);
        gl_FragColor = vec4(uFoam, vAlpha * soft);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; // wake hugs the camera-followed ship; never cull
  points.renderOrder = 2;

  function emit(x, z, lifeSec, sz, sd) {
    const i = head;
    px[i] = x; pz[i] = z;
    age[i] = 0; life[i] = lifeSec; seed[i] = sd;
    aSize[i] = sz;
    head = (head + 1) % N;
  }

  // state: { pos:{x,z}|Vector3, heading, speed }, dt, t
  function update(dt, state, t) {
    const speed = state.speed;
    const maxSpeed = state.maxSpeed || 55;
    const norm = Math.min(1, Math.max(0, speed / maxSpeed)); // 0..1 intensity

    // --- emission (world-space, at bow + stern) ---
    if (norm > 0.02 && dt > 0) {
      const h = state.heading;
      const fx = Math.sin(h), fz = Math.cos(h);   // forward
      const rx = Math.cos(h), rz = -Math.sin(h);  // starboard
      const sx = state.pos.x, sz = state.pos.z;

      // more foam the faster you go; biased so it ramps in quickly then eases
      const rate = norm * (28 + 70 * norm); // particles/sec at this speed
      spawnAcc += rate * dt;
      let count = spawnAcc | 0;
      spawnAcc -= count;
      if (count > N) count = N;

      const bowDist = 11.5;
      const sternDist = 8.0;
      const halfBeam = 2.4;
      for (let k = 0; k < count; k++) {
        const sd = Math.random();
        if (sd < 0.62) {
          // BOW: two diverging shoulders that spread outward -> V shape.
          const sign = Math.random() < 0.5 ? 1 : -1;
          const along = bowDist - Math.random() * 3.0;
          const out = halfBeam * (0.4 + Math.random() * 0.5);
          const x = sx + fx * along + rx * out * sign;
          const z = sz + fz * along + rz * out * sign;
          emit(x, z, 0.9 + 0.7 * norm, 1.6 + 2.2 * norm, sd);
        } else {
          // STERN: churned wake ribbon that the hull leaves behind.
          const lat = (Math.random() * 2 - 1) * halfBeam;
          const back = sternDist + Math.random() * 4.0;
          const x = sx - fx * back + rx * lat;
          const z = sz - fz * back + rz * lat;
          emit(x, z, 1.8 + 1.8 * norm, 1.2 + 2.0 * norm, sd);
        }
      }
    }

    // --- age + ride the swell, write GPU buffers ---
    for (let i = 0; i < N; i++) {
      const l = life[i];
      if (l <= 0) { aAlpha[i] = 0; continue; }
      const a = age[i] + dt;
      if (a >= l) { life[i] = 0; aAlpha[i] = 0; continue; }
      age[i] = a;
      const frac = a / l;                 // 0..1 over lifetime
      const x = px[i], z = pz[i];
      const y = ocean.sampleHeight(x, z, t) + 0.35;
      const j = i * 3;
      positions[j] = x; positions[j + 1] = y; positions[j + 2] = z;
      // quick fade-in, long fade-out — subtle, never opaque
      const fadeIn = Math.min(1, frac * 6.0);
      const fadeOut = 1.0 - frac;
      aAlpha[i] = fadeIn * fadeOut * (0.32 + 0.18 * seed[i]);
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;
    geo.attributes.aSize.needsUpdate = true;
  }

  return { points, update };
}
