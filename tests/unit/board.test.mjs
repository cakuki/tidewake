import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBoard, resolveBrawl, brawlMoraleDent, BOARD_HULL_FRACTION,
  BRAWL_LINES_WON, BRAWL_LINES_CLOSE,
  prizeFork, SINK_INFAMY_BONUS, SPARE_RANSOM_BONUS, SPARE_MIN_STANDING,
} from '../../src/systems/board.js';

const half = () => 0.5; // deterministic rng

test('canBoard: a foe at or below 30% hull is boardable, above it is not', () => {
  assert.equal(canBoard({ enemyHull: 30, maxHull: 100 }), true, 'dead on 30% boards');
  assert.equal(canBoard({ enemyHull: 12, maxHull: 100 }), true, 'well below the line boards');
  assert.equal(canBoard({ enemyHull: 31, maxHull: 100 }), false, 'just above the line does not');
  assert.equal(canBoard({ enemyHull: 100, maxHull: 100 }), false, 'a fresh hull never boards');
});

test('canBoard: the threshold tracks BOARD_HULL_FRACTION and a different max hull', () => {
  assert.equal(canBoard({ enemyHull: 60, maxHull: 200 }), true, '30% of 200 = 60');
  assert.equal(canBoard({ enemyHull: 61, maxHull: 200 }), false);
  assert.ok(BOARD_HULL_FRACTION > 0 && BOARD_HULL_FRACTION < 1, 'fraction is a sane 0..1');
});

test('canBoard: a missing / zero max hull is never boardable (fails safe)', () => {
  assert.equal(canBoard({ enemyHull: 0, maxHull: 0 }), false);
  assert.equal(canBoard({}), false);
  assert.equal(canBoard(), false);
});

test('resolveBrawl: a strong, well-armed crew over a beaten foe carries the deck', () => {
  const r = resolveBrawl(
    { crewMorale: 100, maxMorale: 100, loadout: ['round', 'grape'], foeMorale: 18, foeHull: 18, maxHull: 100 },
    half,
  );
  assert.equal(r.won, true, 'the brawl is won');
  assert.ok(r.advantage > 0, 'a winning margin yields a positive advantage');
  assert.ok(r.advantage <= 1, 'advantage is clamped to 1');
});

test('resolveBrawl: a shaken crew against a stubborn foe is repelled (lost brawl)', () => {
  const r = resolveBrawl(
    { crewMorale: 20, maxMorale: 100, loadout: ['round'], foeMorale: 100, foeHull: 30, maxHull: 100 },
    half,
  );
  assert.equal(r.won, false, 'the brawl is lost');
  assert.equal(r.advantage, 0, 'a losing margin clamps advantage to 0');
});

test('resolveBrawl: a deck-sweeping loadout (grape/swivel) boards with an edge over plain round', () => {
  const args = { crewMorale: 70, maxMorale: 100, foeMorale: 55, foeHull: 28, maxHull: 100 };
  const plain = resolveBrawl({ ...args, loadout: ['round'] }, half);
  const grape = resolveBrawl({ ...args, loadout: ['round', 'grape'] }, half);
  assert.ok(grape.margin > plain.margin, 'grapeshot lifts the boarding margin');
});

test('resolveBrawl: always narrates the scrap with 2–3 distinct comic lines', () => {
  for (const rng of [half, () => 0.1, () => 0.9, Math.random]) {
    const r = resolveBrawl({ crewMorale: 80, maxMorale: 100, loadout: ['round'], foeMorale: 40, foeHull: 20, maxHull: 100 }, rng);
    assert.ok(Array.isArray(r.lines), 'lines is an array');
    assert.ok(r.lines.length >= 2 && r.lines.length <= 3, `2–3 lines, got ${r.lines.length}`);
    assert.equal(new Set(r.lines).size, r.lines.length, 'the lines never repeat within a brawl');
    for (const l of r.lines) assert.ok(typeof l === 'string' && l.length, 'each line is a real string');
  }
});

test('resolveBrawl: degrades safely on empty / junk input (always boards into a duel)', () => {
  const r = resolveBrawl({}, half);
  assert.ok(typeof r.won === 'boolean');
  assert.ok(r.lines.length >= 2);
});

test('brawlMoraleDent: a bigger advantage softens the captain more, clamped to a sane band', () => {
  assert.equal(brawlMoraleDent(0), 0, 'a lost / even brawl gives no opening dent');
  assert.ok(brawlMoraleDent(1) > brawlMoraleDent(0.4), 'a runaway brawl dents more');
  assert.ok(brawlMoraleDent(1) <= 30, 'the dent never trivialises the captain duel');
  assert.equal(brawlMoraleDent(5), brawlMoraleDent(1), 'advantage is clamped at 1');
});

test('the comic line pools are non-trivial and original (>=3 each so a brawl never starves)', () => {
  assert.ok(BRAWL_LINES_WON.length >= 3);
  assert.ok(BRAWL_LINES_CLOSE.length >= 3);
});

// ── Sink-or-spare fork (Option 4, slice 1) ────────────────────────────────────────────────────────
test('prizeFork: SINK is the pirate road — bonus infamy, no ransom, no standing, not captured', () => {
  const f = prizeFork('sink', { coins: 100, infamy: 200 });
  assert.equal(f.choice, 'sink');
  assert.equal(f.addStanding, 0, 'sinking her earns nothing with the ports');
  assert.equal(f.addCoins, 0, 'a scuttled ship pays no ransom');
  assert.equal(f.addInfamy, Math.round(200 * SINK_INFAMY_BONUS), 'the deep deepens the legend');
  assert.equal(f.captured, false, 'a sunk ship is no prize');
  assert.ok(f.addInfamy > 0, 'sinking always adds SOME infamy');
});

test('prizeFork: SPARE is the governor road — a ransom purse + standing, no bonus infamy, captured', () => {
  const f = prizeFork('spare', { coins: 100, infamy: 200 });
  assert.equal(f.choice, 'spare');
  assert.equal(f.addCoins, Math.round(100 * SPARE_RANSOM_BONUS), 'her crew ransoms her back');
  assert.equal(f.addStanding, Math.max(SPARE_MIN_STANDING, Math.round(200 * 0.5)), 'mercy pays the governor pole');
  assert.equal(f.addInfamy, 0, 'sparing tempers the swagger — no bonus infamy');
  assert.equal(f.captured, true, 'a spared ship is a prize taken intact');
});

test('prizeFork: the two roads are a GENUINE fork — sink beats spare on infamy, spare beats sink on standing', () => {
  const base = { coins: 120, infamy: 160 };
  const sink = prizeFork('sink', base);
  const spare = prizeFork('spare', base);
  assert.ok(sink.addInfamy > spare.addInfamy, 'sink is the higher-infamy road');
  assert.ok(spare.addStanding > sink.addStanding, 'spare is the standing road');
  assert.ok(spare.addCoins > sink.addCoins, 'spare is the fatter purse');
});

test('prizeFork: SPARE floors standing so even a feeble duel still nudges the governor pole', () => {
  const f = prizeFork('spare', { coins: 0, infamy: 0 });
  assert.equal(f.addStanding, SPARE_MIN_STANDING, 'the standing floor holds on a tiny win');
});

test('prizeFork: unknown / absent choice defaults to SPARE (ledger-safe — never a stray scuttle)', () => {
  assert.equal(prizeFork(undefined, { coins: 50, infamy: 50 }).choice, 'spare');
  assert.equal(prizeFork('nonsense', { coins: 50, infamy: 50 }).choice, 'spare');
  assert.equal(prizeFork('spare').choice, 'spare', 'degrades safely on empty base too');
});

test('prizeFork: clamps junk numeric input, never emitting a negative delta', () => {
  const f = prizeFork('sink', { coins: -999, infamy: -999 });
  assert.ok(f.addInfamy >= 0 && f.addCoins >= 0 && f.addStanding >= 0, 'no negative rewards leak out');
});
