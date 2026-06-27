// "The Ballad of Your Voyage" (#78) — the anecdote factory. A small, PURE, DOM-free
// voyage log + a balladeer that turns a session's systemic deeds into a short, shareable,
// in-character story. Two pure pieces (the #53 house standard; the thin DOM lives in
// src/ui/ballad.js):
//   (1) recordEvent(log, event) — append a notable deed to the log, IN ORDER, DEDUPED, CAPPED.
//   (2) composeBallad(events, opts) — compose the deeds into a handful of witty ballad lines.
// Both are deterministic and browser-free, so the whole anecdote factory unit-tests under
// `node --test` and the same composed text drives the panel AND the copy-to-clipboard share.
//
// Inspiration (DL#2): emergent-narrative "anecdote factory" — systemic rules + a little
// memory make each run a *tellable* story. The events are ones the systems already emit:
// islands discovered (#19), insult duels won (#33), cannon fights won (#59), and the
// crowned legend milestones (#46). Original work, warm + a wink of comedy (Constitution).

// Keep the log (and thus the save) tiny: the most recent deeds make the better ballad.
export const MAX_EVENTS = 60;

// The deeds the balladeer knows how to sing. A future slice can add more (best trade,
// rank climbed, ports visited) by extending NARRATORS + sanitizeEvent below.
export const EVENT_TYPES = ['landfall', 'duel', 'cannon', 'legend'];

export const BALLAD_TITLE = 'The Ballad of Your Voyage';

// When the log is empty, the balladeer still has something warm to say.
export const EMPTY_LINE =
  'Your tale is yet unwritten, Captain — but the tide is patient. '
  + 'Go raise an isle, best a rival, win a name, and come back for a verse.';

const BALLAD_FOOTER = '— sung at the rail of the Tidewake, and embellished only a little.';

function isStr(s) { return typeof s === 'string' && s.trim().length > 0; }
function nonNegInt(n) {
  const v = Math.round(Number(n));
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

/**
 * PURE — validate + normalise a raw event into a clean log entry, or null if it's junk.
 * Each known deed carries exactly the fields its verse needs; unknown types or missing
 * required strings are rejected so a stray call can never poison the ballad. Numbers are
 * coerced to safe non-negative integers. Never throws, never mutates the input.
 * @param {{type?:string}} ev
 * @returns {object|null}
 */
export function sanitizeEvent(ev) {
  if (!ev || typeof ev !== 'object') return null;
  switch (ev.type) {
    case 'landfall':
      return isStr(ev.name) ? { type: 'landfall', name: String(ev.name).trim() } : null;
    case 'duel':
      return isStr(ev.foe)
        ? { type: 'duel', foe: String(ev.foe).trim(), infamy: nonNegInt(ev.infamy), coins: nonNegInt(ev.coins) }
        : null;
    case 'cannon':
      return isStr(ev.foe)
        ? { type: 'cannon', foe: String(ev.foe).trim(), infamy: nonNegInt(ev.infamy), coins: nonNegInt(ev.coins) }
        : null;
    case 'legend':
      return (ev.pole === 'pirate' || ev.pole === 'governor') && isStr(ev.title)
        ? { type: 'legend', pole: ev.pole, title: String(ev.title).trim() }
        : null;
    default:
      return null;
  }
}

// A natural dedup key for the deeds that should only ever be told ONCE — raising an isle
// you've already raised, or earning a crown you already hold. Fights have no key: every
// foe bested is its own anecdote, even against the same-named rival.
function dedupKey(ev) {
  if (ev.type === 'landfall') return `landfall:${ev.name}`;
  if (ev.type === 'legend') return `legend:${ev.pole}`;
  return null;
}

/**
 * PURE — append a deed to the voyage log. Returns a NEW array on success (chronological
 * order preserved); returns the SAME array (a no-op) if the event is junk or a duplicate of
 * an already-recorded once-only deed. Caps the log at MAX_EVENTS by dropping the oldest, so
 * a long voyage never bloats the save. Never mutates `log`.
 * @param {Array<object>} log  the current log (treated as immutable)
 * @param {object} event       a raw event (see sanitizeEvent for accepted shapes)
 * @returns {Array<object>}
 */
export function recordEvent(log, event) {
  const base = Array.isArray(log) ? log : [];
  const ev = sanitizeEvent(event);
  if (!ev) return base;
  const key = dedupKey(ev);
  if (key && base.some((e) => dedupKey(e) === key)) return base;
  const next = base.concat([ev]);
  return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next;
}

/**
 * PURE — sanitise a whole array of events read back from storage. Drops every junk/foreign
 * entry, re-applies the once-only dedup + the cap, and preserves order — so a tampered or
 * legacy save can never feed the balladeer a malformed verse. Never throws.
 * @param {unknown} raw
 * @returns {Array<object>}
 */
export function sanitizeLog(raw) {
  if (!Array.isArray(raw)) return [];
  let out = [];
  for (const e of raw) out = recordEvent(out, e);
  return out;
}

// ---- The balladeer's voice (the CREATIVE SPARK) ---------------------------------------
// Per-deed verse pools. The variant is chosen DETERMINISTICALLY by how many of that deed
// have been sung so far, so a long voyage's ballad reads varied — but the same log always
// composes the same ballad (vital for the save, the share text, and the unit tests).

const NARRATORS = {
  landfall: [
    (e) => `You raised ${e.name} out of the haze and wrote it onto your chart — the first ever to do so, you'll swear blind in any tavern.`,
    (e) => `${e.name} hove up off the bow, and the lookout near pitched from the rigging hollering its name to the gulls.`,
    (e) => `You made landfall at ${e.name}, planted no flag and stole no goat, yet told the tale in three alehouses by nightfall.`,
  ],
  duel: [
    (e) => `You traded barbs with ${e.foe} until their crew wept into the grog — they struck their colours, and you sailed off ${e.infamy} infamy and ${e.coins} coins the richer for the sharper tongue.`,
    (e) => `${e.foe} fancied themselves witty. You corrected this misapprehension, gloriously and at length, for a tidy ${e.infamy} infamy.`,
    (e) => `A war of words with ${e.foe} ended as your wars tend to: them, speechless; you, ${e.coins} coins the heavier and grinning like a shark.`,
  ],
  cannon: [
    (e) => `You ran out the guns on ${e.foe} and sent her to the seabed in one roar of powder — ${e.coins} coins hauled dripping from the wreck.`,
    (e) => `${e.foe} chose the cannon over the jest. A poor choice: she's kindling now, and your legend swelled by ${e.infamy} infamy.`,
    (e) => `Smoke, splinters, and a hull folding like wet paper — ${e.foe} went under, and you came about ${e.infamy} infamy the more feared.`,
  ],
  legend: [
    (e) => (e.pole === 'pirate'
      ? `And the isles learned to whisper it across the water: ${e.title} — feared from one horizon clean to the other.`
      : `And the isles, with a single voice, proclaimed you ${e.title} — and meant it kindly, mostly.`),
  ],
};

const OPENING = 'Gather round and hear it sung — the ballad of a captain, a small boat, and a sea with opinions.';

function tally(events) {
  let isles = 0, fights = 0, legends = 0;
  for (const e of events) {
    if (e.type === 'landfall') isles++;
    else if (e.type === 'duel' || e.type === 'cannon') fights++;
    else if (e.type === 'legend') legends++;
  }
  return { isles, fights, legends };
}

function closingLine(events) {
  const { isles, fights, legends } = tally(events);
  const parts = [];
  if (isles) parts.push(`${isles} isle${isles === 1 ? '' : 's'} raised`);
  if (fights) parts.push(`${fights} rival${fights === 1 ? '' : 's'} bested`);
  if (legends) parts.push(`${legends} crown${legends === 1 ? '' : 's'} earned`);
  const t = parts.length ? ` (${parts.join(' · ')})` : '';
  return `So sails the voyage thus far${t} — ${events.length} deed${events.length === 1 ? '' : 's'} worth the telling, and the tide still rolling on beneath the keel.`;
}

/**
 * PURE — compose the voyage log into "The Ballad of Your Voyage": an opening, a verse per
 * deed (in order), a closing tally, and a balladeer's footer. Deterministic — the same log
 * always yields the same ballad. An empty log gets a single warm "yet unwritten" line.
 * @param {Array<object>} events  the recorded log (junk-tolerant; sanitised internally)
 * @param {{title?:string}} [opts]
 * @returns {{title:string, lines:string[], text:string}}
 *   `lines` are the body lines (no title); `text` is the full shareable block (title + body).
 */
export function composeBallad(events, opts = {}) {
  const title = isStr(opts.title) ? opts.title : BALLAD_TITLE;
  const log = sanitizeLog(events);

  let lines;
  if (log.length === 0) {
    lines = [EMPTY_LINE];
  } else {
    lines = [OPENING];
    const seen = { landfall: 0, duel: 0, cannon: 0, legend: 0 };
    for (const e of log) {
      const pool = NARRATORS[e.type];
      if (!pool) continue;
      const i = seen[e.type]++ % pool.length;
      lines.push(pool[i](e));
    }
    lines.push(closingLine(log));
    lines.push(BALLAD_FOOTER);
  }

  const text = `${title}\n\n${lines.join('\n')}`;
  return { title, lines, text };
}
