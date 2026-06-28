// Reputation needle — the HUD gauge that makes the Infamy↔Standing pole PERSONAL & audible (#132).
//
// The pole was a silent number; this is the needle that swings the instant your reputation shifts.
// A self-contained HUD component (the #53 house standard): all the decision maths is PURE and lives
// in src/systems/reputation-needle.js (unit-tested without a browser); this thin factory owns the
// gauge DOM, eases the pointer toward its target each frame, and — when a real shift lands — pulses
// the gauge, fires the audio cue (via the injected onCue, so audio stays guarded in main/audio.js),
// and murmurs a tiered in-character line about who you're becoming.
//
// CREATIVE SPARK: a gauge with the governor pole (⚖) at one shoulder and the pirate pole (⚔) at the
// other, a brass pointer resting at dead-centre while you're balanced and leaning hard toward your
// pole as you commit. Each change strikes like a bell — the pointer leaps, the dial flashes its
// pole's colour, a line names the captain you're turning into.
import {
  needleTarget, needlePole, needleTier, needleAngle, easeNeedle, reputationShift,
} from '../systems/reputation-needle.js';

/**
 * Build the live reputation needle. Finds its DOM within `root` (defaults to the whole document) and
 * returns no-ops if absent (headless/test-safe). `onCue({pole, tier, delta})` is called once per felt
 * shift so the caller can play the (guarded) audio sting; omit it for a silent gauge.
 *
 * @param {{ onCue?: (cue:{pole:string,tier:number,delta:number}) => void }} [opts]
 * @param {Document|HTMLElement} [root]
 * @returns {{ update(state:{infamy?:number,standing?:number}, dt:number):void, snapshot():object }}
 */
export function createReputationNeedle(opts = {}, root = (typeof document !== 'undefined' ? document : null)) {
  const onCue = typeof opts.onCue === 'function' ? opts.onCue : null;
  const $gauge = root && root.querySelector ? root.querySelector('#repneedle') : null;
  const $pointer = $gauge ? $gauge.querySelector('#repneedle-pointer') : null;
  const $ack = root && root.querySelector ? root.querySelector('#repneedle-ack') : null;

  // Live display state (also the QA surface). `prev` starts null so the FIRST frame (incl. a
  // restored voyage) silently ADOPTS the current ledger — we only celebrate a shift the player
  // actually causes this session, never the one implied by loading a save.
  let pos = 0;                 // the eased, currently-displayed needle position
  let target = 0;             // where it's heading
  let prev = null;            // last seen ledger { infamy, standing }
  const seen = { pirate: 0, governor: 0 }; // per-pole shift counts → line variety
  let last = null;            // the last fired shift (QA)
  let pulseUntil = 0;         // wall-clock ms the dial pulse runs until
  let ackUntil = 0;           // wall-clock ms the acknowledgement line shows until
  let lastPoleClass = '';

  function now() { return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0; }

  function showAck(line, pole) {
    if (!$ack) return;
    $ack.textContent = line;
    $ack.classList.remove('rep-pirate', 'rep-governor');
    $ack.classList.add(pole === 'pirate' ? 'rep-pirate' : 'rep-governor');
    $ack.classList.add('show');
    ackUntil = now() + 4200;
  }

  function pulse(pole) {
    if (!$gauge) return;
    $gauge.classList.remove('pulse-pirate', 'pulse-governor');
    // Force a reflow so re-adding the class restarts the CSS animation on a rapid re-shift.
    void $gauge.offsetWidth;
    $gauge.classList.add(pole === 'pirate' ? 'pulse-pirate' : 'pulse-governor');
    pulseUntil = now() + 900;
  }

  function update(state, dt) {
    const infamy = Number.isFinite(state?.infamy) ? state.infamy : 0;
    const standing = Number.isFinite(state?.standing) ? state.standing : 0;
    target = needleTarget(infamy, standing);

    // Detect a felt shift against the previous ledger (skip the very first frame — adopt silently).
    if (prev) {
      // Probe the pole first so the line can rotate by how many shifts of THAT pole we've seen.
      const probe = reputationShift(prev, { infamy, standing });
      const shift = probe && reputationShift(prev, { infamy, standing }, seen[probe.pole]);
      if (shift) {
        seen[shift.pole]++;
        last = shift;
        pulse(shift.pole);
        showAck(shift.line, shift.pole);
        if (onCue) { try { onCue({ pole: shift.pole, tier: shift.tier, delta: shift.delta }); } catch { /* a cue must never break the frame */ } }
      }
    }
    prev = { infamy, standing };

    // Ease the displayed pointer toward its target (frame-rate-independent).
    pos = easeNeedle(pos, target, Number.isFinite(dt) ? dt : 0);

    // Paint the pointer + the standing pole tint.
    if ($pointer) $pointer.setAttribute('transform', `rotate(${needleAngle(pos).toFixed(2)} 32 30)`);
    if ($gauge) {
      const poleCls = 'lean-' + needlePole(pos);
      if (poleCls !== lastPoleClass) {
        $gauge.classList.remove('lean-pirate', 'lean-governor', 'lean-neutral');
        $gauge.classList.add(poleCls);
        lastPoleClass = poleCls;
      }
    }
    // Auto-clear transient flourishes.
    const t = now();
    if ($ack && ackUntil && t > ackUntil) { $ack.classList.remove('show'); ackUntil = 0; }
    if ($gauge && pulseUntil && t > pulseUntil) { $gauge.classList.remove('pulse-pirate', 'pulse-governor'); pulseUntil = 0; }
  }

  // QA surface (exposed via window.__tidewake.needle): the live eased position, where it's heading,
  // its categorical pole + commitment tier, and the last felt shift — so a headless playtest can
  // drive the ledger and assert the needle swings + the cue fires.
  function snapshot() {
    return {
      pos,
      target,
      pole: needlePole(pos),
      tier: needleTier(pos),
      last: last ? { pole: last.pole, delta: last.delta, tier: last.tier, cue: last.cue, line: last.line } : null,
    };
  }

  return { update, snapshot };
}
