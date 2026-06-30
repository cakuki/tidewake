import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canBoard, resolveBrawl, brawlMoraleDent, BOARD_HULL_FRACTION,
  BRAWL_LINES_WON, BRAWL_LINES_CLOSE,
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
