import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DANGER_BANDS, DEEP_R, regionDanger, regionalSpec,
} from '../../src/systems/danger.js';
import { shipStats } from '../../src/ship-classes.js';

// A deterministic rng so spec selection is fixed + repeatable in tests.
const rng = () => 0.5;

test('regionDanger: fixed by REGION — safe home coast, deadly open water (no rubber-band)', () => {
  // Danger reads ONLY position (distance from origin). No renown, no rubber-band.
  const coast = regionDanger(0, 320);     // just off the home coast
  const deep = regionDanger(0, DEEP_R + 50); // out in the deadly deep
  assert.ok(coast >= 1 && coast <= 5, `coast danger in 1..5 (${coast})`);
  assert.ok(deep >= 1 && deep <= 5, `deep danger in 1..5 (${deep})`);
  assert.ok(deep > coast, `the deep must be strictly more dangerous than the coast (${deep} !> ${coast})`);
  assert.equal(deep, 5, 'the deep sea is the apex-danger region (tier 5)');
});

test('regionDanger: MONOTONE outward — the farther you sail, the deadlier (never falls)', () => {
  let prev = 0;
  for (let r = 300; r <= DEEP_R + 400; r += 40) {
    const d = regionDanger(r, 0);
    assert.ok(d >= prev, `danger must not fall as you sail out (r=${r}: ${d} < ${prev})`);
    prev = d;
  }
});

test('regionDanger: purely radial — same distance in any direction reads the same danger', () => {
  const r = DEEP_R - 100;
  assert.equal(regionDanger(r, 0), regionDanger(0, r));
  assert.equal(regionDanger(-r, 0), regionDanger(0, -r));
});

test('DANGER_BANDS: an ascending, gap-free ladder ending at the tier-5 deep', () => {
  assert.ok(DANGER_BANDS.length >= 2, 'need at least a coast + a deep band');
  let prev = -Infinity;
  for (const b of DANGER_BANDS) {
    assert.ok(b.cap >= 1 && b.cap <= 5, `band cap in 1..5 (${b.cap})`);
    assert.ok(b.cap >= prev, 'band caps ascend outward');
    prev = b.cap;
  }
  assert.equal(DANGER_BANDS[DANGER_BANDS.length - 1].cap, 5, 'the outermost band is the tier-5 deep');
});

test('regionalSpec: the deep spawns STRICTLY higher-tier ships than the safe coast', () => {
  const coast = regionalSpec(0, 320, rng);
  const deep = regionalSpec(0, DEEP_R + 100, rng);
  const coastTier = shipStats(coast.cls, coast.role).tier;
  const deepTier = shipStats(deep.cls, deep.role).tier;
  assert.ok(deepTier > coastTier, `deep water must out-class the coast (${deepTier} !> ${coastTier})`);
});

test('regionalSpec apex: the withheld WARSHIP man-o\'-war becomes reachable in the deep', () => {
  const spec = regionalSpec(0, DEEP_R + 200, rng, { apex: true });
  assert.equal(spec.cls, 'manowar', 'the deep apex is a man-o\'-war');
  assert.equal(spec.role, 'warship', 'the deep apex is the WARSHIP man-o\'-war (the sea\'s terror)');
  assert.equal(shipStats(spec.cls, spec.role).tier, 5, 'the deep apex is threat tier 5');
});

test('regionalSpec: deterministic — same position + rng gives the same spec (fixed rule)', () => {
  const a = regionalSpec(0, 600, () => 0.3);
  const b = regionalSpec(0, 600, () => 0.3);
  assert.deepEqual(a, b);
});

test('regionalSpec: a spec stays within its region\'s danger cap (never over-classed)', () => {
  for (let r = 320; r <= DEEP_R + 300; r += 30) {
    const cap = regionDanger(r, 0);
    const spec = regionalSpec(r, 0, rng);
    const tier = shipStats(spec.cls, spec.role).tier;
    assert.ok(tier <= cap, `a spawn must not out-class its region (r=${r}: tier ${tier} > cap ${cap})`);
  }
});
