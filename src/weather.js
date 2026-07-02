// Optional weather (#88) — the sky comes ALIVE. A lightweight, seeded, atmospheric weather
// cycle that rides on top of the day-night system (#58): sail long enough and clouds gather, a
// rain squall greys the sea and dims the light, a distant flash cracks over the swell — then it
// clears again. DEFAULT OFF, behind its own toggle in the #73 settings panel; when OFF the clear
// Caribbean weather is the default and is restored byte-for-byte (weather(0)/darken=0 is a perfect
// no-op — a true zero-cost off state).
//
// House standard (#53, src/ui/README.md): the tricky maths is PURE (weather + applyWeather, NO
// three.js / DOM, unit-tested under node:test); a thin factory (createWeather) captures the live
// scene refs, composes the palette on top of day-night's, and owns the CHEAP visuals — a single
// instanced cloud ceiling (1 draw) and one GPU-animated rain particle system (1 draw). No per-drop
// meshes, no per-frame allocation, no geometry leak across toggling (#121); THREE is injected so
// this module stays node-testable.
//
// Perf: weather adds at most 2 draw calls and only while a front is overhead; OFF/clear = 0 draws.

import { mixHex } from './sea-color.js';
import { dayNight, NOON } from './daynight.js';

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

// ---- Keyframes around the weather cycle (phase in [0,1), 0 = perfectly clear) --------------
// CLEAR is the sacred default (all zeros) so weather(0) is a no-op. The arc gathers clouds,
// breaks into a rain squall, then clears — tasteful, never gloomy-by-default (it is opt-in).
const KEYFRAMES = [
  { t: 0.00, cloud: 0.00, rain: 0.00, darken: 0.00 }, // CLEAR — today's sky, untouched
  { t: 0.30, cloud: 0.55, rain: 0.00, darken: 0.12 }, // CLOUDS gathering — a shadow crosses the sea
  { t: 0.50, cloud: 1.00, rain: 1.00, darken: 0.50 }, // SQUALL — overcast, rain, distant flashes
  { t: 0.70, cloud: 0.45, rain: 0.12, darken: 0.10 }, // CLEARING — the front passes, light returns
];

const wrap01 = (t) => ((Number(t) || 0) % 1 + 1) % 1;

// The readable weather state at a phase — for HUD/QA and the deterministic-progression gate.
function keyAt(k) {
  if (k < 0.15 || k >= 0.85) return 'clear';
  if (k < 0.42) return 'clouds';
  if (k < 0.62) return 'squall';
  return 'clearing';
}

// A distant lightning flash: deterministic pulses that fire ONLY when the storm is heavy
// (darken high), so fair weather never flickers. Pure function of phase → 0..1.
function flashAt(k, darken) {
  if (darken < 0.35) return 0;                 // only the real squall throws light
  const f = (k * 17) % 1;                       // a fast deterministic sub-cycle over the storm
  return f < 0.06 ? (1 - f / 0.06) * darken : 0; // a brief decaying spike
}

/**
 * PURE — the weather intensities at a normalised cycle phase.
 * @param {number} phase weather-cycle position in [0,1); 0 = perfectly clear. Wraps (loops).
 * @returns {{key:'clear'|'clouds'|'squall'|'clearing', cloud:number, rain:number,
 *   darken:number, flash:number}} all intensities in [0,1].
 */
export function weather(phase) {
  const k = wrap01(phase);
  const ks = KEYFRAMES;
  let i = 0;
  while (i < ks.length - 1 && k >= ks[i + 1].t) i++;   // segment [ks[i], ks[i+1] | wrap]
  const a = ks[i];
  const b = ks[(i + 1) % ks.length];
  const t0 = a.t;
  const t1 = i + 1 < ks.length ? ks[i + 1].t : 1;      // last segment wraps back to 1 (== 0/clear)
  const f = t1 > t0 ? clamp01((k - t0) / (t1 - t0)) : 0;
  const s = f * f * (3 - 2 * f);                        // smoothstep for a gentle build
  const cloud = clamp01(lerp(a.cloud, b.cloud, s));
  const rain = clamp01(lerp(a.rain, b.rain, s));
  const darken = clamp01(lerp(a.darken, b.darken, s));
  return { key: keyAt(k), cloud, rain, darken, flash: clamp01(flashAt(k, darken)) };
}

// The storm slate the palette greys toward — a desaturated cool grey, never black.
const STORM_GREY = 0x6b7079;

/**
 * PURE — darken a day-night-style palette toward the storm mood by the weather intensities.
 * darken=0 && flash=0 returns the base BYTE-FOR-BYTE (clear is a perfect no-op). A flash briefly
 * LIFTS the light above the dimmed storm level (the distant lightning beat).
 * @param {object} base a dayNight()-shaped palette.
 * @param {{darken:number, flash:number}} w weather intensities.
 */
export function applyWeather(base, w) {
  const d = clamp01(w.darken || 0);
  const flash = clamp01(w.flash || 0);
  const grey = (hex, amt) => mixHex(hex, STORM_GREY, clamp01(amt * d));
  return {
    sun: base.sun,
    sunColor: grey(base.sunColor, 0.4),
    sunIntensity: base.sunIntensity * (1 - 0.5 * d) + flash * 1.5,
    hemiSky: grey(base.hemiSky, 0.5),
    hemiGround: base.hemiGround,
    hemiIntensity: base.hemiIntensity * (1 - 0.3 * d) + flash * 0.8,
    haze: grey(base.haze, 0.6),
    skyTop: grey(base.skyTop, 0.55),
    skyBottom: grey(base.skyBottom, 0.5),
    seaShallow: grey(base.seaShallow, 0.55),
    seaDeep: grey(base.seaDeep, 0.5),
    seaPaper: grey(base.seaPaper, 0.5),
  };
}

// ---- The factory (browser-only; THREE injected so this file stays node-testable) -----------

// A soft round cloud puff drawn once to a canvas → one shared texture for every billboard.
function makeCloudTexture(THREE) {
  const s = 128;
  const cv = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
  if (!cv) return null;
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1.0, 'rgba(255,255,255,0.0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Wire the weather layer to the live scene. Captures the clear defaults so OFF restores them
 * byte-for-byte; when enabled, advances a seeded phase, composes applyWeather() on top of the
 * day-night palette (or the sunny default when the cycle is off) each frame, and drives the
 * cheap cloud + rain visuals. All refs optional (headless/test-safe). THREE is injected.
 *
 * @param {object} refs
 * @param {object} refs.THREE     the three.js namespace (injected; omit → pure/headless, no visuals)
 * @param {object} refs.scene     THREE.Scene (.background + .fog.color, and holds the visuals)
 * @param {object} refs.camera    the follow camera (visuals track it so a front is always overhead)
 * @param {object} refs.sun       THREE.DirectionalLight
 * @param {object} refs.hemi      THREE.HemisphereLight
 * @param {object} refs.ocean     createOcean() result (.uniforms / .fellBack)
 * @param {object} [refs.sky]     sky-dome uniforms { top, bottom }
 * @param {object} [refs.daynight] the day-night controller — weather composes on its live palette
 * @param {number} [refs.period]  seconds for a full clear→squall→clear cycle (default 140)
 * @param {function} [refs.onSquall] called once when a front first breaks into a squall (charm beat)
 */
export function createWeather({ THREE, scene, camera, sun, hemi, ocean, sky, daynight, period = 140, onSquall } = {}) {
  // Capture today's clear defaults so flipping OFF restores them exactly (mirrors day-night).
  const defaults = {
    bg: scene?.background?.getHex?.(),
    fog: scene?.fog?.color?.getHex?.(),
    sunColor: sun?.color?.getHex?.(),
    sunIntensity: sun?.intensity,
    hemiSky: hemi?.color?.getHex?.(),
    hemiGround: hemi?.groundColor?.getHex?.(),
    hemiIntensity: hemi?.intensity,
    skyTop: sky?.top?.value?.getHex?.(),
    skyBottom: sky?.bottom?.value?.getHex?.(),
    uHaze: ocean?.uniforms?.uHaze?.value?.getHex?.(),
    uShallow: ocean?.uniforms?.uShallow?.value?.getHex?.(),
    uDeep: ocean?.uniforms?.uDeep?.value?.getHex?.(),
    uPaper: ocean?.uniforms?.uPaper?.value?.getHex?.(),
  };

  let enabled = false;
  let phase = 0;

  // ---- CHEAP visuals: one instanced cloud ceiling + one GPU rain system (built ONCE) --------
  let clouds = null;   // { mesh (InstancedMesh), group, mat }
  let rain = null;     // { points, mat, geo }
  let squallFired = false;

  if (THREE && scene) {
    try {
      // Cloud bank: N soft billboards on ONE InstancedMesh (1 draw), a shared soft-puff texture,
      // stood up as a distant ring-wall on the horizon (each faces inward ≈ toward the camera, which
      // stays near the ring centre) so it reads as weather coming on the wind — never bleeding onto
      // the near sea. The group drifts (slow y-spin) + tracks the camera. Hidden when clear.
      const N = 18;
      const RAD = 1400;   // a mid-distance ring-wall: close enough to read, behind the near sea
      const tex = makeCloudTexture(THREE);
      const cloudMat = new THREE.MeshBasicMaterial({
        map: tex || undefined, color: 0xffffff, transparent: true, opacity: 0,
        depthWrite: false, fog: false, // occlude behind the sea (depthTest on); no fog so the bank stays legible
      });
      const cloudGeo = new THREE.PlaneGeometry(1, 1);
      const inst = new THREE.InstancedMesh(cloudGeo, cloudMat, N);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
      for (let i = 0; i < N; i++) {
        const ang = (i / N) * Math.PI * 2;
        const yaw = Math.atan2(-Math.cos(ang), -Math.sin(ang)); // face the ring centre (≈ the camera)
        const w = 800 + (i % 4) * 200;
        const h = 620 + (i % 3) * 180;
        pos.set(Math.cos(ang) * RAD, 340 + (i % 3) * 70, Math.sin(ang) * RAD); // a bank rising off the horizon into the sky
        q.setFromEuler(new THREE.Euler(0, yaw, 0));
        scl.set(w, h, 1);
        m.compose(pos, q, scl);
        inst.setMatrixAt(i, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.frustumCulled = false;
      const group = new THREE.Group();
      group.add(inst);
      group.visible = false;
      scene.add(group);
      clouds = { mesh: inst, group, mat: cloudMat };

      // Rain: ONE THREE.Points GPU particle system (1 draw). The vertex shader animates the fall
      // from a uTime uniform (zero per-frame JS allocation); the box tracks the camera so rain is
      // always around the ship. Hidden when dry.
      const COUNT = 1400;
      const BOX = 300, TOP = 220;
      const parr = new Float32Array(COUNT * 3);
      const seed = new Float32Array(COUNT); // per-drop phase offset so they don't fall in lockstep
      for (let i = 0; i < COUNT; i++) {
        parr[i * 3 + 0] = (Math.random() - 0.5) * BOX;
        parr[i * 3 + 1] = Math.random() * TOP;
        parr[i * 3 + 2] = (Math.random() - 0.5) * BOX;
        seed[i] = Math.random();
      }
      const rgeo = new THREE.BufferGeometry();
      rgeo.setAttribute('position', new THREE.BufferAttribute(parr, 3));
      rgeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
      const rmat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, fog: false,
        uniforms: {
          uTime: { value: 0 }, uOpacity: { value: 0 }, uTop: { value: TOP },
          uFall: { value: 140 }, uColor: { value: new THREE.Color(0xcdd6dd) }, uSize: { value: 2.4 },
        },
        vertexShader: `
          attribute float seed; uniform float uTime, uTop, uFall, uSize;
          void main() {
            vec3 p = position;
            float fall = mod(p.y - (uTime + seed * uTop) * uFall, uTop); // wrap the fall, seeded
            p.y = fall;
            p.x += seed * 6.0 - 3.0;                                     // a touch of slant/scatter
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uSize * (300.0 / -mv.z);                      // perspective-scaled drop
          }`,
        fragmentShader: `
          uniform vec3 uColor; uniform float uOpacity;
          void main() {
            vec2 d = gl_PointCoord - 0.5;
            float a = smoothstep(0.5, 0.0, length(d));                   // soft round drop
            gl_FragColor = vec4(uColor, a * uOpacity);
          }`,
      });
      const points = new THREE.Points(rgeo, rmat);
      points.frustumCulled = false;
      points.visible = false;
      scene.add(points);
      rain = { points, mat: rmat, geo: rgeo, BOX, TOP };
    } catch { clouds = null; rain = null; /* visuals are a flourish; never break the sim */ }
  }

  function basePalette() {
    // A fresh, clean palette to modulate — never read back live (so weather never compounds).
    return daynight?.enabled ? daynight.palette() : dayNight(NOON);
  }

  function writePalette(p) {
    if (sun) {
      sun.color?.setHex?.(p.sunColor);
      sun.intensity = p.sunIntensity;
    }
    if (hemi) {
      hemi.color?.setHex?.(p.hemiSky);
      hemi.groundColor?.setHex?.(p.hemiGround);
      hemi.intensity = p.hemiIntensity;
    }
    scene?.background?.setHex?.(p.haze);
    scene?.fog?.color?.setHex?.(p.haze);
    if (sky) { sky.top?.value?.setHex?.(p.skyTop); sky.bottom?.value?.setHex?.(p.skyBottom); }
    const u = ocean?.uniforms;
    if (u && !ocean.fellBack) {
      u.uHaze?.value?.setHex?.(p.haze);
      u.uShallow?.value?.setHex?.(p.seaShallow);
      u.uDeep?.value?.setHex?.(p.seaDeep);
      u.uPaper?.value?.setHex?.(p.seaPaper);
    }
  }

  function restoreDefaults() {
    if (sun) {
      if (defaults.sunColor != null) sun.color?.setHex?.(defaults.sunColor);
      if (defaults.sunIntensity != null) sun.intensity = defaults.sunIntensity;
    }
    if (hemi) {
      if (defaults.hemiSky != null) hemi.color?.setHex?.(defaults.hemiSky);
      if (defaults.hemiGround != null) hemi.groundColor?.setHex?.(defaults.hemiGround);
      if (defaults.hemiIntensity != null) hemi.intensity = defaults.hemiIntensity;
    }
    if (defaults.bg != null) scene?.background?.setHex?.(defaults.bg);
    if (defaults.fog != null) scene?.fog?.color?.setHex?.(defaults.fog);
    if (sky) {
      if (defaults.skyTop != null) sky.top?.value?.setHex?.(defaults.skyTop);
      if (defaults.skyBottom != null) sky.bottom?.value?.setHex?.(defaults.skyBottom);
    }
    const u = ocean?.uniforms;
    if (u) {
      if (defaults.uHaze != null) u.uHaze?.value?.setHex?.(defaults.uHaze);
      if (defaults.uShallow != null) u.uShallow?.value?.setHex?.(defaults.uShallow);
      if (defaults.uDeep != null) u.uDeep?.value?.setHex?.(defaults.uDeep);
      if (defaults.uPaper != null) u.uPaper?.value?.setHex?.(defaults.uPaper);
    }
  }

  function applyVisuals(w) {
    if (clouds) {
      clouds.group.visible = w.cloud > 0.02;
      if (clouds.group.visible) {
        clouds.mat.opacity = 0.7 * w.cloud;
        // Grey the cloud as the storm deepens; drift + track the camera (one write each, no alloc).
        clouds.mat.color?.setHex?.(mixHex(0xffffff, STORM_GREY, 0.6 * w.darken));
        if (camera) { clouds.group.position.x = camera.position.x; clouds.group.position.z = camera.position.z; }
      }
    }
    if (rain) {
      rain.points.visible = w.rain > 0.02;
      if (rain.points.visible) {
        rain.mat.uniforms.uOpacity.value = 0.6 * w.rain;
        if (camera) rain.points.position.set(camera.position.x, camera.position.y - rain.TOP * 0.5, camera.position.z);
      }
    }
  }

  function hideVisuals() {
    if (clouds) clouds.group.visible = false;
    if (rain) rain.points.visible = false;
  }

  function applyPhase() {
    const w = weather(phase);
    writePalette(applyWeather(basePalette(), w));
    applyVisuals(w);
    if (!squallFired && w.key === 'squall') { squallFired = true; try { onSquall?.(); } catch { /* a flourish must never break the loop */ } }
    if (w.key === 'clear') squallFired = false; // re-arm the beat once the front has passed
  }

  return {
    setEnabled(on) {
      enabled = !!on;
      if (enabled) applyPhase();
      else {
        hideVisuals();
        // If day-night owns the palette it rewrites it next frame; else restore the clear default.
        if (!daynight?.enabled) restoreDefaults();
      }
    },
    update(dt) {
      if (!enabled) return;               // OFF is a TRUE no-op — zero per-frame weather work
      phase = (phase + (dt / period)) % 1;
      if (rain) rain.mat.uniforms.uTime.value += dt;
      applyPhase();
    },
    // QA / introspection surface.
    get enabled() { return enabled; },
    get phase() { return phase; },
    set phase(v) { phase = wrap01(v); if (enabled) applyPhase(); },
    state() { return weather(phase); },
    // Live draw cost of the weather visuals right now (0 when clear/off) — for the gate.
    get activeDraws() { return (clouds?.group?.visible ? 1 : 0) + (rain?.points?.visible ? 1 : 0); },
  };
}
