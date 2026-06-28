// Unit: the voyage-log + balladeer PURE logic (#78; #53 self-tested-component standard).
// No browser — these are plain functions over an event log. They hold the record/dedupe/
// order/cap rules and the deterministic ballad composition, so the anecdote factory is
// verifiable without a DOM. The thin panel (src/ui/ballad.js) only wires the DOM + clipboard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  recordEvent, sanitizeEvent, sanitizeLog, composeBallad,
  MAX_EVENTS, BALLAD_TITLE, EMPTY_LINE,
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
  // opening + two duel verses + closing + footer = 5 lines; the two duel verses differ.
  const duelVerses = lines.filter((l) => l.includes('Rival A') || l.includes('Rival B'));
  assert.equal(duelVerses.length, 2);
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
