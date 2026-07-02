// Coins-delta PULSE (#181) — the small visible+audible feedback beat on every coin change.
//
// The RISE loop is earn → spend, but a coin change was silent + invisible: the #21 HUD coins readout
// just SNAPPED to a new number. This closes the FEEDBACK arrow of the fun loop
// (docs/design/what-makes-it-fun.md): when the player's coin total CHANGES, the readout PULSES (a brief
// scale + colour tick — green on a gain, red on a spend/loss), a small delta floats + fades ("+400" /
// "−250"), and main.js plays a soft coin chime (a bright ring on a gain, a duller tick on a spend).
//
// CREATIVE SPARK (Graphic Designer + Sound Engineer): feedback must be PROPORTIONATE + gentle — a coin
// tick is a grace note, never a fanfare. So the pulse is a single small pop (capped scale, a quick
// rise-and-fade) that echoes the #155 juice envelope family, and it fires ONLY on a real change — never
// every frame. It rides the SAME suppression as the rest of the game-feel (a prefers-reduced-motion
// preference OR the #80 "Combat feel" toggle) so the MOTION is optional; the chime is separate audio
// (audio.js owns its own mute), so a reduced-motion player still hears the transaction land.
//
// PURELY presentation off the existing state.coins value — it changes NOTHING in the simulation and
// touches NO save schema (stays v18). PURE on purpose: no THREE, no DOM, no audio, no globals — the
// change-detector, the gain/spend classification, the delta formatting and the pulse curve are all
// unit-tested under `node --test` (tests/unit/coins-pulse.test.mjs); main.js owns the wiring (it feeds
// state.coins to observe() each frame, plays the chime on a real change, and paints the readout from
// the 0-draw scale()/level()/deltaText() read-outs).

import { decay } from './juice.js'; // reuse the #155 "snap-in, ease-out" pop curve — DRY, already tested

// ---- Tunables (the Graphic Designer's fun-shaping numbers) ------------------
// Ceilings, not targets — a grace note, never a fanfare.
export const PULSE_SECONDS = 0.55; // the whole pop lives this long, then it's gone (long enough to read the delta)
export const PULSE_SCALE = 0.35;   // peak extra scale on the coins number (1.0 → 1.35 at the pop's crest)

// ---- PURE helpers -----------------------------------------------------------

/**
 * Classify a coin delta into the beat it earns. A gain (delta > 0) rings bright green; a spend/loss
 * (delta < 0) ticks dull red; no change is 'none' (silent — the readout must NOT pulse every frame). Pure.
 * @param {number} delta  new coins − old coins
 * @returns {'gain'|'spend'|'none'}
 */
export function classifyDelta(delta) {
  const d = Number(delta);
  if (!Number.isFinite(d) || d === 0) return 'none';
  return d > 0 ? 'gain' : 'spend';
}

/**
 * Format a coin delta as the small floating label the player reads: "+400" on a gain, "−250" on a
 * spend (a real U+2212 MINUS SIGN, not a hyphen, so it reads as maths at a glance), "0" for no change.
 * Rounded to whole coins. Pure.
 * @param {number} delta
 * @returns {string}
 */
export function formatDelta(delta) {
  const d = Math.round(Number(delta) || 0);
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return '0';
}

/**
 * The pulse envelope in [0,1] — the classic "snap-in, ease-out" pop, borrowed from the #155 juice
 * family so the coin tick feels of a piece with the combat juice: FULL at the instant of change (the
 * number jumps + the delta flashes in), easing to 0 by `duration` (0 at and past it). Pure.
 * @param {number} elapsed  seconds since the change
 * @param {number} [duration]
 * @returns {number}
 */
export function pulseEnvelope(elapsed, duration = PULSE_SECONDS) {
  return decay(elapsed, duration);
}

// ---- Controller (wired into main.js) ---------------------------------------
//
// Owns the transient pulse state (SAVE-free — pure presentation, never persisted). main.js feeds it the
// live state.coins each frame via observe(); on a REAL change it returns { changed, kind, delta } so
// main.js can play the coin chime, and it arms an internal pop that scale()/level()/deltaText() read out
// each frame (0-draw). A prefers-reduced-motion preference OR the runtime toggle (setEnabled) suppresses
// the visual pop with zero residual motion — but observe() still CLASSIFIES the change (so the gentle
// chime can still play), and it always consumes the value so a re-enable never fires a stale delta.
//
// createCoinsPulse({ reducedMotion, enabled })

export function createCoinsPulse({ reducedMotion = false, enabled = true } = {}) {
  let last = null;   // last observed coin total (null = unseeded — the first observe seeds silently)
  let pulse = null;  // { age, kind, delta, duration } — the one live pop
  const motionOff = !!reducedMotion; // hard accessibility off (prefers-reduced-motion)
  let userOff = !enabled;            // runtime toggle off (rides the #80 "Combat feel" switch)
  // Effective master switch for the VISUAL pop: suppressed ⇒ no motion, but observe still classifies.
  function suppressed() { return motionOff || userOff; }

  /**
   * Observe this frame's coin total. Seeds silently on the first call (no pop on load), then on a REAL
   * change classifies it, arms the visual pop (unless suppressed), and returns the classification so
   * main.js can play the chime. A no-change returns silent — the readout NEVER pulses every frame.
   * @param {number} coins  the live state.coins
   * @returns {{changed:boolean, kind:'gain'|'spend'|null, delta:number}}
   */
  function observe(coins) {
    const c = Number(coins);
    if (!Number.isFinite(c)) return { changed: false, kind: null, delta: 0 };
    if (last === null) { last = c; return { changed: false, kind: null, delta: 0 }; } // seed silently
    const delta = c - last;
    if (delta === 0) return { changed: false, kind: null, delta: 0 }; // steady — silent (not every frame)
    last = c; // consume the value even while suppressed, so a re-enable can't fire a stale delta
    const kind = classifyDelta(delta); // 'gain' | 'spend' (never 'none' here — delta ≠ 0)
    if (!suppressed()) pulse = { age: 0, kind, delta, duration: PULSE_SECONDS };
    return { changed: true, kind, delta };
  }

  /** Age the live pop on the sim clock; prune it when spent. Deterministic + headless-safe. */
  function update(dt) {
    if (!pulse || !(dt > 0)) return;
    pulse.age += dt;
    if (pulse.age >= pulse.duration) pulse = null;
  }

  /** The runtime toggle. Turning it OFF clears any live pop so there's NO residual motion. */
  function setEnabled(v) {
    userOff = !v;
    if (userOff) pulse = null;
    return !userOff;
  }

  /** The extra SCALE on the coins number this frame: 1 at rest, up to 1 + PULSE_SCALE at the crest. */
  function scale() { return pulse ? 1 + PULSE_SCALE * pulseEnvelope(pulse.age, pulse.duration) : 1; }

  /** The pop LEVEL in [0,1] this frame — drives the colour mix + the floating delta's opacity. */
  function level() { return pulse ? pulseEnvelope(pulse.age, pulse.duration) : 0; }

  /** Which way the live pop leans: 'gain' (green), 'spend' (red), or null (at rest). */
  function tint() { return pulse ? pulse.kind : null; }

  /** The floating delta label this frame ("+400" / "−250"), or '' at rest. */
  function deltaText() { return pulse ? formatDelta(pulse.delta) : ''; }

  /** True while a pop is live. */
  function active() { return pulse !== null; }

  /** A plain snapshot for window.__tidewake (lets a headless gate assert a change popped/chimed). */
  function snapshot() {
    return {
      reducedMotion: motionOff,
      enabled: !userOff,
      active: active(),
      kind: tint(),
      delta: pulse ? pulse.delta : 0,
      deltaText: deltaText(),
      scale: scale(),
      level: level(),
    };
  }

  return { observe, update, setEnabled, scale, level, tint, deltaText, active, snapshot };
}
