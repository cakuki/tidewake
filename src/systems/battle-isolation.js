// Hard battle isolation (#161 slice 1) — the SINGLE SOURCE OF TRUTH for "is the deliberate BATTLE
// stance suppressing every non-battle world interaction?"
//
// The owner playtested the marquee fight (#135) and it felt janky/broken: the #125 foundering-ship
// RESCUE offer still spawned mid-cannonade and the open-sea `f`/`g` hail/open-fire verbs still fired
// on OTHER ships while engaged — input theft plus a third hull crashing the arena. A clean fight is
// isolated: while you are squared up in the deliberate stance, ONLY battle verbs are live and every
// ambient prompt/spawn/hail is a no-op. Input handlers + the encounter spawn gate consult this one
// predicate instead of scattering `if (battle.active)` checks, so there is exactly one place that
// decides what a "cleanly isolated fight" means (and where later ambient gates hook in).
//
// Pure + DOM-free + three.js-free so the isolation rule unit-tests under `node --test` (the #53
// self-tested-component standard). No state, no save-schema — a transient stance guard only.

/**
 * Are non-battle world interactions suppressed right now?
 * @param {{ battleActive?: boolean }} [state] — `battleActive` is `battle.state.active`.
 * @returns {boolean} true ⇒ suppress ambient spawns/prompts/hails; only battle verbs stay live.
 */
export function interactionsSuppressed(state = {}) {
  return state.battleActive === true;
}

/**
 * May an ambient at-sea encounter (a #125 founderer) spawn/present right now? Folds the existing
 * "helm must be free" rule together with battle isolation, so the encounter system and the QA hook
 * ask ONE question. Paused (town/menu) OR in a fight ⇒ no ambient intrusion.
 * @param {{ paused?: boolean, battleActive?: boolean }} [state]
 * @returns {boolean}
 */
export function ambientInteractionsAllowed(state = {}) {
  return state.paused !== true && !interactionsSuppressed(state);
}
