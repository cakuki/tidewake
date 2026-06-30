// Unit: the tavern "listen for word" PURE rumour composer (#103; #53 self-tested-component
// standard). No browser, no THREE — composeRumours() turns live world-state + the captain's
// reputation into a handful of in-character rumours, DETERMINISTICALLY, so the same state
// always speaks the same word (vital for the QA hook + these tests). The thin tavern DOM lives
// in src/ui/town.js; this file holds the selection + voice rules so they verify under node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { composeRumours } from '../../src/rumours.js';
import { PORT_NAMES } from '../../src/economy.js';

const PORT = 'Saltpurse Quay';
const others = PORT_NAMES.filter((p) => p !== PORT);

// composeRumours now returns TYPED entries { text, target } (#115); these helpers keep the
// prose-focused assertions readable while a couple of new tests pin the typed target itself.
const texts = (arr) => arr.map((e) => e.text);
const joinText = (arr) => texts(arr).join(' ');

// ---- guards ---------------------------------------------------------------------------

test('no docked port → no word (empty array, never throws)', () => {
  assert.deepEqual(composeRumours({}), []);
  assert.deepEqual(composeRumours({ port: 'Nowhere-by-Sea' }), []);
  assert.deepEqual(composeRumours(null), []);
});

test('a docked port always yields at least one rumour', () => {
  const r = composeRumours({ port: PORT, infamy: 0, standing: 0, renown: 0 });
  assert.ok(Array.isArray(r) && r.length >= 1);
});

// ---- determinism (the keystone: same state → same word) -------------------------------

test('deterministic: identical world + opts compose identical rumours', () => {
  const w = { port: PORT, infamy: 200, standing: 40, renown: 240, deeds: [] };
  assert.deepEqual(composeRumours(w, { nonce: 3 }), composeRumours(w, { nonce: 3 }));
});

test('count is honoured and clamped (1..4)', () => {
  assert.equal(composeRumours({ port: PORT }, { count: 1 }).length, 1);
  assert.ok(composeRumours({ port: PORT }, { count: 99 }).length <= 4);
  assert.ok(composeRumours({ port: PORT }, { count: 0 }).length >= 1);
});

// ---- world-state reactive: rumours name real targets (soft sea objectives) -------------

test('surfaces another port by name — a soft heading to sail toward', () => {
  const joined = joinText(composeRumours({ port: PORT, infamy: 0, standing: 0 }, { count: 4 }));
  assert.ok(others.some((p) => joined.includes(p)), `expected a named other port in: ${joined}`);
});

// ---- reputation reactive: who you've become changes what you hear ----------------------

test('a feared pirate hears feared/hunted word; a respected governor hears civic word', () => {
  const pirate = joinText(composeRumours({ port: PORT, infamy: 1200, standing: 0, renown: 1200 }, { count: 4 }));
  const governor = joinText(composeRumours({ port: PORT, infamy: 0, standing: 1200, renown: 1200 }, { count: 4 }));
  assert.notDeepEqual(pirate, governor);
  assert.match(pirate, /navy|bounty|coin|feared|black|spoons|shutter/i);
  assert.match(governor, /council|trust|standing|prais|fond|honest|cheer/i);
});

test('an unknown captain is told their slate is clean', () => {
  const joined = joinText(composeRumours({ port: PORT, infamy: 0, standing: 0, renown: 0 }, { count: 4 }));
  assert.match(joined, /name|slate|fresh|nobody|stranger/i);
});

// ---- deed reactive: recent deeds echo back as rumour -----------------------------------

test('a recent fight echoes back by the foe’s name', () => {
  const deeds = [{ type: 'cannon', foe: 'Black Sal', infamy: 40, coins: 80 }];
  const joined = joinText(composeRumours({ port: PORT, infamy: 40, standing: 0, renown: 40, deeds }, { count: 4 }));
  assert.match(joined, /Black Sal/);
});

test('a raised isle echoes back by name', () => {
  const deeds = [{ type: 'landfall', name: 'Rumlost Reef' }];
  const joined = joinText(composeRumours({ port: PORT, infamy: 0, standing: 0, renown: 0, deeds }, { count: 4 }));
  assert.match(joined, /Rumlost Reef/);
});

// ---- listen-again freshness + clean text ----------------------------------------------

test('re-listening (nonce) varies the word over a session', () => {
  const w = { port: PORT, infamy: 300, standing: 100, renown: 400, deeds: [{ type: 'duel', foe: 'Grog Mary', infamy: 30, coins: 0 }] };
  const sets = new Set();
  for (let n = 0; n < 8; n++) sets.add(texts(composeRumours(w, { nonce: n })).join('||'));
  assert.ok(sets.size >= 2, 'expected more than one distinct rumour set across nonces');
});

test('rumours are clean prose — no leftover placeholders or junk', () => {
  const r = composeRumours({ port: PORT, infamy: 500, standing: 500, renown: 1000, deeds: [{ type: 'duel', foe: 'X', infamy: 1, coins: 1 }] }, { count: 4 });
  for (const line of texts(r)) {
    assert.ok(typeof line === 'string' && line.trim().length > 0);
    assert.doesNotMatch(line, /\{|\}|undefined|NaN|\[object/);
  }
});

// ---- typed targets: a trade tip is a chase-able objective (#111/#112/#115) -------------

test('every entry is a typed { text, target } record', () => {
  const r = composeRumours({ port: PORT, infamy: 200, standing: 200, renown: 400 }, { count: 4 });
  for (const e of r) {
    assert.equal(typeof e.text, 'string');
    assert.ok(e.target === null || (typeof e.target === 'object' && typeof e.target.kind === 'string'));
  }
});

test('every entry carries its rumour KIND so LISTEN can colour the cue (#116)', () => {
  const r = composeRumours({ port: PORT, infamy: 200, standing: 200, renown: 400, deeds: [{ type: 'duel', foe: 'X' }, { type: 'landfall', name: 'Y' }] }, { count: 4 });
  assert.ok(r.length >= 1);
  for (const e of r) {
    assert.ok(['rep', 'trade', 'sea', 'deed'].includes(e.kind), `entry kind is a known pool: ${e.kind}`);
  }
});

test('a trade tip carries a typed port target naming a real OTHER port', () => {
  // count 4 at a low-renown captain surfaces the trade pool; find a targeted entry.
  const r = composeRumours({ port: PORT, infamy: 0, standing: 0, renown: 0 }, { count: 4 });
  const targeted = r.filter((e) => e.target);
  assert.ok(targeted.length >= 1, 'expected at least one chase-able trade tip');
  for (const e of targeted) {
    assert.equal(e.target.kind, 'port');
    assert.ok(others.includes(e.target.name), `target names a real other port: ${e.target.name}`);
    assert.ok(e.text.includes(e.target.name), 'the prose names the same port as the typed target');
  }
});
