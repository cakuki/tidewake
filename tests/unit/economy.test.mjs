import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GOODS, HOLD_CAP, START_COINS,
  priceAt, market, cargoUsed, initEconomy, buy, sell, resolveGood,
} from '../../src/economy.js';

// A fresh, headless-safe trader state (no DOM, no three.js).
function freshState(overrides = {}) {
  const s = {};
  initEconomy(s);
  return Object.assign(s, overrides);
}

test('initEconomy: seeds coins, empty cargo, no port — only if missing', () => {
  const s = {};
  initEconomy(s);
  assert.equal(s.coins, START_COINS);
  assert.deepEqual(s.cargo, {});
  // idempotent: keeps existing values
  s.coins = 7; s.cargo = { rum: 2 };
  initEconomy(s);
  assert.equal(s.coins, 7);
  assert.deepEqual(s.cargo, { rum: 2 });
});

test('priceAt: sell is always below buy at the same port (no free money)', () => {
  for (const g of GOODS) {
    for (const port of ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"]) {
      const { buy: b, sell: s } = priceAt(port, g.id);
      assert.ok(s < b, `${g.id} @ ${port}: sell ${s} should be < buy ${b}`);
    }
  }
});

test('priceAt: prices differ between ports so arbitrage is possible', () => {
  // Buy rum cheap at Barnacle Bottom, sell dear at Gullet's Rest → net profit.
  const buyHere = priceAt('Barnacle Bottom', 'rum').buy;
  const sellThere = priceAt("Gullet's Rest", 'rum').sell;
  assert.ok(sellThere > buyHere, `expected arbitrage: sell ${sellThere} > buy ${buyHere}`);
});

test('priceAt: unknown port or good throws (programmer error)', () => {
  assert.throws(() => priceAt('Atlantis', 'rum'));
  assert.throws(() => priceAt('Saltpurse Quay', 'moonbeams'));
});

test('market: lists every good with buy/sell for a port', () => {
  const m = market('Saltpurse Quay');
  assert.equal(m.length, GOODS.length);
  assert.ok(m.every((row) => typeof row.buy === 'number' && typeof row.sell === 'number' && row.name));
});

test('buy: reduces coins and adds cargo', () => {
  const s = freshState();
  const price = priceAt('Barnacle Bottom', 'rum').buy;
  const r = buy(s, 'rum', 2, 'Barnacle Bottom');
  assert.equal(r.ok, true);
  assert.equal(s.coins, START_COINS - price * 2);
  assert.equal(s.cargo.rum, 2);
  assert.equal(cargoUsed(s.cargo), 2);
});

test("buy: can't overspend — state unchanged on failure", () => {
  const s = freshState();
  const r = buy(s, 'silk', 999, 'Saltpurse Quay');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-coins');
  assert.equal(s.coins, START_COINS);
  assert.deepEqual(s.cargo, {});
});

test("buy: can't exceed cargo hold capacity", () => {
  const s = freshState({ coins: 100000 }); // plenty of coin, capacity is the limit
  const r = buy(s, 'salt-cod', HOLD_CAP + 1, 'Saltpurse Quay');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-room');
  assert.deepEqual(s.cargo, {});
  // filling exactly to capacity is allowed
  const ok = buy(s, 'salt-cod', HOLD_CAP, 'Saltpurse Quay');
  assert.equal(ok.ok, true);
  assert.equal(cargoUsed(s.cargo), HOLD_CAP);
});

test('buy: rejects bad quantity and unknown goods', () => {
  const s = freshState();
  assert.equal(buy(s, 'rum', 0, 'Barnacle Bottom').reason, 'bad-qty');
  assert.equal(buy(s, 'rum', -3, 'Barnacle Bottom').reason, 'bad-qty');
  assert.equal(buy(s, 'unicorn', 1, 'Barnacle Bottom').reason, 'unknown-good');
  assert.deepEqual(s.cargo, {});
  assert.equal(s.coins, START_COINS);
});

test('sell: adds coins and removes cargo', () => {
  const s = freshState({ cargo: { rum: 3 } });
  const price = priceAt("Gullet's Rest", 'rum').sell;
  const r = sell(s, 'rum', 2, "Gullet's Rest");
  assert.equal(r.ok, true);
  assert.equal(s.coins, START_COINS + price * 2);
  assert.equal(s.cargo.rum, 1);
});

test("sell: can't oversell — state unchanged on failure", () => {
  const s = freshState({ cargo: { rum: 1 } });
  const r = sell(s, 'rum', 5, "Gullet's Rest");
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-cargo');
  assert.equal(s.coins, START_COINS);
  assert.equal(s.cargo.rum, 1);
});

// ---- Docking → trade integration seam (regression for #29) ----------------
// The live bug: docking set the port but the trade hook couldn't drive a buy.
// Two seams broke it — good addressed by display NAME, and the docked-port default.

test('resolveGood: accepts canonical id or display name, case-insensitively', () => {
  assert.equal(resolveGood('rum').id, 'rum');
  assert.equal(resolveGood('Rum').id, 'rum');        // display name, capitalised
  assert.equal(resolveGood('RUM').id, 'rum');
  assert.equal(resolveGood('salt-cod').id, 'salt-cod');
  assert.equal(resolveGood('Salt-cod').id, 'salt-cod');
  assert.equal(resolveGood('moonbeams'), null);
  assert.equal(resolveGood(undefined), null);
});

test('#29 buy: addressing a good by display name still trades (Rum → rum)', () => {
  const s = freshState();
  const price = priceAt('Barnacle Bottom', 'rum').buy;
  const r = buy(s, 'Rum', 2, 'Barnacle Bottom');     // capital-N name, as the QA hook used
  assert.equal(r.ok, true);
  assert.equal(s.coins, START_COINS - price * 2);
  assert.equal(s.cargo.rum, 2);                       // stored under canonical id, not 'Rum'
  assert.equal(s.cargo.Rum, undefined);
});

test('#29 docked seam: state.port → market → buy reduces coins (no explicit port)', () => {
  // Mirrors the renderer: ports.update sets state.port to the docked port; the
  // trade hook then calls buy(state, good) with no port, defaulting to state.port.
  const s = freshState();
  s.port = 'Barnacle Bottom';                         // "docked"
  const board = market(s.port);
  const rum = board.find((row) => row.name === 'Rum');
  const before = s.coins;
  const r = buy(s, rum.name, 1);                      // name + docked-port default
  assert.equal(r.ok, true);
  assert.equal(s.coins, before - rum.buy);
  assert.equal(cargoUsed(s.cargo), 1);
  // and sell via the same docked default restores the hold
  const sr = sell(s, rum.name, 1);
  assert.equal(sr.ok, true);
  assert.equal(cargoUsed(s.cargo), 0);
});

// ---- Standing perk (#43): the world favours a known captain ----------------

test('priceAt: standing never hurts the captain and never makes sell >= buy', () => {
  const RENOWN_HI = 5000; // Sea Captain → top tier
  for (const g of GOODS) {
    for (const port of ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"]) {
      const base = priceAt(port, g.id, 0);
      const fav = priceAt(port, g.id, RENOWN_HI);
      assert.ok(fav.buy <= base.buy, `${g.id}@${port}: favoured buy ${fav.buy} > base ${base.buy}`);
      // Standing must never *widen* the round-trip spread you pay (buy - sell).
      assert.ok((fav.buy - fav.sell) <= (base.buy - base.sell),
        `${g.id}@${port}: standing widened the spread`);
      assert.ok(fav.sell < fav.buy, `${g.id}@${port}: no free money even with standing`);
    }
  }
  // At least one good shows a visibly better deal (not all swallowed by rounding).
  const b0 = priceAt('Saltpurse Quay', 'silk', 0);
  const bHi = priceAt('Saltpurse Quay', 'silk', 5000);
  assert.ok(bHi.buy < b0.buy && bHi.sell > b0.sell, 'silk terms visibly improve with standing');
});

test('buy: a renowned captain pays less than an unknown one', () => {
  const unknown = freshState({ renown: 0 });
  const renowned = freshState({ renown: 5000 });
  buy(unknown, 'silk', 1, 'Saltpurse Quay');
  buy(renowned, 'silk', 1, 'Saltpurse Quay');
  const paidUnknown = START_COINS - unknown.coins;
  const paidRenowned = START_COINS - renowned.coins;
  assert.ok(paidRenowned < paidUnknown, `renowned paid ${paidRenowned}, unknown paid ${paidUnknown}`);
});

test('sell: a renowned captain is paid more than an unknown one', () => {
  const unknown = freshState({ renown: 0, cargo: { silk: 1 } });
  const renowned = freshState({ renown: 5000, cargo: { silk: 1 } });
  sell(unknown, 'silk', 1, 'Saltpurse Quay');
  sell(renowned, 'silk', 1, 'Saltpurse Quay');
  assert.ok(renowned.coins > unknown.coins, `renowned got ${renowned.coins}, unknown ${unknown.coins}`);
});

test('arbitrage loop: buy low, sail, sell high → net profit', () => {
  const s = freshState();
  buy(s, 'rum', 4, 'Barnacle Bottom');   // cheap rum
  const afterBuy = s.coins;
  sell(s, 'rum', 4, "Gullet's Rest");    // thirsty sailors pay dear
  assert.ok(s.coins > START_COINS, `expected profit, got ${s.coins} from ${START_COINS}`);
  assert.ok(s.coins > afterBuy);
  assert.equal(cargoUsed(s.cargo), 0);
});
