// Safe-area layout predicate (#75) — the SINGLE SOURCE OF TRUTH for "does this piece of UI sit
// within the device SAFE AREA?" i.e. inside the viewport AND clear of the notch / status bar /
// home-indicator / rounded-corner insets the OS reports as `env(safe-area-inset-*)`.
//
// The mobile MVP (#63) + the safe-area top sweep (#75, v0.0.20260627133536) anchor every HUD /
// prompt / touch cluster with `env(safe-area-inset-*)`. This module is the pure rule that proves
// those anchors actually keep the UI off the notch/home-indicator, in EITHER orientation. The live
// DOM rects + the real device insets are fed in by the main.js `safeAreaLayout()` QA hook; the
// insets are 0 on desktop / non-notch / headless, so on those the safe area is simply the viewport.
//
// Pure + DOM-free + three.js-free so the rule unit-tests under `node --test` (the #53
// self-tested-component standard). No state, no save-schema — a layout predicate only.

/**
 * The device SAFE-AREA box in viewport pixels: the viewport minus the OS insets. On a non-notch
 * device (or desktop/headless) all insets are 0, so the box is the full viewport.
 * @param {number} vpW viewport width in px
 * @param {number} vpH viewport height in px
 * @param {{top?:number,right?:number,bottom?:number,left?:number}} [insets] env(safe-area-inset-*)
 * @returns {{left:number, top:number, right:number, bottom:number}}
 */
export function safeAreaBox(vpW, vpH, insets = {}) {
  const w = Number(vpW) || 0;
  const h = Number(vpH) || 0;
  const t = Math.max(0, Number(insets.top) || 0);
  const r = Math.max(0, Number(insets.right) || 0);
  const b = Math.max(0, Number(insets.bottom) || 0);
  const l = Math.max(0, Number(insets.left) || 0);
  return { left: l, top: t, right: w - r, bottom: h - b };
}

/**
 * Does this UI rectangle sit fully within the device safe area (inside the viewport, clear of the
 * notch/home-indicator insets)? A zero-area / hidden rect can't hide under anything → clear.
 * @param {{left:number,top:number,right:number,bottom:number}} rect element rect (viewport coords)
 * @param {number} vpW viewport width in px
 * @param {number} vpH viewport height in px
 * @param {{top?:number,right?:number,bottom?:number,left?:number}} [insets]
 * @param {number} [slack] sub-pixel tolerance in px (default 1)
 * @returns {boolean} true ⇒ the element clears the insets; false ⇒ it hides under a notch/edge
 */
export function withinSafeArea(rect, vpW, vpH, insets = {}, slack = 1) {
  if (!rect) return true;                                          // absent element can't violate
  if (rect.right <= rect.left || rect.bottom <= rect.top) return true; // hidden / zero-area
  const box = safeAreaBox(vpW, vpH, insets);
  const s = Number(slack) || 0;
  return rect.left >= box.left - s
    && rect.top >= box.top - s
    && rect.right <= box.right + s
    && rect.bottom <= box.bottom + s;
}
