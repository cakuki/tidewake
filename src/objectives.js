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
  return { kind: 'rumour', target: t, payoff: { coins }, status: 'active' };
}
