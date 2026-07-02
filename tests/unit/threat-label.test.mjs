import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  threatGlyphs, dangerLevel, threatLabelFor, labelFade, maxLabelsForViewport, selectLabels,
  PREY_GLYPH, THREAT_GLYPH,
} from '../../src/systems/threat-label.js';
import { shipStats } from '../../src/ship-classes.js';

// Over-ship threat labels (#165, epic #162 slice 3). The PURE brain is unit-tested here: a ship's class
// → its floating label text + threat glyph (so a man-o'-war reads MORE dangerous than a merchant sloop
// at a glance), and the distance/declutter rule (fade with distance, cap the count, mobile guard) that
// keeps the sea legible instead of smothered. No DOM, no three.js — just the readable-danger maths.

// ---- threatGlyphs: the at-a-glance threat read ----------------------------------------------

test('threatGlyphs: tier 1 is easy prey — a single dot, no skulls', () => {
  assert.equal(threatGlyphs(1), PREY_GLYPH);
  assert.equal((threatGlyphs(1).match(/☠/g) || []).length, 0);
});

test('threatGlyphs: threat escalates monotonically with tier (more skulls = more danger)', () => {
  const skulls = (t) => (threatGlyphs(t).match(/☠/g) || []).length;
  assert.equal(skulls(1), 0);
  assert.equal(skulls(2), 1);
  assert.equal(skulls(3), 2);
  assert.equal(skulls(4), 3);
  assert.equal(skulls(5), 4);
  // strictly increasing — the whole point: bigger tier is visibly deadlier
  for (let t = 2; t <= 5; t++) assert.ok(skulls(t) > skulls(t - 1), `tier ${t} must out-skull ${t - 1}`);
});

test('threatGlyphs: a tier-5 warship man-o\'-war reads the owner\'s "☠☠☠☠"', () => {
  assert.equal(threatGlyphs(5), '☠☠☠☠');
  assert.equal(THREAT_GLYPH, '☠');
});

test('threatGlyphs: clamps out-of-range + non-numeric tiers to [1,5]', () => {
  assert.equal(threatGlyphs(0), PREY_GLYPH);
  assert.equal(threatGlyphs(-3), PREY_GLYPH);
  assert.equal(threatGlyphs(99), '☠☠☠☠');
  assert.equal(threatGlyphs(undefined), PREY_GLYPH);
  assert.equal(threatGlyphs(3.4), '☠☠'); // rounds to 3
});

// ---- dangerLevel: the colour band ------------------------------------------------------------

test('dangerLevel: monotonic green→red band names across the tier ladder', () => {
  assert.equal(dangerLevel(1), 'prey');
  assert.equal(dangerLevel(2), 'easy');
  assert.equal(dangerLevel(3), 'even');
  assert.equal(dangerLevel(4), 'hard');
  assert.equal(dangerLevel(5), 'deadly');
  assert.equal(dangerLevel(0), 'prey');   // clamps
  assert.equal(dangerLevel(9), 'deadly'); // clamps
});

// ---- threatLabelFor: class → the full floating label -----------------------------------------

test('threatLabelFor: a merchant sloop reads "Merchant Sloop ·" — an easy prize', () => {
  const label = threatLabelFor(shipStats('sloop', 'merchant'));
  assert.equal(label.text, 'Merchant Sloop ·');
  assert.equal(label.tier, 1);
  assert.equal(label.level, 'prey');
  assert.equal(label.glyphs, PREY_GLYPH);
});

test('threatLabelFor: a warship man-o\'-war reads "Warship Man-o\'-War ☠☠☠☠" — a deadly foe', () => {
  const label = threatLabelFor(shipStats('manowar', 'warship'));
  assert.equal(label.text, "Warship Man-o'-War ☠☠☠☠");
  assert.equal(label.tier, 5);
  assert.equal(label.level, 'deadly');
});

test('threatLabelFor: a man-o\'-war reads STRICTLY more dangerous than a merchant sloop (pick-your-fight)', () => {
  const prey = threatLabelFor(shipStats('sloop', 'merchant'));
  const beast = threatLabelFor(shipStats('manowar', 'warship'));
  const skulls = (l) => (l.glyphs.match(/☠/g) || []).length;
  assert.ok(beast.tier > prey.tier, 'the man-o\'-war must out-tier the sloop');
  assert.ok(skulls(beast) > skulls(prey), 'the man-o\'-war must show more skulls than the sloop');
});

test('threatLabelFor: null/absent class yields no label (nothing to render)', () => {
  assert.equal(threatLabelFor(null), null);
  assert.equal(threatLabelFor(undefined), null);
});

// ---- labelFade: legible-at-distance, receding declutter --------------------------------------

test('labelFade: fully opaque within `near`, gone by `far`, half-way in the middle', () => {
  assert.equal(labelFade(0, 300, 1500), 1);
  assert.equal(labelFade(300, 300, 1500), 1);
  assert.equal(labelFade(1500, 300, 1500), 0);
  assert.equal(labelFade(2000, 300, 1500), 0);           // beyond far ⇒ culled
  assert.equal(labelFade(900, 300, 1500), 0.5);          // exact midpoint
  const mid = labelFade(700, 300, 1500);
  assert.ok(mid > 0 && mid < 1, 'fades in the band');
});

test('labelFade: monotonically decreasing with distance', () => {
  let prev = Infinity;
  for (let d = 0; d <= 2000; d += 100) {
    const o = labelFade(d, 300, 1500);
    assert.ok(o <= prev, `opacity must not rise with distance (d=${d})`);
    prev = o;
  }
});

// ---- maxLabelsForViewport: the #146 mobile declutter guard ------------------------------------

test('maxLabelsForViewport: a phone shows FEWER labels than a desktop (never smother a small screen)', () => {
  assert.ok(maxLabelsForViewport(400) < maxLabelsForViewport(1280), 'phone caps below desktop');
  assert.equal(maxLabelsForViewport(400), 3);   // phone-portrait
  assert.equal(maxLabelsForViewport(1280), 6);  // desktop
  assert.equal(maxLabelsForViewport(559), 3);   // just under the breakpoint
  assert.equal(maxLabelsForViewport(560), 6);   // at the breakpoint
});

// ---- selectLabels: the whole declutter decision ----------------------------------------------

test('selectLabels: shows on-screen, eligible, in-range hulls nearest-first', () => {
  const out = selectLabels([
    { index: 0, distance: 100, onScreen: true, eligible: true },
    { index: 1, distance: 500, onScreen: true, eligible: true },
  ], { near: 300, far: 1500, maxLabels: 6 });
  assert.equal(out[0], 1);                 // nearest ⇒ full opacity
  assert.ok(out[1] > 0 && out[1] < 1);     // farther ⇒ faded
});

test('selectLabels: culls off-screen, out-of-range, and ineligible hulls', () => {
  const out = selectLabels([
    { index: 0, distance: 100, onScreen: false, eligible: true },  // behind camera
    { index: 1, distance: 3000, onScreen: true, eligible: true },  // over the horizon
    { index: 2, distance: 100, onScreen: true, eligible: false },  // suppressed (e.g. dimmed traffic mid-fight)
    { index: 3, distance: 100, onScreen: true, eligible: true },   // the only one shown
  ], { near: 300, far: 1500, maxLabels: 6 });
  assert.equal(out[0], undefined);
  assert.equal(out[1], undefined);
  assert.equal(out[2], undefined);
  assert.equal(out[3], 1);
});

test('selectLabels: caps at maxLabels — the nearest N win, distant ones drop (declutter)', () => {
  const entries = [];
  for (let i = 0; i < 10; i++) entries.push({ index: i, distance: 100 + i * 50, onScreen: true, eligible: true });
  const out = selectLabels(entries, { near: 300, far: 5000, maxLabels: 3 });
  assert.equal(Object.keys(out).length, 3, 'only 3 labels render at once');
  // the three NEAREST (indices 0,1,2) are the ones kept
  assert.ok(out[0] != null && out[1] != null && out[2] != null);
  assert.equal(out[9], undefined);
});

test('selectLabels: a battle keeps only the foe (eligibility declutters the traffic mid-fight)', () => {
  // main.js marks non-foe hulls ineligible during a fight so the foe\'s label + ring read clean together.
  const entries = [
    { index: 0, distance: 120, onScreen: true, eligible: false }, // dimmed traffic
    { index: 1, distance: 130, onScreen: true, eligible: true },  // the engaged foe
    { index: 2, distance: 140, onScreen: true, eligible: false }, // dimmed traffic
  ];
  const out = selectLabels(entries, { near: 300, far: 1500, maxLabels: 6 });
  assert.deepEqual(Object.keys(out), ['1']);
});
