// Your Harbour, threatened (#134, DL #5) — the home port acquires a STAKE. PURE, DOM-free and
// three.js-free so the whole trigger/threat/resolution logic unit-tests under `node --test`.
//
// Both reputation poles now have symmetric verbs (plunder/Infamy ↔ claim&grow a home port/Standing),
// but you could drift BOTH needles freely with no downside — parallel tracks, not a tension. This
// prices committing to a pole while you hold a home port: lean hard pirate and your notoriety draws
// a NAVY BLOCKADE to your own home water; lean hard governor and the prosperous, lawful harbour you
// raised invites a PIRATE RAID. The monument you built now has a downside you must defend.
//
// CREATIVE SPARK (Game Designer): the home port stops being a trophy on a shelf and becomes a thing
// with a door you have to bar. Come home flying a feared flag and you find the King's ships massing
// off your own quay; come home a beloved governor and freebooters are circling the wealth you made.
// Either way the coast you raised is asking the captain a plain question: pay them off, or stand and
// roll the dice — a bloodless choice/dice beat now, the ready-made reason to FIGHT once battle lands.
//
// ASSET-LIGHT + pre-battle by design: the threat is a tiny persisted record, surfaced as a warning
// (the #105 digest + a banner) and resolved by a lightweight NON-BATTLE beat — pay tribute (certain,
// costs coin) or stand firm (a seeded dice roll: repel it for Standing + glory, or it sacks your
// harbour a level). The actual defensive engagement sequences AROUND battle #100 (owner-held); this
// ships the stakes-in/consequence-out frame without implying any #100 design.
//
// PURE on purpose — no THREE, no DOM, no AudioContext, no game state, no wall-clock. main.js owns the
// wiring (assess on landfall at home; the town panel routes the two resolution taps; the digest reads
// the warning); the dice ROLL is supplied by the caller's seeded RNG so the outcome stays deterministic
// + reproducible + QA-forceable, exactly like the #79 false-colours detection and #125 encounter cadence.

import { needleTarget, needleTier, needlePole } from './reputation-needle.js';
import { demoteHarbour } from './home-port.js';

// The needle commitment tier at/above which a claimed home port draws a threat. Tier 1 ("a name is
// forming", magnitude past TIER_STIR) is the trigger: you have to COMMIT to a pole — a balanced
// captain straddling the centre is safe. So the threat prices leaning hard while holding a home, in
// EITHER direction, which is exactly the pole-tension the parallel tracks were missing.
export const THREAT_TIER = 1;

// Tribute coin demanded, per harbour growth level — a bigger, richer port is a fatter prize, so the
// demand scales with what you've built (tuned against home-port.js invest costs 150/350/700, so even
// a top-tier tribute is payable from a working purse, not a wall). Game Designer's first-class output.
export const DEMAND_PER_LEVEL = 90;
// A tier-2 threat ("the pole owns you") means harder for them — the demand climbs accordingly.
export const TIER_SURCHARGE = 0.6;

// Standing firm is a DICE beat. The odds you repel them climb with how grown (and thus defensible)
// your home port is — a claimed berth is a coin-flip, a jewel of the lanes holds most days. So the
// investment that draws the threat also helps you weather it: the stake and the shield are the same.
export const STAND_FIRM_BASE_ODDS = 0.4;
export const STAND_FIRM_ODDS_PER_LEVEL = 0.1;
export const STAND_FIRM_MAX_ODDS = 0.9;

// Repel a threat by standing firm → a Standing reward (you defended your home water — the lanes
// honour it), comparable to a strong harbour investment. Lose, and it sacks your harbour a level
// AND costs Standing (a home overrun is a public humbling). Tuned so the gamble has real teeth.
export const REPEL_STANDING = 60;
export const FALL_STANDING = 40;

const KIND_BY_POLE = { pirate: 'blockade', governor: 'raid' };
const VALID_KINDS = new Set(['blockade', 'raid']);

const MAX_NAME = 64;

function nonNegInt(n) {
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}
function levelOf(harbour) {
  const l = harbour && Number.isFinite(harbour.level) ? Math.trunc(harbour.level) : 1;
  return Math.max(1, l);
}
function nameOf(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return t ? t.slice(0, MAX_NAME) : '';
}
function tierOf(n) {
  return n >= 2 ? 2 : 1;
}

/**
 * The tribute coin a threat of `tier` demands against a home port at growth `level`. PURE; junk → a
 * sane floor (a level-1, tier-1 demand). Scales with the port you built; a tier-2 threat surcharges.
 * @param {number} level harbour growth level (1..)
 * @param {number} tier  threat commitment tier (1 or 2)
 * @returns {number} coin demanded
 */
export function threatDemand(level, tier) {
  const l = Math.max(1, Number.isFinite(level) ? Math.trunc(level) : 1);
  const base = DEMAND_PER_LEVEL * l;
  return Math.round(base * (tierOf(tier) === 2 ? 1 + TIER_SURCHARGE : 1));
}

/**
 * Sanitise a raw threat record read back from a save (or anywhere): a well-formed threat → a clean
 * {kind, pole, port, tier, demand}; anything else → null (no threat). Fail-open like the other save
 * flourishes — never throws, never mutates the input.
 * @param {unknown} raw
 * @returns {{kind:string, pole:string, port:string, tier:number, demand:number}|null}
 */
export function sanitizeThreat(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (!VALID_KINDS.has(raw.kind)) return null;
  const port = nameOf(raw.port);
  if (!port) return null;
  const pole = raw.kind === 'blockade' ? 'pirate' : 'governor';
  const tier = tierOf(raw.tier);
  const demand = nonNegInt(raw.demand);
  return { kind: raw.kind, pole, port, tier, demand };
}

/** Is `threat` a live, well-formed threat? */
export function isActiveThreat(threat) {
  return !!sanitizeThreat(threat);
}

/**
 * Does the captain's home port draw a threat RIGHT NOW? Point-in-time + junk-safe: needs a claimed
 * harbour AND a needle committed to a pole (tier ≥ THREAT_TIER). Pirate lean → a navy blockade;
 * governor lean → a pirate raid. Returns a fresh threat record, or null when there's no claim or the
 * captain is too balanced to have drawn anyone's eye. PURE; never throws; never mutates its input.
 * @param {{harbour:({name:string,level:number}|null), infamy:number, standing:number}} o
 * @returns {{kind:string, pole:string, port:string, tier:number, demand:number}|null}
 */
export function assessThreat({ harbour, infamy, standing } = {}) {
  if (!harbour || typeof harbour !== 'object') return null;
  const port = nameOf(harbour.name);
  if (!port) return null;
  const pos = needleTarget(infamy, standing);
  const tier = needleTier(pos);
  if (tier < THREAT_TIER) return null;
  const pole = needlePole(pos);
  const kind = KIND_BY_POLE[pole];
  if (!kind) return null;
  return { kind, pole, port, tier, demand: threatDemand(levelOf(harbour), tier) };
}

/**
 * The win probability for STANDING FIRM against a threat — climbs with the home port's growth level,
 * capped. PURE; junk harbour → the base (level-1) odds.
 * @param {{level:number}|null} harbour
 * @returns {number} probability in (0, STAND_FIRM_MAX_ODDS]
 */
export function standFirmOdds(harbour) {
  const odds = STAND_FIRM_BASE_ODDS + STAND_FIRM_ODDS_PER_LEVEL * levelOf(harbour);
  return Math.min(STAND_FIRM_MAX_ODDS, odds);
}

/**
 * Can the captain pay the tribute a threat demands (enough coin)? PURE.
 * @param {{threat:object, coins:number}} o
 * @returns {{ok:boolean, reason?:string, cost?:number}}
 */
export function canPayTribute({ threat, coins } = {}) {
  const t = sanitizeThreat(threat);
  if (!t) return { ok: false, reason: 'no-threat' };
  if (!(Number.isFinite(coins) && coins >= t.demand)) return { ok: false, reason: 'no-coins', cost: t.demand };
  return { ok: true, cost: t.demand };
}

/**
 * Pay the tribute: the threat lifts cleanly for the demanded coin. On success the caller deducts
 * `spent` and clears the threat. PURE — never mutates.
 * @param {{threat:object, coins:number}} o
 * @returns {{ok:boolean, reason?:string, cost?:number, spent?:number, cleared?:boolean}}
 */
export function payTribute({ threat, coins } = {}) {
  const gate = canPayTribute({ threat, coins });
  if (!gate.ok) return gate;
  return { ok: true, spent: gate.cost, cleared: true };
}

/**
 * Resolve STANDING FIRM against a threat with a supplied dice `roll` in [0,1) (the caller's seeded
 * RNG — keeps the outcome deterministic + QA-forceable). Win (roll < standFirmOdds) → the threat is
 * repelled for a Standing reward, the harbour untouched. Lose → the threat SACKS the harbour: it
 * drops a level (losing that tier's invested coin), or a claimed berth is lost outright, and you lose
 * Standing. A junk/absent roll is treated as a LOSS (no free win on a missing RNG). PURE; never throws;
 * never mutates the input harbour — returns the NEW harbour the caller persists.
 * @param {{threat:object, harbour:object, roll:number}} o
 * @returns {{ok:boolean, reason?:string, won?:boolean, cleared?:boolean, odds?:number,
 *           standingGain?:number, standingLoss?:number, harbour?:(object|null), coinLost?:number,
 *           lostPort?:boolean}}
 */
export function resolveStandFirm({ threat, harbour, roll } = {}) {
  const t = sanitizeThreat(threat);
  if (!t) return { ok: false, reason: 'no-threat' };
  const odds = standFirmOdds(harbour);
  const r = Number.isFinite(roll) ? roll : 1; // missing/junk roll → a loss, never a free win
  const won = r < odds;
  if (won) {
    return { ok: true, won: true, cleared: true, odds, standingGain: REPEL_STANDING, harbour: harbour || null };
  }
  const { harbour: next, coinLost } = demoteHarbour(harbour);
  return {
    ok: true, won: false, cleared: true, odds,
    standingLoss: FALL_STANDING, harbour: next, coinLost, lostPort: next === null,
  };
}

// ---- The warning + framing voice (the CREATIVE SPARK) -----------------------------------------
// In-character lines. The WARNING is the one-liner the #105 ashore digest + the landfall banner read;
// the BLURB is the longer in-town framing above the two resolution planks. {port} is substituted.
// Original to Tidewake — grave with the house wink (Constitution).
const WARNING = {
  blockade: 'A navy blockade is gathering off {port} — your black name has drawn the King’s ships to your own home water.',
  raid: 'A pirate raid is mustering against {port} — freebooters covet the prosperous harbour you raised.',
};
const BLURB = {
  blockade: 'Frigates ride at anchor across the mouth of {port}, gun ports open, a writ for your arrest snapping at the masthead. The harbourmaster wants to know your mind, captain — buy the blockade off, or run up your colours and dare them.',
  raid: 'A ragged fleet of cutthroats is closing on {port} by night, drawn to the wealth you made of it. The council looks to you, captain — pay the sea-wolves their tribute, or stand to the guns and trust your walls.',
};
const TITLE = { blockade: '⚓ Blockade off your home port!', raid: '☠ Raiders bound for your home port!' };

/** The short warning line for a threat (the #105 digest line + the banner subtitle). '' if no threat. */
export function threatWarning(threat) {
  const t = sanitizeThreat(threat);
  if (!t) return '';
  return (WARNING[t.kind] || '').replace(/\{port\}/g, t.port);
}

/** The longer in-town framing for a threat (above the resolution planks). '' if no threat. */
export function threatBlurb(threat) {
  const t = sanitizeThreat(threat);
  if (!t) return '';
  return (BLURB[t.kind] || '').replace(/\{port\}/g, t.port);
}

/** The banner title for a threat (when it first appears on landfall). '' if no threat. */
export function threatTitle(threat) {
  const t = sanitizeThreat(threat);
  if (!t) return '';
  return TITLE[t.kind] || '⚠ Your home port is threatened!';
}
