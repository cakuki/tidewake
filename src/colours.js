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
 * approach unsuspected under merchant colours.
 *   'calm'    — relaxed; lets you approach (no alarm).
 *   'wary'    — nervous; keeps its distance.
 *   'hostile' — openly alarmed; flees the dread captain.
 * @param {{colours?:string, infamy?:number}} args
 * @returns {'calm'|'wary'|'hostile'}
 */
export function npcDisposition({ colours = DEFAULT_COLOURS, infamy = 0 } = {}) {
  if (isDeceptive(colours)) return 'calm'; // the lie works — they wave you in
  const m = menaceLevel(infamy);
  if (m >= 2) return 'hostile';
  if (m >= 1) return 'wary';
  return 'calm'; // an unknown captain under honest black colours barely registers
}

/** Will a nearby NPC flee you, given the colours you show + your infamy? */
export function npcFlees(args) {
  const d = npcDisposition(args);
  return d === 'wary' || d === 'hostile';
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

/** Deterministic, junk-safe line picker (rng injectable for tests). Empty pool → ''. */
export function pickLine(pool, rng = Math.random) {
  if (!Array.isArray(pool) || pool.length === 0) return '';
  const i = Math.min(pool.length - 1, Math.max(0, Math.floor(rng() * pool.length)));
  return pool[i];
}
