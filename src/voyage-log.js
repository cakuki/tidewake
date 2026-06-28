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
export const EVENT_TYPES = ['landfall', 'duel', 'cannon', 'legend', 'rumour', 'encounter'];

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
    case 'duel': {
      if (!isStr(ev.foe)) return null;
      const out = { type: 'duel', foe: String(ev.foe).trim(), infamy: nonNegInt(ev.infamy), coins: nonNegInt(ev.coins) };
      if (ev.treachery) out.treachery = true; // struck under false colours (#79) — only stamped when true
      else if (ev.lawful) out.lawful = true;  // a lawful privateer win over a pirate (#91) — honest road
      return out;
    }
    case 'cannon': {
      if (!isStr(ev.foe)) return null;
      const out = { type: 'cannon', foe: String(ev.foe).trim(), infamy: nonNegInt(ev.infamy), coins: nonNegInt(ev.coins) };
      if (ev.captured) out.captured = true;   // she struck her colours — a merciful capture (#72)
      else if (ev.treachery) out.treachery = true; // an ambush under false colours (#79)
      else if (ev.lawful) out.lawful = true;  // a sanctioned pirate-hunt under true colours (#91)
      return out;
    }
    case 'legend':
      return (ev.pole === 'pirate' || ev.pole === 'governor') && isStr(ev.title)
        ? { type: 'legend', pole: ev.pole, title: String(ev.title).trim() }
        : null;
    case 'rumour':
      // A chased rumour that paid off (#112): the named port reached + the coin the tip earned.
      return isStr(ev.name)
        ? { type: 'rumour', name: String(ev.name).trim(), coins: nonNegInt(ev.coins) }
        : null;
    case 'encounter':
      // An at-sea founderer met and answered (#125): the stricken ship's name + which way you
      // leaned (rescue → Standing / plunder → Infamy + coin). `choice` decides the verse.
      if (!isStr(ev.ship)) return null;
      if (ev.choice !== 'rescue' && ev.choice !== 'plunder') return null;
      return {
        type: 'encounter', choice: ev.choice, ship: String(ev.ship).trim(),
        standing: nonNegInt(ev.standing), infamy: nonNegInt(ev.infamy), coins: nonNegInt(ev.coins),
      };
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
  rumour: [
    (e) => `You chased a tavern whisper clean to ${e.name}, and for once the rumour ran true — ${e.coins} coins the richer for trusting a hunched regular with a thirst.`,
    (e) => `A corner-table tip swore ${e.name} was worth the crossing; you went, and it was — ${e.coins} coins, and a nod to the old soak who'd called it.`,
    (e) => `Word said make for ${e.name}, so you did — and the sea, astonishingly, kept its promise: ${e.coins} coins for following a rumour to its end.`,
  ],
};

// False-colours strikes (#79) get their own treacherous verse — the smug last-second reveal.
// Chosen over the honest variant whenever the deed carries `treachery: true`.
const TREACHERY_NARRATORS = {
  duel: [
    (e) => `You hailed ${e.foe} under honest merchant colours, traded pleasantries — then traded barbs and ran up the black, all in one breath. They struck their colours weeping; ${e.infamy} infamy for the loveliest lie at sea.`,
    (e) => `${e.foe} waved you alongside, friendly as anything. A pity about the flag you swapped at the last — and the ${e.infamy} infamy you sailed off with, grinning.`,
  ],
  cannon: [
    (e) => `You crept up on ${e.foe} under merchant colours, all smiles and waving — then ran out the guns and the black flag together. ${e.foe} never saw it coming; ${e.infamy} infamy the richer for the treachery.`,
    (e) => `Old ${e.foe} took you for a humble trader right up until the broadside. The black snapped up as she went down — ${e.infamy} infamy, and not an ounce of it honest.`,
  ],
};

// Lawful privateer wins (#91) get an honest verse — the comic pride of a pirate doing GOOD,
// hunting an outlaw under true colours while the ports cheer. Chosen over the honest pool
// whenever the deed carries `lawful: true`.
const LAWFUL_NARRATORS = {
  duel: [
    (e) => `You hailed the outlaw ${e.foe} under your own true colours and shamed them off the sea — lawful work, and the harbourmaster filed it under "miracles". ${e.coins} coins and a clean conscience.`,
    (e) => `${e.foe} flew the blood-dark flag of a pirate; you flew yours honest, and out-jeered them anyway. A magistrate somewhere is delighted, and frankly so are you.`,
  ],
  cannon: [
    (e) => `You ran down the pirate ${e.foe} under honest colours and sent her under — no lie, no bluff, just lawful thunder. ${e.coins} coins from the wreck and a nod from every port that fears her name.`,
    (e) => `Old ${e.foe} was an outlaw, fair game, and you took her square under your true flag. The privateer's road: feared by pirates, toasted by governors, ${e.coins} coins the richer.`,
  ],
};

// A merciful capture (#72) sings its own verse — you broke their nerve, not their hull, and
// spared the crew. Chosen over the honest pool whenever the deed carries `captured: true`.
const CAPTURE_NARRATORS = {
  cannon: [
    (e) => `You sawed ${e.foe}'s rigging to ribbons until her nerve gave and the colours came down — you spared the crew and sailed off ${e.coins} coins the richer and a touch more respectable.`,
    (e) => `${e.foe} struck her colours rather than her keel: a beaten crew, a ${e.coins}-coin ransom, and a captain who, just this once, chose mercy over a grave.`,
  ],
};

// At-sea encounters (#125): a foundering ship met on the open water sings one of two verses by
// the CHOICE you made — the grateful rescue (Standing, the lawful road) or the cold plunder
// (Infamy + coin). Chosen by `e.choice` in composeBallad, ahead of the type-keyed NARRATORS.
const ENCOUNTER_NARRATORS = {
  rescue: [
    (e) => `You came on ${e.ship} foundering in open water and chose the hard, decent thing — hauled her crew clear and sailed off ${e.standing} standing the better, blessed in three languages.`,
    (e) => `${e.ship} was going down with souls at the rail; you took them off and asked nothing, and the ports added ${e.standing} to your good name for it.`,
    (e) => `You found ${e.ship} sinking and her people praying — so you answered, plucked them from the brine, and your standing rose ${e.standing} for a kindness the sea will remember.`,
  ],
  plunder: [
    (e) => `You found ${e.ship} wallowing and helpless, and helped yourself instead — ${e.coins} coins from her hold and ${e.infamy} infamy from the telling, and her crew left to a long cold row.`,
    (e) => `${e.ship} begged for rescue; you took her cargo. ${e.coins} coins the richer, ${e.infamy} infamy the darker, and not a saint left who'll vouch for you.`,
    (e) => `You boarded the foundering ${e.ship} and stripped her as she settled — ${e.coins} coins, ${e.infamy} infamy, and a name that now travels with a wince.`,
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
    const seen = { landfall: 0, duel: 0, cannon: 0, legend: 0, rumour: 0, encounter: 0 };
    for (const e of log) {
      // An at-sea encounter sings a rescue/plunder verse by the choice made; a treacherous fight
      // sings a false-colours verse; a lawful pirate-hunt the privateer verse; else the honest pool.
      const pool = (e.type === 'encounter' && ENCOUNTER_NARRATORS[e.choice])
        || (e.captured && CAPTURE_NARRATORS[e.type])
        || (e.treachery && TREACHERY_NARRATORS[e.type])
        || (e.lawful && LAWFUL_NARRATORS[e.type])
        || NARRATORS[e.type];
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
