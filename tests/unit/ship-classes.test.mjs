import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHIP_CLASSES, CLASS_ORDER, ROLES, SPAWN_POOL, shipStats, spawnMix,
} from '../../src/ship-classes.js';
import { resolveBroadside, MAX_HULL } from '../../src/cannons.js';

const half = () => 0.5; // deterministic rng → jitter multiplier == 1.0

test('CLASS_ORDER covers exactly the four hull classes, ascending', () => {
  assert.deepEqual(CLASS_ORDER, ['sloop', 'brig', 'frigate', 'manowar']);
  for (const k of CLASS_ORDER) assert.ok(SHIP_CLASSES[k], `missing class ${k}`);
});

test('class ladder: sloop < brig < frigate < man-o\'-war on hull, guns, gunnery, size', () => {
  const stats = CLASS_ORDER.map((k) => shipStats(k, 'warship'));
  for (let i = 1; i < stats.length; i++) {
    assert.ok(stats[i].hull > stats[i - 1].hull, `hull must climb: ${stats[i].cls}`);
    assert.ok(stats[i].guns > stats[i - 1].guns, `guns must climb: ${stats[i].cls}`);
    assert.ok(stats[i].gunnery > stats[i - 1].gunnery, `gunnery must climb: ${stats[i].cls}`);
    assert.ok(stats[i].sizeScale > stats[i - 1].sizeScale, `size must climb: ${stats[i].cls}`);
    assert.ok(stats[i].speed < stats[i - 1].speed, `a bigger hull lumbers slower: ${stats[i].cls}`);
    assert.ok(stats[i].tier >= stats[i - 1].tier, `threat must not fall: ${stats[i].cls}`);
  }
});

test('hull sits on the shared [0,100] combat scale so it feeds the existing battle math', () => {
  for (const k of CLASS_ORDER) {
    const s = shipStats(k, 'warship');
    assert.ok(s.hull > 0 && s.hull <= MAX_HULL, `${k} hull in range: ${s.hull}`);
    assert.equal(s.maxHull, s.hull, 'a fresh spawn starts at full hull');
  }
  assert.equal(shipStats('manowar', 'warship').hull, MAX_HULL, 'the top class caps the scale');
});

test('role: a merchant of the SAME class carries far weaker armament than a warship', () => {
  for (const k of CLASS_ORDER) {
    const w = shipStats(k, 'warship');
    const m = shipStats(k, 'merchant');
    assert.equal(w.hull, m.hull, 'the hull (size) is the same; the ROLE changes the guns');
    assert.ok(m.gunnery < w.gunnery, `a merchant ${k} out-guns nothing: ${m.gunnery} !< ${w.gunnery}`);
    assert.ok(m.guns < w.guns, `a merchant ${k} carries fewer guns`);
    assert.ok(m.tier <= w.tier, 'a merchant reads no more dangerous than her warship sister');
  }
});

test('threat tier spans 1..5, with a warship man-o\'-war the sea\'s apex terror', () => {
  assert.equal(shipStats('manowar', 'warship').tier, 5);
  assert.equal(shipStats('sloop', 'merchant').tier, 1);
  for (const k of CLASS_ORDER) {
    for (const r of Object.keys(ROLES)) {
      const t = shipStats(k, r).tier;
      assert.ok(t >= 1 && t <= 5, `${r} ${k} tier in 1..5: ${t}`);
    }
  }
});

test('class SCALES the fight: a bigger/warship foe\'s broadside reply hits harder (same target)', () => {
  // The fun-beat proof — the class table's gunnery is exactly the return-fire multiplier resolveBroadside
  // consumes, so a frigate genuinely threatens where a sloop barely scratches. Same volley, same rng.
  const target = { quality: 1, enemyHull: 100, playerHull: 100 };
  const reply = (k, r) => resolveBroadside({ ...target, gunnery: shipStats(k, r).gunnery }, half).playerHit;
  const sloop = reply('sloop', 'warship');
  const frigate = reply('frigate', 'warship');
  const manowar = reply('manowar', 'warship');
  assert.ok(frigate > sloop, `a frigate's broadside must out-bite a sloop's: ${frigate} !> ${sloop}`);
  assert.ok(manowar > frigate, `a man-o'-war's broadside must out-bite a frigate's: ${manowar} !> ${frigate}`);
  // …and a merchant of the same class replies weaker than her warship sister.
  const merchFrigate = reply('frigate', 'merchant');
  assert.ok(merchFrigate < frigate, `a merchant frigate replies softer: ${merchFrigate} !< ${frigate}`);
});

test('class SCALES toughness: a man-o\'-war soaks more volleys than a sloop', () => {
  // Sinking a foe is `ceil(hull / per-volley bite)` volleys — a higher hull is strictly more work.
  const volley = 33; // BASE(22)*1.5*quality(1)*jitter(1) — a clean beam broadside
  const volleysToSink = (k) => Math.ceil(shipStats(k, 'warship').hull / volley);
  assert.ok(volleysToSink('manowar') > volleysToSink('sloop'), 'a man-o\'-war takes strictly more sinking');
});

test('spawnMix: deterministic, right length, and always a MIX (never a uniform sea)', () => {
  let s = 12345;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let count = 2; count <= 6; count++) {
    const seedRng = () => 0.37; // fixed → deterministic
    const a = spawnMix(seedRng, count);
    const b = spawnMix(seedRng, count);
    assert.equal(a.length, count);
    assert.deepEqual(a, b, 'same rng → same fleet (deterministic)');
    const classes = new Set(a.map((x) => x.cls));
    assert.ok(classes.size >= 2, `a fleet of ${count} must span ≥2 classes, got ${[...classes]}`);
    for (const spec of a) {
      assert.ok(SHIP_CLASSES[spec.cls], `valid class: ${spec.cls}`);
      assert.ok(ROLES[spec.role], `valid role: ${spec.role}`);
    }
  }
  // Vary the seed → still always a valid, varied fleet.
  for (let i = 0; i < 30; i++) {
    const mix = spawnMix(rng, 3);
    assert.ok(new Set(mix.map((x) => x.cls)).size >= 2, 'every seeded fleet varies');
  }
});

test('SPAWN_POOL withholds the warship man-o\'-war (threat 5 is the opt-in #167 challenge)', () => {
  const hasApex = SPAWN_POOL.some((s) => s.cls === 'manowar' && s.role === 'warship');
  assert.equal(hasApex, false, 'the apex terror is not dropped on you by an unlucky open-sea pass');
  // …but the pool is still genuinely varied (multiple classes AND both roles present).
  assert.ok(new Set(SPAWN_POOL.map((s) => s.cls)).size >= 3, 'the pool spans several classes');
  assert.ok(new Set(SPAWN_POOL.map((s) => s.role)).size === 2, 'the pool carries both roles');
});
