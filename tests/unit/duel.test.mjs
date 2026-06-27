import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MORALE, INSULTS, CATEGORIES,
  makeEnemy, pickOptions, resolveInsult, clampMorale, isOver, reward, penalty,
} from '../../src/duel.js';

const half = () => 0.5; // deterministic rng: jitter multiplier == 1.0

// A fixed enemy so category outcomes are predictable.
function fixedEnemy(weakTo = 'pride', guard = 'wit') {
  return { name: 'Test Captain', morale: MAX_MORALE, maxMorale: MAX_MORALE, weakTo, guard };
}
const bySting = (cat, sting = 20) => ({ id: 't', category: cat, sting, line: 'x', comeback: 'y' });

test('content: at least 12 original insults, each with a category and comeback', () => {
  assert.ok(INSULTS.length >= 12, `expected >= 12 insults, got ${INSULTS.length}`);
  for (const ins of INSULTS) {
    assert.ok(CATEGORIES.includes(ins.category), `bad category: ${ins.category}`);
    assert.ok(typeof ins.line === 'string' && ins.line.length > 0);
    assert.ok(typeof ins.comeback === 'string' && ins.comeback.length > 0);
    assert.ok(ins.sting > 0);
  }
  // every category is represented so an enemy's weakness always has matching lines
  for (const c of CATEGORIES) assert.ok(INSULTS.some((i) => i.category === c), `no insult for ${c}`);
});

test('resolveInsult: a cutting insult (matches weakness) lowers enemy more than the player', () => {
  const enemy = fixedEnemy('pride', 'wit');
  const r = resolveInsult(bySting('pride', 20), enemy, half);
  assert.equal(r.outcome, 'cutting');
  assert.ok(r.enemyDelta < 0, 'enemy morale should drop');
  assert.equal(r.playerDelta, 0, 'a sharp pick costs the player nothing');
  assert.ok(Math.abs(r.enemyDelta) > Math.abs(r.playerDelta));
});

test('resolveInsult: a backfiring insult (matches enemy guard) shakes the player and barely dents the enemy', () => {
  const enemy = fixedEnemy('pride', 'wit');
  const r = resolveInsult(bySting('wit', 20), enemy, half);
  assert.equal(r.outcome, 'backfire');
  assert.ok(r.playerDelta < 0, 'a mismatched jab costs the player');
  assert.ok(Math.abs(r.enemyDelta) < Math.abs(r.playerDelta), 'a whiff cannot out-hurt the enemy');
});

test('resolveInsult: a strong cutting line hurts the enemy more than a weak/glancing one', () => {
  const enemy = fixedEnemy('pride', 'wit');
  const strong = resolveInsult(bySting('pride', 26), enemy, half); // matches weakness
  const weak = resolveInsult(bySting('looks', 18), enemy, half);   // neutral glance
  assert.equal(weak.outcome, 'glancing');
  assert.ok(Math.abs(strong.enemyDelta) > Math.abs(weak.enemyDelta));
});

test('clampMorale: bounds stay within [0, max]', () => {
  assert.equal(clampMorale(-30, 100), 0);
  assert.equal(clampMorale(130, 100), 100);
  assert.equal(clampMorale(42, 100), 42);
});

test('isOver: triggers at or below zero, not above', () => {
  assert.equal(isOver(0), true);
  assert.equal(isOver(-1), true);
  assert.equal(isOver(0.5), false);
  assert.equal(isOver(100), false);
});

test('reward: positive, scales with the fight, and stays modest/bounded', () => {
  const small = reward({ playerMorale: 10, enemyMaxMorale: 60 });
  const big = reward({ playerMorale: 100, enemyMaxMorale: 140 });
  assert.ok(small.coins > 0 && small.renown > 0);
  assert.ok(big.coins > small.coins, 'a tougher, cleaner win pays more');
  assert.ok(big.renown > small.renown);
  assert.ok(big.coins <= 120, 'reward stays modest (not free riches)');
});

test('penalty: a comic setback — small, positive, never punishing', () => {
  const p = penalty();
  assert.ok(p.coins > 0 && p.coins <= 15);
});

test('makeEnemy + pickOptions: options always include a winning (weakness) line and are distinct', () => {
  const enemy = makeEnemy(half);
  assert.ok(CATEGORIES.includes(enemy.weakTo));
  assert.notEqual(enemy.weakTo, enemy.guard);
  assert.equal(enemy.morale, MAX_MORALE);
  const opts = pickOptions(half, enemy, 4);
  assert.equal(opts.length, 4);
  const ids = new Set(opts.map((o) => o.id));
  assert.equal(ids.size, 4, 'no duplicate options');
  assert.ok(opts.some((o) => o.category === enemy.weakTo), 'a sharp line is always offered');
});

test('a full duel is winnable by always playing the enemy weakness', () => {
  const enemy = makeEnemy(half);
  let enemyMorale = enemy.morale, playerMorale = MAX_MORALE, rounds = 0;
  while (!isOver(enemyMorale) && !isOver(playerMorale) && rounds < 50) {
    const opts = pickOptions(half, enemy, 4);
    const sharp = opts.find((o) => o.category === enemy.weakTo);
    const r = resolveInsult(sharp, enemy, half);
    enemyMorale = clampMorale(enemyMorale + r.enemyDelta, enemy.maxMorale);
    playerMorale = clampMorale(playerMorale + r.playerDelta, MAX_MORALE);
    rounds++;
  }
  assert.ok(isOver(enemyMorale), 'enemy should break');
  assert.ok(!isOver(playerMorale), 'player should survive a clean duel');
});
