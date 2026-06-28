// Auto-harbour — the pure decision logic for making landfall into TOWN mode (#67 + #96).
//
// The owner wants arriving at a town to be a MOMENT and a PLACE, not a panel that flickers
// over the helm: sail up → make landfall into a deliberate TOWN mode (the market lives there)
// → leave only via an explicit "Set Sail" button. This module owns the small, PURE state
// machine that decides WHEN to enter and how to leave cleanly — no THREE, no DOM, no game
// state — so it unit-tests under node. main.js owns the wiring (drives the mode + the nudge).
//
// CREATIVE SPARK (Game Designer): landfall should be EDGE-triggered, like a ship actually
// crossing the harbour mouth — town opens once, on arrival, not every frame you sit at the
// berth. And leaving is the mirror: a single pull of the wheel that re-arms the helm and points
// the bow back at open water. The one trap to dodge (owner-flagged): docking re-arms on
// proximity, so stopping + disabling nav inside the radius would STRAND you. The fix is the
// `leftHarbour` latch — while it's up, the harbour's slow-to-stop assist is suspended so the
// seaward nudge can actually carry you out, and it drops the instant you clear the harbour.

import { SAILING } from '../mode.js';

/**
 * Should we make landfall into TOWN this step? Edge-triggered: only on the FRESH arrival
 * (the step the hull first crosses into a port's dock radius) and only while under sail —
 * so it fires once per visit, never every frame you sit at the berth, and never over a fight.
 * @param {{mode:string, arrived:boolean}} o
 * @returns {boolean}
 */
export function shouldEnterTown({ mode, arrived }) {
  return mode === SAILING && !!arrived;
}

/**
 * Is the harbour's slow-to-stop assist (#76c) active this step? It coasts you IN on approach,
 * but must STAND DOWN the moment you choose to leave — otherwise it would fight the seaward
 * nudge and trap you at the dock. So it's suspended while the `leftHarbour` latch is up.
 * @param {boolean} leftHarbour  true between pressing "Set Sail" and clearing the harbour
 * @returns {boolean}
 */
export function harbourAssistActive(leftHarbour) {
  return !leftHarbour;
}

/**
 * Next value of the `leftHarbour` latch — raised when the player sets sail, lowered once the
 * hull has cleared all dock range (so a later approach harbours again, cleanly). Pure.
 * @param {boolean} leftHarbour  current latch
 * @param {{docked:(string|null), leaving:boolean}} o
 * @returns {boolean}
 */
export function nextLeftHarbour(leftHarbour, { docked, leaving }) {
  if (leaving) return true;        // just pressed "Set Sail": suspend the assist, nudge out
  if (!docked) return false;       // cleared the harbour mouth: re-arm for the next landfall
  return leftHarbour;              // still within range: hold the latch
}

/**
 * The heading that points the bow at open water on leaving — the jetty's seaward `angle`
 * (ports.js builds each marker facing out to sea). Ship heading shares that convention
 * (move = [sin h, cos h]), so steering to the jetty angle carries the hull out of the harbour.
 * Falls back to the current heading if no angle is known (never throws, never NaNs the helm).
 * @param {number} angle    the docked port's seaward jetty angle (radians)
 * @param {number} [fallback]  current heading to keep if angle is missing
 * @returns {number}
 */
export function seawardHeading(angle, fallback = 0) {
  return Number.isFinite(angle) ? angle : fallback;
}
