// Unit: the voyage-log + balladeer PURE logic (#78; #53 self-tested-component standard).
// No browser — these are plain functions over an event log. They hold the record/dedupe/
// order/cap rules and the deterministic ballad composition, so the anecdote factory is
// verifiable without a DOM. The thin panel (src/ui/ballad.js) only wires the DOM + clipboard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordEvent, sanitizeEvent, sanitizeLog, composeBallad,
  MAX_EVENTS, BALLAD_TITLE, EMPTY_LINE, EVENT_TYPES,
} from '../../src/voyage-log.js';

// ---- recordEvent: record + order ------------------------------------------------------

test('recordEvent appends deeds in chronological order, immutably', () => {
  const a = [];
  const b = recordEvent(a, { type: 'landfall', name: 'Rumlost Reef' });
  const c = recordEvent(b, { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 50 });
  assert.equal(a.length, 0);            // original untouched (immutable)
  assert.equal(b.length, 1);
  assert.equal(c.length, 2);
  assert.equal(c[0].type, 'landfall');  // order preserved
  assert.equal(c[1].type, 'duel');
  assert.notEqual(b, a);                // a new array each success
});

test('recordEvent coerces numeric fields to safe non-negative integers', () => {
  const log = recordEvent([], { type: 'cannon', foe: 'HMS Folly', infamy: 41.7, coins: -5 });
  assert.equal(log[0].infamy, 42);
  assert.equal(log[0].coins, 0);
});

// ---- recordEvent: dedupe --------------------------------------------------------------

test('recordEvent dedupes once-only deeds (an isle, a crown) but keeps every fight', () => {
  let log = [];
  log = recordEvent(log, { type: 'landfall', name: 'Gallows Cay' });
  log = recordEvent(log, { type: 'landfall', name: 'Gallows Cay' }); // same isle → ignored
  assert.equal(log.length, 1);

  log = recordEvent(log, { type: 'legend', pole: 'pirate', title: 'Terror of the Tidewake' });
  log = recordEvent(log, { type: 'legend', pole: 'pirate', title: 'Terror of the Tidewake' }); // dup crown
  assert.equal(log.length, 2);

  // Two duels against the SAME-named foe are two separate anecdotes.
  log = recordEvent(log, { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 40 });
  log = recordEvent(log, { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 40 });
  assert.equal(log.length, 4);
});

test('recordEvent returns the SAME array (a no-op) for a duplicate or junk event', () => {
  const log = recordEvent([], { type: 'landfall', name: 'Tankard Rock' });
  assert.equal(recordEvent(log, { type: 'landfall', name: 'Tankard Rock' }), log); // dup → same ref
  assert.equal(recordEvent(log, { type: 'nonsense' }), log);                        // junk → same ref
  assert.equal(recordEvent(log, null), log);
});

// ---- recordEvent: reject junk ---------------------------------------------------------

test('sanitizeEvent rejects unknown types and missing required fields', () => {
  assert.equal(sanitizeEvent({ type: 'landfall' }), null);            // no name
  assert.equal(sanitizeEvent({ type: 'landfall', name: '   ' }), null); // blank name
  assert.equal(sanitizeEvent({ type: 'duel' }), null);               // no foe
  assert.equal(sanitizeEvent({ type: 'legend', pole: 'pirate' }), null); // no title
  assert.equal(sanitizeEvent({ type: 'legend', pole: 'mayor', title: 'X' }), null); // bad pole
  assert.equal(sanitizeEvent({ type: 'unknown' }), null);
  assert.equal(sanitizeEvent('nope'), null);
  // a valid one survives
  assert.deepEqual(sanitizeEvent({ type: 'landfall', name: 'Scurvy Point' }), { type: 'landfall', name: 'Scurvy Point' });
});

// ---- recordEvent: cap -----------------------------------------------------------------

test('recordEvent caps the log at MAX_EVENTS, dropping the oldest', () => {
  let log = [];
  for (let i = 0; i < MAX_EVENTS + 15; i++) {
    log = recordEvent(log, { type: 'duel', foe: `Rival ${i}`, infamy: 1, coins: 1 });
  }
  assert.equal(log.length, MAX_EVENTS);
  assert.equal(log[0].foe, 'Rival 15');                  // the oldest 15 fell off the front
  assert.equal(log[log.length - 1].foe, `Rival ${MAX_EVENTS + 14}`);
});

// ---- sanitizeLog ----------------------------------------------------------------------

test('sanitizeLog drops foreign/junk entries and re-applies dedupe + cap', () => {
  const dirty = [
    { type: 'landfall', name: 'Cutlass Bend' },
    { type: 'landfall', name: 'Cutlass Bend' }, // dup
    { evil: true },                              // junk
    'pirate code',                               // junk
    { type: 'duel', foe: 'Mad Mary', infamy: 10, coins: 20 },
  ];
  const clean = sanitizeLog(dirty);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].name, 'Cutlass Bend');
  assert.equal(clean[1].foe, 'Mad Mary');
  assert.deepEqual(sanitizeLog('not an array'), []);
});

// ---- composeBallad: empty -------------------------------------------------------------

test('composeBallad on an empty log gives a graceful "yet unwritten" line', () => {
  const ballad = composeBallad([]);
  assert.equal(ballad.title, BALLAD_TITLE);
  assert.deepEqual(ballad.lines, [EMPTY_LINE]);
  assert.ok(ballad.text.startsWith(BALLAD_TITLE));
  assert.ok(ballad.text.includes('yet unwritten'));
});

// ---- composeBallad: real voyage -------------------------------------------------------

test('composeBallad weaves the deeds into the ballad text, in order', () => {
  let log = [];
  log = recordEvent(log, { type: 'landfall', name: 'Rumlost Reef' });
  log = recordEvent(log, { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 55 });
  log = recordEvent(log, { type: 'cannon', foe: 'The Leviathan', infamy: 60, coins: 120 });
  log = recordEvent(log, { type: 'legend', pole: 'pirate', title: 'Terror of the Tidewake' });

  const ballad = composeBallad(log);
  assert.ok(ballad.text.includes('Rumlost Reef'));
  assert.ok(ballad.text.includes('Black Sal'));
  assert.ok(ballad.text.includes('The Leviathan'));
  assert.ok(ballad.text.includes('Terror of the Tidewake'));
  // closing tally reflects the deeds
  assert.ok(ballad.text.includes('1 isle raised'));
  assert.ok(ballad.text.includes('2 rivals bested'));
  assert.ok(ballad.text.includes('1 crown earned'));
  // ordered: the isle is sung before the duel
  assert.ok(ballad.text.indexOf('Rumlost Reef') < ballad.text.indexOf('Black Sal'));
});

test('composeBallad is deterministic — same log, byte-identical ballad', () => {
  let log = [];
  log = recordEvent(log, { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 55 });
  log = recordEvent(log, { type: 'duel', foe: 'Mad Mary', infamy: 20, coins: 30 });
  log = recordEvent(log, { type: 'landfall', name: 'Gallows Cay' });
  assert.equal(composeBallad(log).text, composeBallad(log).text);
});

test('composeBallad varies the verse for repeated deeds (not the same line twice)', () => {
  let log = [];
  log = recordEvent(log, { type: 'duel', foe: 'Rival A', infamy: 10, coins: 10 });
  log = recordEvent(log, { type: 'duel', foe: 'Rival B', infamy: 10, coins: 10 });
  const { lines } = composeBallad(log);
  // verses are the per-deed body lines (lines[1..log.length]); the two duel verses differ.
  // (Sliced by position so the later "best of voyage" superlative — which also names a foe —
  // can't be mistaken for a duel verse.)
  const duelVerses = lines.slice(1, 1 + log.length);
  assert.equal(duelVerses.length, 2);
  assert.ok(duelVerses[0].includes('Rival A'));
  assert.ok(duelVerses[1].includes('Rival B'));
  assert.notEqual(duelVerses[0], duelVerses[1]);
});

test('composeBallad accepts a custom title and tolerates a junk log', () => {
  const b = composeBallad([{ junk: 1 }, { type: 'landfall', name: 'Tankard Rock' }], { title: 'My Log' });
  assert.equal(b.title, 'My Log');
  assert.ok(b.text.startsWith('My Log'));
  assert.ok(b.text.includes('Tankard Rock'));
});

// ---- False Colours treachery (#79) ----------------------------------------------------

test('sanitizeEvent stamps treachery only when true (back-compatible shape)', () => {
  // honest fight: no treachery field at all (so legacy entries stay byte-identical)
  assert.deepEqual(
    sanitizeEvent({ type: 'cannon', foe: 'Old Thunderbottom', infamy: 100, coins: 50 }),
    { type: 'cannon', foe: 'Old Thunderbottom', infamy: 100, coins: 50 },
  );
  // treacherous fight: the flag is recorded
  assert.deepEqual(
    sanitizeEvent({ type: 'duel', foe: 'Greta the Gull', infamy: 90, coins: 40, treachery: true }),
    { type: 'duel', foe: 'Greta the Gull', infamy: 90, coins: 40, treachery: true },
  );
});

test('composeBallad sings a distinct treacherous verse for a false-colours strike', () => {
  const honest = composeBallad([{ type: 'cannon', foe: 'Old Thunderbottom', infamy: 100, coins: 50 }]);
  const treacherous = composeBallad([{ type: 'cannon', foe: 'Old Thunderbottom', infamy: 100, coins: 50, treachery: true }]);
  // both name the foe, but the treacherous verse reads of the disguise/merchant colours
  assert.ok(honest.text.includes('Old Thunderbottom'));
  assert.ok(treacherous.text.includes('Old Thunderbottom'));
  assert.notEqual(honest.text, treacherous.text);
  assert.ok(/merchant colours|treachery/i.test(treacherous.text));
});

// ---- Letters of Marque lawful verse (#91) ---------------------------------------------

test('sanitizeEvent stamps lawful only when true (and never alongside treachery)', () => {
  // a lawful pirate-hunt under honest colours: the flag is recorded
  assert.deepEqual(
    sanitizeEvent({ type: 'cannon', foe: 'the Black Gannet', infamy: 100, coins: 50, lawful: true }),
    { type: 'cannon', foe: 'the Black Gannet', infamy: 100, coins: 50, lawful: true },
  );
  // treachery wins the flag if both are (impossibly) set — a lie is never lawful
  const both = sanitizeEvent({ type: 'cannon', foe: 'x', infamy: 10, coins: 5, treachery: true, lawful: true });
  assert.equal(both.treachery, true);
  assert.equal(both.lawful, undefined);
});

test('composeBallad sings a distinct LAWFUL privateer verse for an honest pirate-hunt', () => {
  const honest = composeBallad([{ type: 'cannon', foe: 'the Black Gannet', infamy: 100, coins: 50 }]);
  const lawful = composeBallad([{ type: 'cannon', foe: 'the Black Gannet', infamy: 100, coins: 50, lawful: true }]);
  assert.ok(lawful.text.includes('the Black Gannet'));
  assert.notEqual(honest.text, lawful.text);
  // the lawful verse reads of pirates / honest colours / lawful service — never of treachery
  assert.ok(/pirate|outlaw|lawful|honest colours|true (flag|colours)/i.test(lawful.text));
  assert.ok(!/merchant colours|treachery/i.test(lawful.text));
});

// ---- chased-rumour payoff verse (#112) ------------------------------------------------

test('sanitizeEvent accepts a chased-rumour payoff (name + coins), rejects a nameless one', () => {
  assert.deepEqual(
    sanitizeEvent({ type: 'rumour', name: 'Barnacle Bottom', coins: 60 }),
    { type: 'rumour', name: 'Barnacle Bottom', coins: 60 },
  );
  assert.equal(sanitizeEvent({ type: 'rumour', coins: 60 }), null);
  // coins coerced to a safe non-negative integer
  assert.deepEqual(
    sanitizeEvent({ type: 'rumour', name: 'Gullet\'s Rest', coins: -3 }),
    { type: 'rumour', name: "Gullet's Rest", coins: 0 },
  );
});

test('composeBallad sings the chased-rumour verse, naming the port + coin', () => {
  const b = composeBallad([{ type: 'rumour', name: 'Barnacle Bottom', coins: 60 }]);
  assert.match(b.text, /Barnacle Bottom/);
  assert.match(b.text, /60/);
  assert.match(b.text, /rumour|tip|whisper|word/i);
});

test('a chased rumour is NOT deduped — each chase is its own anecdote', () => {
  let log = [];
  log = recordEvent(log, { type: 'rumour', name: 'Barnacle Bottom', coins: 60 });
  log = recordEvent(log, { type: 'rumour', name: 'Barnacle Bottom', coins: 60 });
  assert.equal(log.length, 2);
});

// ---- contested-rumour verses (#133: a rival raced you for the prize) -------------------

test('sanitizeEvent carries a contested rumour\'s rival + win/lose, coercing won to a boolean', () => {
  assert.deepEqual(
    sanitizeEvent({ type: 'rumour', name: 'Barnacle Bottom', coins: 60, rival: 'Silas Thorne', won: true }),
    { type: 'rumour', name: 'Barnacle Bottom', coins: 60, rival: 'Silas Thorne', won: true },
  );
  assert.deepEqual(
    sanitizeEvent({ type: 'rumour', name: 'Barnacle Bottom', coins: 0, rival: 'Silas Thorne' }),
    { type: 'rumour', name: 'Barnacle Bottom', coins: 0, rival: 'Silas Thorne', won: false },
  );
  // a blank/missing rival degrades to a plain rumour (no rival/won fields)
  assert.deepEqual(
    sanitizeEvent({ type: 'rumour', name: 'Barnacle Bottom', coins: 60, rival: '   ' }),
    { type: 'rumour', name: 'Barnacle Bottom', coins: 60 },
  );
});

test('composeBallad sings a WON-race verse (beat them to it) vs a LOST-race verse (beaten to it)', () => {
  const won = composeBallad([{ type: 'rumour', name: 'Barnacle Bottom', coins: 60, rival: 'Silas Thorne', won: true }]);
  assert.match(won.text, /Silas Thorne/);
  assert.match(won.text, /first|ahead|faster|raced/i);
  assert.match(won.text, /60/);
  const lost = composeBallad([{ type: 'rumour', name: 'Barnacle Bottom', coins: 0, rival: 'Silas Thorne', won: false }]);
  assert.match(lost.text, /Silas Thorne/);
  assert.match(lost.text, /gone|beat|claimed|grudge|too late|sailed/i);
  assert.notEqual(won.text, lost.text, 'the win and lose paths sing different verses');
});

// ---- at-sea encounter verse (#125: rescue vs plunder) ---------------------------------

test('sanitizeEvent accepts an encounter (ship + a valid choice), rejects a bad one', () => {
  assert.deepEqual(
    sanitizeEvent({ type: 'encounter', choice: 'rescue', ship: 'the Saltwidow', standing: 120 }),
    { type: 'encounter', choice: 'rescue', ship: 'the Saltwidow', standing: 120, infamy: 0, coins: 0 },
  );
  assert.deepEqual(
    sanitizeEvent({ type: 'encounter', choice: 'plunder', ship: 'the Last Ducat', infamy: 120, coins: 80 }),
    { type: 'encounter', choice: 'plunder', ship: 'the Last Ducat', standing: 0, infamy: 120, coins: 80 },
  );
  assert.equal(sanitizeEvent({ type: 'encounter', choice: 'rescue' }), null);         // no ship name
  assert.equal(sanitizeEvent({ type: 'encounter', ship: 'the Saltwidow' }), null);    // no choice
  assert.equal(sanitizeEvent({ type: 'encounter', choice: 'dither', ship: 'X' }), null); // bad choice
});

test('composeBallad sings a distinct RESCUE verse — the lawful, grateful road', () => {
  const b = composeBallad([{ type: 'encounter', choice: 'rescue', ship: 'the Saltwidow', standing: 120 }]);
  assert.match(b.text, /the Saltwidow/);
  assert.match(b.text, /120/);
  assert.match(b.text, /haul|clear|took them off|rescue|kindness|good name|blessed|decent/i);
  assert.ok(!/plunder|stripped|helped yourself/i.test(b.text));
});

test('composeBallad sings a distinct PLUNDER verse — the cold, coin road', () => {
  const b = composeBallad([{ type: 'encounter', choice: 'plunder', ship: 'the Last Ducat', infamy: 120, coins: 80 }]);
  assert.match(b.text, /the Last Ducat/);
  assert.match(b.text, /80/);          // the coin haul
  assert.match(b.text, /helped yourself|stripped|cargo|took her|cold|wince|infamy/i);
});

test('an at-sea encounter is NOT deduped — each founderer is its own anecdote', () => {
  let log = [];
  log = recordEvent(log, { type: 'encounter', choice: 'rescue', ship: 'the Saltwidow', standing: 120 });
  log = recordEvent(log, { type: 'encounter', choice: 'plunder', ship: 'the Saltwidow', infamy: 120, coins: 80 });
  assert.equal(log.length, 2);
});

// ---- Your Harbour deeds (#118) ------------------------------------------------------
test('sanitizeEvent accepts harbour claim/grow and rejects junk (#118)', () => {
  assert.deepEqual(sanitizeEvent({ type: 'harbour', deed: 'claim', port: 'P', level: 1 }),
    { type: 'harbour', deed: 'claim', port: 'P', level: 1 });
  assert.deepEqual(sanitizeEvent({ type: 'harbour', deed: 'grow', port: 'P', level: 2 }),
    { type: 'harbour', deed: 'grow', port: 'P', level: 2 });
  assert.equal(sanitizeEvent({ type: 'harbour', deed: 'sink', port: 'P' }), null);
  assert.equal(sanitizeEvent({ type: 'harbour', deed: 'claim', port: '' }), null);
});

test('the ballad sings a claimed harbour, deduped per claim/grow tier (#118)', () => {
  let log = [];
  log = recordEvent(log, { type: 'harbour', deed: 'claim', port: "Gullet's Rest", level: 1 });
  log = recordEvent(log, { type: 'harbour', deed: 'claim', port: "Gullet's Rest", level: 1 }); // dup → no-op
  log = recordEvent(log, { type: 'harbour', deed: 'grow', port: "Gullet's Rest", level: 2 });
  assert.equal(log.length, 2);
  const text = composeBallad(log).text;
  assert.ok(text.includes("Gullet's Rest"), 'the home port is named in the ballad');
});

test('sanitizeEvent accepts a governorship crown and rejects junk (#119)', () => {
  assert.deepEqual(sanitizeEvent({ type: 'governorship', port: "Gullet's Rest", title: "Governor of Gullet's Rest" }),
    { type: 'governorship', port: "Gullet's Rest", title: "Governor of Gullet's Rest" });
  assert.equal(sanitizeEvent({ type: 'governorship', port: 'P' }), null);          // no title
  assert.equal(sanitizeEvent({ type: 'governorship', title: 'Governor of P' }), null); // no port
});

test('the ballad sings a governorship once per isle, naming the isle (#119)', () => {
  let log = [];
  log = recordEvent(log, { type: 'governorship', port: "Gullet's Rest", title: "Governor of Gullet's Rest" });
  log = recordEvent(log, { type: 'governorship', port: "Gullet's Rest", title: "Governor of Gullet's Rest" }); // dup → no-op
  assert.equal(log.length, 1, 'the named crown is sung once per isle, never twice on reload');
  const ballad = composeBallad(log);
  assert.ok(ballad.text.includes("Gullet's Rest"), 'the governed isle is named in the ballad');
  // a governorship counts as a crown in the closing tally line (now followed by a pole couplet + footer)
  assert.ok(ballad.lines.some((l) => /crown/.test(l)), 'a governorship counts as a crown in the closing tally');
});

// ---- crew-morale deeds (#124: a loyalty crossing the crew will remember) ---------------

test('morale is a known event type, accepting only the low/mutiny tiers', () => {
  assert.ok(EVENT_TYPES.includes('morale'));
  assert.deepEqual(sanitizeEvent({ type: 'morale', tier: 'low' }), { type: 'morale', tier: 'low' });
  assert.deepEqual(sanitizeEvent({ type: 'morale', tier: 'mutiny' }), { type: 'morale', tier: 'mutiny' });
  assert.equal(sanitizeEvent({ type: 'morale' }), null);              // no tier
  assert.equal(sanitizeEvent({ type: 'morale', tier: 'high' }), null); // not a crossing we sing
});

test('composeBallad sings a distinct grumble vs mutiny-risk verse, and each crossing is its own anecdote', () => {
  const low = composeBallad([{ type: 'morale', tier: 'low' }]);
  const mutiny = composeBallad([{ type: 'morale', tier: 'mutiny' }]);
  assert.match(low.text, /grumbl|mutter|sullen|patience|article/i);
  assert.match(mutiny.text, /mutiny|loyalty|knife|took the ship|aft/i);
  assert.notEqual(low.text, mutiny.text);
  // not deduped — a crew can slump, recover, and slump again
  let log = [];
  log = recordEvent(log, { type: 'morale', tier: 'low' });
  log = recordEvent(log, { type: 'morale', tier: 'low' });
  assert.equal(log.length, 2);
});

// ---- richer composition: a closing couplet reflecting your dominant pole ----------------

test('composeBallad closes on a PIRATE couplet when infamy deeds dominate', () => {
  const b = composeBallad([
    { type: 'cannon', foe: 'HMS Folly', infamy: 80, coins: 40 },
    { type: 'encounter', choice: 'plunder', ship: 'the Last Ducat', infamy: 60, coins: 50 },
  ]);
  // the couplet sits between the tally and the footer
  assert.match(b.lines.at(-2), /black flag|feared|terror|frighten/i);
});

test('composeBallad closes on a GOVERNOR couplet when standing deeds dominate', () => {
  const b = composeBallad([
    { type: 'encounter', choice: 'rescue', ship: 'the Saltwidow', standing: 120 },
    { type: 'harbour', deed: 'claim', port: "Gullet's Rest", level: 1 },
    { type: 'governorship', port: "Gullet's Rest", title: "Governor of Gullet's Rest" },
  ]);
  assert.match(b.lines.at(-2), /lamps|harbour|built|better than|patron|raised/i);
});

test('the pole couplet does not appear on an empty log', () => {
  const b = composeBallad([]);
  assert.equal(b.lines.length, 1);
  assert.deepEqual(b.lines, [EMPTY_LINE]);
});

// ---- thin verse pools rounded out to three deterministic variants (#90) ----------------

test('each repeated capture cycles three distinct verses (a 3-variant pool)', () => {
  // SAME foe each time so only the verse TEMPLATE can make the lines differ — a real pool-size check.
  let log = [];
  for (let i = 0; i < 3; i++) log = recordEvent(log, { type: 'cannon', foe: 'the Prize', coins: 20, captured: true });
  // the per-deed verses are the body lines (position-sliced, so the "best of voyage" superlative
  // line — which also names the foe — isn't counted among them).
  const verses = composeBallad(log).lines.slice(1, 1 + log.length);
  assert.equal(verses.length, 3);
  assert.equal(new Set(verses).size, 3, 'three captures sing three distinct verses');
});

test('three lawful pirate-hunts and three treacheries each sing three distinct verses', () => {
  let lawful = [];
  let treach = [];
  for (let i = 0; i < 3; i++) {
    lawful = recordEvent(lawful, { type: 'duel', foe: 'the Outlaw', infamy: 10, coins: 10, lawful: true });
    treach = recordEvent(treach, { type: 'duel', foe: 'the Mark', infamy: 10, coins: 10, treachery: true });
  }
  // body verses by position (so the trailing "best of voyage" superlative isn't miscounted).
  const lv = composeBallad(lawful).lines.slice(1, 1 + lawful.length);
  const tv = composeBallad(treach).lines.slice(1, 1 + treach.length);
  assert.equal(new Set(lv).size, 3, 'three lawful wins sing three distinct verses');
  assert.equal(new Set(tv).size, 3, 'three treacheries sing three distinct verses');
});

// ---- "best of voyage" superlative line (#90: richest haul + fiercest foe) ---------------

test('composeBallad crowns the richest haul and fiercest foe BY NAME, just before the closing', () => {
  // two distinct fights: the Leviathan pays the most coin, Black Sal fights the hardest.
  const b = composeBallad([
    { type: 'cannon', foe: 'the Leviathan', infamy: 20, coins: 120 },
    { type: 'duel', foe: 'Black Sal', infamy: 90, coins: 30 },
  ]);
  // the superlative sits right before the closing tally (which is before the couplet + footer).
  const peak = b.lines.at(-4);
  assert.match(peak, /richest haul/i);
  assert.match(peak, /fiercest foe/i);
  assert.match(peak, /the Leviathan/);   // the richest haul, named
  assert.match(peak, /Black Sal/);       // the fiercest foe, named
  assert.match(peak, /120/);             // the coin peak
  assert.match(peak, /90/);              // the infamy peak
});

test('when one name both pays and fights the hardest, the superlative merges into one boast', () => {
  const b = composeBallad([{ type: 'cannon', foe: 'the Leviathan', infamy: 60, coins: 120 }]);
  const peak = b.lines.at(-4);
  assert.match(peak, /one name towers/i);
  assert.match(peak, /the Leviathan/);
  assert.match(peak, /120/);
  assert.match(peak, /60/);
  // the foe is named ONCE in the merged boast, not duplicated across two clauses
  assert.equal((peak.match(/the Leviathan/g) || []).length, 1);
});

test('the superlative line is skipped when no coin or infamy was won (a peaceful voyage)', () => {
  const b = composeBallad([
    { type: 'landfall', name: 'Rumlost Reef' },
    { type: 'encounter', choice: 'rescue', ship: 'the Saltwidow', standing: 120 },
    { type: 'morale', tier: 'low' },
  ]);
  assert.ok(!b.lines.some((l) => /richest haul|fiercest|towers over the voyage/i.test(l)),
    'nothing was plundered or feared, so there is no peak to crow about');
});

test('the superlative picks the MAX coin/infamy deeds and is deterministic', () => {
  const log = [
    { type: 'cannon', foe: 'Small Fry', infamy: 5, coins: 10 },
    { type: 'duel', foe: 'Mid Mary', infamy: 40, coins: 200 },   // richest
    { type: 'cannon', foe: 'Grim Gus', infamy: 88, coins: 25 },  // fiercest
  ];
  const peak = composeBallad(log).lines.at(-4);
  assert.match(peak, /200 coins from Mid Mary/);
  assert.match(peak, /Grim Gus, 88 infamy/);
  assert.equal(composeBallad(log).text, composeBallad(log).text); // byte-identical
});
