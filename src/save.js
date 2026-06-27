// Save/load voyage persistence — pure, DOM-free, three.js-free serialize/validate
// helpers so the whole save schema can be unit-tested under `node --test`. The
// renderer (main.js) owns the actual localStorage I/O (guarded in try/catch) and
// just leans on these functions for the shape, versioning, and sanity-checks.
//
// Contract: a "save" is a tiny JSON object { v, heading, speed, throttle, pos }
// where pos is a [x, y, z] array. Anything that doesn't match — wrong version,
// missing/partial fields, non-finite numbers, absurd positions — deserialises to
// `null` so the caller can simply start a fresh voyage. Never throws.

export const SAVE_KEY = 'tidewake.save.v1';
export const SAVE_VERSION = 1;

// Defensive world bound: positions beyond this are treated as corrupt rather than
// teleporting the player into the void. The sea is large but not unbounded.
const MAX_COORD = 1e7;

function isFiniteNumber(n) {
  return typeof n === 'number' && Number.isFinite(n);
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Serialise a live ship state into a versioned JSON string ready for storage.
 * Accepts `pos` as either a [x,y,z] array or a THREE.Vector3-like object exposing
 * `toArray()` — so callers can pass `state.pos` straight through.
 * @param {{heading:number, speed:number, throttle:number, pos:number[]|{toArray:()=>number[]}}} state
 * @returns {string} JSON string
 */
export function serialize(state) {
  const pos = Array.isArray(state.pos)
    ? state.pos
    : (state.pos && typeof state.pos.toArray === 'function' ? state.pos.toArray() : [0, 0, 0]);
  return JSON.stringify({
    v: SAVE_VERSION,
    heading: state.heading,
    speed: state.speed,
    throttle: state.throttle,
    pos: [pos[0], pos[1], pos[2]],
  });
}

/**
 * Parse + validate a stored save string. Returns a clean, sanitised state object
 * `{ heading, speed, throttle, pos:[x,y,z] }` on success, or `null` for anything
 * missing, corrupt, or from an incompatible version. Never throws.
 * @param {unknown} raw  the string read back from storage (or null/undefined)
 * @returns {{heading:number, speed:number, throttle:number, pos:number[]} | null}
 */
export function deserialize(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  // version gate — future fields bump SAVE_VERSION, old saves fall back to fresh
  if (obj.v !== SAVE_VERSION) return null;

  const { heading, speed, throttle, pos } = obj;
  if (!isFiniteNumber(heading) || !isFiniteNumber(speed) || !isFiniteNumber(throttle)) return null;

  if (!Array.isArray(pos) || pos.length !== 3) return null;
  for (const c of pos) {
    if (!isFiniteNumber(c) || Math.abs(c) > MAX_COORD) return null;
  }

  return {
    heading,
    speed: Math.max(0, speed),
    throttle: clamp(throttle, 0, 1),
    pos: [pos[0], pos[1], pos[2]],
  };
}
