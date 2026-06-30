import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MORALE, INSULTS, CATEGORIES,
  makeEnemy, pickOptions, resolveInsult, clampMorale, isOver, reward, penalty, createDuel,
} from '../../src/duel.js';

const half = () => 0.5; // deterministic rng: jitter multiplier == 1.0

// A fixed enemy so category outcomes are predictable.
function fixedEnemy(weakTo = 'pride', guard = 'wit') {
  return { name: 'Test Captain', morale: MAX_MORALE, maxMorale: MAX_MORALE, weakTo, guard };
}
const bySting = (cat, sting = 20) => ({ id: 't', category: cat, sting, line: 'x', comeback: 'y' });

test('content: a rich 50+ insult corpus, every line with a category + fitting riposte (#135 slice 5)', () => {
  assert.ok(INSULTS.length >= 50, `expected >= 50 insults, got ${INSULTS.length}`);
  const ids = new Set();
  const lines = new Set();
  const comebacks = new Set();
  for (const ins of INSULTS) {
    assert.ok(CATEGORIES.includes(ins.category), `bad category: ${ins.category}`);
    assert.ok(typeof ins.line === 'string' && ins.line.length > 0, `empty line on ${ins.id}`);
    assert.ok(typeof ins.comeback === 'string' && ins.comeback.length > 0, `empty riposte on ${ins.id}`);
    assert.ok(ins.sting > 0);
    assert.ok(!ids.has(ins.id), `duplicate id: ${ins.id}`);
    ids.add(ins.id);
    // every jab AND every riposte is original copy — no recycled lines
    assert.ok(!lines.has(ins.line), `duplicate jab line: ${ins.line}`);
    assert.ok(!comebacks.has(ins.comeback), `duplicate riposte: ${ins.comeback}`);
    lines.add(ins.line);
    comebacks.add(ins.comeback);
  }
});

test('content: 7 categories incl. Superstition + Hygiene, each with enough lines for anti-repeat (#135 slice 5)', () => {
  assert.ok(CATEGORIES.length >= 7, `expected >= 7 categories, got ${CATEGORIES.length}`);
  for (const must of ['superstition', 'hygiene']) {
    assert.ok(CATEGORIES.includes(must), `missing category: ${must}`);
  }
  // every category needs a deep-enough bench that a long fight can avoid repeating a weakness line
  for (const c of CATEGORIES) {
    const n = INSULTS.filter((i) => i.category === c).length;
    assert.ok(n >= 6, `category ${c} has only ${n} lines; need >= 6 for anti-repeat`);
  }
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

// ---- Anti-repeat selection (#135 slice 5) ----------------------------------
// A spread rng so picks land on different ids (a constant rng would keep landing on slot 0).
function spreadRng() {
  let i = 0;
  const seq = [0.07, 0.83, 0.31, 0.62, 0.19, 0.95, 0.44, 0.71, 0.05, 0.52, 0.88, 0.27, 0.66, 0.13, 0.39, 0.77];
  return () => seq[(i++) % seq.length];
}

test('pickOptions: skips recently-shown lines while a fresh bench remains (#135 slice 5)', () => {
  const enemy = makeEnemy(half);
  // Mark every line EXCEPT a generous fresh bench as "recently shown".
  const fresh = INSULTS.slice(0, 12).map((i) => i.id); // includes lines of several categories
  const recent = INSULTS.filter((i) => !fresh.includes(i.id)).map((i) => i.id);
  // Guarantee a sharp line is in the fresh bench so the sharp guarantee never forces a stale pick.
  const freshSharp = INSULTS.filter((i) => i.category === enemy.weakTo && fresh.includes(i.id));
  if (freshSharp.length === 0) return; // (rare) skip — the dedicated fallback test covers this
  const opts = pickOptions(spreadRng(), enemy, 4, recent);
  assert.equal(opts.length, 4, 'still offers a full hand');
  assert.equal(new Set(opts.map((o) => o.id)).size, 4, 'no duplicate options');
  for (const o of opts) assert.ok(!recent.includes(o.id), `offered a stale line ${o.id} despite a fresh bench`);
  assert.ok(opts.some((o) => o.category === enemy.weakTo), 'a sharp line is still always offered');
});

test('pickOptions: falls back gracefully when almost everything is recent (correctness > freshness) (#135 slice 5)', () => {
  const enemy = makeEnemy(half);
  // Mark the ENTIRE corpus as recent — anti-repeat must yield to the hard guarantees.
  const recent = INSULTS.map((i) => i.id);
  const opts = pickOptions(spreadRng(), enemy, 4, recent);
  assert.equal(opts.length, 4, 'still offers a full hand even with nothing fresh');
  assert.equal(new Set(opts.map((o) => o.id)).size, 4, 'options remain distinct');
  assert.ok(opts.some((o) => o.category === enemy.weakTo), 'the winning line is never starved out');
});

test('a multi-round duel never re-offers a line while the bench can cover it (#135 slice 5)', () => {
  // Drive the controller directly, NEVER playing the sharp line so the duel runs long; collect
  // every offered id and assert no repeat across the rounds the corpus can cover.
  const duel = createDuel({
    npcs: { snapshot: () => [{ pos: [0, 0] }], respawn() {} },
    getShipPos: () => [0, 0],
    rng: spreadRng(),
  });
  assert.equal(duel.tryChallenge(), true);
  const seen = [];
  const cap = Math.floor(INSULTS.length / 4); // rounds the bench can keep fully distinct
  for (let r = 0; r < cap && duel.state.active; r++) {
    for (const o of duel.state.options) seen.push(o.id);
    // pick a NON-sharp option so the enemy rarely breaks (keep the duel alive)
    const dull = duel.state.options.findIndex((o) => o.category !== duel.state.enemyWeakTo);
    duel.choose(dull === -1 ? 0 : dull);
  }
  // Within the bench's reach, no line was shown twice in this single engagement.
  assert.equal(new Set(seen).size, seen.length, `a line repeated within one engagement: ${seen.length} shown, ${new Set(seen).size} unique`);
});

test('anti-repeat memory carries ACROSS duels in a session (consecutive hails feel fresh) (#135 slice 5)', () => {
  const duel = createDuel({
    npcs: { snapshot: () => [{ pos: [0, 0] }], respawn() {} },
    getShipPos: () => [0, 0],
    rng: spreadRng(),
  });
  // First hail: note the opening hand, then break it off.
  assert.equal(duel.tryChallenge(), true);
  const firstHand = duel.state.options.map((o) => o.id);
  duel.cancel();
  // Second hail immediately after: the opening hand should not be the SAME stale four.
  assert.equal(duel.tryChallenge(), true);
  const secondHand = duel.state.options.map((o) => o.id);
  const overlap = secondHand.filter((id) => firstHand.includes(id)).length;
  assert.ok(overlap < 4, `the next duel opened with the exact same stale hand (overlap=${overlap})`);
});
