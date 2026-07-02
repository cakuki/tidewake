// Rotating sea themes (#94 phase 2) — the PURE theme-selection + bar-clock rotation logic.
//
// Phase 1 (#94 ph1/#109) gave the open sea ONE mode-aware bed. Over long voyages that bed is static.
// This rotates it through a small set of DISTINCT sea themes (a mode + transposition recolour of the
// SAME procedural bed — no loadTrack, no percussive bed), cross-faded in on the bar-clock every so
// often, seeded and deterministic. All PURE — node:test proves selection + scheduling without ever
// opening an AudioContext. music.js is the thin shell that voices the returned cast on a downbeat.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEA_THEMES, SEA_THEME_SEED, ROTATE_BARS,
  seaThemeIndexAt, seaThemeAt, nextSeaTheme, seededStride,
} from '../../src/systems/sea-themes.js';
import { MAJOR_SCALE } from '../../src/music.js';

test('a handful of sea themes, each a well-formed cast', () => {
  assert.ok(SEA_THEMES.length >= 3, 'need a small SET of themes, not one');
  assert.ok(SEA_THEMES.length <= 6, 'a handful, not a sprawl');
  for (const t of SEA_THEMES) {
    assert.equal(typeof t.name, 'string');
    assert.ok(t.name.length > 0);
    assert.ok(Array.isArray(t.scale) && t.scale.length === 7, `${t.name} scale must be a 7-note mode`);
    assert.equal(t.scale[0], 0, 'every mode is rooted at 0 (transposition is rootOffset)');
    assert.ok(Number.isInteger(t.rootOffset), `${t.name} rootOffset must be an integer semitone`);
    // All modes share root/fifth so they stay consonant with the shared bus (the #132/#158 discipline).
    assert.equal(t.scale[4], 7, `${t.name} must keep a perfect fifth (phase-coherent bed)`);
  }
});

test('the home theme is index 0 — the canonical D-major bed, byte-identical to the shipped hornpipe', () => {
  const home = SEA_THEMES[0];
  assert.equal(home.rootOffset, 0, 'a fresh sail opens in the home key (#117 doctrine)');
  assert.deepEqual(home.scale, MAJOR_SCALE, 'the home theme IS the untouched Ionian hornpipe');
});

test('the themes are pairwise DISTINCT — not one loop relabelled', () => {
  const sigs = SEA_THEMES.map((t) => JSON.stringify(t.scale) + '@' + t.rootOffset);
  assert.equal(new Set(sigs).size, SEA_THEMES.length, 'two themes share a (scale, transposition) — not distinct');
});

test('selection is deterministic — same bar + seed always the same theme', () => {
  for (const bars of [0, 3, 16, 31, 64, 129]) {
    const a = seaThemeAt(bars, { seed: SEA_THEME_SEED });
    const b = seaThemeAt(bars, { seed: SEA_THEME_SEED });
    assert.equal(a.name, b.name);
  }
});

test('a fresh sail (bar 0) opens on the home theme', () => {
  assert.equal(seaThemeIndexAt(0, { seed: SEA_THEME_SEED }), 0);
  assert.equal(seaThemeAt(0, { seed: SEA_THEME_SEED }).name, SEA_THEMES[0].name);
});

test('the sea ROTATES over time — a new theme after each ROTATE_BARS, and consecutive steps always differ', () => {
  // The core fun beat: a long voyage does NOT loop — it moves through distinct themes.
  const seen = new Set();
  let prev = seaThemeAt(0, { seed: SEA_THEME_SEED }).name;
  seen.add(prev);
  for (let stepN = 1; stepN <= SEA_THEMES.length * 2; stepN++) {
    const name = seaThemeAt(stepN * ROTATE_BARS, { seed: SEA_THEME_SEED }).name;
    assert.notEqual(name, prev, `rotation step ${stepN} repeated the previous theme — the sea would sound static`);
    seen.add(name);
    prev = name;
  }
  assert.equal(seen.size, SEA_THEMES.length, 'over a full cycle every theme is visited — full variety');
});

test('rotation is bar-QUANTISED — the theme is stable WITHIN a ROTATE_BARS window', () => {
  const first = seaThemeAt(0, { seed: SEA_THEME_SEED }).name;
  for (let b = 0; b < ROTATE_BARS; b++) {
    assert.equal(seaThemeAt(b, { seed: SEA_THEME_SEED }).name, first, `bar ${b} changed mid-window — not bar-quantised`);
  }
  // It changes at the boundary, not before.
  assert.notEqual(seaThemeAt(ROTATE_BARS, { seed: SEA_THEME_SEED }).name, first);
});

test('a different seed can pick a different rotation order', () => {
  // Determinism per-seed, but the seed genuinely steers the order (not a hard-coded sequence).
  const orderFor = (seed) => Array.from({ length: SEA_THEMES.length }, (_, k) =>
    seaThemeAt(k * ROTATE_BARS, { seed }).name).join('>');
  const strides = new Set(SEA_THEMES.map((_, s) => seededStride(s, SEA_THEMES.length)));
  assert.ok(strides.size >= 2, 'the stride must actually vary with the seed');
  // At least two distinct seeds yield distinct orders.
  const orders = new Set([0, 1, 2, 3, 4, 5, 6, 7].map(orderFor));
  assert.ok(orders.size >= 2, 'every seed yields the identical order — the seed does nothing');
});

test('seededStride is always coprime with the theme count — a full cycle visits every theme', () => {
  const n = SEA_THEMES.length;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  for (let seed = 0; seed < 50; seed++) {
    const s = seededStride(seed, n);
    assert.ok(s >= 1 && s <= n - 1, `stride ${s} out of range`);
    assert.equal(gcd(s, n), 1, `stride ${s} not coprime with ${n} — would skip themes`);
  }
});

test('nextSeaTheme FIRES only when the target theme differs from the committed one', () => {
  const home = seaThemeAt(0, { seed: SEA_THEME_SEED });
  // At sea, on the home window, already committed → no fire.
  assert.equal(nextSeaTheme({ committed: home, barsAtSea: 3, atSea: true }).fire, false);
  // At sea, crossed a boundary into a new theme → fire, with the new theme.
  const r = nextSeaTheme({ committed: home, barsAtSea: ROTATE_BARS, atSea: true });
  assert.equal(r.fire, true);
  assert.equal(r.theme.name, seaThemeAt(ROTATE_BARS, { seed: SEA_THEME_SEED }).name);
  assert.notEqual(r.theme.name, home.name);
});

test('nextSeaTheme YIELDS to town/battle — the rotation is HELD, never fires while ashore or fighting', () => {
  const home = seaThemeAt(0, { seed: SEA_THEME_SEED });
  // Even far past a boundary, atSea:false holds the committed theme (town/battle own the mix).
  const held = nextSeaTheme({ committed: home, barsAtSea: ROTATE_BARS * 3, atSea: false });
  assert.equal(held.fire, false, 'a theme swap fired while ashore/fighting — it must yield');
  assert.equal(held.theme.name, home.name, 'the held theme is the last committed one');
});

test('nextSeaTheme RESUMES cleanly on the same theme after a yield (no phantom swap on return to sea)', () => {
  // Sea-time is frozen during town/battle, so barsAtSea is unchanged on return → the committed theme
  // is still current → no fire; the rotation simply picks up where it left off.
  const t = seaThemeAt(5, { seed: SEA_THEME_SEED }); // whatever is committed when we made port
  const resume = nextSeaTheme({ committed: t, barsAtSea: 5, atSea: true });
  assert.equal(resume.fire, false, 'returning to sea must resume on the same theme, not re-cut');
});

test('junk / negative inputs fail safe to the home theme — never throws, never NaN', () => {
  assert.equal(seaThemeAt(-10, { seed: SEA_THEME_SEED }).name, SEA_THEMES[0].name);
  assert.equal(seaThemeAt(NaN, { seed: SEA_THEME_SEED }).name, SEA_THEMES[0].name);
  assert.doesNotThrow(() => seaThemeAt(undefined, {}));
  assert.doesNotThrow(() => nextSeaTheme({}));
});
