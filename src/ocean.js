import * as THREE from 'three';

// A large animated ocean plane. Uses a vertex shader for Gerstner-style waves
// so the GPU does the work and the CPU loop stays cheap.
export function createOcean() {
  const size = 4000;
  const geo = new THREE.PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(0x4fb4cc) },
    uDeep: { value: new THREE.Color(0x16607f) },
    uHaze: { value: new THREE.Color(0xc9bf9e) },   // warm weathered horizon haze
    uPaper: { value: new THREE.Color(0xd8c79c) },  // ink-wash warm paper tone
    uSun: { value: new THREE.Vector3(0.5, 0.8, 0.2).normalize() },
    uCam: { value: new THREE.Vector3() },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vWorld;

      // sum of a few sine waves -> rolling swell (evaluated in WORLD space so the
      // plane can follow the ship without the wave pattern sliding)
      float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
        return amp * sin(dot(normalize(dir), p) * freq + uTime * speed);
      }
      float swell(vec2 p) {
        return wave(p, vec2( 1.0, 0.6), 0.012, 1.1, 6.0)
             + wave(p, vec2(-0.7, 1.0), 0.020, 1.6, 3.5)
             + wave(p, vec2( 0.3,-0.9), 0.045, 2.2, 1.4);
      }

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = swell(wp.xz);
        wp.y += h;
        vHeight = h;

        float e = 2.0;
        float hx = swell(wp.xz + vec2(e, 0.0));
        float hz = swell(wp.xz + vec2(0.0, e));
        vNormal = normalize(vec3(h - hx, e, h - hz));

        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uHaze;
      uniform vec3 uPaper;
      uniform vec3 uSun;
      uniform vec3 uCam;
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vWorld;

      void main() {
        vec3 n = normalize(vNormal);
        float fres = pow(1.0 - max(dot(n, vec3(0.0,1.0,0.0)), 0.0), 2.0);
        vec3 base = mix(uDeep, uShallow, smoothstep(-6.0, 8.0, vHeight));
        float spec = pow(max(dot(reflect(-uSun, n), vec3(0.0,1.0,0.0)), 0.0), 24.0);
        vec3 col = base + fres * 0.30 + spec * vec3(1.0, 0.95, 0.8) * 0.6;
        // distance fog toward horizon haze — measured from the CAMERA so it
        // follows the ship instead of staying pinned to the world origin.
        float d = distance(vWorld.xz, uCam.xz) / 1800.0;
        col = mix(col, uHaze, clamp(d - 0.15, 0.0, 0.85));
        // "ink-wash horizon": with distance, drain saturation and wash toward a
        // warm paper tone so the far sea reads like a weathered nautical chart
        // while the foreground stays full-colour. Pure colour maths — ~free.
        float ink = clamp((d - 0.30) * 1.2, 0.0, 0.7);
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum), ink * 0.55);   // desaturate
        col = mix(col, uPaper, ink * 0.30);      // warm paper wash
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;

  // CPU-side wave sampler so the ship can bob on the same swell the shader draws.
  function sampleHeight(x, z, t) {
    const w = (dx, dy, freq, speed, amp) => {
      const len = Math.hypot(dx, dy);
      return amp * Math.sin(((x * dx + z * dy) / len) * freq + t * speed);
    };
    return (
      w(1.0, 0.6, 0.012, 1.1, 6.0) +
      w(-0.7, 1.0, 0.020, 1.6, 3.5) +
      w(0.3, -0.9, 0.045, 2.2, 1.4)
    );
  }

  return {
    mesh,
    update(t, camPos) {
      uniforms.uTime.value = t;
      if (camPos) {
        uniforms.uCam.value.copy(camPos);
        // keep the plane centred under the camera so the sea looks endless
        mesh.position.x = camPos.x;
        mesh.position.z = camPos.z;
      }
    },
    sampleHeight,
  };
}
