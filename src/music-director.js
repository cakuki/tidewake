// Music Director — the PURE, mode-aware mix resolver (#94, first slice).
//
// One coherent sound system, not scattered tracks: it answers a single question each frame —
// "given WHERE the player is (their mode + how near a port), how loud should each music layer
// be?" — and hands back target gains the audio engine ramps to. No THREE, no DOM, no
// AudioContext, no game state: browser-free and unit-tested under node, so the *decision* is
// provable and the *sound* (music.js) just follows it.
//
// CREATIVE SPARK (Musician + Sound Engineer): a port has an AUDITORY HORIZON. Long before the
// dock is in sight, a warm tavern wheeze should drift across the water — "there's a place to
// put in, here" — swelling as you close and ducking the open-sea bed beneath it. Make landfall
// and the town theme owns the air; a fight settles the whole bed to a low keel so the guns read.
// SAILING is the open hand on the helm; the mix is the world leaning in to whisper where you are.
//
// CONTEXT-SHAPED ON PURPOSE (future hook in #94): the resolver takes an abstract context
// { mode, portDistance, dockRadius[, cueRadius] } today, leaving room for a later sail-zones
// system to feed { zoneId, nearestPortName } picking *which* sea/port track without changing
// this crossfade math. Richer layers (rotating sea themes, per-town identities, battle music)
// are filed follow-ups — this slice ships the procedural proximity crossfade only.

import { SAILING, TOWN, BATTLE } from './mode.js';
import { clamp01 } from './music.js';

/**
 * How far out (world units) a port first becomes audible. Larger than DOCK_RADIUS (90) so you
 * "hear the harbour from a distance" before you can dock — the owner's approach-cue intent (#67
 * acceptance #3). The layer ramps from silence here up to full at the dock radius.
 */
export const PORT_CUE_RADIUS = 260;

/**
 * Port-layer audibility in [0,1] from the nearest-port distance. 0 at/beyond `cueRadius`,
 * rising linearly to 1 at/within `dockRadius`. Non-finite distance (at sea, no port) → 0.
 * @param {number} distance   distance to the nearest port point
 * @param {number} dockRadius the radius at which the layer is full (DOCK_RADIUS)
 * @param {number} [cueRadius] the radius at which the layer first becomes audible
 * @returns {number}
 */
export function portProximity(distance, dockRadius, cueRadius = PORT_CUE_RADIUS) {
  if (!Number.isFinite(distance)) return 0;
  const inner = Math.max(0, dockRadius);
  const outer = Math.max(inner + 1e-6, cueRadius);
  return clamp01((outer - distance) / (outer - inner));
}

/**
 * Resolve the per-layer target gains for the current moment. Returns `{ sea, port }`, each a
 * clean multiplier in [0,1] the engine ramps its layer gains toward (so transitions never click).
 *   • SAILING — the open-sea bed; the port layer swells in as you approach, sea ducks under it.
 *   • TOWN    — ashore: the port/tavern theme owns the air, the sea recedes to a distant hush.
 *   • BATTLE  — the whole bed settles to a low keel so combat SFX read; no port layer.
 * @param {{mode?:string, portDistance?:number, dockRadius?:number, cueRadius?:number}} [context]
 * @returns {{sea:number, port:number}}
 */
export function resolveMix(context = {}) {
  const {
    mode = SAILING,
    portDistance = Infinity,
    dockRadius = 90,
    cueRadius = PORT_CUE_RADIUS,
  } = context;

  if (mode === BATTLE) {
    return { sea: 0.3, port: 0 }; // settle the bed; let the guns speak
  }
  if (mode === TOWN) {
    return { sea: 0.12, port: 1 }; // ashore: the town theme owns the mix
  }
  // SAILING: open-sea bed, with the port layer crossfading up on approach.
  const prox = portProximity(portDistance, dockRadius, cueRadius);
  return { sea: 1 - 0.6 * prox, port: prox };
}
