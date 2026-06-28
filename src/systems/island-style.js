// Per-island STYLING (#71 islands TLC) — PURE placement/palette/silhouette SELECTION.
//
// DOM-free & three.js-free so all the "what does isle N look like" logic unit-tests under
// node:test (same pattern as systems/props.js + fauna-math.js). src/world.js consumes these to
// build varied, dressed islands; because EVERY value is derived from the island INDEX via a
// seeded RNG, an isle keeps its exact look — tones, shape, palm/rock/driftwood layout — across
// reloads. That stability is the point: the player learns the archipelago, so each isle must be
// the same place every voyage (it dovetails with the named-island lore in src/islands.js #19).
//
// CREATIVE SPARK (Graphic + Game Designer): the isles were tonally identical green-on-tan blobs.
// Give each one a face — a warmer or cooler sand, a taller or flatter hill, a different scatter
// of palms, a log of driftwood at the tide-line — so a glance at the horizon tells you WHICH
// isle that is. Warm Caribbean sand reads against the turquoise sea (#61); dressing is INSTANCED
// per type so a richer coast costs almost nothing (the perf mandate).

// mulberry32 — the tiny deterministic RNG the fleet (npc.js) and gulls (fauna.js) already use.
// Seeded per-island so a given index always replays the same little world.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The Caribbean base palette (packed 0xRRGGBB) every island jitters OFF — kept in lock-step with
// world.js so the offsets below are tonal nudges, not a fresh recolour. Warm sand against the
// luminous turquoise sea (#61 sea-color.js).
export const BASE_PALETTE = {
  sand: 0xd8bd84,
  sandDark: 0xc2a468,
  grass: 0x4f7a3a,
  grassDark: 0x3c6230,
  rock: 0x7d7669,
  trunk: 0x5a3b22,
  leaf: 0x2f6d3a,
};

// The dressing vocabulary — one InstancedMesh per type in world.js, so the whole archipelago's
// dressing is a handful of draw calls regardless of how lush it gets.
export const DRESS_TYPES = ['rock', 'palm', 'driftwood', 'tuft'];

// Round to keep deterministic floats clean (and deepEqual-stable across calls).
const q = (n) => Math.round(n * 1e6) / 1e6;

/**
 * Per-island HSL OFFSETS for each material role. Returned as {h,s,l} deltas (three-free) for
 * world.js to apply via `material.clone().offsetHSL(h,s,l)` — the same hue-jitter trick npc.js
 * uses for its fleet. One "warmth" driver per isle keeps sand + grass shifting together so the
 * isle reads coherent (a warm sandy cay, a cooler weathered rock), never a clown's palette.
 * @param {number} index
 * @returns {{sand,sandDark,grass,grassDark,rock,trunk,leaf}} each {h,s,l}
 */
export function islandPalette(index) {
  const rng = makeRng((index >>> 0) * 0x9e3779b1 + 0x51ed);
  // A shared warmth/cool lean for the isle (−1 cool … +1 warm) drives correlated hue nudges.
  const warmth = rng() * 2 - 1;
  const lush = rng() * 2 - 1;   // greener vs. drier interior
  const off = (hBase, sBase, lBase) => ({
    h: q(hBase),
    s: q(sBase + (rng() - 0.5) * 0.06),
    l: q(lBase + (rng() - 0.5) * 0.05),
  });
  return {
    // Sand warms/cools together (hue + a touch of light) — the dominant first read.
    sand: off(warmth * 0.035, 0.05 * warmth, 0.04 * warmth),
    sandDark: off(warmth * 0.03, 0.04 * warmth, 0.03 * warmth - 0.01),
    // Grass leans lush↔dry; a warm isle's grass yellows slightly (negative hue toward olive).
    grass: off(-0.02 + lush * 0.03 - warmth * 0.01, 0.06 * lush, 0.04 * lush),
    grassDark: off(-0.02 + lush * 0.025, 0.05 * lush, 0.03 * lush - 0.01),
    // Rock gets only a faint neutral light jitter so shorelines don't all match.
    rock: off(0, 0.02 * warmth, 0.05 * (rng() - 0.5)),
    trunk: off(0, 0, 0.03 * (rng() - 0.5)),
    leaf: off(lush * 0.02, 0.04 * lush, 0.03 * lush),
  };
}

/**
 * Per-island silhouette: footprint squash (sx,sz), shoreline rotation, and whether it rises to a
 * tall peaked hill or a low broad mound. Wider ranges than the old build so no two isles share a
 * profile on the horizon. Deterministic per index.
 * @param {number} index
 */
export function islandSilhouette(index) {
  const rng = makeRng((index >>> 0) * 0x85ebca6b + 0x9b17);
  // Wider squash than the original 0.8–1.3 so some isles read long-and-thin, others near-round.
  const sx = q(0.65 + rng() * 0.85);   // 0.65 … 1.5
  const sz = q(0.65 + rng() * 0.85);
  const rot = q(rng() * Math.PI);
  const tall = rng() > 0.45;
  const hillScale = q(0.5 + rng() * 0.5);  // 0.5 … 1.0 of the radius
  const peak = tall && rng() > 0.25;       // most tall isles get a peak, some stay a smooth dome
  const peakScale = q(0.26 + rng() * 0.18);
  // A gentle whole-isle lean so even the hill tilts a touch — life, not a turntable.
  const lean = q((rng() - 0.5) * 0.12);
  return { sx, sz, rot, tall, hillScale, peak, peakScale, lean };
}

/**
 * Per-island dressing layout: rocks at the shoreline, palms inland of the beach, the odd
 * driftwood log at the tide-line and a scatter of grass tufts on the interior. Local XZ around
 * the isle centre (caller adds the isle's world position); the footprint squash (sx,sz) is baked
 * in so props ride the actual, possibly-stretched, shoreline. Deterministic per index+radius.
 * @param {number} index
 * @param {number} radius island shoreline radius (world units)
 * @returns {{type,x,y,z,rotY,scale,tilt}[]}
 */
export function islandDressing(index, radius) {
  const r = radius > 0 ? radius : 70;
  const { sx, sz } = islandSilhouette(index);
  const rng = makeRng((index >>> 0) * 0xc2b2ae35 + 0x27d4);
  const out = [];

  // Shoreline rocks — clustered just off the beach ring.
  const nRocks = 3 + Math.floor(rng() * 4);   // 3 … 6
  for (let i = 0; i < nRocks; i++) {
    const a = rng() * Math.PI * 2;
    const rr = r * (0.85 + rng() * 0.35);
    out.push({
      type: 'rock',
      x: q(Math.cos(a) * rr * sx), z: q(Math.sin(a) * rr * sz),
      y: q(rng() * 2), rotY: q(rng() * Math.PI * 2),
      scale: q(0.7 + rng() * 1.6), tilt: q(rng() * 0.6),
    });
  }

  // Palms — set inland of the beach so trunks root in sand, fronds over the water's edge.
  const nPalms = 3 + Math.floor(rng() * 4);   // 3 … 6
  for (let i = 0; i < nPalms; i++) {
    const a = (i / nPalms) * Math.PI * 2 + rng() * 0.6;
    const pr = r * (0.3 + rng() * 0.28);
    out.push({
      type: 'palm',
      x: q(Math.cos(a) * pr * sx), z: q(Math.sin(a) * pr * sz),
      y: 5, rotY: q(rng() * Math.PI),
      scale: q(0.85 + rng() * 0.4), tilt: q((rng() - 0.5) * 0.5),
    });
  }

  // Driftwood — 0–2 weathered logs washed up on the tide-line (a lived-in coast).
  const nLogs = Math.floor(rng() * 3);        // 0 … 2
  for (let i = 0; i < nLogs; i++) {
    const a = rng() * Math.PI * 2;
    const rr = r * (0.92 + rng() * 0.22);
    out.push({
      type: 'driftwood',
      x: q(Math.cos(a) * rr * sx), z: q(Math.sin(a) * rr * sz),
      y: 1, rotY: q(rng() * Math.PI), scale: q(0.8 + rng() * 0.7), tilt: q((rng() - 0.5) * 0.3),
    });
  }

  // Grass tufts — a light freckling on the interior so the hill isn't a bald dome.
  const nTufts = 4 + Math.floor(rng() * 5);   // 4 … 8
  for (let i = 0; i < nTufts; i++) {
    const a = rng() * Math.PI * 2;
    const tr = r * (0.15 + rng() * 0.4);
    out.push({
      type: 'tuft',
      x: q(Math.cos(a) * tr * sx), z: q(Math.sin(a) * tr * sz),
      y: q(4 + rng() * 3), rotY: q(rng() * Math.PI * 2), scale: q(0.7 + rng() * 0.9), tilt: 0,
    });
  }

  return out;
}

/** Convenience bundle: the full deterministic look of one island. */
export function islandStyle(index, radius) {
  return {
    palette: islandPalette(index),
    silhouette: islandSilhouette(index),
    dressing: islandDressing(index, radius),
  };
}
