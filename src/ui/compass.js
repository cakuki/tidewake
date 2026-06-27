// Wind compass — the first self-contained, self-tested HUD component (#53, pattern-setter).
//
// A UI component under src/ui/ owns: (1) its PURE presentation maths, exported and unit-
// tested WITHOUT a browser, and (2) a thin `create…(root)` factory that finds/wires its own
// DOM and exposes a single `update(state)`. See src/ui/README.md for the house standard.
//
// The compass dial is ship-relative (bow up): the wind arrow shows the wind's bearing
// RELATIVE to the heading, and the point-of-sail label/colour follow it.
import { pointOfSail } from '../physics.js';

const RAD2DEG = 180 / Math.PI;

/**
 * PURE — the wind arrow's rotation in DEGREES, normalised to (-180, 180]. Normalising keeps
 * the emitted angle bounded no matter how far `heading` has accumulated, so the value handed
 * to the SVG `rotate()` stays sane on every turn — this is the #50 drift fix.
 * @param {number} heading ship heading in radians
 * @param {number} windDir wind direction in radians
 * @returns {number} degrees in (-180, 180]
 */
export function windArrowDeg(heading, windDir) {
  let deg = (windDir - heading) * RAD2DEG;
  deg = ((deg % 360) + 360) % 360; // -> [0, 360)
  if (deg > 180) deg -= 360;       // -> (-180, 180]
  return deg;
}

/**
 * PURE — point-of-sail presentation: the readable label, its efficiency band, and the CSS
 * class the dial's label wears. Wraps physics.pointOfSail so the thresholds/colours have one
 * home and unit-test without a DOM.
 * @returns {{label:string, band:'good'|'fair'|'poor', cls:string}}
 */
export function pointOfSailLabel(heading, windDir) {
  const { label, band } = pointOfSail(heading, windDir);
  return { label, band, cls: 'pos-' + band };
}

/**
 * Build the live wind compass. Finds its DOM (the wind arrow + point-of-sail label) within
 * `root` (defaults to the whole document), and exposes `update(state)` to be called each
 * frame with the ship state ({ heading, windDir }). Cheap: caches the label/band so the hot
 * path only touches the DOM when the point of sail actually changes.
 *
 * @param {Document|HTMLElement} [root] scope to find #windarrow / #pos within
 * @returns {{ update(state:{heading:number,windDir:number}):void }}
 */
export function createCompass(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return { update() {} };
  const $arrow = root.querySelector('#windarrow');
  const $pos = root.querySelector('#pos');

  let lastLabel = '', lastBand = '';

  function update(state) {
    if (!state) return;
    // Arrow swings to the wind's bearing relative to the bow. The explicit pivot `24 24`
    // (the dial centre) keeps it rotating about the centre at every heading; the angle is
    // normalised so it never drifts as `heading` accumulates (#50).
    if ($arrow) {
      $arrow.setAttribute('transform', `rotate(${windArrowDeg(state.heading, state.windDir)} 24 24)`);
    }
    if ($pos) {
      const sail = pointOfSailLabel(state.heading, state.windDir);
      if (sail.label !== lastLabel) { $pos.textContent = sail.label; lastLabel = sail.label; }
      if (sail.band !== lastBand) { $pos.className = sail.cls; lastBand = sail.band; }
    }
  }

  return { update };
}
