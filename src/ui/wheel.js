// Ship's-wheel touch steering (#93) — a rotatable on-screen helm for mobile. Drag the wheel
// and its rotation maps to an analog steer command [-1,1] that feeds the eased-rudder model
// (#20, src/physics.js easeRudder) exactly as the keyboard's A/D would, so the wheel is just a
// nicer way to give the SAME steer input — no parallel physics path. A self-contained src/ui/
// component (the #53 house standard): the PURE drag-angle → steer maths are exported and unit-
// tested without a browser; a thin `createWheel(root)` factory wires its own DOM region.
//
// It lives in its OWN fixed control zone (a corner of #touch-controls) and owns its gestures —
// it preventDefault/stopPropagation its pointer events so a touch on the helm never doubles as
// the full-screen camera-orbit drag (that listens on the canvas). In TOWN mode the whole
// #touch-controls layer is hidden, so the wheel can't re-introduce the #66 panel overlap.
//
// CREATIVE SPARK (Game Designer): the helm is a SELF-CENTRING wheel — lift your thumb and it
// springs back amidships (steer → 0), so the eased rudder settles the bow straight on its own.
// A real wheel you have to actively hold over to keep turning: weighty, forgiving, never a trap.

/** Full lock: how far (radians) the wheel rotates from centre at steer ±1 (~126°). */
export const MAX_ANGLE = 2.2;
/** A small centred deadzone (radians) so a resting thumb / jitter never drifts the heading. */
export const WHEEL_DEADZONE = 0.15;

/** PURE — clamp the wheel's rotation to its physical travel [-MAX_ANGLE, MAX_ANGLE]. */
export function clampAngle(angle, max = MAX_ANGLE) {
  return Math.max(-max, Math.min(max, angle));
}

/**
 * PURE — map the wheel's rotation (radians from centre) to a steer command in [-1,1], with a
 * centred deadzone and a linear ramp from the deadzone edge out to full lock. Same convention
 * as the keyboard steer the sim already eases: +1 = hard a-port, -1 = hard a-starboard.
 * @param {number} angle wheel rotation in radians
 * @param {{max?:number, dead?:number}} [opts]
 * @returns {number} steer in [-1,1]
 */
export function wheelSteer(angle, { max = MAX_ANGLE, dead = WHEEL_DEADZONE } = {}) {
  const a = clampAngle(angle, max);
  const mag = Math.abs(a);
  if (mag <= dead) return 0;
  const s = (mag - dead) / (max - dead);
  return Math.sign(a) * Math.min(1, s);
}

/** PURE — the smallest signed step from angle `a` to `b`, folded to (-PI, PI], so accumulating
 *  a drag never leaps 2PI when the pointer crosses the ±PI seam behind the hub. */
export function shortestAngleDelta(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
}

/** PURE — the angle (radians) of point (x,y) about centre (cx,cy). Screen space: y grows
 *  downward, so a positive angle is clockwise and a clockwise drag winds the wheel clockwise. */
export function pointerAngle(cx, cy, x, y) {
  return Math.atan2(y - cy, x - cx);
}

// A clockwise wheel (positive rotation) should turn the ship to STARBOARD (right) — the same
// as pressing D (steer -1). The pure wheelSteer keeps +angle → +steer, so we invert here to
// match the helm's real feel. One constant, easy to flip if the live direction reads wrong.
const STEER_SIGN = -1;

/**
 * Build the live ship's-wheel widget. Finds `#ship-wheel` within `root`, wires pointer/touch
 * drag → rotation → steer, and rotates the element to follow the thumb. Exposes a tiny surface
 * for the sim/QA: the current `steer`, `angle`, whether it's being `active`(dragged), and a
 * headless `setAngle()` driver so the playtest can prove a rotated wheel turns the ship.
 *
 * @param {Document|HTMLElement} [root]
 * @param {{ onSteer?:(steer:number)=>void, onGesture?:()=>void }} [opts]
 */
export function createWheel(root = (typeof document !== 'undefined' ? document : null), opts = {}) {
  const onSteer = typeof opts.onSteer === 'function' ? opts.onSteer : null;
  const onGesture = typeof opts.onGesture === 'function' ? opts.onGesture : null;
  const el = root && root.querySelector ? root.querySelector('#ship-wheel') : null;

  let angle = 0;            // wheel rotation in radians (clamped to ±MAX_ANGLE)
  let steer = 0;            // derived steer command in [-1,1]
  let dragging = false, activeId = null, lastPointer = 0;

  function emit() {
    steer = wheelSteer(angle) * STEER_SIGN;
    if (onSteer) { try { onSteer(steer); } catch { /* never break the helm */ } }
  }
  function render() { if (el) el.style.transform = `rotate(${angle}rad)`; }

  function centre() {
    if (!el || !el.getBoundingClientRect) return { cx: 0, cy: 0 };
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  function down(e) {
    dragging = true; activeId = e.pointerId;
    const { cx, cy } = centre();
    lastPointer = pointerAngle(cx, cy, e.clientX, e.clientY);
    try { el.setPointerCapture?.(e.pointerId); } catch { /* not all engines */ }
    if (onGesture) { try { onGesture(); } catch { /* belt-and-braces audio unlock */ } }
    e.preventDefault(); e.stopPropagation();
  }
  function move(e) {
    if (!dragging || (activeId !== null && e.pointerId !== activeId)) return;
    const { cx, cy } = centre();
    const p = pointerAngle(cx, cy, e.clientX, e.clientY);
    angle = clampAngle(angle + shortestAngleDelta(lastPointer, p));
    lastPointer = p;
    render(); emit();
    e.preventDefault(); e.stopPropagation();
  }
  function release(e) {
    if (!dragging) return;
    dragging = false; activeId = null;
    angle = 0; render(); emit();   // self-centring helm (#93): release → springs back amidships
    if (e && e.preventDefault) e.preventDefault();
  }

  if (el && el.addEventListener) {
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  return {
    get steer() { return steer; },
    get angle() { return angle; },
    get active() { return dragging; },
    // QA / headless driver: rotate the wheel to an absolute angle (radians) and apply the steer.
    setAngle(rad) { angle = clampAngle(rad); render(); emit(); return steer; },
    // Recentre the helm (e.g. a new voyage): amidships, steer 0, not dragging.
    reset() { angle = 0; dragging = false; activeId = null; render(); emit(); },
  };
}
