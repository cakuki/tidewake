// Unit: drifting whitecap foam (#70) — the crest-foam intensity maths that drive the
// ocean shader's foam. The shader's foam GLSL is generated from the SAME constants and
// the SAME smoothstep, so gating the maths here gates the look on the GPU too. Foam must
// only ever appear on the upper crests (never in troughs / on calm water), must be a
// bounded 0..1 wash, and must be REACHABLE on the live swell so the sunny sea reads alive.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  smoothstep, crestFoam, whitecap,
  FOAM_LO, FOAM_HI, FOAM_STRENGTH, MAX_SWELL,
} from '../../src/sea-foam.js';

test('smoothstep clamps the edges and is the Hermite curve in between', () => {
  assert.equal(smoothstep(0, 1, -5), 0, 'below e0 → 0');
  assert.equal(smoothstep(0, 1, 5), 1, 'above e1 → 1');
  assert.equal(smoothstep(0, 1, 0.5), 0.5, 'midpoint → 0.5');
  assert.equal(smoothstep(2, 2, 3), 1, 'degenerate window: x≥e0 → 1');
  assert.equal(smoothstep(2, 2, 1), 0, 'degenerate window: x<e0 → 0');
});

test('foam never appears in troughs or on calm mid-swell', () => {
  assert.equal(crestFoam(0), 0, 'flat water is dry');
  assert.equal(crestFoam(-1.4), 0, 'troughs never foam');
  assert.equal(crestFoam(FOAM_LO), 0, 'foam only starts ABOVE the low crest threshold');
  assert.equal(whitecap(2.0, 0), 0, 'no streak → no foam even on a peak');
  assert.equal(whitecap(-1.0, 1), 0, 'a trough never foams whatever the streak');
});

test('foam is reachable on the live swell and reads on the peaks', () => {
  // The window must sit within the swell the ship actually rides, or the sea never foams.
  assert.ok(FOAM_LO < MAX_SWELL, `foam threshold ${FOAM_LO} must be below MAX_SWELL ${MAX_SWELL}`);
  // A near-peak crest grows strong foam so the sunny sea looks alive, not dead-flat.
  assert.ok(crestFoam(MAX_SWELL) > 0.8, `peak crest only foamed ${crestFoam(MAX_SWELL)} — sea looks dead`);
  assert.ok(crestFoam(MAX_SWELL * 0.85) > 0.4, 'high crests should already be frothing');
});

test('crestFoam ramps monotonically across the window', () => {
  let prev = -1;
  for (let h = -1; h <= 2; h += 0.05) {
    const f = crestFoam(h);
    assert.ok(f >= 0 && f <= 1, `crestFoam(${h})=${f} out of 0..1`);
    assert.ok(f >= prev - 1e-9, `crestFoam must be non-decreasing (dipped at h=${h})`);
    prev = f;
  }
});

test('whitecap is a bounded 0..1 wash, monotonic in the streak', () => {
  assert.ok(FOAM_STRENGTH > 0 && FOAM_STRENGTH <= 1, 'foam strength stays a sane wash');
  let prev = -1;
  for (let s = -0.5; s <= 1.5; s += 0.1) {
    const f = whitecap(MAX_SWELL, s);
    assert.ok(f >= 0 && f <= 1, `whitecap streak=${s} → ${f} out of range`);
    assert.ok(f >= prev - 1e-9, 'whitecap must be non-decreasing in streak (after clamp)');
    prev = f;
  }
  assert.ok(whitecap(MAX_SWELL, 1) > 0.5, 'a full-streak peak should be clearly foamy');
});
