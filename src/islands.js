// Island names + flavour (#19) — the world's landmasses get characterful, in-tone names
// and a one-time comedic line that hails you the first time you sail close (#1 Sailing &
// World + #9 Humour & Writing). The CHARM lives in ISLAND_LORE; the WHEN lives in the pure
// detector below. Everything here is browser-/three-free so it unit-tests (tests/unit/
// islands.test.mjs) — main.js just wires the factory's one-time onApproach beat to the
// shared HUD toast (the same banner the harbourmaster, arrival and bump quips use).
//
// Names are assigned by island INDEX, so an island keeps its name across the session and
// across reloads (deterministic), and no two islands ever share a name. They're original,
// salty, slightly daft age-of-sail flavour — and never a real game/brand (Constitution).

// The authored archipelago. Keep them warm, salty and a touch absurd — the Caribbean as
// remembered by a tired bosun three rums in. Add an isle by adding a {name, flavour} line.
export const ISLAND_LORE = [
  { name: 'Gallows Cay', flavour: 'They hang folk here for bad puns. Sail careful — and rhyme nothing.' },
  { name: 'Rumlost Reef', flavour: 'A whole galleon of rum sank here. The fish have never been merrier.' },
  { name: 'Sotweed Hollow', flavour: 'Smells of pipe-smoke and poor decisions. Even the gulls are wheezing.' },
  { name: "Mutineer's Folly", flavour: 'A crew once voted their cook overboard. They starved — but politely.' },
  { name: "Kraken's Footstool", flavour: 'No kraken has ever been seen here. That is exactly what worries the locals.' },
  { name: 'Doubloon Dunes', flavour: 'Buried treasure everywhere, they swear. Mostly it is just very confident sand.' },
  { name: 'Scurvy Point', flavour: 'The oranges here are guarded like crown jewels — by men with terrible gums.' },
  { name: 'Petticoat Spit', flavour: 'Where hard captains come to feel pretty. Judgement is left at the tideline.' },
  { name: 'Tankard Rock', flavour: 'Drinks are cheap, the floor is closer than you think, and the tab is eternal.' },
  { name: 'Cutlass Bend', flavour: 'Every captain swears they sharpened a blade here. None can find the whetstone.' },
  { name: 'Wailing Wharf', flavour: 'The wind here sounds like your mother-in-law. Most ships simply do not stop.' },
  { name: 'Gibbet Green', flavour: 'Lush, lovely, and absolutely covered in warning signs. Picnic at your peril.' },
];

// World units BEYOND an island's shoreline radius at which the "approaching" beat fires —
// far enough that the name reads as a landfall, near enough that it's clearly THIS island.
export const APPROACH_RANGE = 220;

// Read a world position whether it's {x,z} (THREE.Vector3) or [x,y,z]/[x,z].
function readX(p) { return p.x ?? p[0] ?? 0; }
function readZ(p) { return p.z ?? (p.length > 2 ? p[2] : p[1]) ?? 0; }

// Roman numeral suffix so wrapped names (more islands than lore) stay unique & in-tone.
function roman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
  return out;
}

/**
 * Assign a stable, unique name+flavour to each island by index. Deterministic: index i
 * always yields the same name, so an island keeps its name across reloads. If there are
 * more islands than lore entries, later ones wrap with a roman-numeral suffix so names
 * never collide.
 * @param {number} count number of islands
 * @returns {{name:string, flavour:string}[]}
 */
export function assignIslandNames(count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const base = ISLAND_LORE[i % ISLAND_LORE.length];
    const wrap = Math.floor(i / ISLAND_LORE.length);
    const name = wrap === 0 ? base.name : `${base.name} ${roman(wrap + 1)}`;
    out.push({ name, flavour: base.flavour });
  }
  return out;
}

/**
 * Decide which island (if any) the ship is now "approaching" for the first time.
 * Pure: returns the INDEX of the nearest not-yet-introduced island within its approach
 * range, or -1 if none qualifies.
 * @param {{x:number,z:number}|number[]} pos ship position
 * @param {{index:number,x:number,z:number,r:number}[]} islands
 * @param {Set<number>} introduced indices already greeted this session
 */
export function detectApproach(pos, islands, introduced) {
  const px = readX(pos), pz = readZ(pos);
  let pick = -1, pickDist = Infinity;
  for (const isle of islands) {
    if (introduced.has(isle.index)) continue;
    const d = Math.hypot(px - isle.x, pz - isle.z);
    if (d <= isle.r + APPROACH_RANGE && d < pickDist) { pickDist = d; pick = isle.index; }
  }
  return pick;
}

/**
 * The island nearest a position, with its distance (handy for QA / the playtest hook).
 * @returns {{index:number,name?:string,flavour?:string,x:number,z:number,r:number,dist:number}|null}
 */
export function nearestIsland(pos, islands) {
  if (!pos || !islands || !islands.length) return null;
  const px = readX(pos), pz = readZ(pos);
  let best = null, bd = Infinity;
  for (const isle of islands) {
    const d = Math.hypot(px - isle.x, pz - isle.z);
    if (d < bd) { bd = d; best = { ...isle, dist: d }; }
  }
  return best;
}

/**
 * Build the island namer for a created world. Reads island positions/radii once and pins
 * a stable name+flavour to each. Call update(pos, onApproach) from the loop: it fires
 * onApproach(name, flavour, island) EXACTLY once per island, the first time you sail into
 * its approach range this session.
 * @param {{world:{islands:{children:Array}}}} deps
 */
export function createIslandNamer({ world } = {}) {
  const children = (world && world.islands && world.islands.children) ? world.islands.children : [];
  const names = assignIslandNames(children.length);
  const islands = children.map((isle, i) => ({
    index: i,
    x: isle.position.x,
    z: isle.position.z,
    r: (isle.userData && isle.userData.radius) || 70,
    name: names[i].name,
    flavour: names[i].flavour,
  }));
  const introduced = new Set();

  function update(pos, onApproach) {
    if (!pos) return -1;
    const idx = detectApproach(pos, islands, introduced);
    if (idx >= 0) {
      introduced.add(idx);
      const isle = islands[idx];
      if (typeof onApproach === 'function') onApproach(isle.name, isle.flavour, isle);
    }
    return idx;
  }

  return {
    // Serialisable list (also feeds the QA hook + map labels).
    get list() {
      return islands.map((i) => ({ index: i.index, name: i.name, flavour: i.flavour, x: i.x, z: i.z, r: i.r }));
    },
    get introduced() { return [...introduced]; },
    nearestIsland(pos) { return nearestIsland(pos, islands); },
    update,
    // Re-arm every greeting — a fresh voyage gets to discover the archipelago anew.
    reset() { introduced.clear(); },
  };
}
