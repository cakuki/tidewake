// Aim-angle feedback (#161 slice 5) — SEE your firing solution. The owner's marquee-battle note:
// "the angles should matter." They already DO in the maths (`broadsideAim` in src/systems/battle.js:
// a clean beam shot bites, a wide one flies past) — but the player couldn't SEE their aim before
// pressing SPACE. This module turns the live broadside-aim reading into a legible AIM LINE from your
// ship to the foe that COLOURS and TIGHTENS as you come abeam, so lining up the broadside becomes a
// skill you can watch improving.
//
// #166-COORDINATE-READY: this is the SKILL half of the #166 "legible odds" readout ("skill sets the
// odds, luck sets the margin"). The DOM chip carries a reserved `.aim-odds` slot + a `setOdds()` method
// (unused this slice, mirrors the billboard's `setLabel` #165 pattern) so #166 can add odds/margin text
// beside the aim indicator later WITHOUT a redo — the aim UI stays modular and leaves the room.
//
// The hot core is PURE + DOM-free + three.js-free so it unit-tests under `node --test` (the #53
// self-tested-component standard): `aimReadout` classifies the aim off `broadsideAim`'s quality/inArc,
// and `beamGeometry` turns two screen points into a rotated-bar layout. The DOM factory is a thin,
// presentation-only shell fed already-projected screen coordinates (projection stays in main.js, reusing
// the slice-3 over-ship VP matrix). Read-only: NEVER changes the aim maths — presentation only.

// The three legibility bands of a firing solution. `on-target` mirrors broadsideAim.inArc exactly
// (the shot will bite); the other two telegraph the approach so the player can read "keep coming".
export const AIM_ON_TARGET = 'on-target';
export const AIM_CLOSING = 'closing';
export const AIM_OFF = 'off-target';

// The firing-cone half-angle the gizmo renders (degrees): TIGHT when dead abeam (a clean line on her),
// WIDE when bow/stern-on (your guns can't bear). Drives the beam's visible thickness so it literally
// tightens as you come abeam — the felt "I'm lining up" beat.
export const MIN_SPREAD_DEG = 6;   // dead abeam (quality → 1): a tight, confident line
export const MAX_SPREAD_DEG = 55;  // bow/stern-on (quality → 0): a broad, hopeless spread

const LABELS = {
  [AIM_ON_TARGET]: 'ON TARGET',
  [AIM_CLOSING]: 'BEARING…',
  [AIM_OFF]: 'BRING HER ABEAM',
};

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Turn a `broadsideAim` reading into a presentation-ready aim readout (PURE, read-only).
 * @param {{quality:number, inArc:boolean, side?:'port'|'starboard'}} aim  the live broadsideAim result
 * @param {{arcThreshold?:number, closingBand?:number}} [opts]
 *   arcThreshold — matches battle.js ARC_THRESHOLD (the abeam cutoff that decides a hit)
 *   closingBand  — how far below the arc still reads as "closing" (amber) vs "off" (red)
 * @returns {{level:'on-target'|'closing'|'off-target', onTarget:boolean, quality:number,
 *            side:'port'|'starboard', spreadDeg:number, label:string}}
 */
export function aimReadout({ quality, inArc, side = 'starboard' } = {}, { arcThreshold = 0.5, closingBand = 0.18 } = {}) {
  const q = clamp01(quality);
  let level;
  if (inArc) level = AIM_ON_TARGET;           // she'll bite — mirror the maths exactly
  else if (q >= arcThreshold - closingBand) level = AIM_CLOSING; // nearly there, keep coming
  else level = AIM_OFF;                        // your guns can't bear
  const spreadDeg = MAX_SPREAD_DEG - (MAX_SPREAD_DEG - MIN_SPREAD_DEG) * q;
  return {
    level,
    onTarget: level === AIM_ON_TARGET,
    quality: q,
    side: side === 'port' ? 'port' : 'starboard',
    spreadDeg,
    label: LABELS[level],
  };
}

/**
 * Lay out a rotated "beam bar" that connects two screen points (PURE). The bar is positioned at
 * `from`, given a width of the point-to-point distance, and rotated to point at `to` (CSS
 * transform-origin: 0 50%). Also returns the midpoint, where the aim chip sits.
 * @param {{x:number,y:number}} from  the ship end (screen px)
 * @param {{x:number,y:number}} to    the foe end (screen px)
 * @returns {{left:number, top:number, width:number, angleRad:number, midX:number, midY:number}}
 */
export function beamGeometry(from, to) {
  const fx = Number(from?.x) || 0, fy = Number(from?.y) || 0;
  const tx = Number(to?.x) || 0, ty = Number(to?.y) || 0;
  const dx = tx - fx, dy = ty - fy;
  return {
    left: fx,
    top: fy,
    width: Math.hypot(dx, dy),
    angleRad: Math.atan2(dy, dx),
    midX: (fx + tx) / 2,
    midY: (fy + ty) / 2,
  };
}

/**
 * Create ONE aim-indicator (DOM). Presentation-only: fed already-projected screen coords + an
 * `aimReadout`, it draws the beam line (coloured/tightened by level+spread) and a midpoint chip with
 * the readout label. The `.aim-odds` span + `setOdds()` are the #166 reserved slot (unused this slice).
 * @param {{parent?:HTMLElement, className?:string}} [opts]
 */
export function createAimIndicator({ parent, className = 'aim-indicator' } = {}) {
  const host = parent || (typeof document !== 'undefined' ? document.body : null);
  const el = typeof document !== 'undefined' ? document.createElement('div') : null;
  let beam = null, chip = null, label = null;
  // #166 legible-odds slot: a verdict line, a legible damage/±20%-margin sub-line, and a visual MARGIN
  // BAND (a bar whose lit segment = the bounded luck swing, its side of centre = favoured-or-not). Built
  // once here so #166 docks into the reserved slot with no redo; presentation-only, ~0 draws (DOM).
  let odds = null, oddsText = null, oddsSub = null, oddsBand = null, oddsFill = null;
  if (el) {
    el.className = className;
    el.style.display = 'none';
    beam = document.createElement('div'); beam.className = 'aim-beam';
    chip = document.createElement('div'); chip.className = 'aim-chip';
    label = document.createElement('span'); label.className = 'aim-label';
    odds = document.createElement('span'); odds.className = 'aim-odds'; odds.style.display = 'none';
    oddsText = document.createElement('span'); oddsText.className = 'aim-odds-text';
    oddsSub = document.createElement('span'); oddsSub.className = 'aim-odds-sub';
    oddsBand = document.createElement('span'); oddsBand.className = 'aim-odds-band';
    oddsFill = document.createElement('span'); oddsFill.className = 'aim-odds-fill'; // the lit luck-swing segment
    const oddsEven = document.createElement('span'); oddsEven.className = 'aim-odds-even'; // the "even fight" centre tick
    oddsBand.appendChild(oddsFill);
    oddsBand.appendChild(oddsEven);
    odds.appendChild(oddsText);
    odds.appendChild(oddsSub);
    odds.appendChild(oddsBand);
    chip.appendChild(label);
    chip.appendChild(odds); // #166 drives this — beside the aim, no redo
    el.appendChild(beam);
    el.appendChild(chip);
    if (host) host.appendChild(el);
  }
  let level = '', oddsTier = '';

  function setLevel(next) {
    if (level === next) return;
    if (level) { beam.classList.remove(level); chip.classList.remove(level); }
    if (next) { beam.classList.add(next); chip.classList.add(next); }
    level = next;
  }

  return {
    el,
    /**
     * Position + colour the aim line between the ship and the foe.
     * @param {{from:{x,y}, to:{x,y}, readout:object, visible:boolean}} args
     */
    place({ from, to, readout, visible }) {
      if (!el) return;
      if (!visible || !readout) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      el.style.display = 'block';
      const g = beamGeometry(from, to);
      beam.style.left = `${g.left}px`;
      beam.style.top = `${g.top}px`;
      beam.style.width = `${g.width}px`;
      beam.style.transform = `rotate(${g.angleRad}rad)`;
      // Thickness tracks the firing-cone spread: a tight bright line dead abeam, a broad faint one bow-on.
      const thickness = 2 + (readout.spreadDeg / MAX_SPREAD_DEG) * 6;
      beam.style.height = `${thickness}px`;
      chip.style.left = `${g.midX}px`;
      chip.style.top = `${g.midY}px`;
      label.textContent = readout.label || '';
      setLevel(readout.level || '');
    },
    /**
     * #166 legible odds — dock the fair-fight read beside the aim line. Accepts either a bare string
     * (back-compat) or a structured read `{ text, sub, tier, bar }` from oddsReadout()+combatOdds():
     *   text — the plain-language verdict ("She outguns you — reckless")
     *   sub  — the legible damage-per-volley + the bounded ±20% margin (+ optional stake hint)
     *   tier — dominant|favoured|even|risky|dire (drives the colour band)
     *   bar  — { lo, hi } 0..1 band positions: the lit segment = the bounded LUCK swing, its side of the
     *          centre tick = favoured-or-not. Straddling the centre = "luck can flip this" (the tension).
     * Passing '' / null clears it. Presentation-only — reads combat, never changes it.
     */
    setOdds(read) {
      if (!el) return;
      if (!read || (typeof read === 'string' && read === '')) {
        odds.style.display = 'none';
        if (oddsTier) { odds.classList.remove(oddsTier); oddsTier = ''; }
        return;
      }
      if (typeof read === 'string') { // legacy string form
        oddsText.textContent = read; oddsSub.textContent = ''; oddsBand.style.display = 'none';
        odds.style.display = 'inline-flex';
        return;
      }
      oddsText.textContent = read.text || '';
      oddsSub.textContent = read.sub || '';
      const nextTier = read.tier || '';
      if (oddsTier !== nextTier) {
        if (oddsTier) odds.classList.remove(oddsTier);
        if (nextTier) odds.classList.add(nextTier);
        oddsTier = nextTier;
      }
      const bar = read.bar;
      if (bar && Number.isFinite(bar.lo) && Number.isFinite(bar.hi)) {
        const lo = Math.max(0, Math.min(1, bar.lo));
        const hi = Math.max(lo, Math.min(1, bar.hi));
        oddsFill.style.left = `${(lo * 100).toFixed(1)}%`;
        oddsFill.style.width = `${Math.max(2, (hi - lo) * 100).toFixed(1)}%`;
        oddsBand.style.display = 'inline-block';
      } else {
        oddsBand.style.display = 'none';
      }
      odds.style.display = 'inline-flex';
    },
    hide() { if (el) el.style.display = 'none'; },
    dispose() { if (el) el.remove(); },
  };
}
