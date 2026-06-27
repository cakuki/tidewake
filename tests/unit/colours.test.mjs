import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOURS, DEFAULT_COLOURS,
  colourById, isDeceptive, nextColours,
  menaceLevel, npcDisposition, npcFlees,
  TREACHERY_RATE, treacheryBonus, surpriseDamage, SURPRISE_DAMAGE,
  pickLine, HOIST_LINES, FOOLED_LINES, REVEAL_LINES,
} from '../../src/colours.js';

// ---- the colour set -------------------------------------------------------------------
test('COLOURS has at least true/black + false/merchant, and a sane default', () => {
  assert.ok(Array.isArray(COLOURS) && COLOURS.length >= 2);
  const black = COLOURS.find((c) => c.id === 'black');
  const merchant = COLOURS.find((c) => c.id === 'merchant');
  assert.ok(black && merchant, 'both black and merchant colours exist');
  assert.equal(black.deceptive, false, 'true black colours are honest');
  assert.equal(merchant.deceptive, true, 'merchant colours are a disguise');
  assert.equal(DEFAULT_COLOURS, 'black', 'a fresh voyage flies honest black by default');
  for (const c of COLOURS) {
    assert.ok(typeof c.id === 'string' && c.id.length > 0);
    assert.ok(typeof c.name === 'string' && c.name.length > 0);
    assert.ok(typeof c.short === 'string' && c.short.length > 0);
    assert.equal(typeof c.deceptive, 'boolean');
    assert.equal(typeof c.flagColor, 'number');
  }
});

test('colourById resolves a known id and falls back to the default for junk', () => {
  assert.equal(colourById('merchant').id, 'merchant');
  assert.equal(colourById('nonsense').id, DEFAULT_COLOURS);
  assert.equal(colourById(undefined).id, DEFAULT_COLOURS);
  assert.equal(colourById(null).id, DEFAULT_COLOURS);
});

test('isDeceptive reads the flag honestly', () => {
  assert.equal(isDeceptive('black'), false);
  assert.equal(isDeceptive('merchant'), true);
  assert.equal(isDeceptive('junk'), false); // default (black) is honest
});

test('nextColours cycles through the set and wraps around', () => {
  let id = DEFAULT_COLOURS;
  const seen = new Set([id]);
  for (let i = 0; i < COLOURS.length; i++) id = nextColours(id);
  assert.equal(id, DEFAULT_COLOURS, 'a full cycle returns to the start');
  // each step lands on a real, distinct colour
  id = DEFAULT_COLOURS;
  for (let i = 0; i < COLOURS.length - 1; i++) {
    id = nextColours(id);
    assert.ok(colourById(id).id === id);
    seen.add(id);
  }
  assert.equal(seen.size, COLOURS.length, 'cycling visits every colour');
  assert.equal(nextColours('junk'), COLOURS[1 % COLOURS.length].id, 'junk cycles from the default');
});

// ---- NPC reaction to the DISPLAYED colours (not just renown) ---------------------------
test('menaceLevel buckets infamy monotonically (junk → 0)', () => {
  assert.equal(menaceLevel(0), 0);
  assert.equal(menaceLevel(-50), 0);
  assert.equal(menaceLevel(NaN), 0);
  assert.ok(menaceLevel(10_000) >= menaceLevel(100));
  // strictly non-decreasing over a sweep
  let prev = -1;
  for (let i = 0; i <= 10_000; i += 250) {
    const m = menaceLevel(i);
    assert.ok(m >= prev, `menace must not drop at ${i}`);
    prev = Math.max(prev, m);
  }
});

test('a feared captain under TRUE black colours is reacted to by renown', () => {
  assert.equal(npcDisposition({ colours: 'black', infamy: 0 }), 'calm'); // an unknown nobody
  assert.equal(npcDisposition({ colours: 'black', infamy: 300 }), 'wary'); // a known menace
  assert.equal(npcDisposition({ colours: 'black', infamy: 5000 }), 'hostile'); // a terror
  assert.equal(npcFlees({ colours: 'black', infamy: 5000 }), true);
  assert.equal(npcFlees({ colours: 'black', infamy: 0 }), false);
});

test('FALSE merchant colours keep NPCs calm even for an infamous captain — the disguise works', () => {
  assert.equal(npcDisposition({ colours: 'merchant', infamy: 0 }), 'calm');
  assert.equal(npcDisposition({ colours: 'merchant', infamy: 5000 }), 'calm');
  assert.equal(npcFlees({ colours: 'merchant', infamy: 5000 }), false);
});

// ---- the treachery payoff (the point) -------------------------------------------------
test('treacheryBonus rewards a FALSE-colours strike, never an honest one', () => {
  assert.equal(treacheryBonus(100, 'black'), 0, 'attacking under true colours is honest — no bonus');
  assert.equal(treacheryBonus(100, 'merchant'), Math.round(100 * TREACHERY_RATE));
  assert.ok(treacheryBonus(100, 'merchant') > 0);
  // monotonic in base infamy
  assert.ok(treacheryBonus(200, 'merchant') > treacheryBonus(100, 'merchant'));
});

test('treacheryBonus is junk-safe (negative / NaN base → 0)', () => {
  assert.equal(treacheryBonus(-10, 'merchant'), 0);
  assert.equal(treacheryBonus(NaN, 'merchant'), 0);
  assert.equal(treacheryBonus(0, 'merchant'), 0);
});

test('surpriseDamage gives an opening advantage only under false colours', () => {
  assert.equal(surpriseDamage('black'), 0);
  assert.equal(surpriseDamage('merchant'), SURPRISE_DAMAGE);
  assert.ok(SURPRISE_DAMAGE > 0);
});

// ---- the CREATIVE SPARK: bluff banter -------------------------------------------------
test('banter pools exist, are non-empty, and pick deterministically with a seeded rng', () => {
  assert.ok(Array.isArray(HOIST_LINES.black) && HOIST_LINES.black.length > 0);
  assert.ok(Array.isArray(HOIST_LINES.merchant) && HOIST_LINES.merchant.length > 0);
  assert.ok(Array.isArray(FOOLED_LINES) && FOOLED_LINES.length > 0);
  assert.ok(Array.isArray(REVEAL_LINES) && REVEAL_LINES.length > 0);
  // deterministic: rng() === 0 always picks the first line; mid picks within range
  assert.equal(pickLine(FOOLED_LINES, () => 0), FOOLED_LINES[0]);
  const mid = pickLine(REVEAL_LINES, () => 0.999);
  assert.ok(REVEAL_LINES.includes(mid));
  // junk pool → empty string, never throws
  assert.equal(pickLine(null, () => 0), '');
  assert.equal(pickLine([], () => 0), '');
});
