import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deserialize, migrate, serialize, SAVE_VERSION } from '../../src/save.js';
import { START_COINS } from '../../src/economy.js';

// FROZEN OLD-SAVE CORPUS (#122, DL #4) — one real save blob per historical schema version, captured
// in its OWN era's shape (only the fields that existed at that version). These strings are FROZEN: do
// NOT regenerate them with serialize() — their whole value is that they look exactly like a save a
// player actually has sitting in localStorage from an older build. Every bump must keep migrating
// these forward without loss or error — this is the gate that stops a schema bump silently wiping a
// player's progress. When you bump SAVE_VERSION, ADD the new prior version's frozen blob here.
//
// Each entry: the version, the frozen JSON string as it was written back then, and the load-bearing
// fields we assert survive the forward migration to the current schema.

const BASE = { heading: 1.2, speed: 8, throttle: 0.5, pos: [120.5, 0, -340.25] };

const CORPUS = [
  {
    v: 1, // pre-economy: just the nav state
    blob: '{"v":1,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25]}',
    expect: { pos: BASE.pos, coins: START_COINS, cargo: {}, infamy: 0, standing: 0 },
  },
  {
    v: 2, // economy: coins + cargo arrive
    blob: '{"v":2,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3,"spice":2}}',
    expect: { pos: BASE.pos, coins: 250, cargo: { rum: 3, spice: 2 }, infamy: 0, standing: 0 },
  },
  {
    v: 3, // combined renown (later split + dropped — can't be decomposed)
    blob: '{"v":3,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"renown":500}',
    expect: { pos: BASE.pos, coins: 250, cargo: { rum: 3 }, infamy: 0, standing: 0, renown: 0 },
  },
  {
    v: 4, // the two poles: infamy + standing (#45)
    blob: '{"v":4,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200}',
    expect: { pos: BASE.pos, coins: 250, infamy: 300, standing: 200, renown: 500 },
  },
  {
    v: 5, // earned legends (#46)
    blob: '{"v":5,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false}}',
    expect: { coins: 250, infamy: 300, standing: 200, legends: { pirate: true, governor: false } },
  },
  {
    v: 6, // invisible-onboarding flags (#60)
    blob: '{"v":6,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false}}',
    expect: { coins: 250, onboarding: { goal: true, firstDock: true, firstTrade: true, firstRank: false } },
  },
  {
    v: 7, // the voyage log — the Ballad's deeds (#78)
    blob: '{"v":7,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false},"voyageLog":[{"type":"landfall","name":"Rumlost Reef"},{"type":"duel","foe":"Black Sal","infamy":30,"coins":55}]}',
    expect: { coins: 250, voyageLog: [{ type: 'landfall', name: 'Rumlost Reef' }, { type: 'duel', foe: 'Black Sal', infamy: 30, coins: 55 }] },
  },
  {
    v: 8, // displayed colours (#79 False Colours)
    blob: '{"v":8,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false},"voyageLog":[],"colours":"merchant"}',
    expect: { coins: 250, colours: 'merchant' },
  },
  {
    v: 9, // per-port memory (#104)
    blob: '{"v":9,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false},"voyageLog":[],"colours":"merchant","portMemory":{"Saltpurse Quay":{"visits":3,"lastTier":2,"lastPole":"governor"}}}',
    expect: { coins: 250, colours: 'merchant', portMemory: { 'Saltpurse Quay': { visits: 3, lastTier: 2, lastPole: 'governor' } } },
  },
  {
    v: 10, // chased-rumour objective (#111/#112/#115)
    blob: '{"v":10,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false},"voyageLog":[],"colours":"merchant","portMemory":{"Saltpurse Quay":{"visits":3,"lastTier":2,"lastPole":"governor"}},"objective":{"kind":"rumour","target":{"kind":"port","name":"Barnacle Bottom","x":120,"z":-40},"payoff":{"coins":60},"status":"active"}}',
    expect: { coins: 250, objective: { kind: 'rumour', target: { kind: 'port', name: 'Barnacle Bottom', x: 120, z: -40 }, payoff: { coins: 60 }, status: 'active' } },
  },
  {
    v: 11, // deepened port memory — a remembered DEED + emergent home port (#104b)
    blob: '{"v":11,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false},"voyageLog":[],"colours":"merchant","portMemory":{"Saltpurse Quay":{"visits":4,"lastTier":2,"lastPole":"governor","lastDeed":"the day you sent the Black Gull to the seabed in these waters"}},"objective":null}',
    expect: { coins: 250, portMemory: { 'Saltpurse Quay': { visits: 4, lastTier: 2, lastPole: 'governor', lastDeed: 'the day you sent the Black Gull to the seabed in these waters' } } },
  },
  {
    v: 12, // claimed home harbour — the governor pole's first reactive verb (#118 "Your Harbour")
    blob: '{"v":12,"heading":1.2,"speed":8,"throttle":0.5,"pos":[120.5,0,-340.25],"coins":250,"cargo":{"rum":3},"infamy":300,"standing":200,"legends":{"pirate":true,"governor":false},"onboarding":{"goal":true,"firstDock":true,"firstTrade":true,"firstRank":false},"voyageLog":[],"colours":"merchant","portMemory":{},"objective":null,"harbour":{"name":"Gullet\'s Rest","level":2,"invested":150}}',
    expect: { coins: 250, harbour: { name: "Gullet's Rest", level: 2, invested: 150 }, governorship: false },
  },
];

// A subset-deep-equality assert: every key in `expect` matches in `actual` (deep), but `actual` may
// carry more (the new fields the migration filled in with defaults). Keeps each blob focused on the
// fields that version is about, while still proving "no loss" of those fields.
function assertSubset(actual, expect, label) {
  for (const [k, v] of Object.entries(expect)) {
    assert.deepEqual(actual[k], v, `${label}: field "${k}" must survive the forward migration`);
  }
}

test('the frozen corpus covers every prior schema version (v1 .. SAVE_VERSION-1)', () => {
  const versions = CORPUS.map((c) => c.v);
  const expected = [];
  for (let i = 1; i < SAVE_VERSION; i++) expected.push(i);
  assert.deepEqual(versions, expected,
    'every historical version needs a frozen blob; bumping SAVE_VERSION means adding the prior one');
});

for (const { v, blob, expect } of CORPUS) {
  test(`a frozen v${v} save migrates forward without loss or error`, () => {
    const restored = deserialize(blob);
    assert.ok(restored, `a v${v} save must load (migrate forward), never wipe to a fresh voyage`);
    // The nav spine survives every migration.
    assert.deepEqual(restored.pos, BASE.pos, `v${v}: position must survive`);
    assert.equal(restored.heading, BASE.heading, `v${v}: heading must survive`);
    assert.equal(restored.throttle, BASE.throttle, `v${v}: throttle must survive`);
    assert.equal(restored.speed, BASE.speed, `v${v}: speed must survive`);
    // The version-specific load-bearing fields survive.
    assertSubset(restored, expect, `v${v}`);
  });

  test(`migrate() stamps a frozen v${v} save up to the current SAVE_VERSION`, () => {
    const migrated = migrate(JSON.parse(blob));
    assert.ok(migrated, `v${v} must migrate, not fail`);
    assert.equal(migrated.v, SAVE_VERSION, `v${v} must be stamped to the current version`);
  });
}

test('a migrated old save re-serialises to a clean current-version save (round-trips forward)', () => {
  // Take the oldest blob, migrate+load it, re-save it, and confirm the re-save is a current save that
  // loads identically — proving a migrated voyage is now indistinguishable from a native current one.
  const restored = deserialize(CORPUS[0].blob);
  const reSaved = serialize(restored);
  assert.equal(JSON.parse(reSaved).v, SAVE_VERSION);
  const reLoaded = deserialize(reSaved);
  assert.deepEqual(reLoaded, restored, 'a migrated save, re-saved, loads identically (now native current)');
});

test('migrate() is a no-op for an already-current save (behaviour-preserving)', () => {
  const current = JSON.parse(serialize({ ...BASE, coins: 300, cargo: { rum: 2 } }));
  const migrated = migrate(current);
  assert.deepEqual(migrated, current, 'a current save passes through migrate() unchanged');
});

test('migrate() fails open (null) on a missing / future / non-integer version', () => {
  assert.equal(migrate({ heading: 1 }), null, 'missing version → null');
  assert.equal(migrate({ v: SAVE_VERSION + 1 }), null, 'future version → null');
  assert.equal(migrate({ v: 2.5 }), null, 'non-integer version → null');
  assert.equal(migrate({ v: 0 }), null, 'below-range version → null');
});
