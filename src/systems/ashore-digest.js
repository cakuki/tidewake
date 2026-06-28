// "While you were ashore…" digest (#105, DL #4 / Retro 11 living-world legibility line).
//
// The mode spine's whole promise is that the world keeps living underneath you while you're in town
// — but the player can't SEE that unless we tell them. This is the small PURE composer that turns
// the REAL state deltas captured at landfall (the moment town takes the screen) versus Set Sail (the
// moment you cast off) into a short, in-character digest, surfaced on the shared HUD toast as you
// leave. No new simulation: we only surface deltas the existing systems already moved — your purse
// and hold (the market, economy.js), your standing/name (renown.js), and any rumour you took up to
// chase (objectives.js). Richer offscreen world-sim (a rival sacks a named port, the navy moves)
// is filed as FOLLOW-UPS — this ships the smallest always-working, deterministic increment first.
//
// CREATIVE SPARK (Game Designer): lingering has a consequence, and casting off is when you feel it.
// The bow swings seaward and the watch reads you back what your time ashore amounted to — a fuller
// purse, a name that travels further, a heading to chase — so leaving town never feels like merely
// closing a menu. Even a quiet call gets a line: the tide rose and fell, the gulls wheeled; the world
// turned a notch whether you were watching or not.
//
// PURE on purpose — no THREE, no DOM, no wall-clock, no game-state mutation. It reads plain numbers
// off two snapshots, so it's provable under `node --test` (tests/unit/ashore-digest.test.mjs) and
// SAFE headless. main.js owns the wiring (snapshot on entering TOWN; compose + toast on Set Sail).

import { cargoUsed } from '../economy.js';
import { dominantPole, renownTier } from '../renown.js';

/** The signature title of the leaving-town digest toast. */
export const ASHORE_DIGEST_TITLE = '⚓ While you were ashore…';

const DEFAULT_MAX_LINES = 3;

function num(n) {
  return Number.isFinite(n) ? n : 0;
}

function objectiveName(objective) {
  const t = objective && typeof objective === 'object' ? objective.target : null;
  const name = t && typeof t === 'object' ? t.name : null;
  return typeof name === 'string' && name ? name : null;
}

/**
 * Capture the tiny set of delta-able fields at a mode boundary (landfall or Set Sail). PURE + robust:
 * coerces every field so a corrupt save or half-built state never throws (fail-open like the rest of
 * the loop). Derives `hold` (units carried), `tier`/`pole` (your standing as the world reads it), and
 * the name of any rumour you're currently chasing.
 * @param {object} state  the live ship/world state
 * @returns {{coins:number, hold:number, standing:number, infamy:number, renown:number, tier:number, pole:string, objective:(string|null)}}
 */
export function snapshotAshore(state) {
  const s = state && typeof state === 'object' ? state : {};
  const infamy = num(s.infamy);
  const standing = num(s.standing);
  const renown = Number.isFinite(s.renown) ? s.renown : infamy + standing;
  return {
    coins: num(s.coins),
    hold: cargoUsed(s.cargo && typeof s.cargo === 'object' ? s.cargo : null),
    standing,
    infamy,
    renown,
    tier: renownTier(renown).tier,
    pole: dominantPole(infamy, standing),
    objective: objectiveName(s.objective),
  };
}

// Ambient "the world turned a notch" lines for a quiet call — so leaving always speaks the
// living-world promise even when nothing material moved. {port} is substituted; the pick is
// deterministic per port (reproducible for the save-free QA hook + tests). Original to Tidewake.
const AMBIENT = [
  'The tide rose and fell at {port}, the gulls wheeled and settled — little\'s changed since you tied up, but the world turned all the same.',
  'A quiet call at {port}: the same hulls swing at their moorings, the same smoke off the same chimneys. The sea, though, never waited.',
  'Nothing much stirred at {port} while you were ashore — but out past the mole, the world\'s been keeping its own counsel.',
];

function ambientLine(port) {
  let seed = 0;
  for (let i = 0; i < port.length; i++) seed = (seed + port.charCodeAt(i)) | 0;
  const line = AMBIENT[Math.abs(seed) % AMBIENT.length];
  return line.replace(/\{port\}/g, port);
}

function normSnap(snap) {
  if (snap && typeof snap === 'object') return snap;
  return { coins: 0, hold: 0, standing: 0, infamy: 0, renown: 0, tier: 0, pole: 'neutral', objective: null };
}

/**
 * Compose the "while you were ashore…" digest from the landfall→Set-Sail deltas. Returns a titled,
 * always-non-empty list of in-character lines in salience order (most telling first), trimmed to
 * `max`. A genuinely quiet visit gets a single deterministic ambient line. PURE + deterministic:
 * the same (before, after, opts) always yields the same digest.
 * @param {object} before  snapshotAshore() at landfall
 * @param {object} after   snapshotAshore() at Set Sail
 * @param {{port?:string, max?:number}} [opts]
 * @returns {{title:string, lines:string[]}}
 */
export function composeAshoreDigest(before, after, opts = {}) {
  const port = (opts && typeof opts.port === 'string' && opts.port) ? opts.port : 'the port';
  const max = Number.isFinite(opts && opts.max) ? Math.max(1, Math.trunc(opts.max)) : DEFAULT_MAX_LINES;
  const b = normSnap(before);
  const a = normSnap(after);
  const lines = [];

  // 1. Identity — turning to a darker (or more respectable) name is the most telling change.
  if (a.pole !== b.pole && a.pole === 'pirate') {
    lines.push(`You came ashore at ${port} an honest enough sail and cast off under a darker name — the wharf marks the change.`);
  } else if (a.pole !== b.pole && a.pole === 'governor') {
    lines.push(`Your name's gone respectable since you tied up at ${port} — the lawful lanes will hear of it.`);
  }

  // 2. Reputation rise — a tier climbed ashore; the going rates here warm to a known captain (#renown
  // price modifier is tier-keyed, so a tier climb IS a real "price drift at this port").
  if (a.tier > b.tier) {
    lines.push(`Word of your dealings runs ahead of you now — you cut a greater figure leaving ${port}, and the going rates here have warmed to your name.`);
  }

  // 3. A heading taken — a rumour you chose to chase while ashore (newly set, not one already running).
  if (a.objective && a.objective !== b.objective) {
    lines.push(`You cast off with word to chase — a heading set for ${a.objective}.`);
  }

  // 4. The purse — what your dealings at the market came to.
  const dc = a.coins - b.coins;
  if (dc !== 0) {
    const mag = Math.abs(dc);
    const unit = mag === 1 ? 'coin' : 'coins';
    lines.push(`Your dealings at ${port} leave your purse ${mag} ${unit} ${dc > 0 ? 'heavier' : 'lighter'}.`);
  } else if (a.hold !== b.hold) {
    lines.push(`Your hold rode out of ${port} stowed different than it came in.`);
  }

  if (lines.length === 0) return { title: ASHORE_DIGEST_TITLE, lines: [ambientLine(port)] };
  return { title: ASHORE_DIGEST_TITLE, lines: lines.slice(0, max) };
}
