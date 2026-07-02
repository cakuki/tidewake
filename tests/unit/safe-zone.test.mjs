// Unit: non-occluding battle UI (#161 slice 2) — the PURE central-safe-zone predicate that keeps the
// framed ship VISIBLE during a fight. The owner reported the battle prompts covering his ship (a
// dead-centre modal on the hull the camera frames centre-screen). This pins the layout contract
// without a DOM (the #53 self-tested-component standard): a centred modal is REJECTED (it occludes),
// a bottom-docked prompt and the top raid strip both PASS. No save-schema — a layout predicate only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { centreSafeZone, rectsOverlap, clearsCentre, TOP_STRIP_RESERVE } from '../../src/ui/safe-zone.js';

const W = 1280, H = 800; // the playtest's authoritative desktop viewport

// ---- centreSafeZone: the central box the ship + fight occupy ---------------------------------

test('centreSafeZone spans the middle 60% width and the upper-centre 42% height', () => {
  const z = centreSafeZone(W, H);
  assert.equal(z.left, 256);
  assert.equal(z.right, 1024);
  assert.equal(z.top, 128);
  assert.ok(Math.abs(z.bottom - 464) < 1e-6);
});

test('centreSafeZone scales with the viewport (phone portrait)', () => {
  const z = centreSafeZone(400, 860);
  assert.equal(z.left, 80);
  assert.equal(z.right, 320);
  assert.equal(z.top, 137.6);
  assert.ok(Math.abs(z.bottom - 498.8) < 1e-9);
});

// ---- rectsOverlap: AABB, edge-touching is NOT overlap ----------------------------------------

test('rectsOverlap is true when rectangles intersect', () => {
  assert.equal(rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 },
    { left: 5, top: 5, right: 15, bottom: 15 }), true);
});

test('rectsOverlap is false when rectangles are disjoint', () => {
  assert.equal(rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 },
    { left: 20, top: 20, right: 30, bottom: 30 }), false);
});

test('rectsOverlap treats edge-touching as clear (not an overlap)', () => {
  assert.equal(rectsOverlap({ left: 0, top: 0, right: 10, bottom: 10 },
    { left: 10, top: 0, right: 20, bottom: 10 }), false);
});

// ---- clearsCentre: the load-bearing occlusion gate -------------------------------------------

test('a dead-centre modal (the OLD battle panel) OCCLUDES the ship — rejected', () => {
  // #battle at translate(-50%,-50%): a ~460x300 card centred on the viewport → lands on the hull.
  const centred = { left: W / 2 - 230, top: H / 2 - 150, right: W / 2 + 230, bottom: H / 2 + 150 };
  assert.equal(clearsCentre(centred, W, H), false);
});

test('a bottom-docked battle prompt (the FIX) stays clear of the centre', () => {
  // #battle docked to the lower band: ~460x240 centred horizontally, 18px off the bottom.
  const docked = { left: W / 2 - 230, top: H - 18 - 240, right: W / 2 + 230, bottom: H - 18 };
  assert.equal(clearsCentre(docked, W, H), true);
  assert.ok(docked.top > centreSafeZone(W, H).bottom); // literally below the safe band
});

test('the top raid-phase strip sits above the safe band — clear', () => {
  const raidStrip = { left: 490, top: 12, right: 790, bottom: 62 };
  assert.equal(clearsCentre(raidStrip, W, H), true);
});

test('a hidden / zero-area panel never occludes', () => {
  assert.equal(clearsCentre({ left: 0, top: 0, right: 0, bottom: 0 }, W, H), true);
  assert.equal(clearsCentre(null, W, H), true);
});

// ---- #75: short LANDSCAPE screen — the top strips must not read as occluders -------------------

test('short landscape: the band top is floored at the top-strip reserve (not 16% of a short height)', () => {
  const z = centreSafeZone(844, 390);   // 0.16*390 = 62.4 would dip into the top strips
  assert.equal(z.top, TOP_STRIP_RESERVE); // floored to 100 so the strips sit above the band
  assert.ok(z.top < z.bottom);            // still a valid (non-inverted) box
  assert.ok(Math.abs(z.bottom - 226.2) < 1e-6);
});

test('short landscape: the fixed top strips (raid tracker + key-prompts, ~4→96px) clear the band', () => {
  const w = 844, h = 390;
  const raid = { left: w / 2 - 150, top: 4, right: w / 2 + 150, bottom: 54 };
  const keyPrompts = { left: w / 2 - 100, top: 66, right: w / 2 + 100, bottom: 96 };
  assert.equal(clearsCentre(raid, w, h), true);
  assert.equal(clearsCentre(keyPrompts, w, h), true); // 96 ≤ band top 100 → clear (was 62 → occluded)
});

test('tall screens are UNCHANGED by the reserve floor (16% already clears the strips)', () => {
  assert.equal(centreSafeZone(1280, 800).top, 128);   // 0.16*800 = 128 > 100
  assert.ok(Math.abs(centreSafeZone(400, 860).top - 137.6) < 1e-9); // 0.16*860 > 100
});

test('the reserve floor never inverts the box on a pathologically tiny viewport', () => {
  const z = centreSafeZone(300, 170); // 0.40*170 = 68 caps the floor below bottom (0.58*170 = 98.6)
  assert.ok(z.top < z.bottom);
});

test('the bottom-docked prompt still clears on a phone-portrait viewport', () => {
  const w = 400, h = 860;
  // max-height:38vh guardrail → a wrapped panel can be at most ~0.38h tall, docked 18px off bottom.
  const tallest = { left: w * 0.04, top: h - 18 - 0.38 * h, right: w * 0.96, bottom: h - 18 };
  assert.equal(clearsCentre(tallest, w, h), true);
  assert.ok(tallest.top > centreSafeZone(w, h).bottom);
});
