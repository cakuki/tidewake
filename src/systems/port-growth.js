// Governor-pole symmetry — your home port VISIBLY GROWS as you invest (#174, epic #168 "The Rise",
// the RISE finale). PURE, DOM-free and three.js-free so the whole growth-tier logic unit-tests under
// `node --test`. The three.js reveal lives in src/port-growth-view.js (the deck-guns.js pattern).
//
// The pirate road got a visible power fantasy — buy a cannon (#170) SEE it on the deck, buy a bigger
// ship (#171) SEE the hull dwarf the sloop. The GOVERNOR road's spend was still just a NUMBER: you
// sank coin into your home port (home-port.js invest(): 150→350→700c) and its `harbour.level` climbed
// 1..4, but nothing in the world changed. This is the mirror: pour your takings into your home port
// and SEE it PROSPER — new warehouses rise on the shore, more boats ride at anchor, more masts crowd
// the quay — a busier, richer harbour that grows in tiers exactly as your ship grows a class at a time.
//
// CREATIVE SPARK (Game Designer): a bigger ship is the pirate's swagger on the horizon; a grown port is
// the governor's — you don't just climb a needle, you RAISE somewhere, and the coast fills in around
// your name. The visible tier is DERIVED from the already-persisted `harbour.level` (home-port.js) — no
// new economy, no new save field. Stays save v18: the growth is a lens on state you already keep.
//
// Mesh conservation (#121): each growth PIECE is a reused instanced mesh, revealed in tiers like the
// deck guns (unbought = hidden = not drawn), and the whole cluster is distance-culled wholesale when
// you're not home — so a grown port stays nearly free and the draw/tri budget is untouched.

import { localToWorld } from './props.js';

// The top growth tier mirrors home-port.js MAX_LEVEL (claim = tier 1, three investments → tier 4).
export const MAX_TIER = 4;

// Local marker-frame growth dressing for the HOME port, each piece tagged with the tier at which it
// APPEARS. The frame matches ports.js buildMarker + systems/props.js:
//   • +z points SEAWARD (open water); the island / shore is at -z.
//   • +x is to starboard of the jetty; y is height above the calmed harbour water.
// Warehouses rise on the landward beach (-z, framing the jetty foot); moored boats ride at anchor in
// the sheltered water alongside the jetty (+z, offset in x), each carrying a MAST (so higher tiers put
// "more masts at the quay"). Ordered by `appearsAt` ascending within each kind, so revealing the first
// N of a kind reveals exactly the pieces earned so far. Cumulative + monotonic — a port only ever GROWS
// as you invest; a demote (#134) drops the tier and the extra dressing recedes with it.
export const GROWTH_PIECES = [
  // Warehouses / quayside buildings on the landward shore (the port's prospering stores).
  { kind: 'building', x: -15, y: 2.0, z: -9,  appearsAt: 1 },
  { kind: 'building', x:  16, y: 2.0, z: -10, appearsAt: 2 },
  { kind: 'building', x: -24, y: 2.0, z: -15, appearsAt: 3 },
  { kind: 'building', x:  25, y: 2.0, z: -16, appearsAt: 4 },
  { kind: 'building', x:   0, y: 2.0, z: -22, appearsAt: 4 },
  // Boats moored at anchor beside the jetty — each gets a mast (below), crowding the quay as it grows.
  { kind: 'boat', x: -10, y: 0.9, z: 13, appearsAt: 1 },
  { kind: 'boat', x:  10, y: 0.9, z: 16, appearsAt: 2 },
  { kind: 'boat', x: -12, y: 0.9, z: 23, appearsAt: 3 },
  { kind: 'boat', x:  13, y: 0.9, z: 26, appearsAt: 3 },
  { kind: 'boat', x:  -9, y: 0.9, z: 31, appearsAt: 4 },
  { kind: 'boat', x:  11, y: 0.9, z: 34, appearsAt: 4 },
];

// The distinct growth-piece kinds, stable order (one InstancedMesh per kind in the view). Masts share
// the boats' placements (a mast rides each moored boat), so the mast pool tracks the boat count.
export const GROWTH_KINDS = ['building', 'boat'];

function clampTier(n) {
  const t = Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.max(0, Math.min(MAX_TIER, t));
}

/**
 * The VISIBLE growth tier for `port`, derived purely from the persisted harbour record: the home
 * port's clamped level (1..MAX_TIER), or 0 for any port that isn't the claimed home (nothing grows).
 * Fail-open: a null/junk harbour or a mismatched port → tier 0. Pure; never throws.
 * @param {{name:string, level:number}|null} harbour
 * @param {string} port
 * @returns {number} 0 (not home / unclaimed) .. MAX_TIER
 */
export function growthTier(harbour, port) {
  if (!harbour || typeof harbour !== 'object') return 0;
  if (!port || typeof port !== 'string') return 0;
  if (harbour.name !== port) return 0;
  return clampTier(harbour.level);
}

/**
 * How many pieces of each kind are REVEALED at a given tier — the cumulative count of pieces whose
 * `appearsAt` ≤ tier. Tier 0 → all zero (an unclaimed / away port shows no growth). Monotonic
 * non-decreasing in tier. Pure; never throws.
 * @param {number} tier
 * @returns {{building:number, boat:number, mast:number}} mast tracks boat (a mast per moored boat)
 */
export function revealCounts(tier) {
  const t = clampTier(tier);
  const building = GROWTH_PIECES.filter((p) => p.kind === 'building' && p.appearsAt <= t).length;
  const boat = GROWTH_PIECES.filter((p) => p.kind === 'boat' && p.appearsAt <= t).length;
  return { building, boat, mast: boat };
}

/**
 * The growth pieces of one kind, ordered by the tier they appear at (ascending) — so the view can
 * place them ONCE into an InstancedMesh in this order and reveal the first `revealCounts()` of them.
 * @param {'building'|'boat'} kind
 * @returns {Array<{kind:string,x:number,y:number,z:number,appearsAt:number}>}
 */
export function piecesOfKind(kind) {
  return GROWTH_PIECES.filter((p) => p.kind === kind).sort((a, b) => a.appearsAt - b.appearsAt);
}

/**
 * World placement of one growth piece at a given home port. `port` = { x, z, angle } (a ports.js
 * placement). Returns the world position + the piece's world Y-rotation (the jetty bearing), reusing
 * the SAME local→world transform as the CC0 dressing so growth sits in the port's own frame. Pure.
 * @param {{x:number,y:number,z:number}} piece  a GROWTH_PIECES entry
 * @param {{x:number,z:number,angle:number}} port
 * @returns {{x:number, y:number, z:number, rotY:number}}
 */
export function pieceWorldPlacement(piece, port) {
  const { x, z } = localToWorld(piece.x, piece.z, port.angle, port.x, port.z);
  return { x, y: piece.y, z, rotY: port.angle };
}

/**
 * The total number of growth pieces shown at a tier (buildings + boats) — a single legible scalar the
 * caller can use for a "how prosperous" read (e.g. a busier-quay audio swell). 0 at tier 0. Pure.
 * @param {number} tier
 * @returns {number}
 */
export function prosperity(tier) {
  const c = revealCounts(tier);
  return c.building + c.boat;
}
