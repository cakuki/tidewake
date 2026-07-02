import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_CLASS_LADDER, CLASS_COSTS, PLAYER_COMBAT,
  nextClass, nextClassCost, canBuyClass, buyClass,
  classScale, classBroadsideMult, classArmor, classLabel, sanitizeShipClass,
} from '../../src/systems/ship-class-upgrade.js';
import { resolveBroadside, resolveExchange } from '../../src/cannons.js';
import { SHIP_CLASSES } from '../../src/ship-classes.js';

test('the buyable ladder starts at the sloop and steps up to the frigate', () => {
  assert.deepEqual(PLAYER_CLASS_LADDER, ['sloop', 'brig', 'frigate']);
});

test('nextClass walks the ladder then returns null at the top / off-ladder', () => {
  assert.equal(nextClass('sloop'), 'brig');
  assert.equal(nextClass('brig'), 'frigate');
  assert.equal(nextClass('frigate'), null);      // maxed for this slice
  assert.equal(nextClass('manowar'), null);      // off the buyable ladder → treated as maxed
  assert.equal(nextClass(undefined), 'brig');    // junk sanitises to sloop → next is brig
});

test('nextClassCost follows the escalating curve then null at the cap', () => {
  assert.equal(nextClassCost('sloop'), CLASS_COSTS.brig);
  assert.equal(nextClassCost('brig'), CLASS_COSTS.frigate);
  assert.equal(nextClassCost('frigate'), null);
  assert.ok(CLASS_COSTS.frigate > CLASS_COSTS.brig, 'each class up should cost more');
});

test('canBuyClass gates on purse and the ladder cap', () => {
  assert.deepEqual(canBuyClass({ shipClass: 'sloop', coins: 10000 }),
    { ok: true, reason: null, cost: CLASS_COSTS.brig, next: 'brig' });
  const poor = canBuyClass({ shipClass: 'sloop', coins: 10 });
  assert.equal(poor.ok, false);
  assert.equal(poor.reason, 'no-coins');
  assert.equal(poor.cost, CLASS_COSTS.brig);
  const maxed = canBuyClass({ shipClass: 'frigate', coins: 999999 });
  assert.equal(maxed.ok, false);
  assert.equal(maxed.reason, 'maxed');
  assert.equal(maxed.cost, null);
});

test('buyClass advances the class and docks the purse; is pure (never mutates)', () => {
  const before = { shipClass: 'sloop', coins: 2000 };
  const res = buyClass(before);
  assert.equal(res.ok, true);
  assert.equal(res.shipClass, 'brig');
  assert.equal(res.coins, 2000 - CLASS_COSTS.brig);
  assert.equal(res.cost, CLASS_COSTS.brig);
  assert.equal(res.next, 'frigate');
  // input untouched
  assert.deepEqual(before, { shipClass: 'sloop', coins: 2000 });
});

test('buyClass refuses when broke or maxed, returning state unchanged with a reason', () => {
  const broke = buyClass({ shipClass: 'sloop', coins: 100 });
  assert.equal(broke.ok, false);
  assert.equal(broke.reason, 'no-coins');
  assert.equal(broke.shipClass, 'sloop');
  assert.equal(broke.coins, 100);

  const maxed = buyClass({ shipClass: 'frigate', coins: 999999 });
  assert.equal(maxed.ok, false);
  assert.equal(maxed.reason, 'maxed');
  assert.equal(maxed.shipClass, 'frigate');
});

test('a full save-up walks sloop → brig → frigate → maxed', () => {
  let s = { shipClass: 'sloop', coins: 5000 };
  s = buyClass(s); assert.equal(s.shipClass, 'brig');
  s = buyClass(s); assert.equal(s.shipClass, 'frigate');
  const over = buyClass(s);
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'maxed');
});

test('classScale reuses the NPC sizeScale, sloop = exactly 1.0 (byte-identical baseline)', () => {
  assert.equal(classScale('sloop'), 1);
  const brig = SHIP_CLASSES.brig.sizeScale / SHIP_CLASSES.sloop.sizeScale;
  const frig = SHIP_CLASSES.frigate.sizeScale / SHIP_CLASSES.sloop.sizeScale;
  assert.equal(classScale('brig'), brig);
  assert.equal(classScale('frigate'), frig);
  // the frigate visibly DWARFS the sloop — the whole point of the slice
  assert.ok(classScale('frigate') > classScale('brig'));
  assert.ok(classScale('brig') > classScale('sloop'));
  assert.ok(classScale('frigate') > 1.5, 'a frigate should be well over half again the sloop');
});

test('class combat mults ascend; the sloop is the ×1.0 pre-#171 baseline', () => {
  assert.equal(classBroadsideMult('sloop'), 1);
  assert.equal(classArmor('sloop'), 1);
  assert.ok(classBroadsideMult('brig') > classBroadsideMult('sloop'));
  assert.ok(classBroadsideMult('frigate') > classBroadsideMult('brig'));
  assert.ok(classArmor('brig') > classArmor('sloop'));
  assert.ok(classArmor('frigate') > classArmor('brig'));
  // a frigate is a real edge but never invincible
  assert.ok(classArmor('frigate') < 2, 'armour must not trivialise incoming fire');
});

test('junk / off-ladder classes fail open to the sloop baseline', () => {
  assert.equal(classBroadsideMult('nonsense'), 1);
  assert.equal(classArmor(undefined), 1);
  assert.equal(classScale(null), 1);
  assert.equal(sanitizeShipClass('bogus'), 'sloop');
  assert.equal(classLabel('frigate'), SHIP_CLASSES.frigate.label);
});

// The combat SEAM: a bigger class hits harder AND soaks more, both through the real broadside math.
test('a frigate hits harder than a sloop through resolveBroadside (broadsideMult seam)', () => {
  const rng = () => 0.5; // jitter == 1 → deterministic
  const target = { quality: 1, enemyHull: 100, playerHull: 100, gunnery: 1 };
  const sloopHit = resolveBroadside({ ...target, broadsideMult: classBroadsideMult('sloop') }, rng).enemyHit;
  const frigHit = resolveBroadside({ ...target, broadsideMult: classBroadsideMult('frigate') }, rng).enemyHit;
  assert.ok(frigHit > sloopHit, `frigate broadside (${frigHit}) must bite harder than a sloop (${sloopHit})`);
});

test('playerArmor reduces the fire you take; armor=1 is byte-identical to legacy', () => {
  const rng = () => 0.5;
  // enemy survives your volley so she fires back (playerHit > 0)
  const base = { quality: 0.4, enemyHull: 100, playerHull: 100, gunnery: 1 };
  const legacy = resolveBroadside({ ...base }, rng).playerHit;
  const armored1 = resolveBroadside({ ...base, playerArmor: 1 }, rng).playerHit;
  const armoredFrig = resolveBroadside({ ...base, playerArmor: classArmor('frigate') }, rng).playerHit;
  assert.equal(armored1, legacy, 'armor=1 must be byte-identical to the pre-#171 call');
  assert.ok(armoredFrig < legacy, `a frigate (armor ${classArmor('frigate')}) must take LESS fire (${armoredFrig} < ${legacy})`);

  // and the same defence holds in the turn-based cannonade
  const ex = { aim: 'broadside', enemyHull: 100, playerHull: 100, gunnery: 1 };
  const exLegacy = resolveExchange({ ...ex }, rng).playerHit;
  const exArmored = resolveExchange({ ...ex, playerArmor: classArmor('frigate') }, rng).playerHit;
  assert.equal(resolveExchange({ ...ex, playerArmor: 1 }, rng).playerHit, exLegacy);
  assert.ok(exArmored < exLegacy);
});
