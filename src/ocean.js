import * as THREE from 'three';
import { WAVES, MAX_SWELL, swellHeight } from './swell.js';
import { DEEP, SHALLOW, oceanFallbackColor } from './sea-color.js';
import { FOAM_LO, FOAM_HI, FOAM_COLOR, FOAM_DRIFT, FOAM_STRENGTH, crestFoam } from './sea-foam.js';

// Re-export so existing importers (and the swell unit test) can read the crest height.
export { MAX_SWELL };

// Format a JS number as a GLSL float literal (always with a decimal point).
const glf = (n) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

// Pull a material's compiled GL program out of the renderer, tolerating three's
// internal shape across minor versions. Returns null if it can't be found (so a
// caller can choose NOT to act rather than risk a false-positive fallback).
function getGLProgram(renderer, material) {
  try {
    const props = renderer.properties?.get?.(material);
    if (!props) return null;
    if (props.currentProgram?.program) return props.currentProgram.program;
    if (props.programs) {
      const iter = typeof props.programs.values === 'function' ? props.programs.values() : props.programs;
      for (const p of iter) if (p?.program) return p.program;
    }
  } catch {
    /* fall through */
  }
  return null;
}

// A large animated ocean plane. Uses a vertex shader for Gerstner-style waves
// so the GPU does the work and the CPU loop stays cheap.
export function createOcean() {
  const size = 4000;
  const geo = new THREE.PlaneGeometry(size, size, 200, 200);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uShallow: { value: new THREE.Color(SHALLOW) }, // luminous Caribbean turquoise (shallows)
    uDeep: { value: new THREE.Color(DEEP) },       // rich tropical blue (offshore, not murky)
    uHaze: { value: new THREE.Color(0xbfe8e6) },   // bright sunny sea-haze (keeps foreground vivid)
    uPaper: { value: new THREE.Color(0xeae7d6) },  // soft warm sun-bleach toward horizon
    uSun: { value: new THREE.Vector3(0.5, 0.8, 0.2).normalize() },
    uCam: { value: new THREE.Vector3() },
    // Glassy "moored" swell settle (#102 ph2): a global amplitude multiplier the landfall gesture
    // eases 1→0.2 as you come to rest ashore, then back to 1 as you set sail. 1 = full open-water
    // swell (the at-sea default). Mirrored on the CPU sampler so the ship never drifts off the sea.
    uSwellScale: { value: 1 },
    // Drifting whitecap foam (#70): the tint the wave crests froth toward. A uniform (like the
    // wake's uFoam) so a future day-night pass could warm it at golden hour. Colour write only.
    uFoam: { value: new THREE.Color(FOAM_COLOR) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    // iOS Safari WebGL is strict: an explicit `precision highp float;` in BOTH stages
    // keeps the shared varyings at a MATCHING precision (a vertex/fragment precision
    // mismatch is a classic mobile link failure → the whole ocean draws nothing and you
    // see only the clear colour, i.e. a flat teal void). highp also keeps the wave trig
    // honest once the camera sails far from the origin.
    vertexShader: /* glsl */ `
      precision highp float;
      precision highp int;
      uniform float uTime;
      uniform vec3 uCam;
      uniform float uSwellScale; // glassy "moored" settle (#102 ph2): 1 at sea, eases toward 0.2 ashore
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vRel; // camera-relative world position — kept SMALL so mobile GPUs stay precise

      // sum of a few sine waves -> rolling swell (evaluated in WORLD space so the
      // plane can follow the ship without the wave pattern sliding). Scaled by uSwellScale so
      // the whole sea can settle glassy-calm as the ship comes to her moorings (#102 ph2).
      float wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
        return amp * sin(dot(normalize(dir), p) * freq + uTime * speed);
      }
      float swell(vec2 p) {
        return (${WAVES.map(([dx, dz, f, s, a]) =>
          `wave(p, vec2(${glf(dx)}, ${glf(dz)}), ${glf(f)}, ${glf(s)}, ${glf(a)})`
        ).join('\n              + ')}) * uSwellScale;
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

        // Pass the position RELATIVE to the camera. The fragment shader's haze, glint and
        // micro-ripple then work on small numbers (the plane is recentred under the camera
        // each frame) instead of huge absolute world coords that lose precision on mobile.
        vRel = wp.xyz - uCam;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp int;
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uDeep;
      uniform vec3 uHaze;
      uniform vec3 uPaper;
      uniform vec3 uSun;
      uniform vec3 uFoam; // drifting whitecap tint (#70)
      varying vec3 vNormal;
      varying float vHeight;
      varying vec3 vRel;

      void main() {
        vec3 n = normalize(vNormal);

        // Subtle micro-detail: a cheap high-frequency ripple perturbs the shading
        // normal only (no geometry/height change — ports/coasts stay dry). Works in
        // camera-relative space (vRel.xz) so the numbers stay small on mobile GPUs.
        vec2 w = vRel.xz;
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
        // viewDir = normalize(uCam - vWorld) == normalize(-vRel).
        vec3 viewDir = normalize(-vRel);
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

        // Drifting whitecaps (#70): foam catches the upper crests and breaks apart as the
        // swell rolls, so the sunny sea reads alive and in motion. Pure shader maths — no
        // geometry, no extra draws — and it reads vHeight (already lock-step with the CPU
        // sampleHeight #102/#65), so it never touches the swell the ship/wake/ports ride.
        // The crest window + smoothstep are generated from sea-foam.js so JS and GPU agree.
        float crest = smoothstep(${glf(FOAM_LO)}, ${glf(FOAM_HI)}, vHeight);
        // patchy streaks that DRIFT across the crests (camera-relative space → small mobile
        // numbers); a sum of slow sines in ~[-1,1] breaks the foam into moving patches so the
        // crests froth unevenly instead of as one solid band — but enough of them catch to read.
        float p = 0.5 * sin(w.x * 0.16 + uTime * ${glf(FOAM_DRIFT)})
                + 0.3 * sin(w.y * 0.19 - uTime * ${glf(FOAM_DRIFT * 0.8)})
                + 0.2 * sin((w.x + w.y) * 0.09 - uTime * ${glf(FOAM_DRIFT * 0.5)});
        float streak = smoothstep(-0.15, 0.6, p);
        float foam = clamp(crest * streak, 0.0, 1.0);
        col = mix(col, uFoam, foam * ${glf(FOAM_STRENGTH)});

        // distance fog toward a BRIGHT sunny sea-haze — measured from the CAMERA so it
        // follows the ship instead of staying pinned to the world origin. length(vRel.xz)
        // == distance(vWorld.xz, uCam.xz), but on small camera-relative numbers.
        float d = length(w) / 1800.0;
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
  // delegates to the shared pure swellHeight() (same WAVES the GLSL is generated from), scaled by
  // the SAME glassy-moored multiplier as the GPU (uSwellScale) so the ship never drifts off the
  // visible sea as the swell settles ashore (#102 ph2). swellScale === uSwellScale.value always.
  let swellScale = 1;
  const sampleHeight = (x, z, t) => swellHeight(x, z, t) * swellScale;

  let fellBack = false;   // did we install the flat-sea fallback?
  let logged = false;     // one-time diagnostic guard (never spam)

  // Swap the custom shader for a simple lit water material in the sea colour. A
  // plausible flat sea always beats an empty teal void.
  function installFallback() {
    if (fellBack) return;
    fellBack = true;
    try {
      mesh.material = new THREE.MeshLambertMaterial({ color: oceanFallbackColor() });
      mat.dispose?.();
    } catch {
      /* if even the fallback throws, leave the original material — never crash the game */
    }
  }

  return {
    mesh,
    // The live ShaderMaterial uniforms — exposed so the optional day-night cycle (#58) can
    // modulate the sun direction + sky/sea tint. When the iOS shader fallback is installed the
    // sea is a flat MeshLambert (no uniforms in use); callers guard with `fellBack`.
    uniforms,
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
    // Drifting-whitecap QA surface (#70): the crest-foam factor (0..1) a point would froth,
    // sampled on the SAME swell the ship rides (sampleHeight, so it tracks uSwellScale too).
    // The shader gates this by a drifting streak; this returns the deterministic crest factor
    // so a headless playtest can sail and assert the sunny sea grows foam on its crests.
    whitecapAt(x, z, t) { return crestFoam(sampleHeight(x, z, t)); },
    // The foam tuning travels with the ocean so QA/tooling can self-check the window is reachable.
    foam: { lo: FOAM_LO, hi: FOAM_HI, strength: FOAM_STRENGTH },
    // Glassy "moored" swell settle (#102 ph2): ease the whole sea's amplitude as the ship comes to
    // rest ashore (1 = full open-water swell, 0.2 = glassy moored calm). Drives BOTH the GPU shader
    // (uSwellScale) and the CPU sampler in lock-step so the ship rides exactly the swell it draws.
    // A no-op-safe write: the flat-sea fallback has no uniforms, so it just tracks the CPU scale.
    setSwellScale(s) {
      swellScale = Number.isFinite(s) ? s : 1;
      try { uniforms.uSwellScale.value = swellScale; } catch { /* fallback sea has no uniforms */ }
      return swellScale;
    },
    get swellScale() { return swellScale; },
    get fellBack() { return fellBack; },
    // Diagnose the ocean shader after the first render and harden against a silent
    // blank sea: if the program DEFINITIVELY failed to link (the iOS symptom), log it
    // once and install a flat-but-coloured fallback. If we can't tell, do nothing (so a
    // healthy desktop sea is never regressed). Safe to call every frame; acts once.
    verifyShader(renderer) {
      if (fellBack || !renderer) return !fellBack;
      try {
        const gl = renderer.getContext?.();
        if (!gl) return true;
        const program = getGLProgram(renderer, mesh.material);
        if (!program) return true; // can't determine — don't risk a false fallback
        const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (linked) {
          if (!logged) { logged = true; console.info('[ocean] shader program linked OK'); }
          return true;
        }
        const info = gl.getProgramInfoLog(program) || '(no program info log)';
        console.warn('[ocean] shader failed to link — installing flat-sea fallback so the sea is never a void:', info);
        installFallback();
        return false;
      } catch {
        return !fellBack;
      }
    },
  };
}
