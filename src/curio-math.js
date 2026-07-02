// Ocean sail-over curios (#70, slice 1) — PURE curio logic. No three.js, no DOM, no game
// state: plain numbers/strings in, numbers/strings out, so the spawn schedule, the sail-over
// trigger, the distance cull and the witty-line anti-repeat picker are all node-testable in
// isolation (same pure-split idiom as fauna-math.js / npc-ai.js / physics.js). The three.js
// factory lives in curios.js and consumes these.
//
// THE BEAT (Game Designer + Sound Engineer): the empty sea now rewards attention. Every so
// often a small curio drifts into view ahead of the bow — a corked BOTTLE bobbing in the
// swell, or a sea TURTLE breaking the surface — and as you sail over it a soft cue plays and a
// wry line raises a smile. Pure delight, no mechanics: a "every session makes a story" drip
// that keeps the world alive between the fights. Deterministic + distance-culled + a single
// reused mesh per type (≤1 extra draw), matching the #110 dolphin idiom.

export const CURIO_SPAWN_MIN = 10;      // seconds: shortest gap between curios
export const CURIO_SPAWN_MAX = 28;      // longest gap — irregular (Poisson-ish), never metronomic
export const CURIO_AHEAD = 62;          // metres ahead of the bow a curio drifts into view
export const CURIO_BEAM = 20;           // metres off a random beam (so you sail PAST, not always dead-through)
export const SAILOVER_RADIUS = 26;      // within this of the ship → you've sailed over it (fire once)
export const CURIO_CULL_RADIUS = 900;   // beyond this from the camera focus → hide the mesh (0 draws) [matches fauna]
export const CURIO_DESPAWN_RADIUS = 1200; // once the ship is this far past it, retire the curio (> cull, so a real culled window exists)
export const MIN_SAIL_SPEED = 1.5;      // only drift in while genuinely under way (matches the fauna pod)
export const CURIO_BOB_RATE = 1.25;     // how fast a curio bobs on the swell
export const CURIO_SPIN_RATE = 0.35;    // slow idle rotation (radians/sec) — a touch of life

// The curio kinds. Slice 1 shipped the two highest-charm cheap picks (bottle, turtle). Post-RISE
// polish adds a third under the #70 standing 1–2-per-loop drip: a drifting SPAR — the wreckage of
// the fights you've been winning, the sea now carrying the debris of your growing legend. More
// (message-in-a-bottle variants, breaching rays, gulls on flotsam…) stay deferred follow-ups.
export const CURIO_TYPES = ['bottle', 'turtle', 'spar'];

// Per-type surface behaviour: a bottle rides low and bobs a little; a turtle's shell sits a touch
// PROUD of the waterline and rises/settles as it breathes; a waterlogged SPAR sits nearly awash and
// rolls heavily on the swell. Pure data the factory reads.
export const CURIO_SURFACE = {
  bottle: { lift: 0.15, bob: 0.35 },
  turtle: { lift: 0.55, bob: 0.30 },
  spar: { lift: 0.10, bob: 0.42 },
};

// The witty-line pools, by kind. Original, on-brand 🪶 humour + 🌊 atmosphere — never a named
// franchise. The anti-repeat picker (pickLine) draws from these so you never see the same line
// twice in a row. Kept as pure data (like the rumours.js pools) so a unit test can assert every
// pool is a healthy, deduplicated set of strings.
export const CURIO_LINES = {
  bottle: [
    "A corked bottle bobs past — the note inside just reads 'send rum'.",
    'Message in a bottle: a treasure map, smudged beyond all use. Typical.',
    "A bottle winks in the swell — someone's last will, or their grocery list.",
    'Flotsam drifts by — a bottle, half a chair, and the ghost of a bad decision.',
    'A bottle knocks the hull. The sea returning your empties. How thoughtful.',
    "Faded ink in green glass: 'If found, I owe you nothing.' Fair enough.",
    'A bottle rolls past bearing a love letter. Salt ate the name. Probably for the best.',
    "Green glass glints — a bottle, and inside, one dry sock. The ocean's a jester.",
    'A bottle drifts by, cork long gone, full only of seawater and regret.',
    "An SOS in a bottle, dated forty years back. Hope it worked out for them.",
    "A bottle taps the bow like it wants aboard. Sorry, mate — we're full of trouble already.",
  ],
  turtle: [
    'A sea turtle surfaces, regards you with ancient boredom, and sinks again.',
    "A turtle breaches alongside — older than your grandfather's grandfather, less impressed.",
    'A great turtle glides past, in no hurry, bound nowhere important. Envy stirs.',
    'A turtle lifts its head, blinks once at your colours, and rates them poorly.',
    'A barnacled turtle paddles by, wearing the sea like a battered old coat.',
    'A turtle surfaces to breathe, reads your course, and wisely swims the other way.',
    "A turtle suns its shell as it drifts — the Caribbean's slowest, smuggest sailor.",
    'A green turtle rises, chews a jelly, and judges your seamanship in silence.',
    'A turtle bobs up beside the hull, unbothered by pirates, weather, or time itself.',
    'An old turtle surfaces trailing weed like a beard. Nods. Dives. A whole life, that.',
  ],
  // SPAR — post-RISE flavour: the sea now carries the wreckage of the fights you've been winning.
  // Wry, a touch dark, the world quietly acknowledging a rising legend. Never a named franchise.
  spar: [
    "A shattered spar drifts by — someone's mast, someone's very bad morning.",
    'Wreckage rolls past: a broken beam trailing rope, a loose thread of some old fight.',
    'A splintered spar knocks the hull — the sea handing back what it took from a rival.',
    "Driftwood in the swell: a ship's rib, picked clean. The Caribbean keeps no graves.",
    'A spar wallows past, barnacled and beaten — someone sailed her proud, once.',
    "Broken timber drifts by. Yours? No. But the sea's collecting, and it knows your name now.",
    "A tangled spar floats past, its colours long rotted off. Nobody's flag any more.",
    'A charred beam bobs by — a fire, a fight, a story that ended before yours got good.',
    'Flotsam of a bigger ship than yours drifts past. Was. Was bigger.',
    "A cracked mast rolls in the swell, its gulls long flown. The wake of somebody else's ambition.",
    "A waterlogged spar thumps the bow — the ocean's way of noting it has seen worse than you.",
  ],
};

function clampUnit(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

/**
 * Seconds until the next curio drifts in. Maps a 0..1 random into [min,max] so appearances
 * land irregularly and never feel metronomic (same idiom as fauna-math nextPodDelay). Pure.
 *   nextCurioDelay(rand, min?, max?) -> number
 */
export function nextCurioDelay(rand, min = CURIO_SPAWN_MIN, max = CURIO_SPAWN_MAX) {
  return min + clampUnit(rand) * (max - min);
}

/**
 * Pick which curio kind drifts in from a 0..1 random. Deterministic: the same random always
 * yields the same kind. Pure.
 *   pickCurioType(rand, types?) -> string
 */
export function pickCurioType(rand, types = CURIO_TYPES) {
  if (!types.length) return null;
  let i = Math.floor(clampUnit(rand) * types.length);
  if (i >= types.length) i = types.length - 1;
  return types[i];
}

/**
 * Where a new curio surfaces: CURIO_AHEAD ahead of the bow and CURIO_BEAM off to one `side`
 * (+1 starboard / -1 port), at sea level `seaY`. Mirrors the fauna podSpawnOrigin so the curio
 * appears ahead in your path, not on top of you. Pure.
 *   curioSpawnOrigin(ship, heading, side, seaY?) -> { x, y, z }
 */
export function curioSpawnOrigin(ship, heading, side, seaY = 0) {
  const sinH = Math.sin(heading), cosH = Math.cos(heading);
  const s = side < 0 ? -1 : 1;
  return {
    x: ship.x + sinH * CURIO_AHEAD + cosH * CURIO_BEAM * s,
    z: ship.z + cosH * CURIO_AHEAD - sinH * CURIO_BEAM * s,
    y: seaY,
  };
}

/**
 * Have we sailed over/past a curio? A once-on-entry distance check vs the ship (no raycasting;
 * mirrors the ports.js docking test). Pure.
 *   sailedOver(curioPos, shipPos, radius?) -> boolean
 */
export function sailedOver(curioPos, shipPos, radius = SAILOVER_RADIUS) {
  const dx = curioPos.x - shipPos.x, dz = curioPos.z - shipPos.z;
  return dx * dx + dz * dz <= radius * radius;
}

/**
 * Distance-cull: should the curio mesh be hidden (0 draws) because it's off-stage — farther than
 * `radius` from the camera `focus`? Same predicate shape as fauna-math shouldCull. Pure.
 *   shouldCull(pos, focus, radius?) -> boolean
 */
export function shouldCull(pos, focus, radius = CURIO_CULL_RADIUS) {
  const dx = pos.x - focus.x, dz = pos.z - focus.z;
  return dx * dx + dz * dz > radius * radius;
}

/**
 * Has the ship sailed well past the curio, so we can retire it and schedule the next? True beyond
 * CURIO_DESPAWN_RADIUS (deliberately larger than the cull radius, so a curio can be culled-but-
 * still-live before it's finally retired). Pure.
 *   curioDespawned(curioPos, shipPos, radius?) -> boolean
 */
export function curioDespawned(curioPos, shipPos, radius = CURIO_DESPAWN_RADIUS) {
  const dx = curioPos.x - shipPos.x, dz = curioPos.z - shipPos.z;
  return dx * dx + dz * dz > radius * radius;
}

/**
 * A curio's gentle vertical bob on the swell at time `t`, in [-amp, +amp]. The factory adds this
 * to the curio's per-type surface lift so it rides the water with a touch of life. Pure.
 *   curioBob(t, phase, amp?) -> number
 */
export function curioBob(t, phase, amp = 0.35) {
  return Math.sin(t * CURIO_BOB_RATE + phase) * amp;
}

/**
 * Anti-repeat line picker — THE charm guarantee for #70: draw an index into a pool of
 * `poolLength` lines from a 0..1 random such that it is NEVER the `lastIndex` just shown (so you
 * never read the same witty line twice in a row), while every other line stays reachable. Works by
 * sampling uniformly across the (poolLength-1) NON-last slots and skipping over the last one. Pure.
 *   pickLine(poolLength, lastIndex, rand) -> number  (-1 for an empty pool; 0 for a single line)
 */
export function pickLine(poolLength, lastIndex, rand) {
  const n = Math.max(0, Math.trunc(poolLength));
  if (n <= 0) return -1;
  if (n === 1) return 0;
  const r = clampUnit(rand);
  let idx = Math.floor((r < 1 ? r : 1 - 1e-9) * (n - 1)); // 0 .. n-2 (a NON-last slot)
  if (idx > n - 2) idx = n - 2;
  // Fold the (n-1) non-last slots back over the full pool by skipping the last-shown index.
  if (lastIndex >= 0 && lastIndex < n && idx >= lastIndex) idx += 1;
  return idx;
}
