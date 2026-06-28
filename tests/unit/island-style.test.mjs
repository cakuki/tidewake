// Unit: per-island STYLING pure logic (#71 islands TLC). island-style.js derives — from an
// island's INDEX alone — a hue-jittered palette, a silhouette (squash/height/peak/lean) and a
// dressing layout (rocks / palms / driftwood / grass tufts). It is DOM-free & three.js-free so
// the SELECTION logic unit-tests under node:test (same standard as systems/props.js +
// fauna-math.js). The keystone property: it is DETERMINISTIC — index i always yields the exact
// same look — so an isle keeps its tones, shape and prop layout across reloads.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_PALETTE, DRESS_TYPES,
  islandPalette, islandSilhouette, islandDressing, islandStyle,
} from '../../src/systems/island-style.js';

test('the base palette carries every material role as a packed 0xRRGGBB', () => {
  for (const role of ['sand', 'sandDark', 'grass', 'grassDark', 'rock', 'trunk', 'leaf']) {
    const v = BASE_PALETTE[role];
    assert.equal(typeof v, 'number', `${role} is a number`);
    assert.ok(v >= 0 && v <= 0xffffff, `${role} is a valid colour`);
  }
});

test('islandPalette returns bounded HSL offsets per role, deterministically', () => {
  const a = islandPalette(2);
  const b = islandPalette(2);
  assert.deepEqual(a, b, 'same index → identical palette offsets (stable across reloads)');
  for (const role of ['sand', 'sandDark', 'grass', 'grassDark', 'rock']) {
    const o = a[role];
    assert.ok(o && typeof o.h === 'number' && typeof o.s === 'number' && typeof o.l === 'number',
      `${role} has {h,s,l} offsets`);
    // Offsets stay gentle — a tonal shift, never a cartoon recolour.
    assert.ok(Math.abs(o.h) <= 0.08, `${role} hue offset is gentle (${o.h})`);
    assert.ok(Math.abs(o.s) <= 0.15, `${role} sat offset is gentle (${o.s})`);
    assert.ok(Math.abs(o.l) <= 0.12, `${role} light offset is gentle (${o.l})`);
  }
});

test('different islands get visibly different tones', () => {
  // Across a spread of isles, at least most differ in their sand hue/light — variety, not clones.
  const sands = [0, 1, 2, 3, 4, 5].map((i) => islandPalette(i).sand);
  const keys = new Set(sands.map((o) => `${o.h.toFixed(3)}:${o.l.toFixed(3)}`));
  assert.ok(keys.size >= 5, `expected varied sand tones, got ${keys.size} distinct of 6`);
});

test('islandSilhouette is deterministic and within sane, varied bounds', () => {
  const a = islandSilhouette(3);
  assert.deepEqual(a, islandSilhouette(3), 'same index → identical silhouette');
  for (let i = 0; i < 8; i++) {
    const s = islandSilhouette(i);
    assert.ok(s.sx >= 0.6 && s.sx <= 1.6, `sx in range (${s.sx})`);
    assert.ok(s.sz >= 0.6 && s.sz <= 1.6, `sz in range (${s.sz})`);
    assert.ok(s.hillScale > 0.4 && s.hillScale < 1.1, `hillScale in range (${s.hillScale})`);
    assert.equal(typeof s.tall, 'boolean');
    assert.ok(s.rot >= 0 && s.rot <= Math.PI, `rot in range (${s.rot})`);
    assert.ok(typeof s.peak === 'boolean');
  }
});

test('silhouettes vary in shape across islands', () => {
  const shapes = [0, 1, 2, 3, 4, 5].map((i) => {
    const s = islandSilhouette(i);
    return `${s.sx.toFixed(2)}:${s.sz.toFixed(2)}:${s.tall}`;
  });
  assert.ok(new Set(shapes).size >= 5, `expected varied silhouettes, got ${new Set(shapes).size}`);
});

test('islandDressing places only known prop types, deterministically', () => {
  const r = 80;
  const a = islandDressing(1, r);
  assert.deepEqual(a, islandDressing(1, r), 'same index+radius → identical dressing layout');
  assert.ok(Array.isArray(a) && a.length > 0, 'an isle is dressed with at least one prop');
  for (const p of a) {
    assert.ok(DRESS_TYPES.includes(p.type), `known prop type (${p.type})`);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), 'has a finite local position');
    assert.ok(Number.isFinite(p.y) && p.y >= 0, 'sits at or above ground');
    assert.ok(Number.isFinite(p.rotY), 'has a Y rotation');
    assert.ok(p.scale > 0, 'has a positive scale');
  }
});

test('every dressing type appears across a typical archipelago', () => {
  const seen = new Set();
  for (let i = 0; i < 6; i++) for (const p of islandDressing(i, 80)) seen.add(p.type);
  for (const t of DRESS_TYPES) assert.ok(seen.has(t), `type ${t} appears somewhere in the archipelago`);
});

test('dressing counts stay modest so the perf budget holds (instanced, but still bounded)', () => {
  for (let i = 0; i < 8; i++) {
    const d = islandDressing(i, 80);
    assert.ok(d.length <= 24, `isle ${i} dressing count bounded (${d.length})`);
    const palms = d.filter((p) => p.type === 'palm').length;
    assert.ok(palms >= 2 && palms <= 7, `isle ${i} has a believable palm count (${palms})`);
  }
});

test('dressing props sit on/near the isle footprint (not flung to the horizon)', () => {
  const r = 70;
  for (const p of islandDressing(4, r)) {
    assert.ok(Math.hypot(p.x, p.z) <= r * 1.6, `prop within reach of the isle (${Math.hypot(p.x, p.z).toFixed(0)})`);
  }
});

test('islandStyle bundles palette + silhouette + dressing for one index', () => {
  const s = islandStyle(2, 90);
  assert.deepEqual(s.palette, islandPalette(2));
  assert.deepEqual(s.silhouette, islandSilhouette(2));
  assert.deepEqual(s.dressing, islandDressing(2, 90));
});
