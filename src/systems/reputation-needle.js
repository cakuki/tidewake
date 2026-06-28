// Reputation needle (#132, DL #5) — the pole made PERSONAL & AUDIBLE.
//
// #126 made the WORLD mirror the Infamy↔Standing pole; this makes the player FEEL each shift the
// instant it happens. The two things a captain attends to most — their own ledger and the moment
// of change — were a silent number. This is the PURE logic behind a HUD needle that swings toward
// your pole, an audio sting, and a tiered in-character line acknowledging who you're becoming.
//
// CREATIVE SPARK (Game Designer + Sound Engineer): a reputation change should land like a struck
// bell. The needle leaps toward your pole, a short sting bites (dark/freygish for infamy, warm/bright
// for standing — echoing the #94 mode-aware bed), and the world murmurs a line about the captain
// you're turning into. Earn a name and you HEAR and SEE yourself become it.
//
// PURE on purpose — no THREE, no DOM, no AudioContext, no game state. It answers three questions:
//   (1) where should the needle point?          → needleTarget()  (signed, deadzoned like #126)
//   (2) did a felt reputation change just occur? → reputationShift()  (delta → pole/tier/cue/line)
//   (3) how does the needle ease there?          → easeNeedle()  (frame-rate-independent smoothing)
// The UI (src/ui/reputation-needle.js) and audio (src/audio.js) just follow what this decides.

// Mirror renown.js / reputation-grade.js: a 60/40 lean still reads "balanced", so the needle sits
// dead-centre until you clearly commit past the band — a slight lean is neutral.
export const BALANCE_BAND = 0.2;

// The needle pole-commitment tiers (how far along your pole you now are). Drives which
// acknowledgement line + sting intensity you get. A swing still inside the band is tier 0.
export const TIER_STIR = 0.33;   // past here: a name is forming
export const TIER_KNOWN = 0.66;  // past here: the pole owns you

function poleScore(n) {
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Where the needle should point for a ledger: a signed position in [-1, 1].
 *   > 0  → pirate (Infamy) — swings toward the feared pole
 *   < 0  → governor (Standing) — swings toward the respected pole
 *   = 0  → neutral (dead-centre; the deadzone makes a slight lean read balanced)
 * Same tilt #126 uses, deadzoned by the neutral band and smoothstep-eased so the onset is gentle
 * and full commitment reaches the pole. PURE; junk/negative scores treated as 0.
 * @param {number} infamy   pirate-path score
 * @param {number} standing governor-path score
 * @returns {number} signed needle position in [-1, 1]
 */
export function needleTarget(infamy, standing) {
  const i = poleScore(infamy), s = poleScore(standing);
  const total = i + s;
  if (total <= 0) return 0;                              // no legend yet → centred
  const tilt = (i - s) / total;                         // -1 pure governor … +1 pure pirate
  const mag = Math.abs(tilt);
  if (mag <= BALANCE_BAND) return 0;                    // still balanced → centred
  const t = (mag - BALANCE_BAND) / (1 - BALANCE_BAND);  // remap (band,1] → (0,1]
  const eased = t * t * (3 - 2 * t);                    // smoothstep — gentle onset
  return Math.sign(tilt) * eased;
}

/**
 * The categorical pole for a signed needle position (matches needleTarget's sign).
 * @param {number} pos
 * @returns {'pirate'|'governor'|'neutral'}
 */
export function needlePole(pos) {
  return pos > 0 ? 'pirate' : pos < 0 ? 'governor' : 'neutral';
}

/**
 * Pole-commitment tier from a needle magnitude: how far down the pole "who you're becoming" sits.
 * @param {number} pos signed needle position (sign ignored)
 * @returns {0|1|2} 0 = stirring/neutral · 1 = a name forming · 2 = the pole owns you
 */
export function needleTier(pos) {
  const m = Math.abs(pos);
  if (m >= TIER_KNOWN) return 2;
  if (m >= TIER_STIR) return 1;
  return 0;
}

// The needle's angular swing at full commitment (degrees off vertical). Pirate swings to +,
// governor to -. Kept modest so the pointer reads as a gauge, not a spinner.
export const NEEDLE_MAX_DEG = 46;

/**
 * Map a signed needle position to a pointer rotation in degrees (presentation helper, kept pure
 * so the gauge angle unit-tests). Clamped to the gauge's range.
 * @param {number} pos signed needle position in [-1, 1]
 * @returns {number} degrees in [-NEEDLE_MAX_DEG, NEEDLE_MAX_DEG]
 */
export function needleAngle(pos) {
  const p = Number.isFinite(pos) ? (pos < -1 ? -1 : pos > 1 ? 1 : pos) : 0;
  return p * NEEDLE_MAX_DEG;
}

// ---- The acknowledgement voice (the CREATIVE SPARK) -------------------------------------------
// Personal, in-character lines acknowledging WHO YOU'RE BECOMING — warm, witty, a wink of comedy
// (the voyage-log house tone). Keyed by pole then commitment tier; a long voyage rotates the pool
// deterministically (the UI passes how many shifts of that pole it has seen).
export const ACK_LINES = {
  pirate: [
    [ // tier 0 — a darker name is stirring
      'A darker name begins to follow your wake.',
      "The harbours have started to whisper — and not kindly.",
      'Something feared is taking shape in your shadow, Captain.',
    ],
    [ // tier 1 — a name forming
      'Ports speak your name now behind shuttered windows.',
      'Mothers point you out to children as a cautionary tale.',
      'The watch logs your sails the moment they crest the horizon.',
    ],
    [ // tier 2 — the pole owns you
      'You are the storm they warn the children about.',
      'Whole harbours hold their breath when your colours show.',
      'Your name is a thing spoken with a glance over the shoulder.',
    ],
  ],
  governor: [
    [ // tier 0 — honest folk take note
      'Honest folk are starting to nod as you pass.',
      'The dockhands have begun to mean it when they wave.',
      'A good name is taking root in your wake, Captain.',
    ],
    [ // tier 1 — your word carries
      'Your word carries weight in every harbour now.',
      'Councils ask after you; the bell rings a little gladder.',
      'Ports lay out the good grog before you ask for it.',
    ],
    [ // tier 2 — the isles would crown you
      'The isles would crown you, and gladly.',
      'They name fair winds after you in three languages.',
      'Whole towns stand a little straighter when you make port.',
    ],
  ],
};

/**
 * The acknowledgement line for a pole + tier, rotating deterministically by `seen`.
 * @param {'pirate'|'governor'} pole
 * @param {0|1|2} tier
 * @param {number} [seen] how many shifts of this pole have been seen (for variety)
 * @returns {string}
 */
export function ackLine(pole, tier, seen = 0) {
  const byTier = ACK_LINES[pole];
  if (!byTier) return '';
  const t = tier < 0 ? 0 : tier > 2 ? 2 : tier;
  const pool = byTier[t] || byTier[0];
  const n = Number.isFinite(seen) ? Math.floor(seen) : 0;
  return pool[((n % pool.length) + pool.length) % pool.length];
}

/**
 * Detect a FELT reputation change between two ledgers and resolve everything the moment needs:
 * which pole grew, the gain size, the new needle target, the commitment tier, the audio cue key,
 * and the personal acknowledgement line. Returns null when nothing meaningfully grew (a sale that
 * only moved coin, a loss, junk) so the cue only fires on a real legend shift.
 *
 * The gain is attributed to whichever pole rose MORE this step, so a kill reads pirate and a
 * rescue/trade/investment reads governor — source-agnostic, driven purely by the real deltas.
 * @param {{infamy?:number, standing?:number}} prev  the ledger before the change
 * @param {{infamy?:number, standing?:number}} next  the ledger after the change
 * @param {number} [seen] how many shifts of the resulting pole have been seen (line variety)
 * @returns {null | {pole:'pirate'|'governor', delta:number, target:number, tier:0|1|2, cue:string, line:string}}
 */
export function reputationShift(prev, next, seen = 0) {
  const pi = poleScore(prev?.infamy), ps = poleScore(prev?.standing);
  const ni = poleScore(next?.infamy), ns = poleScore(next?.standing);
  const di = ni - pi, ds = ns - ps;
  if (di <= 0 && ds <= 0) return null;       // nothing grew → no felt shift
  const pole = di >= ds ? 'pirate' : 'governor';
  const delta = pole === 'pirate' ? di : ds;
  if (delta <= 0) return null;               // the grown pole must actually be the gainer
  const target = needleTarget(ni, ns);
  const tier = needleTier(target);
  return {
    pole,
    delta,
    target,
    tier,
    cue: 'rep-' + pole,                       // audio.playRepSting(pole, tier) keys off this
    line: ackLine(pole, tier, seen),
  };
}

/**
 * Frame-rate-independent easing of the displayed needle toward its target. Exponential smoothing,
 * so the swing reads the same at 30 or 144 fps and never zippers. Snaps once within EPS.
 * @param {number} current the needle's current displayed position
 * @param {number} target  the position to ease toward
 * @param {number} dt      seconds since the last frame
 * @param {number} [rate]  smoothing rate (higher = snappier)
 * @returns {number} the next displayed position
 */
export function easeNeedle(current, target, dt, rate = 6) {
  const c = Number.isFinite(current) ? current : 0;
  const tgt = Number.isFinite(target) ? target : 0;
  const d = Number.isFinite(dt) && dt > 0 ? dt : 0;
  const k = 1 - Math.exp(-rate * d);
  const next = c + (tgt - c) * k;
  return Math.abs(tgt - next) < 1e-4 ? tgt : next;
}
