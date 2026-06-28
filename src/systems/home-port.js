// Your Harbour (#118, DL #4) — the GOVERNOR pole's FIRST reactive verb. PURE, DOM-free and
// three.js-free so the whole claim/grow logic unit-tests under `node --test`.
//
// The pirate pole had reactive verbs (raid / false colours / legend); the respected-governor half
// of the fantasy was still just a number on the needle. This is the cheapest way to make the
// lawful pole PLAYABLE: at sufficient Standing you CLAIM a port as your home harbour, then SPEND
// coin there to GROW it a level at a time — each investment earns Standing and warms the port's
// "your harbour" identity (a homecoming greeting that swells as the place prospers under your hand).
// It promotes the parked #104b "Your Harbour" seed (the emergent most-visited home port) into a
// deliberate, persisted CHOICE + a coin sink that pays the governor pole.
//
// CREATIVE SPARK (Game Designer): a home port is the lawful captain's answer to plunder — you don't
// take a place, you RAISE one. The first claim is a berth with your name carved in the post; by the
// top tier the whole coast lights its lamps early for your homecoming. Standing stops being abstract
// reputation and becomes somewhere that is, plainly and warmly, YOURS.
//
// The claimed harbour is a tiny, robust record carried in the existing save (fail-open, additive):
//   { name, level, invested }   — the port name, its growth tier (1..MAX_LEVEL), coin sunk to date.
// A null harbour means you've claimed nowhere yet. Deeper investment tiers / visible port-dressing
// growth are filed as follow-ups; this ships the smallest always-working verb.

// Standing needed before a port will let you put down roots — a touch over the first named rung, so
// it's a reachable EARLY governor goal, not a grind. Tuned against renown.js (~one strong sale).
export const CLAIM_STANDING = 40;
// Standing earned for the claim itself — the lanes honour a captain who commits to a home water.
export const CLAIM_REWARD = 15;
// The top growth tier this slice ships. Claim = level 1; each investment grows it one level.
export const MAX_LEVEL = 4;

// The investment ladder: coin cost to grow FROM level L to L+1, and the Standing that growth earns.
// Costs climb (a coin sink that scales with a prospering port); Standing per invest is legible on
// the needle and comparable, per action, to a strong sale / a won duel (see renown.js tuning).
const GROW = {
  1: { cost: 150, standing: 40 },
  2: { cost: 350, standing: 70 },
  3: { cost: 700, standing: 120 },
};

// Short labels for the UI — what your harbour reads as at each tier.
const LEVEL_NAMES = ['', 'Claimed berth', 'Your harbour', 'Thriving home port', 'Jewel of the lanes'];

// The homecoming greeting, warming a tier at a time — the visible/narrative "your harbour" identity.
// {port} is filled per call. Original to Tidewake.
const LEVEL_LINES = [
  '',
  '{port} is yours now, captain — a berth with your name carved in the post. The harbourmaster pockets your claim, tips his hat: “Welcome home.”',
  'Your colours fly over {port}, captain — a warehouse stocked and a warm berth kept against your return. The quay calls it your harbour now, and means it.',
  '{port} thrives under your hand, captain — new jetties, a busy market, lamps lit early for your homecoming. They speak your name like fair weather on this coast.',
  '{port} has grown into a jewel of the lanes under your governance, captain — a home port the whole Tidewake envies. You did not merely claim a harbour; you raised one.',
];

const MAX_NAME = 64;

function nonNegInt(n) {
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}
function clampLevel(n) {
  const l = Number.isFinite(n) ? Math.trunc(n) : 1;
  return Math.max(1, Math.min(MAX_LEVEL, l));
}
function nameOf(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return t ? t.slice(0, MAX_NAME) : '';
}

/**
 * A fresh, unclaimed harbour state (you've put down roots nowhere yet).
 * @returns {null}
 */
export function freshHarbour() {
  return null;
}

/**
 * Sanitise a raw harbour record read back from a save (or anywhere): a well-formed claim with a
 * real port name → a clean {name, level, invested}; anything else → null (no claim). Fail-open,
 * like the other save flourishes — never throws, never mutates the input.
 * @param {unknown} raw
 * @returns {{name:string, level:number, invested:number}|null}
 */
export function sanitizeHarbour(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = nameOf(raw.name);
  if (!name) return null;
  return { name, level: clampLevel(raw.level), invested: nonNegInt(raw.invested) };
}

/**
 * Is `port` the captain's claimed home harbour?
 * @param {{name:string}|null} harbour
 * @param {string} port
 * @returns {boolean}
 */
export function isHome(harbour, port) {
  return !!(harbour && typeof harbour === 'object' && nameOf(harbour.name) && harbour.name === port);
}

/**
 * The short tier label for a harbour level (e.g. "Your harbour"). '' for an out-of-range level.
 * @param {number} level
 * @returns {string}
 */
export function harbourLevelName(level) {
  return LEVEL_NAMES[clampLevel(level)] || '';
}

/**
 * Coin cost to grow this harbour ONE level, or null if there's no harbour / it's fully grown.
 * @param {{level:number}|null} harbour
 * @returns {number|null}
 */
export function investCost(harbour) {
  if (!harbour || typeof harbour !== 'object') return null;
  const tier = GROW[clampLevel(harbour.level)];
  return tier ? tier.cost : null;
}

/**
 * Standing earned by the NEXT investment in this harbour (0 if none / maxed).
 * @param {{level:number}|null} harbour
 * @returns {number}
 */
export function investStanding(harbour) {
  if (!harbour || typeof harbour !== 'object') return 0;
  const tier = GROW[clampLevel(harbour.level)];
  return tier ? tier.standing : 0;
}

/**
 * Can the captain CLAIM `port` as their home harbour right now? Pure check, no side effects.
 * @param {{harbour:({name:string}|null), port:string, standing:number}} o
 * @returns {{ok:boolean, reason?:string}}
 */
export function canClaim({ harbour, port, standing } = {}) {
  if (!port || typeof port !== 'string') return { ok: false, reason: 'no-port' };
  if (isHome(harbour, port)) return { ok: false, reason: 'already-home' };
  if (harbour && nameOf(harbour.name)) return { ok: false, reason: 'has-home' };
  if (!(Number.isFinite(standing) && standing >= CLAIM_STANDING)) return { ok: false, reason: 'low-standing' };
  return { ok: true };
}

/**
 * Claim `port` as the captain's home harbour. On success returns the NEW harbour record (level 1)
 * and the Standing the claim earns; the caller applies the Standing + persists. Pure.
 * @param {{harbour:({name:string}|null), port:string, standing:number}} o
 * @returns {{ok:boolean, reason?:string, harbour?:object, standingGain?:number}}
 */
export function claim({ harbour, port, standing } = {}) {
  const gate = canClaim({ harbour, port, standing });
  if (!gate.ok) return gate;
  return { ok: true, harbour: { name: port, level: 1, invested: 0 }, standingGain: CLAIM_REWARD };
}

/**
 * Can the captain INVEST in their home harbour at `port` right now (enough coin, not maxed)? Pure.
 * @param {{harbour:({name:string,level:number}|null), port:string, coins:number}} o
 * @returns {{ok:boolean, reason?:string, cost?:number}}
 */
export function canInvest({ harbour, port, coins } = {}) {
  if (!isHome(harbour, port)) return { ok: false, reason: 'not-home' };
  const cost = investCost(harbour);
  if (cost === null) return { ok: false, reason: 'maxed' };
  if (!(Number.isFinite(coins) && coins >= cost)) return { ok: false, reason: 'no-coins', cost };
  return { ok: true, cost };
}

/**
 * Invest in the home harbour at `port`: grow it one level. On success returns the NEW harbour, the
 * coin spent, the Standing earned, and the new level; the caller deducts coin, applies Standing, and
 * persists. Pure — never mutates the input harbour.
 * @param {{harbour:({name:string,level:number,invested:number}|null), port:string, coins:number}} o
 * @returns {{ok:boolean, reason?:string, harbour?:object, spent?:number, standingGain?:number, level?:number}}
 */
export function invest({ harbour, port, coins } = {}) {
  const gate = canInvest({ harbour, port, coins });
  if (!gate.ok) return gate;
  const level = clampLevel(harbour.level);
  const tier = GROW[level];
  const next = { name: harbour.name, level: level + 1, invested: nonNegInt(harbour.invested) + tier.cost };
  return { ok: true, harbour: next, spent: tier.cost, standingGain: tier.standing, level: next.level };
}

/**
 * The homecoming greeting for the captain's home harbour at `port` — warming a tier at a time — or
 * null if `port` isn't their claimed harbour. Pure; never throws.
 * @param {{name:string, level:number}|null} harbour
 * @param {string} [port]
 * @returns {string|null}
 */
export function harbourGreeting(harbour, port) {
  if (!isHome(harbour, port)) return null;
  const line = LEVEL_LINES[clampLevel(harbour.level)] || '';
  return line ? line.replace(/\{port\}/g, port) : null;
}

// ---- Governorship endgame (#119, DL #4) — the lawful arc's NAMED capstone ---------------------
// The pirate pole's summit crowns a legend (#46): cross the top of Infamy and you are THE Terror of
// the Tidewake. The governor pole's PERSONAL capstone is the mirror, tied to the very port you
// RAISED — grow your home harbour to its top tier AND climb Standing high enough, and the isle
// proclaims you its GOVERNOR: a persisted title "Governor of [your home port]", crowned ONCE with
// the same fanfare + persistence as the legend-crown (banner + Ballad verse + saved + acknowledged
// on landfall). It lands EARLIER than the Tidewake-wide "Governor of the Tidewake" legend (renown
// 2400) — you govern the isle you raised before the whole sea proclaims you — so the lawful climb
// gains a nearer, NAMED destination and a felt distance to it (DL #4).

// Standing for your home isle to proclaim you its governor. Growing the home port to its top tier
// already banks ~245 Standing of investment (the 40 claim gate + 15 claim + 40/70/120 grows); this
// gate sits a little above that, so a focused governor tips over with a sale or two more —
// reachable, not a grind (mirrors how #46's LEGEND_AT rewards a dedicated climb), and well below
// the 2400-renown legend summit so the named home crown comes first.
export const GOVERNOR_STANDING = 400;

/**
 * Has the captain earned the governorship of their home isle RIGHT NOW? Earned when the home harbour
 * is grown to its top tier (MAX_LEVEL) AND Standing has reached GOVERNOR_STANDING. Point-in-time +
 * junk-safe; the caller ORs it into a persistent flag (crowned once, like a legend). Pure; never
 * throws; never mutates its input.
 * @param {{harbour:({name:string,level:number}|null), standing:number}} o
 * @returns {boolean}
 */
export function earnedGovernorship({ harbour, standing } = {}) {
  const h = sanitizeHarbour(harbour);
  if (!h || h.level < MAX_LEVEL) return false;
  return Number.isFinite(standing) && standing >= GOVERNOR_STANDING;
}

/**
 * The captain's governor title for their home isle ("Governor of [port]"), or null with no claim.
 * @param {{name:string}|null} harbour
 * @returns {string|null}
 */
export function governorTitle(harbour) {
  const h = sanitizeHarbour(harbour);
  return h ? `Governor of ${h.name}` : null;
}

/**
 * The celebration beat for the home-isle governorship — the NAMED mirror of renown.js's legendBeat
 * (#46), read by the HUD crown overlay/badge and the Ballad. Null with no claimed harbour. Original
 * to Tidewake: warm grandeur with a wink of comedy (Constitution).
 * @param {{name:string,level:number}|null} harbour
 * @returns {{title:string, icon:string, kicker:string, proclaim:string, flourish:string}|null}
 */
export function governorshipBeat(harbour) {
  const h = sanitizeHarbour(harbour);
  if (!h) return null;
  return {
    title: `Governor of ${h.name}`,
    icon: '⚖',
    kicker: 'A GOVERNOR IS NAMED',
    proclaim: `${h.name}, the jewel you raised from a bare berth, proclaims you its own — and runs your colours up the council mast.`,
    flourish: 'A street now bears your name. So, against all advice, does a remarkably good pie.',
  };
}
