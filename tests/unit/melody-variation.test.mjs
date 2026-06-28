import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  makeRng,
  SEA_VARIATION_SEED,
  MIN_DEG,
  MAX_DEG,
  MAX_ORNAMENTS,
  variationPlan,
  varyMelodyPass,
} from '../../src/systems/melody-variation.js';
import { melodyPattern, LOOP_BEATS } from '../../src/music.js';

const base = melodyPattern();
const lastIndex = base.length - 1;

test('makeRng: deterministic, in [0,1), spread', () => {
  const a = makeRng(12345);
  const b = makeRng(12345);
  const c = makeRng(999);
  for (let i = 0; i < 20; i++) {
    const x = a();
    assert.equal(x, b(), 'same seed → identical stream');
    assert.ok(x >= 0 && x < 1, `in [0,1): ${x}`);
  }
  // Different seed → a different stream (overwhelmingly likely within a few draws).
  let differs = false;
  const a2 = makeRng(12345);
  for (let i = 0; i < 5; i++) if (a2() !== c()) differs = true;
  assert.ok(differs, 'different seeds → different streams');
});

test('variationPlan: pass 0 is the canonical, unvaried home version', () => {
  const plan = variationPlan(base, 0, { seed: SEA_VARIATION_SEED });
  assert.equal(plan.passIndex, 0);
  assert.deepEqual(plan.displaced, [], 'no ornaments on pass 0');
});

test('variationPlan: deterministic — same (notes, pass, seed) → identical plan', () => {
  for (const p of [1, 2, 3, 7, 41, 128]) {
    const a = variationPlan(base, p, { seed: SEA_VARIATION_SEED });
    const b = variationPlan(base, p, { seed: SEA_VARIATION_SEED });
    assert.deepEqual(a, b, `pass ${p} reproduces exactly`);
  }
});

test('variationPlan: a different seed → a different sequence', () => {
  const sameCount = [1, 2, 3, 4, 5].filter((p) => {
    const a = JSON.stringify(variationPlan(base, p, { seed: SEA_VARIATION_SEED }).displaced);
    const b = JSON.stringify(variationPlan(base, p, { seed: SEA_VARIATION_SEED ^ 0xabcdef }).displaced);
    return a === b;
  }).length;
  assert.ok(sameCount < 5, 'changing the seed changes at least one pass');
});

test('variationPlan: bounded ornament count, never touches the cadence or entry note', () => {
  for (let p = 1; p <= 64; p++) {
    const { displaced } = variationPlan(base, p, { seed: SEA_VARIATION_SEED });
    assert.ok(displaced.length >= 1 && displaced.length <= MAX_ORNAMENTS,
      `pass ${p}: 1..${MAX_ORNAMENTS} ornaments, got ${displaced.length}`);
    const idxs = displaced.map((d) => d.index);
    assert.equal(new Set(idxs).size, idxs.length, `pass ${p}: distinct indices`);
    for (const d of displaced) {
      assert.notEqual(d.index, 0, 'never displaces the phrase-entry note');
      assert.notEqual(d.index, lastIndex, 'never displaces the cadence/landing note');
    }
  }
});

test('varyMelodyPass: pass 0 deep-equals the base melody', () => {
  assert.deepEqual(varyMelodyPass(base, 0, { seed: SEA_VARIATION_SEED }), base);
});

test('varyMelodyPass: timing is untouched — total beats still fills the loop exactly', () => {
  for (const p of [0, 1, 2, 9, 33]) {
    const v = varyMelodyPass(base, p, { seed: SEA_VARIATION_SEED });
    assert.equal(v.length, base.length, `pass ${p}: same note count`);
    let total = 0;
    for (let i = 0; i < v.length; i++) {
      assert.equal(v[i].beats, base[i].beats, `pass ${p}: note ${i} keeps its duration`);
      total += v[i].beats;
    }
    assert.ok(Math.abs(total - LOOP_BEATS) < 1e-9, `pass ${p}: still spans ${LOOP_BEATS} beats`);
  }
});

test('varyMelodyPass: every change is octave-only → provably stays in key', () => {
  for (let p = 1; p <= 64; p++) {
    const v = varyMelodyPass(base, p, { seed: SEA_VARIATION_SEED });
    for (let i = 0; i < v.length; i++) {
      const delta = v[i].deg - base[i].deg;
      assert.equal(Math.abs(delta) % 7, 0, `pass ${p} note ${i}: change is a whole number of octaves`);
      // pitch class (0-based scale degree mod 7) preserved → same diatonic tone, just a register shift
      const pcIn = ((base[i].deg - 1) % 7 + 7) % 7;
      const pcOut = ((v[i].deg - 1) % 7 + 7) % 7;
      assert.equal(pcIn, pcOut, `pass ${p} note ${i}: same scale tone (in key)`);
    }
  }
});

test('varyMelodyPass: displaced notes stay in a comfortable register window (never shrill/muddy)', () => {
  for (let p = 1; p <= 64; p++) {
    const v = varyMelodyPass(base, p, { seed: SEA_VARIATION_SEED });
    for (const n of v) {
      assert.ok(n.deg >= MIN_DEG && n.deg <= MAX_DEG, `pass ${p}: deg ${n.deg} within [${MIN_DEG},${MAX_DEG}]`);
    }
  }
});

test('varyMelodyPass: variation actually differs across passes (kills the tiling fatigue)', () => {
  const variants = new Set();
  for (let p = 0; p < 16; p++) {
    variants.add(JSON.stringify(varyMelodyPass(base, p, { seed: SEA_VARIATION_SEED }).map((n) => n.deg)));
  }
  assert.ok(variants.size >= 8, `expected many distinct passes, got ${variants.size}`);
});

test('varyMelodyPass: never mutates the input array', () => {
  const snapshot = JSON.stringify(base);
  varyMelodyPass(base, 5, { seed: SEA_VARIATION_SEED });
  assert.equal(JSON.stringify(base), snapshot, 'base melody untouched');
});
