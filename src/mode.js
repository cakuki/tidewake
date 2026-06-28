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
//
// HARDENED (#106, DL #3 theme 3): now that #67 town + #94 sound stand on this seam and battle
// #100 is about to plug in, it is a real Thinnest-Viable-Platform contract — a legal-transition
// graph, a multi-subscriber event bus (so each system attaches/detaches independently instead of
// fighting over one callback), and a deterministic new-voyage reset. The invariants below are
// what every other system may rely on.

export const SAILING = 'sailing';
export const TOWN = 'town';
export const BATTLE = 'battle';

// Order matters: SAILING is the resting state; TOWN/BATTLE are the "paused-helm" stances.
export const MODES = [SAILING, TOWN, BATTLE];

// The legal-transition graph (#106). SAILING is the HUB — the open hand on the helm every stance
// falls back to (leave harbour / fight ends / new voyage), so it is always reachable. Combat is
// the highest-priority stance: a fight can break out anywhere, even ashore (TOWN→BATTLE), but you
// can NEVER make port mid-broadside (BATTLE→TOWN is illegal — "TOWN must not interrupt BATTLE").
// A mode only ever leaves BATTLE by ending the fight (→SAILING). Keep this map in sync with the
// matrix test in tests/unit/mode.test.mjs — it is the seam's published contract.
export const TRANSITIONS = {
  [SAILING]: [TOWN, BATTLE],
  [TOWN]: [SAILING, BATTLE],
  [BATTLE]: [SAILING],
};

/** Is `m` one of the known modes? Guards every transition + initial value. */
export function isMode(m) {
  return MODES.includes(m);
}

/**
 * Is a move from `from` to `to` legal? Pure, side-effect free — the seam's published guard.
 * Same-mode is an allowed no-op; unknown modes on either side are rejected. (#106)
 */
export function canTransition(from, to) {
  if (!isMode(from) || !isMode(to)) return false;
  if (from === to) return true; // idempotent no-op (set() short-circuits it before any event)
  return TRANSITIONS[from].includes(to);
}

/**
 * Create a mode manager.
 *   createModeManager({ initial = SAILING, onChange }) -> {
 *     current,                 // the active mode string
 *     is(mode),                // current === mode
 *     playerPaused,            // current !== SAILING (helm paused; world keeps living)
 *     canEnter(mode),          // would enter(mode) be a legal transition from here?
 *     enter(mode),             // transition to mode (legal-guarded); true if it changed
 *     leave(),                 // back to SAILING; true if it changed
 *     reset(),                 // deterministic: a fresh voyage always starts under sail
 *     subscribe(fn) -> off,    // multi-subscriber bus; fn(to, from) on each real transition
 *   }
 * `onChange(to, from)`, if given, is registered as subscriber #0 (backward-compatible sugar).
 * Subscribers fire only on a *real* transition (re-entering the current mode, or an illegal
 * move, is a no-op — so callers can poll-drive `enter()` from `update()` without churn). A
 * throwing subscriber is isolated: it never corrupts state nor blocks its peers.
 */
export function createModeManager({ initial = SAILING, onChange } = {}) {
  if (!isMode(initial)) throw new Error(`unknown mode: ${initial}`);
  let current = initial;
  const subscribers = new Set();
  if (onChange) subscribers.add(onChange); // backward-compat: onChange is just subscriber #0

  function notify(to, from) {
    // Snapshot so a subscriber that (un)subscribes mid-notify can't perturb this round.
    for (const fn of [...subscribers]) {
      try { fn(to, from); } catch { /* a subscriber must never break the seam or block its peers */ }
    }
  }

  function set(next) {
    if (!isMode(next)) throw new Error(`unknown mode: ${next}`); // programmer error → throw
    if (next === current) return false;            // no-op: same stance, no event
    if (!canTransition(current, next)) return false; // illegal-but-known: guarded, no churn
    const prev = current;
    current = next;
    notify(current, prev);
    return true;
  }

  return {
    get current() { return current; },
    is(mode) { return current === mode; },
    get playerPaused() { return current !== SAILING; },
    canEnter(mode) { return canTransition(current, mode); },
    enter(mode) { return set(mode); },
    leave() { return set(SAILING); },
    reset() { return set(SAILING); }, // a fresh voyage always starts under sail (#95/#106)
    subscribe(fn) {
      if (typeof fn !== 'function') throw new Error('subscribe(fn): fn must be a function');
      subscribers.add(fn);
      let active = true;
      return function unsubscribe() {
        if (!active) return false; // idempotent
        active = false;
        return subscribers.delete(fn);
      };
    },
  };
}
