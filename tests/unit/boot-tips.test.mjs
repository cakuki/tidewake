// #15 — comedic boot-tip pool + anti-repeat picker. Pure logic, node-tested (no DOM, no three.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOT_TIPS, pickTip, tipAt } from '../../src/boot-tips.js';

test('pool is 15+ non-empty, single-line, original in-voice strings', () => {
  assert.ok(BOOT_TIPS.length >= 15, `expected 15+ tips, got ${BOOT_TIPS.length}`);
  const seen = new Set();
  for (const line of BOOT_TIPS) {
    assert.equal(typeof line, 'string');
    const t = line.trim();
    assert.ok(t.length >= 12 && t.length <= 140, `tip length out of range: "${line}"`);
    assert.ok(!/[\n\r\t]/.test(line), `tip must be a single line: "${line}"`);
    assert.ok(!seen.has(t), `duplicate tip: "${line}"`);
    seen.add(t);
  }
});

test('no franchise / real-world brand references (original work only)', () => {
  // A guard, not a censor: catch the obvious franchise leaks the Constitution forbids.
  const banned = /monkey island|black flag|assassin|sea of thieves|sid meier|jack sparrow|pirates of the caribbean|guybrush|nintendo|pokemon|star wars/i;
  for (const line of BOOT_TIPS) assert.ok(!banned.test(line), `franchise reference in: "${line}"`);
});

test('pool is frozen + tipAt is bounds-safe', () => {
  assert.ok(Object.isFrozen(BOOT_TIPS));
  assert.equal(tipAt(0), BOOT_TIPS[0]);
  assert.equal(tipAt(-1), '');
  assert.equal(tipAt(BOOT_TIPS.length), '');
});

test('pickTip returns an in-range index for any random draw', () => {
  for (let i = 0; i <= 100; i++) {
    const idx = pickTip(-1, i / 100);
    assert.ok(idx >= 0 && idx < BOOT_TIPS.length, `out of range: ${idx}`);
  }
});

test('pickTip NEVER returns the last-shown index (anti-repeat) yet reaches every other line', () => {
  for (let last = 0; last < BOOT_TIPS.length; last++) {
    const reached = new Set();
    for (let s = 0; s <= 500; s++) {
      const idx = pickTip(last, s / 500);
      assert.notEqual(idx, last, `repeated index ${idx} after last=${last}`);
      reached.add(idx);
    }
    assert.equal(reached.size, BOOT_TIPS.length - 1, `not every non-last line reachable from last=${last}`);
  }
});

test('pickTip is deterministic — same (last, rand) → same index', () => {
  assert.equal(pickTip(3, 0.42), pickTip(3, 0.42));
  assert.equal(pickTip(7, 0.99), pickTip(7, 0.99));
});

test('a long chain of reloads never repeats back-to-back', () => {
  let last = -1;
  let seed = 0.1234;
  for (let i = 0; i < 300; i++) {
    seed = (seed * 9301 + 0.49297) % 1; // cheap deterministic stream
    const idx = pickTip(last, seed);
    assert.notEqual(idx, last, `back-to-back repeat at step ${i}`);
    last = idx;
  }
});
