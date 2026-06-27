import * as THREE from 'three';
import { WAVES, MAX_SWELL, swellHeight } from './swell.js';

// Re-export so existing importers (and the swell unit test) can read the crest height.
export { MAX_SWELL };

// Format a JS number as a GLSL float literal (always with a decimal point).
const glf = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

// A large animated ocean plane. Uses a vertex shader for Gerstner-style waves
// so the GPU does the work and the CPU loop stays cheap.
export function createOcean() {
  const size = 4000;
  const geo = new THREE.PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(0x46e3d0) }, // luminous Caribbean turquoise (shallows)
    uDeep: { value: new THREE.Color(0x1192c6) },    // rich tropical blue (offshore, not murky)
    uHaze: { value: new THREE.Color(0xbfe8e6) },    // bright sunny sea-haze (keeps foreground vivid)
    uPaper: { value: new THREE.Color(0xeae7d6) },   // soft warm sun-bleach toward horizon
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
        return ${WAVES.map(([dx, dz, f, s, a]) =>
          `wave(p, vec2(${glf(dx)}, ${glf(dz)}), ${glf(f)}, ${glf(s)}, ${glf(a)})`
        ).join('\n             + ')};
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
      uniform float uTime;
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

        // Subtle micro-detail: a cheap high-frequency ripple perturbs the shading
        // normal only (no geometry/height change — ports/coasts stay dry). It scrolls
        // slowly, tied to time, to break the flatness left by the calmer swell (#51).
        vec2 w = vWorld.xz;
        vec3 nMicro = normalize(n + vec3(
          0.05 * cos(w.x * 0.25 + uTime * 0.8) + 0.03 * cos(w.y * 0.6 - uTime * 1.3),
          0.0,
          0.05 * cos(w.y * 0.22 - uTime * 0.6) + 0.03 * cos(w.x * 0.55 + uTime * 1.1)));

        // Caribbean depth ramp: rich tropical blue in the troughs -> luminous
        // turquoise on the crests, with a touch of extra aqua lift near the top.
        float depth = smoothstep(-6.0, 8.0, vHeight);
        vec3 base = mix(uDeep, uShallow, depth);
        base += uShallow * 0.10 * smoothstep(0.2, 1.0, depth);

        // Sky-tint fresnel: grazing angles pick up bright sky, lifting the sheen.
        float fres = pow(1.0 - max(dot(nMicro, vec3(0.0,1.0,0.0)), 0.0), 2.0);

        // Sun glint — believable Blinn-Phong sparkle tied to the sun direction (uSun)
        // and the eye. A tight bright core reads as a sun reflection; a broader,
        // shimmering lobe twinkles as the micro-ripples and time scroll past, so the
        // glint dances calmly on the water. Capped so it never blows out to white.
        vec3 viewDir = normalize(uCam - vWorld);
        vec3 sunDir = normalize(uSun);
        vec3 halfV = normalize(sunDir + viewDir);
        float ndh = max(dot(nMicro, halfV), 0.0);
        float glintCore = pow(ndh, 220.0);                 // tight sun pinpoint
        float shimmer = 0.5 + 0.5 * sin(w.x * 0.7 + uTime * 2.5)
                                  * sin(w.y * 0.6 - uTime * 2.0);
        float sparkle = pow(ndh, 60.0) * shimmer;          // dancing sea-sparkle
        float glint = min(glintCore * 1.3 + sparkle * 0.45, 1.6);
        vec3 sunCol = vec3(1.0, 0.97, 0.86);

        vec3 col = base + fres * 0.22 + glint * sunCol;

        // distance fog toward a BRIGHT sunny sea-haze — measured from the CAMERA so it
        // follows the ship instead of staying pinned to the world origin.
        float d = distance(vWorld.xz, uCam.xz) / 1800.0;
        col = mix(col, uHaze, clamp(d - 0.15, 0.0, 0.85));
        // Gentle sun-bleach toward the horizon for depth — a soft, warm, BRIGHT wash
        // (re-tuned from the old weathered ink-wash so the foreground water stays vivid
        // turquoise and the whole sea reads sunny, not gloomy). Pure colour maths — ~free.
        float ink = clamp((d - 0.45) * 1.0, 0.0, 0.45);
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(lum), ink * 0.18);   // a hint of distance desaturation
        col = mix(col, uPaper, ink * 0.14);      // soft warm sun-bleach
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;

  // CPU-side wave sampler so the ship can bob on the same swell the shader draws —
  // delegates to the shared pure swellHeight() (same WAVES the GLSL is generated from).
  const sampleHeight = swellHeight;

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
