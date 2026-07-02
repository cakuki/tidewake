import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TIER, GROWTH_PIECES, GROWTH_KINDS,
  growthTier, revealCounts, piecesOfKind, pieceWorldPlacement, prosperity,
} from '../../src/systems/port-growth.js';
import { MAX_LEVEL } from '../../src/systems/home-port.js';
import { localToWorld } from '../../src/systems/props.js';

// The whole point of #174: the visible growth tier is DERIVED from the already-persisted harbour.level
// (no new save field), so MAX_TIER must track home-port.js MAX_LEVEL exactly — one source of truth.
test('MAX_TIER mirrors home-port MAX_LEVEL (derived from the same persisted level)', () => {
  assert.equal(MAX_TIER, MAX_LEVEL);
});

// ---- growthTier: only the claimed home port grows, derived from its level -------------------
test('growthTier is the home port level, and 0 for any other / unclaimed port', () => {
  const h = { name: 'Saltpurse Quay', level: 3, invested: 500 };
  assert.equal(growthTier(h, 'Saltpurse Quay'), 3);       // home → its level
  assert.equal(growthTier(h, 'Barnacle Bottom'), 0);      // a different port → nothing grows
  assert.equal(growthTier(null, 'Saltpurse Quay'), 0);    // nowhere claimed
});

test('growthTier fails open on junk and clamps into 0..MAX_TIER', () => {
  for (const junk of [null, undefined, 0, 'x', [], {}]) {
    assert.equal(growthTier(junk, 'X'), 0);
  }
  assert.equal(growthTier({ name: 'X', level: 99 }, 'X'), MAX_TIER); // clamped up
  assert.equal(growthTier({ name: 'X', level: -5 }, 'X'), 0);        // clamped down
  assert.equal(growthTier({ name: 'X', level: 2 }, ''), 0);          // no port name → 0
});

// ---- revealCounts: the visible dressing GROWS with the tier (the SEE beat, deterministic) ----
test('revealCounts grows monotonically with the tier — the port visibly prospers as you invest', () => {
  let prevB = -1, prevBoat = -1;
  for (let t = 0; t <= MAX_TIER; t++) {
    const c = revealCounts(t);
    assert.ok(c.building >= prevB, `buildings must not shrink at tier ${t}`);
    assert.ok(c.boat >= prevBoat, `boats must not shrink at tier ${t}`);
    assert.equal(c.mast, c.boat, 'a mast rides every moored boat');
    prevB = c.building; prevBoat = c.boat;
  }
});

test('tier 0 shows nothing; the top tier shows the fullest port', () => {
  assert.deepEqual(revealCounts(0), { building: 0, boat: 0, mast: 0 });
  const top = revealCounts(MAX_TIER);
  assert.equal(top.building, GROWTH_PIECES.filter((p) => p.kind === 'building').length);
  assert.equal(top.boat, GROWTH_PIECES.filter((p) => p.kind === 'boat').length);
});

test('each investment STEP adds visible dressing (tier N+1 shows strictly more than tier N somewhere)', () => {
  for (let t = 0; t < MAX_TIER; t++) {
    const a = revealCounts(t), b = revealCounts(t + 1);
    assert.ok((b.building + b.boat) > (a.building + a.boat),
      `growing from tier ${t} to ${t + 1} must reveal more of the port`);
  }
});

test('revealCounts clamps out-of-range tiers (fail-open)', () => {
  assert.deepEqual(revealCounts(-3), revealCounts(0));
  assert.deepEqual(revealCounts(999), revealCounts(MAX_TIER));
  assert.deepEqual(revealCounts(NaN), revealCounts(0));
});

// ---- piecesOfKind: ordered so the view can reveal the first-N by count ----------------------
test('piecesOfKind returns each kind ordered by appearsAt so reveal-first-N is correct', () => {
  for (const kind of GROWTH_KINDS) {
    const ps = piecesOfKind(kind);
    assert.ok(ps.length > 0, `${kind} should have pieces`);
    for (const p of ps) assert.equal(p.kind, kind);
    for (let i = 1; i < ps.length; i++) {
      assert.ok(ps[i].appearsAt >= ps[i - 1].appearsAt, `${kind} must be tier-ordered`);
    }
    // The count revealed at a tier equals the prefix of this ordered list at/under that tier.
    const atTop = ps.filter((p) => p.appearsAt <= MAX_TIER).length;
    assert.equal(atTop, revealCounts(MAX_TIER)[kind]);
  }
});

test('every piece appears at a real tier (1..MAX_TIER) so nothing is orphaned', () => {
  for (const p of GROWTH_PIECES) {
    assert.ok(p.appearsAt >= 1 && p.appearsAt <= MAX_TIER, `${p.kind} appearsAt out of range`);
  }
});

// ---- pieceWorldPlacement: sits in the port's own frame (reuses the CC0 transform) -----------
test('pieceWorldPlacement transforms into the port frame like the CC0 dressing', () => {
  const port = { x: 100, z: -50, angle: Math.PI / 3 };
  const piece = { kind: 'boat', x: -10, y: 0.9, z: 13, appearsAt: 1 };
  const got = pieceWorldPlacement(piece, port);
  const want = localToWorld(piece.x, piece.z, port.angle, port.x, port.z);
  assert.ok(Math.abs(got.x - want.x) < 1e-9 && Math.abs(got.z - want.z) < 1e-9);
  assert.equal(got.y, piece.y);
  assert.equal(got.rotY, port.angle);
});

// ---- prosperity: a single legible "how grown" scalar ---------------------------------------
test('prosperity rises with the tier and is 0 for an unclaimed / away port', () => {
  assert.equal(prosperity(0), 0);
  for (let t = 1; t <= MAX_TIER; t++) {
    assert.ok(prosperity(t) > prosperity(t - 1), `prosperity must climb at tier ${t}`);
  }
});
