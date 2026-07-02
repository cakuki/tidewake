// Non-occluding battle UI (#161 slice 2) — the SINGLE SOURCE OF TRUTH for "does this piece of UI
// sit clear of the centre of the screen, where the battle camera frames the ship?"
//
// The owner playtested the marquee fight (#135) and couldn't SEE his own ship: the battle prompts
// (`#battle`/`#cannons`/`#duel`) were dead-centre `translate(-50%,-50%)` modals that landed exactly
// on the hull the battle camera frames centre-screen. The fix docks those panels to a non-occluding
// lower band; this module defines the CENTRAL SAFE-ZONE they must stay clear of, and the pure
// rectangle-overlap test used both by the CSS-verifying QA hook and this slice's regression gate.
//
// Pure + DOM-free + three.js-free so the zone rule unit-tests under `node --test` (the #53
// self-tested-component standard). No state, no save-schema — a layout predicate only.

// The fixed TOP INSTRUMENT STRIP reserve (#75): the raid-phase tracker (#135) + the just-in-time
// key-prompts (#153) are pinned to the top edge and stack to ~96px of FIXED-position UI. On a tall
// screen 16% of height sits well below them; on a SHORT LANDSCAPE screen 16% of height dips INTO
// that strip, so the keep-clear band would wrongly read those deliberate top strips as "occluding
// the ship." We floor the band's top at this reserve so the strips are always above the band. ~96px
// of strip + a hair of margin.
export const TOP_STRIP_RESERVE = 100;

/**
 * The central "keep clear" box for the battle stage — the region the framed ship + the fight
 * occupy, that battle UI must never cover. A generous central band: the middle 60% of the width and
 * the upper-centre 42% of the height (top 16% → 58%), where the quarter-view camera frames the hull.
 * Deliberately NOT the full lower band, so bottom-docked prompts and the top raid strip both clear.
 * The top is floored at TOP_STRIP_RESERVE so a SHORT landscape screen (where 16% of height dips into
 * the fixed top-strip band) never counts the deliberate top strips as occluders (#75); the floor is
 * itself capped below the band's own bottom so a pathologically tiny viewport can't invert the box.
 * Tall screens (desktop / phone portrait) are UNCHANGED — 16% of height already clears the strips.
 * @param {number} width  viewport width in px
 * @param {number} height viewport height in px
 * @returns {{left:number, top:number, right:number, bottom:number}}
 */
export function centreSafeZone(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  return {
    left: 0.20 * w,
    right: 0.80 * w,
    top: Math.max(0.16 * h, Math.min(TOP_STRIP_RESERVE, 0.40 * h)),
    bottom: 0.58 * h,
  };
}

/**
 * Axis-aligned rectangle overlap. Edge-touching (a.right === b.left) is NOT an overlap — a panel
 * that abuts the safe-zone boundary is considered clear.
 * @param {{left:number,top:number,right:number,bottom:number}} a
 * @param {{left:number,top:number,right:number,bottom:number}} b
 * @returns {boolean}
 */
export function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Does this UI rectangle stay clear of the central safe-zone (i.e. NOT cover the framed ship)?
 * A zero-area / hidden rect (no width or height) is treated as clear — a panel that isn't shown
 * can't occlude anything.
 * @param {{left:number,top:number,right:number,bottom:number}} rect
 * @param {number} width  viewport width in px
 * @param {number} height viewport height in px
 * @returns {boolean} true ⇒ the centre stays visible; false ⇒ this UI occludes the ship
 */
export function clearsCentre(rect, width, height) {
  if (!rect) return true;
  if (rect.right <= rect.left || rect.bottom <= rect.top) return true; // hidden / zero-area
  return !rectsOverlap(rect, centreSafeZone(width, height));
}
