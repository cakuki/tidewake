import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize, SAVE_VERSION } from '../../src/save.js';
import { GOODS, HOLD_CAP, START_COINS } from '../../src/economy.js';

// A representative "live" state shape, mirroring main.js's `state` but with the
// THREE.Vector3 reduced to its array form (the renderer-free contract).
function sampleState() {
  return {
    heading: 1.2345,
    speed: 22.5,
    throttle: 0.7,
    pos: [120.5, 0, -340.25],
  };
}

test('serialize → deserialize round-trips a good state', () => {
  const s = sampleState();
  const restored = deserialize(serialize(s));
  assert.equal(restored.heading, s.heading);
  assert.equal(restored.speed, s.speed);
  assert.equal(restored.throttle, s.throttle);
  assert.deepEqual(restored.pos, s.pos);
});

test('serialize stamps the current save version', () => {
  const obj = JSON.parse(serialize(sampleState()));
  assert.equal(obj.v, SAVE_VERSION);
});

test('serialize accepts a THREE.Vector3-like pos with a toArray()', () => {
  const s = {
    heading: 0.5, speed: 10, throttle: 0.3,
    pos: { toArray: () => [1, 2, 3] },
  };
  const restored = deserialize(serialize(s));
  assert.deepEqual(restored.pos, [1, 2, 3]);
});

test('deserialize rejects null / empty / non-string', () => {
  assert.equal(deserialize(null), null);
  assert.equal(deserialize(undefined), null);
  assert.equal(deserialize(''), null);
  assert.equal(deserialize(42), null);
});

test('deserialize rejects malformed JSON', () => {
  assert.equal(deserialize('{not json'), null);
  assert.equal(deserialize('}{'), null);
});

test('deserialize rejects an old / missing version', () => {
  const good = JSON.parse(serialize(sampleState()));
  const old = { ...good, v: SAVE_VERSION - 1 };
  assert.equal(deserialize(JSON.stringify(old)), null);
  const noV = { ...good };
  delete noV.v;
  assert.equal(deserialize(JSON.stringify(noV)), null);
});

test('deserialize rejects partial / missing fields', () => {
  const good = JSON.parse(serialize(sampleState()));
  for (const k of ['heading', 'speed', 'throttle', 'pos']) {
    const partial = { ...good };
    delete partial[k];
    assert.equal(deserialize(JSON.stringify(partial)), null, `missing ${k} should reject`);
  }
});

test('deserialize rejects non-finite / NaN numbers', () => {
  const good = JSON.parse(serialize(sampleState()));
  assert.equal(deserialize(JSON.stringify({ ...good, heading: 'x' })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, speed: null })), null);
  // JSON can't carry NaN/Infinity literally, but a coerced bad value should fail
  assert.equal(deserialize(JSON.stringify({ ...good, throttle: 'NaN' })), null);
});

test('deserialize rejects a malformed pos (wrong length / non-numbers)', () => {
  const good = JSON.parse(serialize(sampleState()));
  assert.equal(deserialize(JSON.stringify({ ...good, pos: [1, 2] })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, pos: 'here' })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, pos: [1, 'b', 3] })), null);
});

test('deserialize clamps throttle to [0,1] and speed to >= 0', () => {
  const good = JSON.parse(serialize(sampleState()));
  const hi = deserialize(JSON.stringify({ ...good, throttle: 9, speed: -5 }));
  assert.equal(hi.throttle, 1);
  assert.equal(hi.speed, 0);
  const lo = deserialize(JSON.stringify({ ...good, throttle: -3 }));
  assert.equal(lo.throttle, 0);
});

test('deserialize rejects absurd / non-finite positions defensively', () => {
  const good = JSON.parse(serialize(sampleState()));
  // a position far beyond any sane world bound is treated as corrupt
  assert.equal(deserialize(JSON.stringify({ ...good, pos: [1e30, 0, 0] })), null);
});

// ---- Economy persistence (coins + cargo) ----

// A live state that also carries the economy fields from economy.js.
function economyState() {
  return {
    heading: 1, speed: 5, throttle: 0.4, pos: [10, 0, -5],
    coins: 250, cargo: { rum: 3, spice: 2 },
  };
}

test('serialize → deserialize round-trips coins + cargo', () => {
  const s = economyState();
  const restored = deserialize(serialize(s));
  assert.equal(restored.coins, 250);
  assert.deepEqual(restored.cargo, { rum: 3, spice: 2 });
});

test('serialize defaults a missing economy to a fresh purse + empty hold', () => {
  // sampleState() predates the economy fields — restored save should still be valid.
  const restored = deserialize(serialize(sampleState()));
  assert.ok(restored);
  assert.equal(restored.coins, START_COINS);
  assert.deepEqual(restored.cargo, {});
});

// ---- Displayed colours persistence (#79 False Colours, save v8) ----

test('serialize → deserialize round-trips the chosen colours', () => {
  const s = { ...economyState(), colours: 'merchant' };
  const restored = deserialize(serialize(s));
  assert.equal(restored.colours, 'merchant');
});

test('a missing or unknown colours loads as the honest black default', () => {
  const restored = deserialize(serialize(economyState())); // no colours field
  assert.equal(restored.colours, 'black');
  const good = JSON.parse(serialize({ ...economyState(), colours: 'merchant' }));
  const tampered = deserialize(JSON.stringify({ ...good, colours: 'pirate-king' }));
  assert.ok(tampered, 'an unknown colours never rejects the save (flavour, not physics)');
  assert.equal(tampered.colours, 'black');
});

test('deserialize rejects negative or non-finite coins', () => {
  const good = JSON.parse(serialize(economyState()));
  assert.equal(deserialize(JSON.stringify({ ...good, coins: -1 })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, coins: 'x' })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, coins: null })), null);
});

test('deserialize rejects cargo with unknown-good keys', () => {
  const good = JSON.parse(serialize(economyState()));
  assert.equal(deserialize(JSON.stringify({ ...good, cargo: { kraken: 1 } })), null);
});

test('deserialize rejects cargo with negative / non-finite quantities', () => {
  const good = JSON.parse(serialize(economyState()));
  assert.equal(deserialize(JSON.stringify({ ...good, cargo: { rum: -2 } })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, cargo: { rum: 'lots' } })), null);
});

test('deserialize rejects cargo over hold capacity', () => {
  const good = JSON.parse(serialize(economyState()));
  const over = { [GOODS[0].id]: HOLD_CAP, [GOODS[1].id]: 1 }; // HOLD_CAP + 1 total
  assert.equal(deserialize(JSON.stringify({ ...good, cargo: over })), null);
});

test('deserialize rejects a non-object cargo (array / null)', () => {
  const good = JSON.parse(serialize(economyState()));
  assert.equal(deserialize(JSON.stringify({ ...good, cargo: [1, 2] })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, cargo: null })), null);
});

test('deserialize rejects a current save missing economy fields', () => {
  const good = JSON.parse(serialize(economyState()));
  const noCoins = { ...good }; delete noCoins.coins;
  assert.equal(deserialize(JSON.stringify(noCoins)), null);
  const noCargo = { ...good }; delete noCargo.cargo;
  assert.equal(deserialize(JSON.stringify(noCargo)), null);
});

test('deserialize rejects an old pre-economy (v1) save', () => {
  const v1 = { v: 1, heading: 1, speed: 5, throttle: 0.4, pos: [10, 0, -5] };
  assert.equal(deserialize(JSON.stringify(v1)), null);
});

test('deserialize accepts good economy data right up to hold capacity', () => {
  const good = JSON.parse(serialize(economyState()));
  const full = { [GOODS[0].id]: HOLD_CAP }; // exactly at cap
  const restored = deserialize(JSON.stringify({ ...good, cargo: full }));
  assert.ok(restored);
  assert.equal(restored.cargo[GOODS[0].id], HOLD_CAP);
  assert.equal(restored.coins, good.coins);
});

// ---- Two-pole persistence: Infamy + Standing (save v4, #45) ----

test('serialize → deserialize round-trips infamy + standing, deriving renown', () => {
  const s = { ...economyState(), infamy: 1500, standing: 900 };
  const restored = deserialize(serialize(s));
  assert.equal(restored.infamy, 1500);
  assert.equal(restored.standing, 900);
  assert.equal(restored.renown, 2400, 'renown is the derived sum of both poles');
});

test('serialize stamps both poles into the save object', () => {
  const obj = JSON.parse(serialize({ ...economyState(), infamy: 200, standing: 550 }));
  assert.equal(obj.infamy, 200);
  assert.equal(obj.standing, 550);
});

test('serialize defaults missing poles to 0 (old/pre-pole caller still round-trips)', () => {
  const obj = JSON.parse(serialize(economyState())); // no poles
  assert.equal(obj.infamy, 0);
  assert.equal(obj.standing, 0);
  const restored = deserialize(serialize(economyState()));
  assert.equal(restored.infamy, 0);
  assert.equal(restored.standing, 0);
  assert.equal(restored.renown, 0);
});

test('serialize defaults negative / non-finite poles to 0', () => {
  const o = JSON.parse(serialize({ ...economyState(), infamy: -5, standing: Infinity }));
  assert.equal(o.infamy, 0);
  assert.equal(o.standing, 0);
});

test('deserialize defaults absent poles to 0 (a leaner save stays valid)', () => {
  const good = JSON.parse(serialize(economyState()));
  delete good.infamy; delete good.standing;
  const restored = deserialize(JSON.stringify(good));
  assert.ok(restored, 'a save without poles should still load');
  assert.equal(restored.infamy, 0);
  assert.equal(restored.standing, 0);
});

test('deserialize rejects present-but-corrupt poles', () => {
  const good = JSON.parse(serialize(economyState()));
  assert.equal(deserialize(JSON.stringify({ ...good, infamy: -1 })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, standing: 'famous' })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, infamy: null })), null);
});

test('deserialize rejects old pre-pole saves (v2 economy, v3 renown)', () => {
  const v2 = { v: 2, heading: 1, speed: 5, throttle: 0.4, pos: [10, 0, -5], coins: 100, cargo: {} };
  assert.equal(deserialize(JSON.stringify(v2)), null);
  const v3 = { v: 3, heading: 1, speed: 5, throttle: 0.4, pos: [10, 0, -5], coins: 100, cargo: {}, renown: 500 };
  assert.equal(deserialize(JSON.stringify(v3)), null);
});

// ---- Endgame legends persistence (save v5, #46) ----

test('SAVE_VERSION advanced to carry the earned legends', () => {
  assert.ok(SAVE_VERSION >= 5, 'legends bump the save version');
});

test('serialize → deserialize round-trips earned legends', () => {
  const s = { ...economyState(), infamy: 12800, standing: 0, legends: { pirate: true, governor: false } };
  const restored = deserialize(serialize(s));
  assert.deepEqual(restored.legends, { pirate: true, governor: false });
  const both = deserialize(serialize({ ...economyState(), legends: { pirate: true, governor: true } }));
  assert.deepEqual(both.legends, { pirate: true, governor: true });
});

test('serialize stamps the legends flags into the save object', () => {
  const obj = JSON.parse(serialize({ ...economyState(), legends: { pirate: true, governor: false } }));
  assert.equal(obj.legends.pirate, true);
  assert.equal(obj.legends.governor, false);
});

test('old saves with no legends default to none earned', () => {
  // a save written before legends existed (no `legends` field) loads with both false
  const good = JSON.parse(serialize(economyState())); // economyState carries no legends
  assert.deepEqual(good.legends, { pirate: false, governor: false });
  const restored = deserialize(serialize(economyState()));
  assert.deepEqual(restored.legends, { pirate: false, governor: false });
  // an explicitly stripped legends field also defaults to none
  delete good.legends;
  const r2 = deserialize(JSON.stringify(good));
  assert.ok(r2);
  assert.deepEqual(r2.legends, { pirate: false, governor: false });
});

test('deserialize coerces a malformed legends field to safe booleans', () => {
  const good = JSON.parse(serialize(economyState()));
  const r = deserialize(JSON.stringify({ ...good, legends: { pirate: 'yes', governor: 0 } }));
  assert.ok(r, 'a junk legends field must not reject the whole save');
  assert.deepEqual(r.legends, { pirate: true, governor: false });
  const r2 = deserialize(JSON.stringify({ ...good, legends: 'whoops' }));
  assert.ok(r2);
  assert.deepEqual(r2.legends, { pirate: false, governor: false });
});

// ---- Invisible-onboarding persistence (save v6, #60) ----

test('SAVE_VERSION advanced to carry the onboarding flags', () => {
  assert.ok(SAVE_VERSION >= 6, 'onboarding bumps the save version');
});

test('serialize → deserialize round-trips the onboarding flags', () => {
  const s = { ...economyState(), onboarding: { goal: true, firstDock: true, firstTrade: true, firstRank: false } };
  const restored = deserialize(serialize(s));
  assert.deepEqual(restored.onboarding, { goal: true, firstDock: true, firstTrade: true, firstRank: false });
});

test('serialize stamps a fresh onboarding set for a pre-onboarding caller', () => {
  const obj = JSON.parse(serialize(economyState())); // no onboarding field
  assert.deepEqual(obj.onboarding, { goal: false, firstDock: false, firstTrade: false, firstRank: false });
});

test('deserialize coerces a malformed onboarding field to safe booleans (never rejects)', () => {
  const good = JSON.parse(serialize(economyState()));
  const r = deserialize(JSON.stringify({ ...good, onboarding: { firstDock: 'aye', firstTrade: 1, junk: 9 } }));
  assert.ok(r, 'a junk onboarding field must not reject the whole save');
  assert.deepEqual(r.onboarding, { goal: false, firstDock: true, firstTrade: true, firstRank: false });
  const r2 = deserialize(JSON.stringify({ ...good, onboarding: 'whoops' }));
  assert.ok(r2);
  assert.deepEqual(r2.onboarding, { goal: false, firstDock: false, firstTrade: false, firstRank: false });
});

test('an untouched save with no onboarding field reads as a brand-new captain', () => {
  // a fresh-start save (starting purse, no renown, empty hold) with the field absent
  const bare = { v: SAVE_VERSION, heading: 0, speed: 0, throttle: 0, pos: [0, 0, 0], coins: START_COINS, cargo: {}, infamy: 0, standing: 0 };
  const r = deserialize(JSON.stringify(bare));
  assert.ok(r);
  assert.deepEqual(r.onboarding, { goal: false, firstDock: false, firstTrade: false, firstRank: false });
});

test('a save with real progress but no onboarding field reads as a returning captain (none nagged)', () => {
  const progressed = { v: SAVE_VERSION, heading: 0, speed: 0, throttle: 0, pos: [10, 0, -5], coins: 500, cargo: { rum: 2 }, infamy: 80, standing: 40 };
  const r = deserialize(JSON.stringify(progressed));
  assert.ok(r);
  assert.deepEqual(r.onboarding, { goal: true, firstDock: true, firstTrade: true, firstRank: true });
});

// ---- Voyage-log persistence (save v7, #78 — the Ballad of Your Voyage) ----

test('SAVE_VERSION advanced to carry the voyage log', () => {
  assert.ok(SAVE_VERSION >= 7, 'the voyage log bumps the save version');
});

test('serialize → deserialize round-trips the voyage log (deeds survive a reload)', () => {
  const voyageLog = [
    { type: 'landfall', name: 'Rumlost Reef' },
    { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 55 },
    { type: 'legend', pole: 'pirate', title: 'Terror of the Tidewake' },
  ];
  const restored = deserialize(serialize({ ...economyState(), voyageLog }));
  assert.deepEqual(restored.voyageLog, voyageLog);
});

test('serialize sanitises junk out of the voyage log; a pre-ballad caller gets an empty log', () => {
  const obj = JSON.parse(serialize({ ...economyState(), voyageLog: [{ evil: true }, { type: 'landfall', name: 'Tankard Rock' }] }));
  assert.deepEqual(obj.voyageLog, [{ type: 'landfall', name: 'Tankard Rock' }]);
  const fresh = JSON.parse(serialize(economyState())); // no voyageLog field
  assert.deepEqual(fresh.voyageLog, []);
});

test('deserialize tolerates a malformed voyage log (never rejects the save)', () => {
  const good = JSON.parse(serialize(economyState()));
  const r = deserialize(JSON.stringify({ ...good, voyageLog: 'not an array' }));
  assert.ok(r, 'a junk voyageLog must not reject the whole save');
  assert.deepEqual(r.voyageLog, []);
});
