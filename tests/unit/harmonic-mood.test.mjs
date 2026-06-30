// The harmonic reputation needle (#132 Slice B, DL #5) — pure lean→modal-recolour mapping.
// Slice A made the SHIP wear the Infamy↔Standing lean; this is its AUDIBLE twin: the same signed lean
// recolours the lead's mode. We assert the cast (neutral/Ionian at rest, a freygish "bite" toward Infamy,
// a warm Lydian voicing toward Standing, monotone + bounded crossfade, junk-safe) — all PURE, so
// node:test proves it without ever opening an AudioContext.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  harmonicMood, recolourBlend,
  IONIAN, LYDIAN, FREYGISH, RECOLOUR_MAX,
} from '../../src/systems/harmonic-mood.js';
import { reputationLean, MAX_LEAN } from '../../src/systems/reputation-grade.js';
import { MAJOR_SCALE } from '../../src/music.js';

test('neutral by default — no legend, the untouched D-major hornpipe', () => {
  for (const lean of [0, NaN, undefined, null]) {
    const m = harmonicMood(lean);
    assert.equal(m.pole, 'neutral');
    assert.equal(m.blend, 0);
    assert.deepEqual(m.scale, IONIAN);
  }
});

test('IONIAN is the neutral bed — byte-for-byte the music.js MAJOR_SCALE', () => {
  // The recolour must layer over the SAME scale the bed already plays at neutral, or the crossfade
  // would click at lean 0. This guards that the two never drift apart.
  assert.deepEqual(IONIAN, MAJOR_SCALE);
});

test('the three modes share root / third / fifth / octave (phase-coherent over the fixed bed)', () => {
  // 1=root(0), 3=third(idx2), 5=fifth(idx4) — identical across all three so the FIXED D-major bass +
  // pad never fights the recolour; only the colour tones (2/4/6/7) differ between modes.
  for (const s of [IONIAN, LYDIAN, FREYGISH]) {
    assert.equal(s[0], 0, 'shared root');
    assert.equal(s[2], 4, 'shared major third');
    assert.equal(s[4], 7, 'shared fifth');
  }
});

test('FREYGISH is the Infamy bite — flat-2, major-3, flat-6, flat-7 (phrygian-dominant)', () => {
  assert.equal(FREYGISH[1], 1, 'flat second — the menace');
  assert.equal(FREYGISH[2], 4, 'major third (it is dominant, not minor)');
  assert.equal(FREYGISH[5], 8, 'flat sixth — the augmented-2nd "happy-sad" bite');
  assert.equal(FREYGISH[6], 10, 'flat seventh');
});

test('LYDIAN is the Standing brightening — raised 4th over the neutral Ionian', () => {
  assert.equal(LYDIAN[3], 6, 'raised fourth — airy/luminous');
  assert.equal(IONIAN[3], 5, 'neutral fourth is natural');
  // Lydian differs from Ionian by exactly the one raised note (otherwise identical).
  for (let i = 0; i < 7; i++) if (i !== 3) assert.equal(LYDIAN[i], IONIAN[i], `degree ${i} unchanged`);
});

test('a pirate lean leans freygish; a governor lean brightens to lydian', () => {
  const pirate = harmonicMood(MAX_LEAN);
  assert.equal(pirate.pole, 'pirate');
  assert.deepEqual(pirate.scale, FREYGISH);
  assert.ok(pirate.blend > 0);

  const gov = harmonicMood(-MAX_LEAN);
  assert.equal(gov.pole, 'governor');
  assert.deepEqual(gov.scale, LYDIAN);
  assert.ok(gov.blend > 0);
});

test('recolourBlend: |lean| over [0, MAX_LEAN] → [0, RECOLOUR_MAX], junk → 0, bounded', () => {
  assert.equal(recolourBlend(0), 0);
  assert.equal(recolourBlend(NaN), 0);
  assert.equal(recolourBlend(undefined), 0);
  assert.ok(Math.abs(recolourBlend(MAX_LEAN) - RECOLOUR_MAX) < 1e-9);
  assert.ok(Math.abs(recolourBlend(-MAX_LEAN) - RECOLOUR_MAX) < 1e-9);
  assert.equal(recolourBlend(MAX_LEAN * 10), RECOLOUR_MAX); // bounded — a wisp of Ionian always survives
  assert.ok(Math.abs(recolourBlend(MAX_LEAN / 2) - RECOLOUR_MAX / 2) < 1e-9);
});

test('the crossfade is monotonic with commitment (deeper pole → more recolour)', () => {
  const steps = [0, 0.25, 0.5, 0.75, 1].map((f) => recolourBlend(f * MAX_LEAN));
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1], `blend grows at step ${i}`);
  // never exceeds the ceiling, so the neutral lead (1-blend) never fully vanishes
  for (const b of steps) assert.ok(b <= RECOLOUR_MAX + 1e-9);
});

test('rides the real needle: a deadzoned slight lean reads neutral, a clear commit recolours', () => {
  // reputationLean() returns exactly 0 inside the neutral band — so a 55/45 split must stay Ionian.
  const slight = harmonicMood(reputationLean(55, 45));
  assert.equal(slight.pole, 'neutral');
  assert.equal(slight.blend, 0);
  assert.deepEqual(slight.scale, IONIAN);

  const feared = harmonicMood(reputationLean(900, 100));
  assert.equal(feared.pole, 'pirate');
  assert.deepEqual(feared.scale, FREYGISH);
  assert.ok(feared.blend > 0);

  const honoured = harmonicMood(reputationLean(100, 900));
  assert.equal(honoured.pole, 'governor');
  assert.deepEqual(honoured.scale, LYDIAN);
  assert.ok(honoured.blend > 0);
});
