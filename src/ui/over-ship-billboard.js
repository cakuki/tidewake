// Over-ship billboard — a reusable world-space marker/label anchored ABOVE a ship and projected to
// the screen (#161 slice 3 target-lock; built #165-ready).
//
// The owner's complaint on the marquee fight (#135): "while moving other ships are all around: I
// don't know which one I am fighting with!" In a busy sea the engaged foe was visually identical to
// the background traffic. This module is the shared foundation for over-ship UI: a cheap DOM/CSS
// billboard (ZERO draw calls — no mesh, no material) positioned each frame by projecting a world
// point to screen space, carrying a highlight RING (target-lock, this slice) AND an optional text
// LABEL (the #162/#165 over-ship threat labels — "Man-o'-War ☠☠☠☠" — will drive the same element).
// Two consumers, one billboard: #161 wires the ring now; #165 adds the label later.
//
// The two hot cores are PURE + DOM-free + three.js-free so they unit-test under `node --test`
// (the #53 self-tested-component standard): the world→screen projection, and the emphasis predicate
// that says which hull is the locked foe and which recede as dimmed traffic. The DOM factory is a
// thin, presentation-only shell that takes already-computed screen coordinates.

/** How far a non-combatant fades during a fight — a real recede, but she stays faintly alive on the
 *  sea (not hidden), so the world still breathes around the duel. Shared by npc.js (material opacity)
 *  and the QA hook so "dimmed" means exactly one thing. */
export const DIM_OPACITY = 0.28;

/**
 * Project a world point to screen pixels through a view-projection matrix (PURE).
 * @param {[number,number,number]} point  world-space [x, y, z]
 * @param {number[]} vp  the 16-element column-major view-projection matrix (three.js Matrix4.elements
 *                       convention: projectionMatrix * camera.matrixWorldInverse)
 * @param {number} width   viewport width in px
 * @param {number} height  viewport height in px
 * @returns {{x:number, y:number, ndcX:number, ndcY:number, ndcZ:number, behind:boolean, onScreen:boolean}}
 *          x/y are screen pixels (y grows downward, screen convention); `behind` ⇒ the point is behind
 *          the camera; `onScreen` ⇒ in front AND inside the [-1,1] NDC box (safe to show a marker).
 */
export function projectToScreen(point, vp, width, height) {
  const x = point[0], y = point[1], z = point[2];
  const e = vp;
  const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const cz = e[2] * x + e[6] * y + e[10] * z + e[14];
  const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
  const behind = cw <= 0;
  const iw = cw !== 0 ? 1 / cw : 0;
  const ndcX = cx * iw, ndcY = cy * iw, ndcZ = cz * iw;
  const sx = (ndcX * 0.5 + 0.5) * width;
  const sy = (-ndcY * 0.5 + 0.5) * height; // NDC +y is up; screen +y is down
  const onScreen = !behind && ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1 && ndcZ <= 1;
  return { x: sx, y: sy, ndcX, ndcY, ndcZ, behind, onScreen };
}

/**
 * Which visual treatment does ship `index` get right now (PURE)?
 *   'foe'    — the engaged foe (target-locked: full opacity + the ring above her)
 *   'dim'    — a non-combatant during a fight (receded to DIM_OPACITY so the foe reads instantly)
 *   'normal' — full opacity, no marker (open sea, or no foe locked)
 * @param {{battleActive:boolean, foeIndex:number, index:number}} args
 * @returns {'foe'|'dim'|'normal'}
 */
export function shipEmphasis({ battleActive, foeIndex, index }) {
  if (!battleActive || !Number.isInteger(foeIndex) || foeIndex < 0) return 'normal';
  return index === foeIndex ? 'foe' : 'dim';
}

/**
 * Create ONE over-ship billboard element (DOM). Presentation-only: it takes already-computed screen
 * coordinates from projectToScreen and shows/hides + positions itself. Reusable — #161 turns the ring
 * on for target-lock; #165 will call setLabel() for a threat label on a per-ship instance.
 * @param {{parent?:HTMLElement, className?:string}} [opts]
 */
export function createOverShipBillboard({ parent, className = 'over-ship-marker' } = {}) {
  const host = parent || (typeof document !== 'undefined' ? document.body : null);
  const el = typeof document !== 'undefined' ? document.createElement('div') : null;
  let ring = null, label = null;
  if (el) {
    el.className = className;
    el.style.display = 'none';
    ring = document.createElement('div'); ring.className = 'osm-ring'; ring.style.display = 'none';
    label = document.createElement('div'); label.className = 'osm-label'; label.style.display = 'none';
    el.appendChild(ring);
    el.appendChild(label);
    if (host) host.appendChild(el);
  }

  return {
    el,
    /** Position at screen (x,y) and show; `visible:false` (e.g. off-screen / behind) hides it. */
    place({ x, y, visible }) {
      if (!el) return;
      if (!visible) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    /** Toggle the target-lock highlight ring (this slice's fun beat). */
    setRing(on) {
      if (!el) return;
      const v = !!on;
      ring.style.display = v ? 'block' : 'none';
      el.classList.toggle('has-ring', v);
    },
    /** Set (or clear, with '') the text label — the #165 threat-label hook; unused this slice. */
    setLabel(text) {
      if (!el) return;
      const t = text || '';
      label.textContent = t;
      label.style.display = t ? 'block' : 'none';
      el.classList.toggle('has-label', !!t);
    },
    hide() { if (el) el.style.display = 'none'; },
    dispose() { if (el) el.remove(); },
  };
}
