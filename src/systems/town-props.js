// Loose town / harbour props (#101, props phase 3) — glowing LANTERNS + market STALLS that make a
// port feel LIVED-IN rather than a bare marker. PURE, DOM-free and three.js-free placement + cull
// math (node-testable), the same idiom as systems/props.js (dock cargo: barrels/crates/palms) and
// systems/port-growth.js (the growing quay): one InstancedMesh per KIND per port, distance-culled
// wholesale so the open sea costs nothing. src/town-props-view.js consumes these to instance cheap
// procedural meshes at every port.
//
// CREATIVE SPARK (Game + Graphic Designer): you make landfall and the quay has lanterns glowing
// down the jetty and a little market of stalls at its foot — the port reads as a PLACE people live,
// not an empty stage. DETERMINISTIC PER-TOWN: a port's arrangement is seeded off its NAME — the very
// same FNV identity #129 gives it its music — so each harbour lays its lanterns + stalls out a little
// differently, and the SAME port looks the same every voyage. A town that sounds like itself (#69/
// #129) now also LOOKS like itself.
//
// Purely visual dressing — no mechanics, no save change (stays v18). The placement is provable
// headless (tests/unit/town-props.test.mjs); the view just instances the numbers.

import { localToWorld, clusterVisible, PROP_CULL_RADIUS } from './props.js';

// The loose-prop kinds this pass adds, in a stable order (one InstancedMesh per kind per port).
export const TOWN_PROP_KINDS = ['lantern', 'stall'];

// Share the dock-dressing cull radius so the loose props appear/vanish in lock-step with the barrels
// & crates already at the port — one coherent "town view" that costs nothing at open sea.
export const TOWN_PROP_CULL_RADIUS = PROP_CULL_RADIUS;
export { clusterVisible };

// Per-town count ranges — a small deterministic spread so no two harbours are laid out alike, but
// every port earns at least a couple of each (never a bare quay).
export const LANTERN_MIN = 3, LANTERN_MAX = 6;
export const STALL_MIN = 2, STALL_MAX = 4;

// Deck-top height (units) a lantern post stands on — matches the jetty deck top in systems/props.js
// (deck box y=2.4, half-height 0.7 → top ~3.1). The shore/plaza the stalls sit on matches the palm
// root height (y=2.0) so a stall stands on the same beach the palms are rooted in.
const DECK_TOP_Y = 3.1;
const SHORE_Y = 2.0;

// FNV-1a 32-bit hash — a stable, well-spread seed from a port name (same idiom as town-theme.js, so a
// town's LOOK is keyed to the same identity as its SOUND). Junk/empty coerces to a string, never throws.
function hashName(name) {
  const s = typeof name === 'string' ? name : String(name ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// mulberry32 — a tiny deterministic PRNG (same family as fauna.js/curios.js), so a given seed always
// replays the same [0,1) sequence and a town's layout is byte-identical every voyage.
function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function countInRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// Lanterns march down BOTH quay edges (x = ±~3.3, clear of the centre-line cargo at |x|≲2.6),
// striding seaward along the jetty planks (z grows toward open water). Local marker frame matches
// systems/props.js: +z seaward, -z landward, +x starboard; y is height above the calmed water.
// Deterministic off the port name — count, stride jitter and each lantern's own spin.
export function localLanterns(name) {
  const rng = makeRng(hashName(name) ^ 0x1a17e5);
  const n = countInRange(rng, LANTERN_MIN, LANTERN_MAX);
  const out = [];
  for (let i = 0; i < n; i++) {
    const side = i % 2 === 0 ? -1 : 1;                 // alternate the quay edges
    const z = 7 + i * 4.4 + (rng() - 0.5) * 1.2;       // striding seaward, small jitter
    const x = side * (3.3 + (rng() - 0.5) * 0.3);      // hug the deck edge
    const rot = rng() * Math.PI * 2;
    out.push({ x, y: DECK_TOP_Y, z, rot });
  }
  return out;
}

// Market stalls cluster on the landward PLAZA at the foot of the jetty (z near 0, on the beach the
// palms root in), spread across the shore in x but clear of the framing palms (|x| ≈ 11) and the
// warehouses (#174, |x| ≳ 15). Deterministic off the port name.
export function localStalls(name) {
  const rng = makeRng(hashName(name) ^ 0x57a11c);
  const n = countInRange(rng, STALL_MIN, STALL_MAX);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = (rng() - 0.5) * 14;                      // -7..7 across the shore plaza
    const z = -1 + rng() * 5;                          // -1..4 at the jetty foot
    const rot = rng() * Math.PI * 2;
    out.push({ x, y: SHORE_Y, z, rot });
  }
  return out;
}

// The full LOCAL-frame layout for a port name → { lantern:[...], stall:[...] }. Deterministic:
// identical for the same name, spread across names. This is the seedable unit the view reads.
export function townPropLayout(name) {
  return { lantern: localLanterns(name), stall: localStalls(name) };
}

// World placement of one local entry at a given port. `port` = { x, z, angle } (a ports.js placement);
// reuses the SAME local→world transform as the dock dressing + growth so the loose props sit in the
// port's own frame (jetty bearing), and folds the entry's own spin into the bearing.
export function propWorldPlacement(entry, port) {
  const { x, z } = localToWorld(entry.x, entry.z, port.angle, port.x, port.z);
  return { x, y: entry.y, z, rotY: port.angle + entry.rot };
}

// All world placements of one KIND for a port (so each kind becomes one InstancedMesh per port).
export function placementsForKind(port, kind) {
  const layout = townPropLayout(port && port.name);
  const list = layout[kind] || [];
  return list.map((e) => propWorldPlacement(e, port));
}

// The full world placements for a port → { lantern:[...], stall:[...] }.
export function townPropPlacements(port) {
  const out = {};
  for (const kind of TOWN_PROP_KINDS) out[kind] = placementsForKind(port, kind);
  return out;
}
