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
//   { visits, lastTier, lastPole, lastDeed? }
//   — visit count + a snapshot of your standing as seen locally + (optional) the SPECIFIC last
//   notable thing you did at/near this port, remembered BY NAME (#104b).
//
// #104b deepens "the port remembers you": a return greeting now recalls your LAST NOTABLE DEED there
// by name ("they've not forgotten the day you sent the Black Gull to the seabed in these waters"),
// not just a warm/cool tone — and the most-visited port is recognised as your HOME PORT (the seed of
// the DL #3 "Your Harbour" stretch, filed in full as a follow-up). Deed + home both ride the same
// tiny per-port record so they persist in the existing save store (fail-open, additive).

const POLES = new Set(['pirate', 'governor', 'neutral']);
// Bound the store so a corrupt/bloated save can never grow it without limit (only a handful of real
// ports exist; this is purely defensive). Oldest-by-insertion entries are dropped past the cap.
const MAX_PORTS = 32;
// A remembered deed is a short phrase; cap it so a tampered save can't bloat the store with prose.
const MAX_DEED = 160;
// A port you've tied up at this many times (or more) is recognisably YOURS — your home port (#104b
// seed of "Your Harbour"). Two calls is a regular; three is home water.
export const HOME_MIN_VISITS = 3;

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
// A clean remembered-deed phrase, or '' if there's nothing worth recalling. Trimmed + capped so a
// stray/huge value can never poison a greeting; never throws.
function deedOf(s) {
  if (typeof s !== 'string') return '';
  const t = s.trim();
  return t ? t.slice(0, MAX_DEED) : '';
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
  const rec = { visits: intOf(r.visits), lastTier: clampTier(r.lastTier), lastPole: poleOf(r.lastPole) };
  const deed = deedOf(r.lastDeed);
  if (deed) rec.lastDeed = deed; // only carried when there's a specific memory (keeps the record tiny)
  return rec;
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
// ---- #104b: the SPECIFIC memory. When a port remembers a named deed, that leads — a place that
// recalls WHAT you did there, not just whether it liked you. {deed} is the remembered phrase. ----
const DEED_RETURN = [
  'Back at {port}, captain — and they\'ve not forgotten {deed}. Your name carries weight on this wharf.',
  '{port} knows you, right enough: still talk on the quay of {deed}. The harbourmaster grins and waves you in.',
];
// You\'ve never docked here, yet a deed in these waters means your reputation arrived first (#104 verb).
const DEED_PRECEDES = [
  'First time you\'ve tied up at {port}, captain — but word reached here ahead of you: {deed}. You\'re no stranger after all.',
  'You\'ve never made {port} before, yet the wharf already murmurs of it: {deed}. Your reputation sails faster than you do.',
];
// ---- #104b: your HOME PORT — the seed of "Your Harbour". A port you frequent greets you as one of
// their own; if it also remembers a deed, all the warmer. ----
const HOME_DEED = [
  '{port} again — near enough your own harbour now, and proud of it: {deed}. The whole quay turns out to wave you in.',
  'Home water, captain — {port} keeps your berth, your name, and the tale of {deed}. Welcome back where you belong.',
];
const HOME = [
  '{port} has become your harbour, captain — {n} calls now, and the quay greets you like one of their own.',
  'Your colours are known on sight at {port}; near enough a home port. Your usual berth\'s kept clear, as ever.',
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
 * Salience order — the most TELLING signal leads: a remembered deed BY NAME (#104b) ▸ your home
 * port's warm welcome ▸ turned pirate (cooler) ▸ turned respectable (warmer) ▸ risen a tier
 * (noticed) ▸ a warm regular's welcome ▸ a plain familiar nod. A deed even precedes you at a port
 * you've never docked at (visits 0) — "your reputation precedes you" (the #104 verb).
 *
 * @param {{visits:number, lastTier:number, lastPole:string, lastDeed?:string}} record  PRIOR memory
 * @param {{tier:number, pole:string}} current  the captain's standing right now
 * @param {string} [portName='the port']
 * @param {{home?:boolean}} [opts]  home=true → this is the captain's most-visited home port (#104b)
 * @returns {string|null}
 */
export function recallLine(record, current = {}, portName = 'the port', opts = {}) {
  const visits = intOf(record && record.visits);
  const deed = deedOf(record && record.lastDeed);
  if (visits <= 0 && !deed) return null; // never been here, no deed in these waters — a true stranger
  const home = !!(opts && opts.home);
  const curPole = poleOf(current.pole);
  const curTier = clampTier(current.tier);
  const lastPole = poleOf(record && record.lastPole);
  const lastTier = clampTier(record && record.lastTier);
  const n = visits + 1; // the number of THIS visit (prior visits + this one)

  let line;
  if (deed) {
    // The specific memory is the headline of #104b — the port recalls WHAT you did, by name.
    line = pick(home ? HOME_DEED : (visits > 0 ? DEED_RETURN : DEED_PRECEDES), visits);
  } else if (home) line = pick(HOME, visits);
  else if (curPole === 'pirate' && lastPole !== 'pirate') line = pick(TURNED_PIRATE, visits);
  else if (curPole === 'governor' && lastPole !== 'governor') line = pick(TURNED_GOVERNOR, visits);
  else if (curTier > lastTier) line = pick(RISEN, visits);
  else if (visits >= 2) line = pick(REGULAR, visits);
  else line = pick(FAMILIAR, visits);

  return line.replace(/\{port\}/g, portName).replace(/\{n\}/g, String(n)).replace(/\{deed\}/g, deed);
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
  const rec = {
    visits: intOf(prev.visits) + 1,
    lastTier: clampTier(current.tier),
    lastPole: poleOf(current.pole),
  };
  const deed = deedOf(prev.lastDeed);
  if (deed) rec.lastDeed = deed; // a remembered deed survives later visits (#104b)
  next[portName] = rec;
  // Re-cap after the insert (a brand-new port could push us over the bound on a corrupt save).
  return capStore(next);
}

/**
 * Record a SPECIFIC notable deed at/near a port, remembered BY NAME (#104b). Sets the port's
 * `lastDeed` (the newest deed wins — a port recalls your *latest* exploit) WITHOUT bumping the visit
 * count, so a deed done in a port's waters can be remembered even before you next make landfall there
 * (your reputation precedes you — the #104 verb). Returns a NEW, sanitised store; never mutates the
 * input. A junk port name or empty deed is a no-op. Pure.
 * @param {object} store  current per-port memory map
 * @param {string} portName  the port that witnessed/heard of the deed
 * @param {string} deed  a short remembered phrase (e.g. "the day you sank the Black Gull in these waters")
 * @returns {object} the next store
 */
export function recordDeed(store, portName, deed) {
  const next = sanitizePortMemory(store);
  const phrase = deedOf(deed);
  if (!portName || typeof portName !== 'string' || !phrase) return next;
  const prev = next[portName] || { visits: 0 };
  next[portName] = {
    visits: intOf(prev.visits),
    lastTier: clampTier(prev.lastTier),
    lastPole: poleOf(prev.lastPole),
    lastDeed: phrase,
  };
  return capStore(next);
}

// ---- Turning a systemic deed into the short phrase a PORT would remember (#104b). PURE: maps a
// voyage-log-style event (combat win / chased-rumour payoff) onto a terse, in-character memory
// phrase, framed from the port's vantage ("in these waters", "off this very wharf"). Returns '' for
// anything not worth a harbourmaster's memory. Original to Tidewake. ----
function isStr(s) { return typeof s === 'string' && s.trim().length > 0; }
export function deedPhrase(event) {
  if (!event || typeof event !== 'object') return '';
  const foe = isStr(event.foe) ? event.foe.trim() : '';
  switch (event.type) {
    case 'cannon':
      if (!foe) return '';
      if (event.captured) return `how you ran down ${foe} and spared her crew off this very wharf`;
      if (event.treachery) return `the black flag you sprang on ${foe} in these waters`;
      if (event.lawful) return `the day you sank the outlaw ${foe} in these waters, lawful and square`;
      return `the day you sent ${foe} to the seabed in these waters`;
    case 'duel':
      if (!foe) return '';
      if (event.treachery) return `the merchant's smile you wore until you out-jeered ${foe} off this wharf`;
      if (event.lawful) return `how you shamed the outlaw ${foe} off the sea within sight of the quay`;
      return `how you out-jeered ${foe} to silence within sight of the wharf`;
    case 'rumour':
      // A contested rumour (#133): the port remembers the RACE — won or lost to a named rival.
      if (isStr(event.rival)) {
        return event.won
          ? `the day you outran ${event.rival.trim()} to a prize the whole coast wanted`
          : `the day ${event.rival.trim()} beat you to the prize by a single tide`;
      }
      return 'the tavern tip that paid off the very moment you made port';
    default:
      return '';
  }
}

/**
 * The captain's HOME PORT (#104b seed of "Your Harbour"): the most-visited port, once it's been
 * called at HOME_MIN_VISITS+ times — a place frequented enough to be recognisably *yours*. Ties
 * break by name (ascending) so the pick is fully deterministic regardless of insertion order.
 * Returns the port name, or null if no port yet clears the bar. Pure; never throws.
 * @param {object} store  the per-port memory map
 * @returns {string|null}
 */
export function homePort(store) {
  const clean = sanitizePortMemory(store);
  let best = null, bestVisits = 0;
  for (const name of Object.keys(clean)) {
    const v = intOf(clean[name].visits);
    if (v < HOME_MIN_VISITS) continue;
    if (v > bestVisits || (v === bestVisits && best !== null && name < best)) {
      best = name; bestVisits = v;
    }
  }
  return best;
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
      const deed = deedOf(r.lastDeed);
      // Keep a record that's worth something: a real visit OR a deed the port remembers (#104b — a
      // deed in a port's waters survives even before you next dock there). Pure flotsam is dropped.
      if (visits <= 0 && !deed) continue;
      const rec = { visits, lastTier: clampTier(r.lastTier), lastPole: poleOf(r.lastPole) };
      if (deed) rec.lastDeed = deed; // only carried when present (keeps clean records tiny)
      out[key] = rec;
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
