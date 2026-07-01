import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  projectToScreen, shipEmphasis, DIM_OPACITY,
} from '../../src/ui/over-ship-billboard.js';

// The reusable over-ship billboard module (#161 slice 3 target-lock; #165-ready). Two PURE cores are
// unit-tested here — the world→screen projection that anchors a marker/label above a ship, and the
// emphasis predicate that decides which hull is the locked foe and which recede as traffic.

// A column-major 4x4 identity (three.js Matrix4.elements convention). With w=1 the clip coords equal
// the world point, so NDC == the point and the screen map is trivial to reason about.
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

test('projectToScreen: the origin lands dead-centre of the viewport', () => {
  const p = projectToScreen([0, 0, 0], IDENTITY, 1280, 800);
  assert.equal(p.x, 640);
  assert.equal(p.y, 400);
  assert.equal(p.onScreen, true);
});

test('projectToScreen: +NDC x is screen-right, +NDC y is screen-UP (y flips)', () => {
  const p = projectToScreen([0.5, 0.5, 0], IDENTITY, 1000, 1000);
  assert.equal(p.x, 750); // (0.5*0.5+0.5)*1000
  assert.equal(p.y, 250); // (-0.5*0.5+0.5)*1000 — up on screen is a smaller y
  assert.equal(p.onScreen, true);
});

test('projectToScreen: a point outside the [-1,1] NDC box is off-screen (not behind)', () => {
  const p = projectToScreen([2, 0, 0], IDENTITY, 1280, 800);
  assert.equal(p.onScreen, false);
  assert.equal(p.behind, false);
});

test('projectToScreen: a point behind the camera (w<=0) is flagged behind + off-screen', () => {
  // e[3],e[7],e[11]=0 and e[15]=-1 ⇒ clip-w is -1 for any point → behind the camera.
  const behindMat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1];
  const p = projectToScreen([0, 0, 0], behindMat, 1280, 800);
  assert.equal(p.behind, true);
  assert.equal(p.onScreen, false);
});

test('shipEmphasis: outside battle every hull is normal (no dimming at sea)', () => {
  assert.equal(shipEmphasis({ battleActive: false, foeIndex: 2, index: 2 }), 'normal');
  assert.equal(shipEmphasis({ battleActive: false, foeIndex: 2, index: 0 }), 'normal');
});

test('shipEmphasis: in battle the foe is the foe, everyone else is dimmed traffic', () => {
  assert.equal(shipEmphasis({ battleActive: true, foeIndex: 1, index: 1 }), 'foe');
  assert.equal(shipEmphasis({ battleActive: true, foeIndex: 1, index: 0 }), 'dim');
  assert.equal(shipEmphasis({ battleActive: true, foeIndex: 1, index: 2 }), 'dim');
});

test('shipEmphasis: an active battle with no foe index (-1) dims nothing', () => {
  assert.equal(shipEmphasis({ battleActive: true, foeIndex: -1, index: 0 }), 'normal');
});

test('DIM_OPACITY is a real fade (strictly between hidden and full) so traffic recedes but stays alive', () => {
  assert.ok(DIM_OPACITY > 0 && DIM_OPACITY < 1);
});
