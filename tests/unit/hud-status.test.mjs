// Unit: persistent status HUD layout model (#21) — the PURE grouping + viewport-fit contract that
// keeps the corner "who you are / what you have" cluster legible after THE RISE (#168) piled coins,
// rank/title, the reputation ledger and the crown onto it. Pins the contract without a DOM (the #53
// self-tested-component standard): the read-outs split into two named groups, every RISE field
// survives the flatten, and a box that spills off a phone-portrait screen is REJECTED. No save-schema.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HUD_GROUPS, HUD_FIELDS, fitsViewport, anchoredTopLeft } from '../../src/ui/hud-status.js';

// ---- HUD_GROUPS: two legible clusters, navigation vs progression ------------------------------

test('the HUD splits into exactly two groups — Sailing and Captain', () => {
  assert.equal(HUD_GROUPS.length, 2);
  assert.deepEqual(HUD_GROUPS.map((g) => g.id), ['sail', 'status']);
  assert.deepEqual(HUD_GROUPS.map((g) => g.caption), ['Sailing', 'Captain']);
});

test('the Sailing group carries the navigation read-outs', () => {
  const sail = HUD_GROUPS.find((g) => g.id === 'sail');
  assert.deepEqual(sail.fields, ['heading', 'speed', 'wind']);
});

test('the Captain group carries wealth + the RISE progression read-outs', () => {
  const status = HUD_GROUPS.find((g) => g.id === 'status');
  for (const id of ['coins', 'cargo', 'infamy', 'standing', 'rank']) {
    assert.ok(status.fields.includes(id), `Captain group must show ${id}`);
  }
});

// ---- HUD_FIELDS: nothing dropped in the consolidation (#21 must-not-break) --------------------

test('HUD_FIELDS flattens every grouped read-out — the RISE fields all survive', () => {
  for (const id of ['coins', 'infamy', 'standing', 'rank']) {
    assert.ok(HUD_FIELDS.includes(id), `${id} must survive the consolidation`);
  }
  // Flatten is exactly the concatenation of the group field lists (no field lost or duplicated).
  assert.deepEqual(HUD_FIELDS, HUD_GROUPS.flatMap((g) => g.fields));
});

// ---- fitsViewport: the #146 phone-portrait guard ---------------------------------------------

test('a small top-left corner HUD fits both desktop and phone portrait', () => {
  const hud = { left: 12, top: 12, right: 300, bottom: 260 };
  assert.equal(fitsViewport(hud, 1280, 800), true);
  assert.equal(fitsViewport(hud, 400, 860), true);
});

test('a HUD that spills off the right edge is REJECTED', () => {
  const wide = { left: 12, top: 12, right: 460, bottom: 260 };
  assert.equal(fitsViewport(wide, 400, 860), false);
});

test('a HUD that overflows the bottom edge is REJECTED', () => {
  const tall = { left: 12, top: 12, right: 300, bottom: 900 };
  assert.equal(fitsViewport(tall, 400, 860), false);
});

test('tolerance absorbs a sub-pixel edge-flush box', () => {
  const flush = { left: -0.4, top: -0.3, right: 400.4, bottom: 860.2 };
  assert.equal(fitsViewport(flush, 400, 860, 0), false);
  assert.equal(fitsViewport(flush, 400, 860, 1), true);
});

test('a hidden / zero-area / missing box never overflows', () => {
  assert.equal(fitsViewport({ left: 0, top: 0, right: 0, bottom: 0 }, 400, 860), true);
  assert.equal(fitsViewport(null, 400, 860), true);
});

// ---- anchoredTopLeft: the corner HUD's non-occlusion contract --------------------------------

test('a real top-left corner HUD stays anchored on desktop AND phone (clear of the ship band)', () => {
  // Measured live rects: desktop 12,12→332,317 ; phone 12,12→268,280 (with a full RISE ledger).
  assert.equal(anchoredTopLeft({ left: 12, top: 12, right: 332, bottom: 317 }, 1280, 800), true);
  assert.equal(anchoredTopLeft({ left: 12, top: 12, right: 268, bottom: 280 }, 400, 860), true);
});

test('a cluster that drops into the mid-screen ship band is REJECTED', () => {
  // Same top-left origin but grown tall enough to spill past the vertical half — over the framed hull.
  assert.equal(anchoredTopLeft({ left: 12, top: 12, right: 268, bottom: 520 }, 400, 860), false);
});

test('a centre-anchored panel (not a corner cluster) is REJECTED', () => {
  assert.equal(anchoredTopLeft({ left: 500, top: 300, right: 780, bottom: 500 }, 1280, 800), false);
});

test('a hidden / missing corner box is treated as clear', () => {
  assert.equal(anchoredTopLeft({ left: 0, top: 0, right: 0, bottom: 0 }, 400, 860), true);
  assert.equal(anchoredTopLeft(null, 400, 860), true);
});
