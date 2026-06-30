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
export const EVENT_TYPES = ['landfall', 'duel', 'cannon', 'legend', 'rumour', 'encounter', 'harbour', 'governorship', 'morale'];

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
    case 'rumour': {
      // A chased rumour that paid off (#112): the named port reached + the coin the tip earned.
      // A CONTESTED rumour (#133) also carries the named `rival` you raced + whether you `won`
      // (arrived in time) or were beaten to it — which decides the verse.
      if (!isStr(ev.name)) return null;
      const out = { type: 'rumour', name: String(ev.name).trim(), coins: nonNegInt(ev.coins) };
      if (isStr(ev.rival)) { out.rival = String(ev.rival).trim(); out.won = !!ev.won; }
      return out;
    }
    case 'encounter':
      // An at-sea founderer met and answered (#125): the stricken ship's name + which way you
      // leaned (rescue → Standing / plunder → Infamy + coin). `choice` decides the verse.
      if (!isStr(ev.ship)) return null;
      if (ev.choice !== 'rescue' && ev.choice !== 'plunder') return null;
      return {
        type: 'encounter', choice: ev.choice, ship: String(ev.ship).trim(),
        standing: nonNegInt(ev.standing), infamy: nonNegInt(ev.infamy), coins: nonNegInt(ev.coins),
      };
    case 'harbour':
      // Your Harbour (#118): you claimed a home port, or grew it a tier. `deed` decides the verse;
      // `port` is the home water and `level` its growth tier.
      if (ev.deed !== 'claim' && ev.deed !== 'grow') return null;
      return isStr(ev.port)
        ? { type: 'harbour', deed: ev.deed, port: String(ev.port).trim(), level: nonNegInt(ev.level) }
        : null;
    case 'governorship':
      // The home-isle governorship (#119): the lawful arc's NAMED capstone — the home port you
      // raised + the title the isle crowned you with. The mirror of the `legend` crown verse.
      return isStr(ev.port) && isStr(ev.title)
        ? { type: 'governorship', port: String(ev.port).trim(), title: String(ev.title).trim() }
        : null;
    case 'morale':
      // A crew-morale CROSSING the voyage will remember (#124): the loyalty meter dipped past a felt
      // threshold — the grumble ('low') or the mutiny-risk brush ('mutiny'). Only the two downward
      // edges the morale system actually rings are sung; each crossing is its own anecdote (no dedup),
      // since a crew can slump, be won back, and slump again across one voyage.
      return (ev.tier === 'low' || ev.tier === 'mutiny')
        ? { type: 'morale', tier: ev.tier }
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
  // Your Harbour (#118): a claim and each growth tier is sung once — never twice on a reload.
  if (ev.type === 'harbour') return `harbour:${ev.deed}:${ev.port}:${ev.level}`;
  // Governorship (#119): the named home-isle crown is sung once per isle — never twice on a reload.
  if (ev.type === 'governorship') return `governorship:${ev.port}`;
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
    (e) => (e.pole === 'pirate'
      ? `They stopped saying your name in the open after a while; ${e.title}, they'd murmur, and bolt the shutters against the tide.`
      : `Children were named for you that year, and a fair-day too — ${e.title}, the ports agreed, and toasted you in the good rum.`),
    (e) => (e.pole === 'pirate'
      ? `Somewhere a clerk struck your true name from the rolls and wrote only ${e.title} — for the rolls, too, had learned to be afraid.`
      : `A statue, they threatened, though you talked them down to a plaque: ${e.title}, it reads, and the gulls respect it not at all.`),
  ],
  rumour: [
    (e) => `You chased a tavern whisper clean to ${e.name}, and for once the rumour ran true — ${e.coins} coins the richer for trusting a hunched regular with a thirst.`,
    (e) => `A corner-table tip swore ${e.name} was worth the crossing; you went, and it was — ${e.coins} coins, and a nod to the old soak who'd called it.`,
    (e) => `Word said make for ${e.name}, so you did — and the sea, astonishingly, kept its promise: ${e.coins} coins for following a rumour to its end.`,
  ],
  // Your Harbour (#118): the governor pole's payoff — you don't take a place, you RAISE one.
  harbour: [
    (e) => (e.deed === 'claim'
      ? `You claimed ${e.port} as your own home water, your colours run up over the quay — and for once a captain came not to plunder a port, but to keep one.`
      : `You poured your coin into ${e.port} and watched it rise — new jetties, fuller berths, lamps lit early for your homecoming, all of it bearing your name.`),
    (e) => (e.deed === 'claim'
      ? `At ${e.port} you carved your name into the harbour post and called it home; the wharf, against all pirate custom, was glad of it.`
      : `${e.port} prospered another notch under your hand — they'll tell their grandchildren the harbour grew the day your sails came in.`),
    (e) => (e.deed === 'claim'
      ? `You dropped anchor at ${e.port} and, for the first time, meant to stay — a home water at last, and the harbourmaster left the lamp lit just in case.`
      : `Coin in, ${e.port} out: another quay, another berth, another reason for the chandler to wave you in by name and not by bounty.`),
  ],
  // Governorship (#119): the lawful arc's NAMED capstone — the mirror of the legend crown, sung for
  // the very isle you raised. Warm grandeur with a wink.
  governorship: [
    (e) => `And the isles laid down their ledgers to make it law: ${e.title}. You did not seize the place — you raised it from a bare berth, and ${e.port} crowned you for the building.`,
    (e) => `${e.port} put it to a vote it could not lose and named you ${e.title} — a pirate-turned-patron, the wharf still half-amazed it had wagered right.`,
    (e) => `They struck a seal and a sash and a deal of speeches, and made you ${e.title} of ${e.port} — the rarest legend at sea: the one who stayed to govern what he found.`,
  ],
};

// False-colours strikes (#79) get their own treacherous verse — the smug last-second reveal.
// Chosen over the honest variant whenever the deed carries `treachery: true`.
const TREACHERY_NARRATORS = {
  duel: [
    (e) => `You hailed ${e.foe} under honest merchant colours, traded pleasantries — then traded barbs and ran up the black, all in one breath. They struck their colours weeping; ${e.infamy} infamy for the loveliest lie at sea.`,
    (e) => `${e.foe} waved you alongside, friendly as anything. A pity about the flag you swapped at the last — and the ${e.infamy} infamy you sailed off with, grinning.`,
    (e) => `You played the meek trader to ${e.foe} until the very last word, then dropped the act and the false colours both — ${e.infamy} infamy, and a story they tell with a shudder.`,
  ],
  cannon: [
    (e) => `You crept up on ${e.foe} under merchant colours, all smiles and waving — then ran out the guns and the black flag together. ${e.foe} never saw it coming; ${e.infamy} infamy the richer for the treachery.`,
    (e) => `Old ${e.foe} took you for a humble trader right up until the broadside. The black snapped up as she went down — ${e.infamy} infamy, and not an ounce of it honest.`,
    (e) => `A friendly hail, a friendly course, a friendly nothing — until ${e.foe} was abeam and the guns spoke before the flag could. ${e.infamy} infamy, earned the crooked way.`,
  ],
};

// Lawful privateer wins (#91) get an honest verse — the comic pride of a pirate doing GOOD,
// hunting an outlaw under true colours while the ports cheer. Chosen over the honest pool
// whenever the deed carries `lawful: true`.
const LAWFUL_NARRATORS = {
  duel: [
    (e) => `You hailed the outlaw ${e.foe} under your own true colours and shamed them off the sea — lawful work, and the harbourmaster filed it under "miracles". ${e.coins} coins and a clean conscience.`,
    (e) => `${e.foe} flew the blood-dark flag of a pirate; you flew yours honest, and out-jeered them anyway. A magistrate somewhere is delighted, and frankly so are you.`,
    (e) => `Letter of marque in hand, you called ${e.foe} to account with words alone and won — ${e.coins} coins, lawfully got, and the novel sensation of being on the right side of it.`,
  ],
  cannon: [
    (e) => `You ran down the pirate ${e.foe} under honest colours and sent her under — no lie, no bluff, just lawful thunder. ${e.coins} coins from the wreck and a nod from every port that fears her name.`,
    (e) => `Old ${e.foe} was an outlaw, fair game, and you took her square under your true flag. The privateer's road: feared by pirates, toasted by governors, ${e.coins} coins the richer.`,
    (e) => `You hunted ${e.foe} down for the bounty she was, colours flying true the whole chase, and brought her in lawful and proud — ${e.coins} coins, and a wink from every honest captain in the roads.`,
  ],
};

// A merciful capture (#72) sings its own verse — you broke their nerve, not their hull, and
// spared the crew. Chosen over the honest pool whenever the deed carries `captured: true`.
const CAPTURE_NARRATORS = {
  cannon: [
    (e) => `You sawed ${e.foe}'s rigging to ribbons until her nerve gave and the colours came down — you spared the crew and sailed off ${e.coins} coins the richer and a touch more respectable.`,
    (e) => `${e.foe} struck her colours rather than her keel: a beaten crew, a ${e.coins}-coin ransom, and a captain who, just this once, chose mercy over a grave.`,
    (e) => `You shot away ${e.foe}'s steerage and let the sea do the arguing until she yielded — no graves, just a ${e.coins}-coin ransom and a crew that lived to grumble about you.`,
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

// Contested rumours (#133): a chased tip a rival raced you for sings one of two verses — the race
// WON (you got there first) or the race LOST (the rival beat you to it). Chosen by `e.won` in
// composeBallad whenever a rumour deed carries a `rival`, ahead of the plain rumour pool. The same
// named rival recurs across deeds, so the ballad reads as a running grudge. Original to Tidewake.
const RUMOUR_RACE_WON = [
  (e) => `You raced ${e.rival} clean across the water for the same whispered prize at ${e.name} — and got there first. ${e.coins} coins, and the rare joy of a rival arriving to your wake.`,
  (e) => `Word said ${e.name}, and so did ${e.rival} — but you carried the wind and made port ahead of them. ${e.coins} coins, and a wave at the latecomer.`,
  (e) => `${e.rival} wanted that ${e.name} tip as badly as you did. A pity for them: you were faster, ${e.coins} coins faster, and grinning about it.`,
];
const RUMOUR_RACE_LOST = [
  (e) => `You chased a tip to ${e.name}, but ${e.rival} had the same notion and a fairer wind — you made port to find the prize gone and only a wry shrug for the crossing.`,
  (e) => `${e.rival} beat you to ${e.name} by a single tide. The bounty was claimed, the quay was laughing, and you'd a long memory to show for it.`,
  (e) => `You dawdled, and ${e.rival} did not — by the time you raised ${e.name} the prize had sailed, and a grudge took its place in the hold.`,
];

// Crew morale crossings (#124): a loyalty meter that answers to the deeds you CHOOSE, sung when it dips
// past a felt line. The grumble ('low') is rueful comedy; the mutiny-risk brush ('mutiny') is a real
// scare you talked your way back from. Selected by `e.tier` in composeBallad, ahead of NARRATORS.
const MORALE_NARRATORS = {
  low: [
    (e) => `The crew took to muttering at the capstan — short of rations and shorter of patience, and every dark glance aimed square at the quarterdeck.`,
    (e) => `Morale sank low enough that the bosun came aft to "discuss the articles", which is sailor for a grumble with its boots on.`,
    (e) => `A sullen quiet settled over the deck, and you learned the particular silence of a crew deciding whether you're worth the following.`,
  ],
  mutiny: [
    (e) => `It came within a whisker of mutiny — the hands gathered aft with hard eyes, and only a kinder turn of deeds talked them down off the wheel.`,
    (e) => `A knife stood quivering in the mast by the watch-bill; the crew were long past grumbling, and you sailed the next league on borrowed loyalty.`,
    (e) => `Loyalty failed near to breaking — they all but took the ship, and the ballad nearly ended there, with a different captain to sing it.`,
  ],
};

const OPENING = 'Gather round and hear it sung — the ballad of a captain, a small boat, and a sea with opinions.';

// The deed's subject for a "best of" boast — a bested foe, a stricken ship, a named port/isle.
function subjectOf(e) {
  return e.foe || e.ship || e.name || e.port || null;
}

// Join a handful of "best of" clauses into one toast, Oxford-style: two read "a, and b"; three
// read "a, b, and c" (so a three-peak voyage doesn't stutter "a, and b, and c").
function joinClauses(parts) {
  if (parts.length <= 1) return parts.join('');
  if (parts.length === 2) return `${parts[0]}, and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

// The "best of voyage" superlative (#90 richer composition): the crew's tavern toast — surfaced BY
// NAME from deeds already in the log, one clause per road the voyage actually ran:
//   • the RICHEST haul   — most coins off one deed (the trader's peak),
//   • the FIERCEST foe   — most infamy hard-won in one fight (the pirate's peak),
//   • the KINDEST turn   — most standing won in one rescue (the governor's peak, #125 encounters).
// Ties go to the earliest deed (deterministic). Returns null only when NONE of the three was won
// (a voyage of bare landfalls or grumbles has no peak to crow about) so the line skips gracefully.
// Pure — reads coins/infamy/standing already in the log; no save fields, no new event types.
function superlativeLine(events) {
  let rich = null, fierce = null, kind = null;
  for (const e of events) {
    const coins = nonNegInt(e.coins);
    const infamy = nonNegInt(e.infamy);
    const standing = nonNegInt(e.standing);
    const who = subjectOf(e);
    if (coins > 0 && (!rich || coins > rich.coins)) rich = { coins, who };
    if (infamy > 0 && (!fierce || infamy > fierce.infamy)) fierce = { infamy, who };
    // Standing is only ever won by a rescue (#125) — the governor road's brag.
    if (e.type === 'encounter' && e.choice === 'rescue' && standing > 0 && (!kind || standing > kind.standing)) {
      kind = { standing, who };
    }
  }
  if (!rich && !fierce && !kind) return null;
  // One name towers over the voyage — it filled the hold the deepest AND fought you the hardest.
  // Kept for the pure pirate/trader run; a kindness peak alongside falls through to the full toast.
  if (rich && fierce && !kind && rich.who && rich.who === fierce.who) {
    return `And one name towers over the voyage: ${rich.who} — the fiercest you fought (${fierce.infamy} infamy hard-won) and the deepest the hold ever rode (${rich.coins} coins).`;
  }
  const parts = [];
  if (rich) parts.push(rich.who ? `the richest haul — ${rich.coins} coins from ${rich.who}` : `the richest haul — ${rich.coins} coins`);
  if (fierce) parts.push(fierce.who ? `the fiercest foe — ${fierce.who}, ${fierce.infamy} infamy hard-won` : `the fiercest fight — ${fierce.infamy} infamy hard-won`);
  if (kind) parts.push(kind.who ? `the kindest turn — ${kind.who} hauled clear for ${kind.standing} standing` : `the kindest turn — ${kind.standing} standing won at sea`);
  const count = parts.length === 3 ? 'three deeds' : parts.length === 2 ? 'two deeds' : 'one deed';
  return `Of it all, the crew still toast ${count} above the rest: ${joinClauses(parts)}.`;
}

function tally(events) {
  let isles = 0, fights = 0, legends = 0, coins = 0;
  for (const e of events) {
    if (e.type === 'landfall') isles++;
    else if (e.type === 'duel' || e.type === 'cannon') fights++;
    // The named home-isle governorship (#119) counts as a crown alongside the pole legends (#46).
    else if (e.type === 'legend' || e.type === 'governorship') legends++;
    coins += nonNegInt(e.coins); // #90 coin milestone: the WHOLE voyage's takings, not one haul
  }
  return { isles, fights, legends, coins };
}

function closingLine(events) {
  const { isles, fights, legends, coins } = tally(events);
  const parts = [];
  if (isles) parts.push(`${isles} isle${isles === 1 ? '' : 's'} raised`);
  if (fights) parts.push(`${fights} rival${fights === 1 ? '' : 's'} bested`);
  if (legends) parts.push(`${legends} crown${legends === 1 ? '' : 's'} earned`);
  // The cumulative coin count (#90) — distinct from the single "richest haul" peak above.
  if (coins) parts.push(`${coins} coin${coins === 1 ? '' : 's'} won`);
  const t = parts.length ? ` (${parts.join(' · ')})` : '';
  return `So sails the voyage thus far${t} — ${events.length} deed${events.length === 1 ? '' : 's'} worth the telling, and the tide still rolling on beneath the keel.`;
}

// Which pole the voyage LEANS to (#90 richer composition): weigh the deeds the player chose — the
// pirate road (raids, false colours, plunder, a feared crown) against the governor road (rescues, a
// home port raised, a lawful hunt, a governorship). A clear lean closes on its own couplet; a tie
// closes on the "both" couplet. Neutral deeds (landfall, rumour, morale) don't tug the needle.
function poleLean(events) {
  let pirate = 0, governor = 0;
  for (const e of events) {
    switch (e.type) {
      case 'duel':
      case 'cannon':
        if (e.lawful) governor += 1; else pirate += 1;
        if (e.treachery) pirate += 1;
        break;
      case 'encounter':
        if (e.choice === 'rescue') governor += 2; else pirate += 2;
        break;
      case 'harbour': governor += 1; break;
      case 'governorship': governor += 2; break;
      case 'legend': if (e.pole === 'pirate') pirate += 2; else governor += 2; break;
      default: break; // landfall, rumour, morale — neutral
    }
  }
  return { pirate, governor };
}

// The closing couplet — a last sung line that reflects who the voyage made you. Deterministic by the
// dominant pole; warm + a wink either way, and frank delight at being ungovernably both.
function closingCouplet(events) {
  const { pirate, governor } = poleLean(events);
  if (pirate > governor) {
    return `And when the tale is told, it's the black flag they remember — a name the calm ports still use to frighten the children to bed.`;
  }
  if (governor > pirate) {
    return `And when the tale is told, it's the lamps you lit they remember — a captain who, against every pirate custom, left the harbours better than he found them.`;
  }
  return `And when the tale is told, they'll never agree the half of it — terror to some, patron to others, and you grinning at being thoroughly both.`;
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
    const seen = { landfall: 0, duel: 0, cannon: 0, legend: 0, rumour: 0, encounter: 0, harbour: 0, governorship: 0, morale: 0 };
    for (const e of log) {
      // An at-sea encounter sings a rescue/plunder verse by the choice made; a morale crossing sings
      // its tier verse; a treacherous fight a false-colours verse; a lawful pirate-hunt the privateer
      // verse; else the honest pool.
      const pool = (e.type === 'encounter' && ENCOUNTER_NARRATORS[e.choice])
        || (e.type === 'morale' && MORALE_NARRATORS[e.tier])
        || (e.type === 'rumour' && e.rival && (e.won ? RUMOUR_RACE_WON : RUMOUR_RACE_LOST))
        || (e.captured && CAPTURE_NARRATORS[e.type])
        || (e.treachery && TREACHERY_NARRATORS[e.type])
        || (e.lawful && LAWFUL_NARRATORS[e.type])
        || NARRATORS[e.type];
      if (!pool) continue;
      const i = seen[e.type]++ % pool.length;
      lines.push(pool[i](e));
    }
    const peak = superlativeLine(log); // #90: the "best of voyage" toast, when there's a peak to crow
    if (peak) lines.push(peak);
    lines.push(closingLine(log));
    lines.push(closingCouplet(log)); // #90: a last couplet reflecting your dominant pole
    lines.push(BALLAD_FOOTER);
  }

  const text = `${title}\n\n${lines.join('\n')}`;
  return { title, lines, text };
}
