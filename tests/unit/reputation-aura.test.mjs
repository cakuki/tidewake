// Your ship wears your legend (#132 Slice A, DL #5) — pure lean→ship-material mapping.
// The game's spine is the Infamy↔Standing pole; #126 made the WORLD show it, this makes the player's
// OWN SHIP show it. We assert the cast (neutral identity at rest, a grimy/dark pirate cast, a clean/
// bright/glowing governor cast, monotone with commitment, bounded, junk-safe) — all PURE, so node:test
// proves it without a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  shipAura, auraCommitment,
  NEUTRAL, GOVERNOR_GLOW, ROUGH_GRIME, ROUGH_CLEAN, GLOW_MAX,
} from '../../src/systems/reputation-aura.js';
import { reputationLean, MAX_LEAN } from '../../src/systems/reputation-grade.js';

const chan = (hex, shift) => (hex >> shift) & 0xff;
const R = (h) => chan(h, 16), G = (h) => chan(h, 8), B = (h) => h & 0xff;
const lum = (h) => (R(h) + G(h) + B(h)) / 3;
const warmth = (h) => R(h) - B(h); // >0 = warmer

test('neutral by default — no legend, the untouched ship (byte-for-byte identity)', () => {
  for (const lean of [0, NaN, undefined, null]) {
    const a = shipAura(lean);
    assert.equal(a.pole, 'neutral');
    assert.equal(a.mag, 0);
    for (const p of [a.sail, a.hull]) {
      assert.equal(p.color, NEUTRAL);
      assert.equal(p.roughnessAdd, 0);
      assert.equal(p.emissive, 0x000000);
      assert.equal(p.emissiveIntensity, 0);
    }
  }
});

test('auraCommitment: |lean| maps over [0, MAX_LEAN] → [0,1], junk → 0, saturates at 1', () => {
  assert.equal(auraCommitment(0), 0);
  assert.equal(auraCommitment(NaN), 0);
  assert.equal(auraCommitment(MAX_LEAN), 1);
  assert.equal(auraCommitment(-MAX_LEAN), 1);
  assert.equal(auraCommitment(MAX_LEAN * 10), 1); // bounded
  assert.ok(Math.abs(auraCommitment(MAX_LEAN / 2) - 0.5) < 1e-9);
});

test('infamy (positive lean) → a GRIMY, DARKENED, MATTE cast, no glow', () => {
  const a = shipAura(MAX_LEAN); // full pirate commitment
  assert.equal(a.pole, 'pirate');
  // colour multiplier darkens below white (grime); warmth does NOT increase (it greys/cools)
  assert.ok(lum(a.sail.color) < lum(NEUTRAL), 'sail darkened');
  assert.ok(lum(a.hull.color) < lum(NEUTRAL), 'hull darkened');
  assert.ok(lum(a.hull.color) < lum(a.sail.color), 'timber grimes darker than canvas');
  // roughens (matte / salt-caked), never glows
  assert.ok(a.sail.roughnessAdd > 0 && a.hull.roughnessAdd > 0, 'roughened');
  assert.equal(a.sail.emissiveIntensity, 0);
  assert.equal(a.hull.emissiveIntensity, 0);
});

test('standing (negative lean) → a CLEAN, WARM, GLOWING, SHEENED cast', () => {
  const a = shipAura(-MAX_LEAN); // full governor commitment
  assert.equal(a.pole, 'governor');
  // warm tint (not darkened to grey), a soft trim glow, a cared-for sheen (lower roughness)
  assert.ok(warmth(a.sail.color) > 0, 'sail warmed');
  assert.ok(warmth(a.hull.color) > 0, 'hull warmed');
  assert.ok(a.sail.emissiveIntensity > 0 && a.hull.emissiveIntensity > 0, 'glows');
  assert.equal(a.sail.emissive, GOVERNOR_GLOW);
  assert.ok(a.sail.roughnessAdd < 0 && a.hull.roughnessAdd < 0, 'sheened (smoother)');
});

test('the two poles are DISTINCT — pirate grimes/roughens, governor brightens/glows', () => {
  const pirate = shipAura(MAX_LEAN);
  const gov = shipAura(-MAX_LEAN);
  assert.ok(lum(gov.sail.color) > lum(pirate.sail.color), 'governor canvas reads brighter than pirate');
  assert.ok(gov.sail.roughnessAdd < pirate.sail.roughnessAdd, 'governor sheens where pirate roughens');
  assert.ok(gov.sail.emissiveIntensity > pirate.sail.emissiveIntensity, 'only governor glows');
});

test('monotone with commitment — a deeper lean casts further from neutral (and stays bounded)', () => {
  const slightP = shipAura(MAX_LEAN * 0.4);
  const fullP = shipAura(MAX_LEAN);
  assert.ok(lum(fullP.sail.color) < lum(slightP.sail.color), 'deeper infamy → darker');
  assert.ok(fullP.sail.roughnessAdd > slightP.sail.roughnessAdd, 'deeper infamy → rougher');
  const slightG = shipAura(-MAX_LEAN * 0.4);
  const fullG = shipAura(-MAX_LEAN);
  assert.ok(fullG.sail.emissiveIntensity > slightG.sail.emissiveIntensity, 'deeper standing → more glow');
  // bounded at full commitment
  assert.ok(fullP.sail.roughnessAdd <= ROUGH_GRIME + 1e-9);
  assert.ok(fullG.sail.roughnessAdd >= -ROUGH_CLEAN - 1e-9);
  assert.ok(fullG.sail.emissiveIntensity <= GLOW_MAX + 1e-9);
});

test('end-to-end off the ledger: a feared captain grimes, a respected one gleams, balanced stays honest', () => {
  // a balanced ledger sits in the deadzone → the honest sloop
  assert.equal(shipAura(reputationLean(55, 45)).pole, 'neutral');
  // a committed pirate
  assert.equal(shipAura(reputationLean(2000, 0)).pole, 'pirate');
  // a committed governor
  assert.equal(shipAura(reputationLean(0, 2000)).pole, 'governor');
});
