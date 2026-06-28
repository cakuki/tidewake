// Mode — the world-state machine (#95). The spine the rest of the owner's batch stands on:
// town mode (#67/#96), battle mode (#100) and the mode-aware sound system (#94) all plug
// into this one seam. It answers a single question — "what kind of moment is the player in?"
//
// Today the game has an *implicit* two-state gate buried in main.js' update():
//   `const fighting = duel.active || cannons.active`
// …which silently snap-freezes everything for a fight. This generalises that into an explicit,
// deliberate machine: SAILING (the helm is yours, the world sails) ↔ TOWN / BATTLE (your helm
// pauses, but the world keeps living underneath — other vessels sail on).
//
// CREATIVE SPARK (Game Designer): a mode isn't a menu — it's a *change of stance*. SAILING is
// the open hand on the helm; TOWN and BATTLE are both "hands off the wheel, eyes up" — so they
// share one truth, `playerPaused`. That single boolean is the whole reason the world no longer
// snaps frozen around you: the player settles, everything else carries on.
//
// PURE on purpose — no THREE, no DOM, no game state. Unit-tested in tests/unit/mode.test.mjs;
// main.js owns the wiring (drives BATTLE from combat, keeps `update()` thin).

export const SAILING = 'sailing';
export const TOWN = 'town';
export const BATTLE = 'battle';

// Order matters: SAILING is the resting state; TOWN/BATTLE are the "paused-helm" stances.
export const MODES = [SAILING, TOWN, BATTLE];

/** Is `m` one of the known modes? Guards every transition + initial value. */
export function isMode(m) {
  return MODES.includes(m);
}

/**
 * Create a mode manager.
 *   createModeManager({ initial = SAILING, onChange }) -> {
 *     current,                 // the active mode string
 *     is(mode),                // current === mode
 *     playerPaused,            // current !== SAILING (helm paused; world keeps living)
 *     enter(mode),             // transition to mode (guarded); true if it changed
 *     leave(),                 // back to SAILING; true if it changed
 *   }
 * `onChange(to, from)` fires only on a *real* transition (re-entering the current mode is a
 * deliberate no-op so callers can poll-drive it from `update()` without churn).
 */
export function createModeManager({ initial = SAILING, onChange } = {}) {
  if (!isMode(initial)) throw new Error(`unknown mode: ${initial}`);
  let current = initial;

  function set(next) {
    if (!isMode(next)) throw new Error(`unknown mode: ${next}`);
    if (next === current) return false; // no-op: same stance, no event
    const prev = current;
    current = next;
    if (onChange) onChange(current, prev);
    return true;
  }

  return {
    get current() { return current; },
    is(mode) { return current === mode; },
    get playerPaused() { return current !== SAILING; },
    enter(mode) { return set(mode); },
    leave() { return set(SAILING); },
  };
}
