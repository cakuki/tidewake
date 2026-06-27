// Letters of Marque (#91) — the LAWFUL pole, the honest mirror of False Colours (#79).
// Pure-logic gate (the #53 house standard): the Standing reward for hunting pirates honestly,
// the piracy fine for gunning down innocents, the deterministic vessel dispositions, and the
// rising "seen-through" risk of the bluff. All DOM-free, deterministic under `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VESSEL_KINDS, vesselKind, isOutlaw,
  LAWFUL_RATE, PIRACY_FINE, lawfulStanding,
  SEEN_THROUGH_FLOOR, SEEN_THROUGH_CEIL, SEEN_THROUGH_CAP,
  seenThroughChance, isSeenThrough,
  npcDisposition, npcFlees,
  LAWFUL_LINES, PIRACY_LINES, SEEN_THROUGH_LINES, pickLine,
} from '../../src/colours.js';

// ---- vessel dispositions --------------------------------------------------------------
test('vesselKind is deterministic, stable, and yields both kinds in a small fleet', () => {
  assert.deepEqual(VESSEL_KINDS, ['merchant', 'pirate']);
  // deterministic + repeatable for a given slot
  for (let i = 0; i < 12; i++) assert.equal(vesselKind(i), vesselKind(i));
  // a default fleet of 3 carries at least one pirate AND at least one merchant
  const fleet = [0, 1, 2].map(vesselKind);
  assert.ok(fleet.includes('pirate'), 'a pirate to hunt exists in the default fleet');
  assert.ok(fleet.includes('merchant'), 'a merchant to spare exists in the default fleet');
  // junk index → an honest merchant (never throws)
  assert.equal(vesselKind(-3), 'merchant');
  assert.equal(vesselKind(1.5), 'merchant');
  assert.equal(vesselKind(NaN), 'merchant');
});

test('isOutlaw reads pirate vessels and nothing else', () => {
  assert.equal(isOutlaw('pirate'), true);
  assert.equal(isOutlaw('merchant'), false);
  assert.equal(isOutlaw('junk'), false);
  assert.equal(isOutlaw(undefined), false);
});

// ---- the lawful Standing reward (the point) -------------------------------------------
test('lawfulStanding rewards an HONEST pirate-kill and never a deceptive one', () => {
  assert.equal(lawfulStanding(100, 'black', 'pirate'), Math.round(100 * LAWFUL_RATE));
  assert.ok(lawfulStanding(100, 'black', 'pirate') > 0, 'lawful privateering earns Standing');
  // a lie forfeits the lawful claim — that's the Infamy road (#79), not Standing
  assert.equal(lawfulStanding(100, 'merchant', 'pirate'), 0);
});

test('lawfulStanding FINES an honest strike on an innocent merchant (lawful path is actually lawful)', () => {
  const fine = lawfulStanding(100, 'black', 'merchant');
  assert.ok(fine < 0, 'gunning down an innocent under your own flag costs Standing');
  assert.equal(fine, -Math.round(100 * PIRACY_FINE));
});

test('lawfulStanding is monotonic in the base value and junk-safe', () => {
  assert.ok(lawfulStanding(200, 'black', 'pirate') > lawfulStanding(100, 'black', 'pirate'));
  assert.equal(lawfulStanding(-10, 'black', 'pirate'), 0);
  assert.equal(lawfulStanding(NaN, 'black', 'pirate'), 0);
  assert.equal(lawfulStanding(0, 'black', 'pirate'), 0);
});

test('the two poles MIRROR: a lawful pirate-kill (Standing) opposes a treacherous strike (Infamy)', () => {
  // honest + pirate feeds the governor pole; deceptive feeds nothing here (it feeds Infamy in #79)
  assert.ok(lawfulStanding(100, 'black', 'pirate') > 0);
  assert.equal(lawfulStanding(100, 'merchant', 'pirate'), 0);
});

// ---- the "seen-through" risk ----------------------------------------------------------
test('seenThroughChance is 0 at low infamy, rises monotonically, and is capped < 1', () => {
  assert.equal(seenThroughChance(0, 'merchant'), 0, 'an unknown captain is never doubted');
  assert.equal(seenThroughChance(SEEN_THROUGH_FLOOR, 'merchant'), 0, 'at the floor the bluff is still free');
  assert.ok(seenThroughChance(SEEN_THROUGH_CEIL, 'merchant') > 0, 'a notorious captain risks detection');
  assert.ok(SEEN_THROUGH_CAP < 1, 'the bluff always keeps a sporting chance');
  assert.ok(seenThroughChance(SEEN_THROUGH_CEIL, 'merchant') <= SEEN_THROUGH_CAP + 1e-9);
  assert.ok(seenThroughChance(1e9, 'merchant') <= SEEN_THROUGH_CAP + 1e-9, 'never exceeds the cap');
  // strictly non-decreasing across a sweep
  let prev = -1;
  for (let i = 0; i <= 6000; i += 100) {
    const c = seenThroughChance(i, 'merchant');
    assert.ok(c >= prev - 1e-9, `chance must not drop at infamy ${i}`);
    prev = c;
  }
  // honest colours can never be "seen through"
  assert.equal(seenThroughChance(5000, 'black'), 0);
});

test('isSeenThrough resolves deterministically with an injected rng', () => {
  // at high infamy (chance ~0.85): a low roll pierces the disguise, a near-1 roll holds it
  assert.equal(isSeenThrough(5000, 'merchant', () => 0), true);
  assert.equal(isSeenThrough(5000, 'merchant', () => 0.999), false);
  // honest colours: nothing to pierce, whatever the roll
  assert.equal(isSeenThrough(5000, 'black', () => 0), false);
  // low infamy: a free pass even on a roll of 0 (chance is exactly 0)
  assert.equal(isSeenThrough(0, 'merchant', () => 0), false);
});

test('npcDisposition: a seen-through disguise makes a notorious captain read as their true self', () => {
  // the lie holds → calm, even feared
  assert.equal(npcDisposition({ colours: 'merchant', infamy: 5000, seenThrough: false }), 'calm');
  // the lie is pierced → they react to the real renown (a terror → hostile, flees)
  assert.equal(npcDisposition({ colours: 'merchant', infamy: 5000, seenThrough: true }), 'hostile');
  assert.equal(npcFlees({ colours: 'merchant', infamy: 5000, seenThrough: true }), true);
  assert.equal(npcFlees({ colours: 'merchant', infamy: 5000, seenThrough: false }), false);
  // default (no seenThrough) preserves the #79 behaviour exactly
  assert.equal(npcDisposition({ colours: 'merchant', infamy: 5000 }), 'calm');
});

// ---- the CREATIVE SPARK: lawful pride, piracy wince, the rumbled squint ----------------
test('lawful / piracy / seen-through banter pools exist and pick deterministically', () => {
  for (const pool of [LAWFUL_LINES, PIRACY_LINES, SEEN_THROUGH_LINES]) {
    assert.ok(Array.isArray(pool) && pool.length > 0);
    assert.equal(pickLine(pool, () => 0), pool[0]);
    assert.ok(pool.includes(pickLine(pool, () => 0.999)));
  }
});
