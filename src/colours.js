// False Colours (#79) — flag deception as a VERB. PURE, DOM-free, three.js-free so the
// whole bluff resolves under `node --test`. The player flies a chosen set of COLOURS; the
// world reacts to the colours SHOWN, not merely to your reputation — and striking a ship
// you approached under a LIE pays a bonus to **Infamy** (the perfidy/treachery payoff, #45).
//
// Age-of-sail truth (DL#2 research): flying false flags to close on a prize was standard
// practice — the colours dropped and the true flag rose only at the last possible moment.
// Here that becomes a real choice: approach honestly under the black, or creep up under
// merchant colours and show your teeth at the last — dishonest, but it pays.
//
// All names + banter are ORIGINAL to Tidewake. Warm, swashbuckling, a wink of comedy
// (CONSTITUTION). A future slice adds an honest "Letter of Marque" / navy-colours path that
// feeds STANDING (the lawful pole) and a "seen-through" chance at very high Infamy — both
// filed as follow-ups so this slice stays the smallest always-working deception verb.

// The colours a captain can fly. A deliberately small, legible set so cycling stays simple.
//   black    — TRUE colours: the honest pirate flag. No disguise; the world reads your renown.
//   merchant — FALSE colours: a humble trader's ensign. A lie that lets you approach unsuspected.
// `flagColor` tints the player's pennant; `showSkull` hides the cheeky skull while disguised.
export const COLOURS = [
  { id: 'black',    name: 'True Colours (Black)',   short: 'Black',    icon: '🏴', deceptive: false, flagColor: 0x14110f, showSkull: true },
  { id: 'merchant', name: 'False Merchant Colours', short: 'Merchant', icon: '🏳', deceptive: true,  flagColor: 0xcdbb86, showSkull: false },
];

// A fresh voyage flies honest black — you are who you are until you choose to lie.
export const DEFAULT_COLOURS = 'black';

/** Resolve a colours id to its definition; junk / unknown → the default (honest black). */
export function colourById(id) {
  return COLOURS.find((c) => c.id === id) || COLOURS.find((c) => c.id === DEFAULT_COLOURS);
}

/** Are these colours a lie (a disguise that NPCs read as friendly)? Junk → false (honest). */
export function isDeceptive(id) {
  return !!colourById(id).deceptive;
}

/** The next colours in the cycle (wraps). Junk starts the cycle from the default. */
export function nextColours(id) {
  const i = COLOURS.findIndex((c) => c.id === id);
  const from = i === -1 ? COLOURS.findIndex((c) => c.id === DEFAULT_COLOURS) : i;
  return COLOURS[(from + 1) % COLOURS.length].id;
}

// ---- How the world reads you when you fly your TRUE colours ----------------------------
// Menace is bucketed from raw INFAMY (the pirate pole), tuned to the game's scale: a duel
// or cannon win moves infamy ~100-160, so a couple of bloody fights makes you "feared"
// (wary) and a committed pirate becomes a "terror" (hostile). Monotonic, junk-safe.
export const MENACE_TIERS = [0, 200, 1200]; // calm-nobody / feared / terror

/** Bucket infamy into a menace level 0..2 (junk / negative → 0). Non-decreasing. */
export function menaceLevel(infamy) {
  const i = Number.isFinite(infamy) && infamy > 0 ? infamy : 0;
  if (i >= MENACE_TIERS[2]) return 2;
  if (i >= MENACE_TIERS[1]) return 1;
  return 0;
}

/**
 * How a nearby NPC reacts to the colours you're SHOWING (not just your renown). The keystone
 * of the deception verb: a disguise overrides your reputation, so even a feared captain can
 * approach unsuspected under merchant colours — UNLESS the lie is `seenThrough` (#91), in which
 * case the vessel reads your true renown anyway (the disguise has been pierced on approach).
 *   'calm'    — relaxed; lets you approach (no alarm).
 *   'wary'    — nervous; keeps its distance.
 *   'hostile' — openly alarmed; flees the dread captain.
 * @param {{colours?:string, infamy?:number, seenThrough?:boolean}} args
 * @returns {'calm'|'wary'|'hostile'}
 */
export function npcDisposition({ colours = DEFAULT_COLOURS, infamy = 0, seenThrough = false } = {}) {
  // The lie works — they wave you in — but only while it holds. Once it's rumbled (#91), they
  // react to who you really are.
  if (isDeceptive(colours) && !seenThrough) return 'calm';
  const m = menaceLevel(infamy);
  if (m >= 2) return 'hostile';
  if (m >= 1) return 'wary';
  return 'calm'; // an unknown captain under honest black colours barely registers
}

/** Will a nearby NPC flee you, given the colours you show + your infamy (+ seen-through)? */
export function npcFlees(args) {
  const d = npcDisposition(args);
  return d === 'wary' || d === 'hostile';
}

// ---- Letters of Marque (#91): the LAWFUL pole, the honest mirror of the bluff -----------
// #79 made TREACHERY (false colours) feed Infamy. This is its opposing verb: hunt PIRATES
// under your TRUE colours and the ports credit you as a privateer — it feeds **Standing**
// (the governor pole, #45). Sail honestly is to sail lawfully. But honesty alone isn't
// virtue: gun down an innocent MERCHANT under true colours and that's plain piracy — no
// Standing, and a small fine besides. The lawful path has to be actually lawful.

// Vessel dispositions on the sea. A light, deterministic notion so "a lawful attack on a
// pirate" is meaningful without a whole faction system (filed as a follow-up).
//   merchant — an honest trader. Attacking one honestly is piracy (Standing fine).
//   pirate   — an outlaw/raider. Hunting one honestly is lawful privateering (Standing reward).
export const VESSEL_KINDS = ['merchant', 'pirate'];

/**
 * The kind of the NPC vessel in fleet slot `i` — DETERMINISTIC and stable across respawns,
 * so "that one's a pirate" stays true for a given slot. Roughly one vessel in three is an
 * outlaw (slots 1, 4, 7, …), guaranteeing a default fleet carries both a pirate to hunt and
 * merchants to spare. Junk index → an honest merchant.
 * @param {number} i  fleet slot index
 * @returns {'merchant'|'pirate'}
 */
export function vesselKind(i) {
  const n = Number.isInteger(i) && i >= 0 ? i : 0;
  return n % 3 === 1 ? 'pirate' : 'merchant';
}

/** Is this an outlaw/pirate vessel — fair game for a lawful privateer? Junk → false. */
export function isOutlaw(kind) {
  return kind === 'pirate';
}

export const LAWFUL_RATE = 0.6;   // Standing earned for a lawful pirate-kill, as a fraction of its base value
export const PIRACY_FINE = 0.25;  // Standing LOST for honestly gunning down an innocent merchant

/**
 * The Standing delta for a kill, by the colours flown and the target's kind. The honest mirror
 * of treacheryBonus. PURE, junk-safe, monotonic in the base value.
 *   honest (true colours) + PIRATE   → +Standing   (lawful privateering — the ports cheer)
 *   honest (true colours) + MERCHANT → −Standing   (piracy under your own flag — a fine)
 *   FALSE colours, any target        →  0          (a lie is never lawful — that's the Infamy road)
 * @param {number} baseValue   the base infamy/value the kill is worth
 * @param {string} colours     the colours flown at the moment of the attack
 * @param {string} targetKind  the struck vessel's kind ('pirate'|'merchant')
 * @returns {number} signed Standing delta (integer; can be negative)
 */
export function lawfulStanding(baseValue, colours, targetKind) {
  if (isDeceptive(colours)) return 0; // sailing under a lie forfeits any lawful claim
  const b = Number.isFinite(baseValue) && baseValue > 0 ? baseValue : 0;
  if (isOutlaw(targetKind)) return Math.round(b * LAWFUL_RATE);
  return -Math.round(b * PIRACY_FINE); // an honest strike on a non-pirate is piracy
}

// ---- "Seen-through" (#91): the bluff gets riskier the more notorious you are -------------
// A free disguise at the top of the Infamy ladder would be a free win. So at high Infamy a
// false-colours approach has a SEEDED, deterministic chance to be PIERCED — the NPC squints,
// "…I know that rigging", and reacts to your true renown anyway. The chance rises with Infamy
// from nothing (an unknown captain is never doubted) to a cap that is deliberately < 1 (the
// bluff always keeps a sporting chance, even for a legend).
export const SEEN_THROUGH_FLOOR = 1200; // below this infamy a disguise is never questioned (a free pass)
export const SEEN_THROUGH_CEIL = 3000;  // at/above this the detection chance reaches its cap
export const SEEN_THROUGH_CAP = 0.85;   // max detection chance — never a dead certainty (<1 by design)

/**
 * Probability in [0, SEEN_THROUGH_CAP] that false colours are seen through on approach, rising
 * monotonically with Infamy. Honest colours can't be "seen through" (0). PURE, junk-safe.
 * @param {number} infamy
 * @param {string} colours
 * @returns {number}
 */
export function seenThroughChance(infamy, colours) {
  if (!isDeceptive(colours)) return 0; // there's no lie to pierce
  const i = Number.isFinite(infamy) && infamy > 0 ? infamy : 0;
  if (i <= SEEN_THROUGH_FLOOR) return 0;
  const t = Math.min(1, (i - SEEN_THROUGH_FLOOR) / (SEEN_THROUGH_CEIL - SEEN_THROUGH_FLOOR));
  return SEEN_THROUGH_CAP * t;
}

/**
 * Deterministic detection roll for one approach: true if the disguise is pierced. `rng` is
 * injectable so the whole risk resolves under `node --test` (and stays reproducible in-game).
 * @param {number} infamy
 * @param {string} colours
 * @param {() => number} [rng]
 * @returns {boolean}
 */
export function isSeenThrough(infamy, colours, rng = Math.random) {
  return rng() < seenThroughChance(infamy, colours);
}

// ---- The treachery payoff (the point) -------------------------------------------------
// Strike a ship you approached under FALSE colours and you gain a PERFIDY bonus to the
// Infamy of the kill — the dishonest pirate's road pays more. Attacking under your true
// black flag is the honest way and earns no bonus.
export const TREACHERY_RATE = 0.5;     // +50% infamy for a false-colours strike
export const SURPRISE_DAMAGE = 18;     // a false-colours ambush opens with the foe this weakened

/**
 * The bonus Infamy for a treacherous (false-colours) strike. PURE, junk-safe, monotonic in
 * the base infamy. True colours → 0 (no bonus for honest work).
 * @param {number} baseInfamy  the infamy the kill would pay honestly
 * @param {string} colours     the colours flown at the moment of the attack
 * @returns {number} bonus infamy (>= 0, integer)
 */
export function treacheryBonus(baseInfamy, colours) {
  if (!isDeceptive(colours)) return 0;
  const b = Number.isFinite(baseInfamy) && baseInfamy > 0 ? baseInfamy : 0;
  return Math.round(b * TREACHERY_RATE);
}

/** The opening advantage of an ambush: the foe starts this much weakened under false colours. */
export function surpriseDamage(colours) {
  return isDeceptive(colours) ? SURPRISE_DAMAGE : 0;
}

// ---- The CREATIVE SPARK: the comedy of bluffing ---------------------------------------
// Original, warm, daft. HOIST_LINES play when you raise a set of colours; FOOLED_LINES when
// a fooled NPC waves you in under false colours; REVEAL_LINES are the foe's betrayed splutter
// as your true black flag snaps up at the last second.
export const HOIST_LINES = {
  black: [
    'Up goes the black! No more pretence — let them see exactly who comes calling.',
    'The Jolly Roger snaps to the masthead. Somewhere, a merchant fouls his ledger.',
    'True colours flying. Honest work, this — terrifying, but honest.',
  ],
  merchant: [
    'Down comes the black, up the merchant ensign — butter would not melt, Captain.',
    'False colours bent on! We are but humble traders. Hold the winking, lads.',
    'The merchant flag flutters up, all innocence. The crew practises looking harmless.',
  ],
};

// "They bought it" — fired when a disguised captain drifts within hailing range of a calm NPC.
export const FOOLED_LINES = [
  'They wave you in, friendly as you please. The fools — they bought it whole.',
  'Not a gunport open on her. She thinks you a friend. Oh, this is too easy.',
  'A cheery hail floats across the water. The crew waves back, biting their cheeks.',
];

// The foe's betrayed splutter when the black flag snaps up mid-attack (the smug reveal).
export const REVEAL_LINES = [
  'merchant colours?! You— you absolute BARNACLE, that is CHEATING—',
  'But you WAVED! Who waves and then— oh, you villain, you magnificent villain—',
  'The flag— the FLAG just changed! Treachery! TREACH— oh, bother.',
];

// LAWFUL service (#91): the grateful port nod when you hunt a pirate under honest colours.
// Warm, a wink of comedy — the comic pride of a sanctioned villain doing good for once.
export const LAWFUL_LINES = [
  'A pirate, cleared from the lanes under your own honest flag — the harbourmaster will positively weep into his ledger.',
  'Lawful work! The port council drafts a commendation; the crew, unused to praise, looks faintly suspicious of it.',
  'You ran down an outlaw fair and square. Somewhere a magistrate raises a small, approving eyebrow.',
];

// PIRACY under your own flag (#91): the wince when you gun down an innocent trader honestly.
export const PIRACY_LINES = [
  'That was no pirate — just a poor trader hauling turnips. The ports will hear of it, and they will tut.',
  'An honest merchant, sunk under honest colours. That is just piracy with extra steps, Captain.',
  'The crew exchanges glances. Even THEY thought that one a bit much.',
];

// SEEN THROUGH (#91): the NPC's squint when a notorious captain's disguise is pierced on
// approach — "…I know that rigging — that's no merchantman!" The bluff's risk made flesh.
export const SEEN_THROUGH_LINES = [
  '…hold on. I know that rigging. That is NO merchantman — pipe all hands, it is HIM!',
  'Funny sort of trader, that — too many gunports for turnips. Show us your TRUE colours, then!',
  'A merchant flag, is it? On THAT hull? My nan would not buy it, and she buys everything. Run!',
];

/** Deterministic, junk-safe line picker (rng injectable for tests). Empty pool → ''. */
export function pickLine(pool, rng = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[i];
}
