// Optional day & night cycle (#58) — a gentle, pretty time-of-day arc that plugs into the
// #73 settings panel as a toggle (DEFAULT OFF). When OFF the permanent sunny Caribbean look
// (#61) is the default and is restored byte-for-byte. When ON, a slow charming cycle plays:
// the sun arcs across the sky and the sky / ambient / sea tint drift through
// dawn → bright noon → golden afternoon → dusk → a soft moonlit night, then loop.
//
// House standard (#53, src/ui/README.md): the tricky maths is a PURE function (dayNight)
// with NO three.js / DOM, unit-tested under node:test; a thin factory (createDayNight)
// captures the live scene references and just maps the palette onto them each frame.
//
// The sunny look is the NOON keyframe — so dayNight(NOON) returns the exact sunny constants,
// and the cycle simply passes through "today's look" at midday.

import { mixHex } from './sea-color.js';

// ---- The permanent sunny Caribbean look (#61) = the NOON keyframe -----------------------
// These mirror the constants wired in main.js (lights + scene.background/fog), ocean.js
// (the ShaderMaterial uniforms) and world.js (the sky dome). dayNight(NOON) === SUNNY.
export const SUNNY = Object.freeze({
  sun: [0.5, 0.8, 0.2],   // sun direction (normalised on output) — high overhead at noon
  sunColor: 0xfff4de,     // warm white sun (DirectionalLight)
  sunIntensity: 2.2,
  hemiSky: 0xd2effb,      // sky-blue hemisphere fill
  hemiGround: 0x3a5a4c,   // sea-green bounce
  hemiIntensity: 0.95,
  haze: 0xbfe8e6,         // bright sunny sea-haze (scene.background + fog + ocean uHaze)
  skyTop: 0x2f8fd8,       // clear sunny sky-blue up high (sky dome)
  skyBottom: 0xe6eef0,    // bright warm horizon haze (sky dome)
  seaShallow: 0x46e3d0,   // luminous Caribbean turquoise (ocean uShallow)
  seaDeep: 0x1192c6,      // rich tropical blue (ocean uDeep)
  seaPaper: 0xeae7d6,     // soft warm sun-bleach toward horizon (ocean uPaper)
});

// Normalised time-of-day of the NOON keyframe (so OFF/default === dayNight(NOON)).
export const NOON = 0.5;

// ---- Keyframes around the clock (t in [0,1), 0 = midnight) ------------------------------
// Warm and charming throughout (Monkey-Island holiday mood); the only cool beat is a soft
// moonlit night — never gloomy or murky. Each is a full palette; dayNight interpolates
// smoothly between them and loops seamlessly (the last frame wraps back to the first).
const KEYFRAMES = [
  { // 0.00 — NIGHT: soft moonlit blue (not black), a cool moon high in the NW.
    t: 0.00,
    sun: [-0.35, 0.55, 0.30], sunColor: 0xaccaff, sunIntensity: 0.55,
    hemiSky: 0x3a5688, hemiGround: 0x1d2942, hemiIntensity: 0.55,
    haze: 0x49608c, skyTop: 0x1a274d, skyBottom: 0x36436e,
    seaShallow: 0x2f7a90, seaDeep: 0x0e3d5e, seaPaper: 0x55648c,
  },
  { // 0.25 — DAWN: rosy peach, a low warm sun in the east.
    t: 0.25,
    sun: [0.88, 0.16, 0.42], sunColor: 0xffc38a, sunIntensity: 1.5,
    hemiSky: 0x9fc3e8, hemiGround: 0x6a5f4e, hemiIntensity: 0.8,
    haze: 0xf3cdb0, skyTop: 0x5a86c4, skyBottom: 0xf3c9a8,
    seaShallow: 0x57ccc9, seaDeep: 0x1a6f9e, seaPaper: 0xefd9c0,
  },
  { // 0.50 — NOON: the permanent sunny Caribbean look (SUNNY).
    t: 0.50,
    sun: SUNNY.sun, sunColor: SUNNY.sunColor, sunIntensity: SUNNY.sunIntensity,
    hemiSky: SUNNY.hemiSky, hemiGround: SUNNY.hemiGround, hemiIntensity: SUNNY.hemiIntensity,
    haze: SUNNY.haze, skyTop: SUNNY.skyTop, skyBottom: SUNNY.skyBottom,
    seaShallow: SUNNY.seaShallow, seaDeep: SUNNY.seaDeep, seaPaper: SUNNY.seaPaper,
  },
  { // 0.70 — GOLDEN afternoon: warm gold, sun lowering to the west. The screenshot beat.
    t: 0.70,
    sun: [-0.45, 0.42, 0.22], sunColor: 0xffd39a, sunIntensity: 2.0,
    hemiSky: 0xbfd9ea, hemiGround: 0x5a5238, hemiIntensity: 0.9,
    haze: 0xf2d9b6, skyTop: 0x4f93cf, skyBottom: 0xf6dcaf,
    seaShallow: 0x52d8c4, seaDeep: 0x1487bd, seaPaper: 0xefdcc0,
  },
  { // 0.83 — DUSK: dusty orange, a deep low sun near the horizon.
    t: 0.83,
    sun: [-0.9, 0.12, 0.12], sunColor: 0xff9966, sunIntensity: 1.1,
    hemiSky: 0x8a86b8, hemiGround: 0x4a3d44, hemiIntensity: 0.7,
    haze: 0xe6a886, skyTop: 0x3a4f8c, skyBottom: 0xf0a878,
    seaShallow: 0x3f9fb0, seaDeep: 0x125f86, seaPaper: 0xd9b59a,
  },
];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

function normalize3([x, y, z]) {
  const m = Math.hypot(x, y, z) || 1;
  return [x / m, y / m, z / m];
}

/**
 * PURE — the time-of-day palette at a normalised clock position.
 * @param {number} t time-of-day in [0,1); 0 = midnight, 0.5 = noon. Wraps (loops seamlessly).
 * @returns {{sun:[number,number,number], sunColor:number, sunIntensity:number,
 *   hemiSky:number, hemiGround:number, hemiIntensity:number, haze:number,
 *   skyTop:number, skyBottom:number, seaShallow:number, seaDeep:number, seaPaper:number}}
 *   colours are packed 0xRRGGBB; `sun` is a unit direction.
 */
export function dayNight(t) {
  const k = ((Number(t) || 0) % 1 + 1) % 1;            // wrap into [0,1)
  const ks = KEYFRAMES;
  let i = 0;
  while (i < ks.length - 1 && k >= ks[i + 1].t) i++;    // segment [ks[i], ks[i+1] | wrap]
  const a = ks[i];
  const b = ks[(i + 1) % ks.length];
  const t0 = a.t;
  const t1 = i + 1 < ks.length ? ks[i + 1].t : 1;       // last segment wraps to 1 (== 0/night)
  const f = t1 > t0 ? clamp01((k - t0) / (t1 - t0)) : 0;
  const s = f * f * (3 - 2 * f);                         // smoothstep for a gentle ramp

  return {
    sun: normalize3([
      lerp(a.sun[0], b.sun[0], s),
      lerp(a.sun[1], b.sun[1], s),
      lerp(a.sun[2], b.sun[2], s),
    ]),
    sunColor: mixHex(a.sunColor, b.sunColor, s),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, s),
    hemiSky: mixHex(a.hemiSky, b.hemiSky, s),
    hemiGround: mixHex(a.hemiGround, b.hemiGround, s),
    hemiIntensity: lerp(a.hemiIntensity, b.hemiIntensity, s),
    haze: mixHex(a.haze, b.haze, s),
    skyTop: mixHex(a.skyTop, b.skyTop, s),
    skyBottom: mixHex(a.skyBottom, b.skyBottom, s),
    seaShallow: mixHex(a.seaShallow, b.seaShallow, s),
    seaDeep: mixHex(a.seaDeep, b.seaDeep, s),
    seaPaper: mixHex(a.seaPaper, b.seaPaper, s),
  };
}

// ---- The factory (browser-only; mutates live scene refs, no three.js import) -----------

const DISTANCE = 600;   // how far out to place the directional "sun" along its direction

/**
 * Wire the day-night cycle to the live scene. Captures the current sunny look so OFF restores
 * it byte-for-byte; when enabled, advances a slow phase and maps dayNight() onto the refs each
 * frame. All refs are optional (headless/test-safe) and only mutated via their own methods.
 *
 * @param {object} refs
 * @param {object} refs.scene        THREE.Scene (its .background colour + .fog.color)
 * @param {object} refs.sun          THREE.DirectionalLight
 * @param {object} refs.hemi         THREE.HemisphereLight
 * @param {object} refs.ocean        createOcean() result (reads .uniforms / .fellBack)
 * @param {object} [refs.sky]        sky-dome uniforms { top, bottom } (from createWorld)
 * @param {number} [refs.period]     seconds for a full day→night→day cycle (default 150)
 * @param {function} [refs.onDusk]   called once when the cycle first dips into dusk (charm beat)
 */
export function createDayNight({ scene, sun, hemi, ocean, sky, period = 150, onDusk } = {}) {
  // Capture today's sunny defaults so flipping OFF restores them exactly.
  const defaults = {
    bg: scene?.background?.getHex?.(),
    fog: scene?.fog?.color?.getHex?.(),
    sunColor: sun?.color?.getHex?.(),
    sunIntensity: sun?.intensity,
    sunPos: sun?.position ? [sun.position.x, sun.position.y, sun.position.z] : null,
    hemiSky: hemi?.color?.getHex?.(),
    hemiGround: hemi?.groundColor?.getHex?.(),
    hemiIntensity: hemi?.intensity,
    skyTop: sky?.top?.value?.getHex?.(),
    skyBottom: sky?.bottom?.value?.getHex?.(),
    uSun: ocean?.uniforms?.uSun ? ocean.uniforms.uSun.value.clone?.() : null,
    uHaze: ocean?.uniforms?.uHaze?.value?.getHex?.(),
    uShallow: ocean?.uniforms?.uShallow?.value?.getHex?.(),
    uDeep: ocean?.uniforms?.uDeep?.value?.getHex?.(),
    uPaper: ocean?.uniforms?.uPaper?.value?.getHex?.(),
  };

  let enabled = false;
  let phase = NOON;        // start the cycle at midday so it eases away from the sunny look
  let duskFired = false;

  function applyPalette(p) {
    if (sun) {
      sun.color?.setHex?.(p.sunColor);
      sun.intensity = p.sunIntensity;
      sun.position?.set?.(p.sun[0] * DISTANCE, p.sun[1] * DISTANCE, p.sun[2] * DISTANCE);
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
      u.uSun?.value?.set?.(p.sun[0], p.sun[1], p.sun[2]);
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
      if (defaults.sunPos) sun.position?.set?.(...defaults.sunPos);
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
      if (defaults.uSun) u.uSun?.value?.copy?.(defaults.uSun);
      if (defaults.uHaze != null) u.uHaze?.value?.setHex?.(defaults.uHaze);
      if (defaults.uShallow != null) u.uShallow?.value?.setHex?.(defaults.uShallow);
      if (defaults.uDeep != null) u.uDeep?.value?.setHex?.(defaults.uDeep);
      if (defaults.uPaper != null) u.uPaper?.value?.setHex?.(defaults.uPaper);
    }
  }

  function applyPhase() { applyPalette(dayNight(phase)); }

  // Is `p` within the dusk window (after golden, before night) — for the one-time charm beat.
  function isDusk(p) { return p >= 0.78 && p < 0.92; }

  return {
    setEnabled(on) {
      enabled = !!on;
      if (enabled) applyPhase();
      else restoreDefaults();   // OFF → the sunny default, immediately and exactly
    },
    update(dt) {
      if (!enabled) return;
      phase = (phase + (dt / period)) % 1;
      applyPhase();
      if (!duskFired && isDusk(phase)) { duskFired = true; try { onDusk?.(); } catch { /* a flourish must never break the loop */ } }
    },
    // QA / introspection surface.
    get enabled() { return enabled; },
    get phase() { return phase; },
    set phase(v) { phase = ((Number(v) || 0) % 1 + 1) % 1; if (enabled) applyPhase(); },
    palette() { return dayNight(phase); },
  };
}
