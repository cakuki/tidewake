// Shot lockers — the fitted ammo & the mid-combat shot cycle (#135, slice 3).
//
// Slice 2 gave the deliberate BATTLE stance real-time teeth: steer the foe abeam, press SPACE,
// the broadside bites. But every volley was the same iron ball. This slice adds the choice the
// owner asked for: you FIT shot at a town WORKSHOP (no buying mid-combat), then cycle the LOADED
// shot type with one key mid-fight — each with a DISTINCT effect on the broadside. Round pounds
// the hull; chain shreds her rigging so her reply comes back limp; grape sweeps the deck and
// breaks crew nerve for a capture; light shot reaches with a forgiving arc; heavy double-shot
// devastates but loads slowly and exposes you; swivels patter quick and rattle.
//
// CREATIVE SPARK (Game Designer): a broadside isn't one button — it's a QUESTION. "Do I want her
// SUNK (Infamy) or YIELDED (Standing)? Hard and slow, or quick and forgiving?" The shot you load
// is your answer, switched on the fly as the fight turns — chain to cripple her, then grape to
// scare the colours down, then round to finish. The numbers below are tuned so each shot has a
// clear best moment and none is strictly dominant.
//
// PURE on purpose — no THREE, no DOM, no game state. The profiles feed cannons.resolveBroadside
// (slice 2's pure model) unchanged; the loadout/cycle helpers are unit-tested under node. main.js
// owns the wiring (the workshop UI in town.js, the mid-fight cycle key, the HUD shot readout).

// Canonical order — the order the workshop lists them and the cycle key walks them.
export const AMMO_TYPES = ['round', 'chain', 'grape', 'light', 'heavy', 'swivel'];

// Each profile is read by cannons.resolveBroadside (slice 2):
//   hullMult    — scales the hull bite of the volley.
//   returnMult  — scales the foe's reply (chain's torn rigging answers weakly).
//   moraleMult  — scales the crew-nerve shock (grape sweeps the deck → faster yield/capture).
//   shock       — which crewShock profile to use ('broadside' drowns; 'rigging' terrifies).
//   aimForgive  — 0..1; lifts a glancing (off-beam) hit toward a clean one (light shot reaches).
//   reloadMult  — scales the reload time between volleys (heavy is slow; swivels are quick).
// name/icon/blurb/tag are presentation only (the workshop board + the battle HUD readout).
export const AMMO = {
  round: {
    id: 'round', name: 'Round shot', icon: '⚫', tag: 'Balanced',
    hullMult: 1.0, returnMult: 1.0, moraleMult: 1.0, shock: 'broadside', aimForgive: 0.0, reloadMult: 1.0,
    blurb: 'The workhorse ball — solid hull damage, honest in every way.',
  },
  chain: {
    id: 'chain', name: 'Chain shot', icon: '⛓', tag: 'Cripples rigging',
    hullMult: 0.5, returnMult: 0.45, moraleMult: 1.0, shock: 'rigging', aimForgive: 0.0, reloadMult: 1.0,
    blurb: 'Twin balls on a chain shred her sails — light on the hull, but her reply comes back limp.',
  },
  grape: {
    id: 'grape', name: 'Grapeshot', icon: '🔘', tag: 'Breaks nerve',
    hullMult: 0.35, returnMult: 1.0, moraleMult: 2.4, shock: 'broadside', aimForgive: 0.0, reloadMult: 0.9,
    blurb: 'A scatter of musket balls sweeps her deck — barely scratches the hull, but it scares the colours down.',
  },
  light: {
    id: 'light', name: 'Light shot', icon: '◦', tag: 'Forgiving arc',
    hullMult: 0.8, returnMult: 0.8, moraleMult: 0.9, shock: 'broadside', aimForgive: 0.35, reloadMult: 0.7,
    blurb: 'A lighter ball with a long, forgiving arc — bites even when she is not dead abeam.',
  },
  heavy: {
    id: 'heavy', name: 'Heavy shot', icon: '⬛', tag: 'Devastating',
    hullMult: 1.7, returnMult: 1.3, moraleMult: 1.1, shock: 'broadside', aimForgive: 0.0, reloadMult: 1.4,
    blurb: 'Double-shotted iron — devastating to a hull, but slow to load and you take a heavier reply.',
  },
  swivel: {
    id: 'swivel', name: 'Swivel shot', icon: '✶', tag: 'Quick-firing',
    hullMult: 0.45, returnMult: 0.9, moraleMult: 1.4, shock: 'broadside', aimForgive: 0.1, reloadMult: 0.55,
    blurb: 'Quick-firing deck guns — they patter the hull and rattle the crew between the big volleys.',
  },
};

/** True if `id` names a real shot. */
export function isFittable(id) {
  return Object.prototype.hasOwnProperty.call(AMMO, id);
}

/** The pure profile for a shot id, falling back to round for anything unknown/missing. */
export function ammoProfile(id) {
  return AMMO[id] || AMMO.round;
}

/** The starter locker — round always fitted, plus a little variety so the cycle is useful day one. */
export function defaultLoadout() {
  return ['round', 'chain', 'grape'];
}

/**
 * Cycle the LOADED shot to the next one in the fitted loadout (wraps). PURE. Defends against an
 * empty / garbage loadout by always falling back to round, so the guns can always fire something.
 * @param {string} current  the currently-loaded shot id
 * @param {string[]} [loadout] the fitted shot ids (the workshop's locker)
 * @returns {string} the next fitted shot id
 */
export function cycleAmmo(current, loadout = AMMO_TYPES) {
  const list = (Array.isArray(loadout) ? loadout.filter(isFittable) : []);
  if (!list.length) return 'round';
  const i = list.indexOf(current);
  return list[(i + 1) % list.length];
}

/**
 * Fit (or unfit) a shot in the loadout — the workshop TOGGLE. PURE: returns a NEW loadout in the
 * canonical AMMO_TYPES order. Round can never be unfitted (your crew always has a ball at the rack);
 * an unknown id is ignored.
 * @param {string[]} loadout  the current fitted ids
 * @param {string} id         the shot to toggle
 * @returns {string[]} the new fitted loadout (canonical order)
 */
export function fitAmmo(loadout, id) {
  const set = new Set((Array.isArray(loadout) ? loadout : []).filter(isFittable));
  set.add('round'); // round is always at the rack
  if (isFittable(id)) {
    if (id === 'round') { /* round is never unfitted */ }
    else if (set.has(id)) set.delete(id);
    else set.add(id);
  }
  return AMMO_TYPES.filter((t) => set.has(t));
}
