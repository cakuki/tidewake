import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScaleToLength,
  centrePivotOffset,
  GLB_Z_MIN, GLB_Z_MAX, TARGET_LENGTH,
} from '../../src/ship-loader-math.js';

describe('ship-loader pure helpers', () => {
  it('computeScaleToLength scales the GLB hull to target length', () => {
    const glbLength = GLB_Z_MAX - GLB_Z_MIN; // 8.8
    const scale = computeScaleToLength(glbLength, TARGET_LENGTH);
    // 16 / 8.8 ≈ 1.818
    assert.ok(Math.abs(scale - 1.818) < 0.001, `expected ≈1.818, got ${scale}`);
  });

  it('computeScaleToLength preserves ratios', () => {
    const s = computeScaleToLength(4, 8);
    assert.equal(s, 2);
    assert.equal(computeScaleToLength(10, 10), 1);
  });

  it('centrePivotOffset centres the keel midpoint at origin', () => {
    // GLB Z_MIN=-4.2, Z_MAX=4.6 → midpoint in GLB space = 0.2
    // After scale, root should be shifted by -0.2 * scale
    const glbLength = GLB_Z_MAX - GLB_Z_MIN;
    const scale = computeScaleToLength(glbLength, TARGET_LENGTH);
    const offset = centrePivotOffset(GLB_Z_MIN, GLB_Z_MAX, scale);
    // midpoint × scale should cancel out
    const midInGlb = (GLB_Z_MIN + GLB_Z_MAX) / 2; // 0.2
    assert.ok(Math.abs(offset + midInGlb * scale) < 1e-9, `offset should cancel midpoint, got ${offset}`);
  });

  it('centrePivotOffset is zero when hull is already centred', () => {
    const offset = centrePivotOffset(-5, 5, 1);
    assert.equal(offset, 0);
  });

  it('TARGET_LENGTH is 16', () => {
    assert.equal(TARGET_LENGTH, 16);
  });

  it('GLB bounds are as measured from the asset', () => {
    assert.equal(GLB_Z_MIN, -4.2);
    assert.equal(GLB_Z_MAX, 4.6);
  });
});
