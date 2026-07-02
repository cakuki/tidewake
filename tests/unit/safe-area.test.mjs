// Safe-area layout predicate (#75) — the pure notch/home-indicator rule, self-tested with NONZERO
// insets (the headless gate always reports insets=0, so this is the only behavioural proof that the
// safe-area math is right for a real notched phone in portrait AND landscape).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAreaBox, withinSafeArea } from '../../src/ui/safe-area.js';

test('safeAreaBox: no insets ⇒ the safe area is the whole viewport', () => {
  assert.deepEqual(safeAreaBox(390, 844, {}), { left: 0, top: 0, right: 390, bottom: 844 });
  assert.deepEqual(safeAreaBox(390, 844), { left: 0, top: 0, right: 390, bottom: 844 });
});

test('safeAreaBox: insets shrink the box on each edge (portrait notch + home indicator)', () => {
  // iPhone-ish portrait: 47px notch top, 34px home indicator bottom.
  assert.deepEqual(safeAreaBox(390, 844, { top: 47, bottom: 34 }), { left: 0, top: 47, right: 390, bottom: 810 });
});

test('safeAreaBox: landscape insets shrink the LEFT/RIGHT edges (notch to the side)', () => {
  // Landscape phone: notch on the left (44px), home indicator along the bottom (21px), rounded
  // corner on the right (44px).
  assert.deepEqual(safeAreaBox(844, 390, { left: 44, right: 44, bottom: 21 }), { left: 44, top: 0, right: 800, bottom: 369 });
});

test('safeAreaBox: negative / garbage insets clamp to 0 (never grow the box)', () => {
  assert.deepEqual(safeAreaBox(844, 390, { top: -10, left: NaN, right: undefined }), { left: 0, top: 0, right: 844, bottom: 390 });
});

test('withinSafeArea: an element inside the insets is clear', () => {
  const rect = { left: 12, top: 60, right: 200, bottom: 120 };
  assert.equal(withinSafeArea(rect, 390, 844, { top: 47, bottom: 34 }), true);
});

test('withinSafeArea: an element under the top notch is NOT clear', () => {
  const rect = { left: 12, top: 20, right: 200, bottom: 120 }; // top:20 < notch 47
  assert.equal(withinSafeArea(rect, 390, 844, { top: 47, bottom: 34 }), false);
});

test('withinSafeArea: an element under the bottom home indicator is NOT clear', () => {
  const rect = { left: 12, top: 700, right: 200, bottom: 820 }; // bottom:820 > 844-34=810
  assert.equal(withinSafeArea(rect, 390, 844, { top: 47, bottom: 34 }), false);
});

test('withinSafeArea: landscape — an element under the SIDE inset (right home-indicator/corner) is NOT clear', () => {
  // Landscape 844×390, 44px right inset → safe right edge = 800. A control pinned at right:18 with
  // NO inset would sit at right≈826 and hide under the corner.
  const throttleNoInset = { left: 760, top: 300, right: 826, bottom: 366 };
  assert.equal(withinSafeArea(throttleNoInset, 844, 390, { right: 44, bottom: 21 }), false);
  // The same control shifted in by the inset (right:18+44) clears it.
  const throttleWithInset = { left: 716, top: 300, right: 782, bottom: 366 };
  assert.equal(withinSafeArea(throttleWithInset, 844, 390, { right: 44, bottom: 21 }), true);
});

test('withinSafeArea: same rect that fails WITH insets passes when insets are 0 (headless == viewport)', () => {
  const rect = { left: 12, top: 20, right: 200, bottom: 120 };
  assert.equal(withinSafeArea(rect, 390, 844, {}), true);           // headless: safe area == viewport
  assert.equal(withinSafeArea(rect, 390, 844, { top: 47 }), false); // device: hides under the notch
});

test('withinSafeArea: a hidden / zero-area element can never violate (nothing to hide)', () => {
  assert.equal(withinSafeArea({ left: 0, top: 0, right: 0, bottom: 0 }, 390, 844, { top: 47 }), true);
  assert.equal(withinSafeArea(null, 390, 844, { top: 47 }), true);
});

test('withinSafeArea: sub-pixel slack tolerates a hair of overrun on either edge', () => {
  const rect = { left: -0.5, top: 46.5, right: 389.5, bottom: 810.4 };
  assert.equal(withinSafeArea(rect, 390, 844, { top: 47, bottom: 34 }, 1), true);
  // Beyond the slack it fails.
  assert.equal(withinSafeArea({ ...rect, top: 45 }, 390, 844, { top: 47, bottom: 34 }, 1), false);
});
