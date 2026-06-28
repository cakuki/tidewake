// Objectives (#115, DL#4 keystone) — the small PURE typed-target model that turns a chosen
// rumour into a tracked sea objective. ONE source of truth the marker (#111), the arrival-
// detection + payoff (#112) and (later) the ashore digest (#105) all read, instead of each
// re-parsing rumour PROSE. Pure, DOM-free and three.js-free, so the whole lifecycle unit-tests
// under `node --test` and the same inputs always resolve the same way (vital for the QA hook
// and the save round-trip).
//
// An objective is a tiny plain object:
//   { kind, target:{ kind, name, x?, z? }, payoff:{ coins }, status }
// where the outer `kind` is the objective family ('rumour' for now), `target` is the typed
// world-target (a port to make / an isle to raise / a patch of sea), `payoff` is the
// deterministic reward banked on resolve, and `status` is 'active' | 'done'.
//
// CREATIVE SPARK (Game Designer): "chasing" a rumour should be a real VERB — the tip becomes a
// pin you steer toward and a coin in the palm when you make port. Modest + deterministic, so
// listening is worth the visit without ever becoming a coin printer. This slice ships ONE rumour
// type end-to-end (a trade tip → a port target); richer rewards + more target kinds are filed.

// The world-target kinds the model knows. Only 'port' is chase-able END-TO-END this slice
// (it names a real harbour with coords + a dock we already detect arrival at); the others are
// reserved so battle/isle objectives slot into the same struct later without a reshape.
export const TARGET_KINDS = new Set(['port', 'isle', 'sea']);

// The deterministic bounty a chased trade rumour pays on arrival. Modest by design (~a tidy
// trade-run's edge), so the tip rewards the detour without grinding. Trade tips only, for now.
export const RUMOUR_REWARD_COINS = 60;

// ---- Contested rumours (#133, DL #5) ----------------------------------------------------------
// Some chased rumours are CONTESTED: a rival captain is racing you for the same bounty on a soft,
// SEEDED clock (distance/time-keyed, NOT wall-clock — the #125 standard). Sail straight there and
// you win it as normal (+ a "you beat them to it" beat); dawdle ashore on errands or take the long
// way and the rival closes the gap — when the clock runs out they CLAIM it first, and you arrive to
// find the prize gone (a wry "beaten to it" line, no reward). All of it is pure + deterministic, so
// the clock + claim/resolve logic unit-tests under node and the same chase always plays the same.
//
// CREATIVE SPARK (Game Designer): the still rumour becomes a real DECISION — chase now, or finish
// your business and risk arriving to a rival's smug wake. The rival is a NAMED, recurring antagonist
// (seeded off the target), so the sea remembers who keeps beating you to the punch — and hands battle
// (#100, owner-held) a ready-made grudge to cash in later. Richer rival behaviour (a visible sail,
// interception) is filed as a follow-up, not built here.

// A pool of named rival captains. The pick is SEEDED off the contested target, so the same rumour
// always names the same rival — a recurring antagonist, not a faceless timer. Original to Tidewake.
export const RIVAL_NAMES = [
  'Captain Mordecai Vane', 'Bess "Blackjib" Calloway', 'Silas Thorne',
  'Captain Ruan Dega', 'Esme "the Gull" Hark', 'Lorcan Ashgrave',
];

// The soft clock: a contested chase is allotted GRACE seconds of slack plus the time a rival sailing
// at PACE would need to cover the distance. PACE sits below the player's cruise speed (MAX_SPEED 55),
// so a DIRECT run beats the rival comfortably, while lingering/detours burn the budget down. Clamped
// so neither a doorstep target (too tight to be fair) nor a far one (too long to matter) breaks.
const CONTEST_PACE = 26;       // the rival's effective speed (world units / sim-second)
const CONTEST_GRACE = 14;      // seconds of slack to peel off the berth and find the wind
const CONTEST_MIN_BUDGET = 24; // a near target still gives a fair shot
const CONTEST_MAX_BUDGET = 420;

function strHash(s) {
  let h = 0; const str = String(s == null ? '' : s);
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function seedOf(seed) {
  return (typeof seed === 'number' && Number.isFinite(seed)) ? Math.abs(Math.trunc(seed)) : strHash(seed);
}

function isStr(s) { return typeof s === 'string' && s.trim().length > 0; }
function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
function nonNegInt(n) { const v = Math.round(Number(n)); return Number.isFinite(v) && v >= 0 ? v : 0; }

/**
 * PURE — clean a raw typed target into `{ kind, name, x?, z? }`, or null if junk. Coords are
 * optional (carried only when both are finite) so a target can be authored before it's placed.
 * Never throws, never mutates the input.
 * @param {unknown} raw
 * @returns {{kind:string, name:string, x?:number, z?:number}|null}
 */
export function sanitizeTarget(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!TARGET_KINDS.has(raw.kind)) return null;
  if (!isStr(raw.name)) return null;
  const out = { kind: raw.kind, name: String(raw.name).trim() };
  if (finite(raw.x) && finite(raw.z)) { out.x = raw.x; out.z = raw.z; }
  return out;
}

/**
 * PURE — build an ACTIVE objective from a typed target (+ optional payoff override). Returns
 * null if the target is junk. Deterministic; never mutates inputs.
 * @param {object} target  a typed target (see sanitizeTarget)
 * @param {{coins?:number}} [opts]  override the default payoff
 * @returns {{kind:string, target:object, payoff:{coins:number}, status:'active'}|null}
 */
export function makeObjective(target, opts = {}) {
  const t = sanitizeTarget(target);
  if (!t) return null;
  const coins = finite(opts.coins) ? nonNegInt(opts.coins) : RUMOUR_REWARD_COINS;
  return { kind: 'rumour', target: t, payoff: { coins }, status: 'active' };
}

/**
 * PURE — does arriving at `portName` RESOLVE this objective? Only an ACTIVE port-target
 * objective whose name matches exactly resolves. Never throws.
 * @param {object|null} objective
 * @param {string} portName
 * @returns {boolean}
 */
export function resolvesAt(objective, portName) {
  if (!objective || objective.status !== 'active') return false;
  const t = objective.target;
  if (!t || t.kind !== 'port') return false;
  return isStr(portName) && t.name === portName;
}

/**
 * PURE — the payoff banked for resolving this objective: `{ coins }`. Zero for a junk or
 * non-active objective (so a double-resolve can never double-pay). Never throws.
 * @param {object|null} objective
 * @returns {{coins:number}}
 */
export function payoffFor(objective) {
  if (!objective || objective.status !== 'active') return { coins: 0 };
  // A contested rumour the rival has already CLAIMED pays nothing — you arrived to find it gone (#133).
  if (isClaimed(objective)) return { coins: 0 };
  return { coins: (objective.payoff && nonNegInt(objective.payoff.coins)) || 0 };
}

/**
 * PURE — mark an objective resolved, returning a NEW object (status 'done'). Never mutates the
 * input; null-safe.
 * @param {object|null} objective
 * @returns {object|null}
 */
export function resolveObjective(objective) {
  if (!objective || typeof objective !== 'object') return null;
  return { ...objective, status: 'done' };
}

/**
 * PURE — sanitise an objective read back from storage (or anywhere) into a clean ACTIVE
 * objective, or null. Only an ACTIVE objective is worth tracking/persisting; a done/!active or
 * junk objective loads as null (no marker, no pending payoff) — fail open, never throws.
 * @param {unknown} raw
 * @returns {object|null}
 */
export function sanitizeObjective(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.status !== 'active') return null;
  const t = sanitizeTarget(raw.target);
  if (!t) return null;
  const coins = (raw.payoff && nonNegInt(raw.payoff.coins)) || 0;
  const out = { kind: 'rumour', target: t, payoff: { coins }, status: 'active' };
  // Contested rumour (#133): preserve the rival + soft-clock state so a reload keeps the race
  // honest (you can't reset the clock by reloading). A junk contest fails open to a plain chase.
  const contest = sanitizeContest(raw.contest);
  if (contest) out.contest = contest;
  return out;
}

// ---- Contested-rumour pure logic (#133) -------------------------------------------------------

/**
 * PURE — deterministically name the rival racing you for a contested target. The same seed (the
 * target name, or a number) always names the same captain — a recurring antagonist. Never throws.
 * @param {string|number} seed
 * @returns {string}
 */
export function pickRival(seed) {
  return RIVAL_NAMES[seedOf(seed) % RIVAL_NAMES.length];
}

/**
 * PURE — the soft-clock budget (sim-seconds) a contested chase is allotted, from the distance to
 * the target. Clamped to [CONTEST_MIN_BUDGET, CONTEST_MAX_BUDGET]. Deterministic; never throws.
 * @param {number} distance  world-units from the chase origin to the target
 * @returns {number}
 */
export function contestBudget(distance) {
  const d = finite(distance) && distance > 0 ? distance : 0;
  const raw = CONTEST_GRACE + d / CONTEST_PACE;
  return Math.max(CONTEST_MIN_BUDGET, Math.min(CONTEST_MAX_BUDGET, raw));
}

/**
 * PURE — should the rumour with this seed be contested? Deterministic; ~1 in 3 chase-able rumours
 * draw a rival, so a contested chase is a notable event, not the every-time default. Never throws.
 * @param {string|number} seed
 * @returns {boolean}
 */
export function shouldContest(seed) {
  return (seedOf(seed) % 3) === 0;
}

/**
 * PURE — clean a raw contest sub-object read back from storage into `{ rival, budget, elapsed,
 * claimed }`, or null if junk (→ a plain, uncontested chase). `claimed` is re-derived from the
 * clock so a tampered flag can't un-claim a run-out race. Never throws, never mutates.
 * @param {unknown} raw
 * @returns {{rival:string, budget:number, elapsed:number, claimed:boolean}|null}
 */
export function sanitizeContest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!isStr(raw.rival)) return null;
  const budget = finite(raw.budget) && raw.budget > 0 ? raw.budget : 0;
  if (budget <= 0) return null;
  const elapsed = finite(raw.elapsed) && raw.elapsed >= 0 ? raw.elapsed : 0;
  const claimed = !!raw.claimed || elapsed >= budget;
  return { rival: String(raw.rival).trim(), budget, elapsed, claimed };
}

/**
 * PURE — build a CONTESTED active rumour objective: a normal objective plus a `{ rival, budget,
 * elapsed:0, claimed:false }` soft clock. The rival is seeded off the target (recurring), the
 * budget from the distance (opts.distance, or computed from the target coords + opts.fromX/fromZ).
 * Returns null on a junk target. Deterministic; never mutates inputs.
 * @param {object} target  a typed target (see sanitizeTarget)
 * @param {{coins?:number, rival?:string, distance?:number, fromX?:number, fromZ?:number, budget?:number}} [opts]
 * @returns {object|null}
 */
export function makeContestedObjective(target, opts = {}) {
  const base = makeObjective(target, opts);
  if (!base) return null;
  const t = base.target;
  const distance = finite(opts.distance) ? opts.distance
    : (finite(t.x) && finite(t.z) && finite(opts.fromX) && finite(opts.fromZ)
      ? Math.hypot(t.x - opts.fromX, t.z - opts.fromZ) : 0);
  const rival = isStr(opts.rival) ? String(opts.rival).trim() : pickRival(t.name);
  const budget = finite(opts.budget) && opts.budget > 0 ? opts.budget : contestBudget(distance);
  base.contest = { rival, budget, elapsed: 0, claimed: false };
  return base;
}

/**
 * PURE — advance a contested objective's soft clock by `dt` sim-seconds, returning a NEW objective
 * (the rival claims it the moment `elapsed` reaches `budget`). A no-op (returns the SAME object) for
 * a non-contested / resolved / already-claimed objective or a non-positive dt. Never mutates inputs.
 * @param {object|null} objective
 * @param {number} dt  sim-seconds elapsed this step
 * @returns {object|null}
 */
export function tickContest(objective, dt) {
  if (!objective || objective.status !== 'active') return objective;
  const c = objective.contest;
  if (!c || c.claimed) return objective;
  const step = finite(dt) && dt > 0 ? dt : 0;
  if (step === 0) return objective;
  const elapsed = c.elapsed + step;
  return { ...objective, contest: { ...c, elapsed, claimed: elapsed >= c.budget } };
}

/** PURE — is this objective a contested rumour (carries a rival + soft clock)? Null-safe. */
export function isContested(objective) {
  return !!(objective && objective.contest && typeof objective.contest === 'object' && objective.contest.rival);
}

/** PURE — has the rival already CLAIMED this contested prize (the clock ran out)? Null-safe. */
export function isClaimed(objective) {
  return !!(objective && objective.contest && objective.contest.claimed);
}

/** PURE — the name of the rival racing you for this objective, or null if uncontested. Null-safe. */
export function rivalName(objective) {
  return isContested(objective) ? objective.contest.rival : null;
}

/** PURE — sim-seconds left on the soft clock before the rival claims it, or null if uncontested. */
export function contestRemaining(objective) {
  if (!isContested(objective)) return null;
  const c = objective.contest;
  return Math.max(0, c.budget - c.elapsed);
}
