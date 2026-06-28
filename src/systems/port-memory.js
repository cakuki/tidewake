// Port memory — "The port remembers you" (#104, DL #3 theme 1). PURE, DOM-free and three.js-free
// so the whole per-town memory can be unit-tested under `node --test`. The owner wanted town to be
// a PLACE WITH A MEMORY, not a fresh stranger every landfall: each port keeps a tiny record of your
// prior dealings THERE — how many times you've tied up, and who you were last time (your local
// standing snapshot) — and reflects it back the next time you make port. Renown stops being a flat
// number and becomes a relationship that accrues, port by port.
//
// CREATIVE SPARK (Game Designer): your reputation precedes you. A port that has watched you grow
// greets you warmer each call ("back again, that's your third time alongside"); a port you left an
// honest trader and return to flying the black eyes you colder ("you sailed out a friend and come
// back under a darker flag"). The signal is LOCAL and earned — the harbourmaster remembers YOUR face,
// not just your number.
//
// The record per port is deliberately tiny + robust:
//   { visits, lastTier, lastPole }   — visit count + a snapshot of your standing as seen locally.
// FOLLOW-UPS (filed, not built here): a per-port "last deed" recalled by name (#104b), and a claimed
// "Your Harbour" home port that physically grows across sessions (the DL #3 stretch).

const POLES = new Set(['pirate', 'governor', 'neutral']);
// Bound the store so a corrupt/bloated save can never grow it without limit (only a handful of real
// ports exist; this is purely defensive). Oldest-by-insertion entries are dropped past the cap.
const MAX_PORTS = 32;

function intOf(n) {
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}
function clampTier(n) {
  const t = Number.isFinite(n) ? Math.trunc(n) : 0;
  return Math.max(0, Math.min(2, t));
}
function poleOf(p) {
  return POLES.has(p) ? p : 'neutral';
}

/**
 * A fresh, empty memory store (no port remembers you yet).
 * @returns {Object<string, {visits:number, lastTier:number, lastPole:string}>}
 */
export function freshPortMemory() {
  return {};
}

/**
 * The remembered record for one port, or a zeroed record if it's never been visited.
 * @param {object} store  the per-port memory map
 * @param {string} portName
 * @returns {{visits:number, lastTier:number, lastPole:string}}
 */
export function portRecord(store, portName) {
  const r = store && typeof store === 'object' ? store[portName] : null;
  if (!r || typeof r !== 'object') return { visits: 0, lastTier: 0, lastPole: 'neutral' };
  return { visits: intOf(r.visits), lastTier: clampTier(r.lastTier), lastPole: poleOf(r.lastPole) };
}

// ---- Recall lines: what the harbourmaster says when he REMEMBERS you. Templated with {port} and
// {n} (this visit's number). Picked deterministically by visit count so a return is reproducible
// (vital for the save-free QA hook + tests) yet rotates over many calls. Original to Tidewake. ----
const TURNED_PIRATE = [
  'You sailed out of {port} an honest trader, captain — and back you come under a darker flag. The harbourmaster\'s smile goes thin.',
  '{port} remembers a fairer sail than the black you fly now. Word travels; so does worry.',
];
const TURNED_GOVERNOR = [
  'Last time {port} saw you there was talk of trouble — but you return with your name gone respectable. The wharf relaxes.',
  '{port} eyes you afresh, captain: the rogue they recall has come back a credit to the lanes. Welcome, and well met.',
];
const RISEN = [
  'They remember you smaller at {port}, captain. You\'ve grown a name since — and the harbourmaster\'s noticed.',
  'Back at {port}, and risen since last you called. The dockhands nudge each other: "that one\'s going places."',
];
const REGULAR = [
  'Back again, captain — that\'s {n} times you\'ve tied up at {port} now. They keep your berth warm.',
  '{port} knows your sail on the horizon by now. Welcome home, near enough — your usual berth\'s clear.',
];
const FAMILIAR = [
  'Ah, you again — {port} remembers your last call. Welcome back, captain.',
  'A familiar hull at {port}. The harbourmaster gives a nod of recognition: back so soon?',
];

function pick(pool, seed) {
  return pool[((Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : 0)) % pool.length];
}

/**
 * The "remembered return" greeting for a port, given its PRIOR record and your CURRENT standing —
 * or `null` on a genuine first visit (let the normal stranger greeting play). Deterministic: the
 * same (record, current, port) always yields the same line, rotating across visits. Pure.
 *
 * Salience order — the most telling change leads: turned pirate (cooler) ▸ turned respectable
 * (warmer) ▸ risen a tier (noticed) ▸ a warm regular's welcome ▸ a plain familiar nod.
 *
 * @param {{visits:number, lastTier:number, lastPole:string}} record  PRIOR memory of this port
 * @param {{tier:number, pole:string}} current  the captain's standing right now
 * @param {string} [portName='the port']
 * @returns {string|null}
 */
export function recallLine(record, current = {}, portName = 'the port') {
  const visits = intOf(record && record.visits);
  if (visits <= 0) return null; // never been here — no memory to recall
  const curPole = poleOf(current.pole);
  const curTier = clampTier(current.tier);
  const lastPole = poleOf(record && record.lastPole);
  const lastTier = clampTier(record && record.lastTier);
  const n = visits + 1; // the number of THIS visit (prior visits + this one)

  let line;
  if (curPole === 'pirate' && lastPole !== 'pirate') line = pick(TURNED_PIRATE, visits);
  else if (curPole === 'governor' && lastPole !== 'governor') line = pick(TURNED_GOVERNOR, visits);
  else if (curTier > lastTier) line = pick(RISEN, visits);
  else if (visits >= 2) line = pick(REGULAR, visits);
  else line = pick(FAMILIAR, visits);

  return line.replace(/\{port\}/g, portName).replace(/\{n\}/g, String(n));
}

/**
 * Bank this arrival into the port's memory: bump the visit count and snapshot the captain's
 * current standing as seen locally. Returns a NEW, sanitised store (never mutates the input), so a
 * caller can assign it straight onto state and persist it. Pure.
 * @param {object} store  current per-port memory map
 * @param {string} portName  the port being entered
 * @param {{tier:number, pole:string}} current  the captain's standing at this visit
 * @returns {object} the next store
 */
export function rememberArrival(store, portName, current = {}) {
  const next = sanitizePortMemory(store);
  if (!portName || typeof portName !== 'string') return next;
  const prev = next[portName] || { visits: 0 };
  next[portName] = {
    visits: intOf(prev.visits) + 1,
    lastTier: clampTier(current.tier),
    lastPole: poleOf(current.pole),
  };
  // Re-cap after the insert (a brand-new port could push us over the bound on a corrupt save).
  return capStore(next);
}

/**
 * Sanitise a raw store read back from a save (or anywhere): keep only well-formed records with a
 * positive visit count, coerce each field to a safe value, and bound the map size. Junk → {} (a
 * memory that simply forgets, never one that crashes) — fail-open, like legends/onboarding/ballad.
 * Never throws; never mutates the input.
 * @param {unknown} raw
 * @returns {object} a clean per-port memory map
 */
export function sanitizePortMemory(raw) {
  const out = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const key of Object.keys(raw)) {
      if (typeof key !== 'string' || !key) continue;
      const r = raw[key];
      if (!r || typeof r !== 'object') continue;
      const visits = intOf(r.visits);
      if (visits <= 0) continue;
      out[key] = { visits, lastTier: clampTier(r.lastTier), lastPole: poleOf(r.lastPole) };
    }
  }
  return capStore(out);
}

// Bound the store to MAX_PORTS, dropping earliest-inserted keys past the cap (defensive only).
function capStore(store) {
  const keys = Object.keys(store);
  if (keys.length <= MAX_PORTS) return store;
  const out = {};
  for (const key of keys.slice(keys.length - MAX_PORTS)) out[key] = store[key];
  return out;
}
