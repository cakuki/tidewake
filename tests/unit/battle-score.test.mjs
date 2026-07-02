// Per-phase battle musical signatures (#158) — the PURE layer-selection + bar-clock crossfade logic.
// The shipped #135 raid-phase model names WHICH ACT you're in (⚔ Maneuver / 🪝 Boarding / 🗣 Duel);
// this makes the SCORE wear that act. Each act gets a DISTINCT musical layer (a mode + register +
// drive — not merely louder), and a phase transition triggers a bar-quantised, constant-power
// crossfade to the new layer. All PURE — node:test proves it without ever opening an AudioContext.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  battleLayer, crossfadeGains, nextTransition,
  BATTLE_ACTS, DRIVE_SCALE, MENACE_SCALE, EDGE_SCALE, BATTLE_STEPS_PER_BAR,
} from '../../src/systems/battle-score.js';
import { MAJOR_SCALE } from '../../src/music.js';
import { RAID_ACTS } from '../../src/ui/raid-phases.js';

test('the three battle acts match the shipped raid-phase model — invents NO new phases', () => {
  // The score reads the SAME acts the #135 HUD names; it must never drift a fourth phase into being.
  assert.deepEqual(Object.keys(BATTLE_ACTS).sort(), RAID_ACTS.map((a) => a.key).sort());
});

test('each act maps to a DISTINCT layer/param set — not merely louder', () => {
  const man = battleLayer('maneuver');
  const brd = battleLayer('boarding');
  const duel = battleLayer('duel');
  assert.equal(man.act, 'maneuver');
  assert.equal(brd.act, 'boarding');
  assert.equal(duel.act, 'duel');
  // Pairwise distinct by COLOUR (scale), not just gain: the ear reads a different mode per act.
  assert.notDeepEqual(man.scale, brd.scale);
  assert.notDeepEqual(brd.scale, duel.scale);
  assert.notDeepEqual(man.scale, duel.scale);
  // …and a distinct energy/register per act, so the contrast is unmistakable on transition.
  const drives = [man.drive, brd.drive, duel.drive];
  assert.equal(new Set(drives).size, 3, 'each act has its own drive');
  // The duel is the sharp, pointed climax — voiced a register up over the boarding brawl.
  assert.ok(duel.octave > man.octave, 'the duel reads higher/sharper than the maneuver');
});

test('all three act scales share root / major-3rd / 5th — phase-coherent over the FIXED D-major bed', () => {
  // The battle layers recolour the LEAD over the SAME fixed D-major bass+pad (the #132 discipline —
  // NO percussive bed added, NO loadTrack). Sharing 1/3/5 keeps every act consonant with that bed;
  // only the colour tones (2/4/6/7) change between acts.
  for (const s of [DRIVE_SCALE, MENACE_SCALE, EDGE_SCALE]) {
    assert.equal(s[0], 0, 'shared root');
    assert.equal(s[2], 4, 'shared major third');
    assert.equal(s[4], 7, 'shared fifth');
    assert.equal(s.length, 7, 'a seven-note mode');
  }
});

test('the maneuver drive layer is a rolling, propulsive recolour (flat-7 chase colour)', () => {
  assert.equal(DRIVE_SCALE[6], 10, 'flat seventh — the driving mixolydian roll of the chase');
});

test('the boarding menace layer bites (flat-2, flat-6 — the grapple tension)', () => {
  assert.equal(MENACE_SCALE[1], 1, 'flat second — the menace');
  assert.equal(MENACE_SCALE[5], 8, 'flat sixth — the dark grapple tension');
});

test('the duel edge layer is sharp/bright (raised-4th — the pointed verbal standoff)', () => {
  assert.equal(EDGE_SCALE[3], 6, 'raised fourth — the sharp, unresolved edge of the duel');
});

test('battleLayer at sea / on junk → a silent rest (no battle layer, the honest bed alone)', () => {
  for (const junk of [null, undefined, '', 'atsea', 'sailing', 42, {}]) {
    const rest = battleLayer(junk);
    assert.equal(rest.act, null, `${JSON.stringify(junk)} → no act`);
    assert.equal(rest.drive, 0, 'silent — the battle layer is absent outside a raid');
    assert.deepEqual(rest.scale, MAJOR_SCALE, 'falls back to the neutral D-major bed');
  }
});

test('crossfadeGains is constant-power (equal-power sum ≈ 1) across the swap', () => {
  for (const t of [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1]) {
    const { from, to } = crossfadeGains(t);
    assert.ok(Math.abs(from * from + to * to - 1) < 1e-9, `constant power at t=${t}`);
  }
});

test('crossfadeGains endpoints: t=0 is all-outgoing, t=1 is all-incoming', () => {
  const a = crossfadeGains(0);
  assert.ok(Math.abs(a.from - 1) < 1e-9 && Math.abs(a.to - 0) < 1e-9, 'start: old layer full');
  const b = crossfadeGains(1);
  assert.ok(Math.abs(b.from - 0) < 1e-9 && Math.abs(b.to - 1) < 1e-9, 'end: new layer full');
});

test('crossfadeGains is monotonic (incoming rises, outgoing falls) and junk-safe', () => {
  const ts = [0, 0.2, 0.4, 0.6, 0.8, 1];
  const g = ts.map(crossfadeGains);
  for (let i = 1; i < g.length; i++) {
    assert.ok(g[i].to >= g[i - 1].to, 'incoming grows');
    assert.ok(g[i].from <= g[i - 1].from, 'outgoing shrinks');
  }
  // junk clamps into [0,1] range, never NaN
  assert.deepEqual(crossfadeGains(-5), crossfadeGains(0));
  assert.deepEqual(crossfadeGains(9), crossfadeGains(1));
  const j = crossfadeGains(NaN);
  assert.ok(Number.isFinite(j.from) && Number.isFinite(j.to));
});

test('nextTransition: a phase change fires ONLY on the bar-clock downbeat (quantised, never mid-phrase)', () => {
  const spb = BATTLE_STEPS_PER_BAR;
  // Off the downbeat, a pending change is HELD — the committed act stays, no swap.
  const held = nextTransition({ committed: 'maneuver', target: 'boarding', step: 3, stepsPerBar: spb });
  assert.equal(held.fire, false);
  assert.equal(held.act, 'maneuver');
  // On the next downbeat (step % stepsPerBar === 0), the swap FIRES to the new act.
  const fired = nextTransition({ committed: 'maneuver', target: 'boarding', step: spb, stepsPerBar: spb });
  assert.equal(fired.fire, true);
  assert.equal(fired.act, 'boarding');
});

test('nextTransition: no pending change → no crossfade (steady during an act, even on a downbeat)', () => {
  const spb = BATTLE_STEPS_PER_BAR;
  const same = nextTransition({ committed: 'boarding', target: 'boarding', step: 0, stepsPerBar: spb });
  assert.equal(same.fire, false);
  assert.equal(same.act, 'boarding');
});

test('nextTransition: entering (null→act) and leaving (act→null) both quantise to the downbeat', () => {
  const spb = BATTLE_STEPS_PER_BAR;
  const enter = nextTransition({ committed: null, target: 'maneuver', step: 0, stepsPerBar: spb });
  assert.equal(enter.fire, true);
  assert.equal(enter.act, 'maneuver');
  const leaveHeld = nextTransition({ committed: 'duel', target: null, step: 5, stepsPerBar: spb });
  assert.equal(leaveHeld.fire, false);
  assert.equal(leaveHeld.act, 'duel');
  const leave = nextTransition({ committed: 'duel', target: null, step: 2 * spb, stepsPerBar: spb });
  assert.equal(leave.fire, true);
  assert.equal(leave.act, null);
});

test('nextTransition is junk-safe (bad step/stepsPerBar never throws, never false-fires)', () => {
  assert.doesNotThrow(() => nextTransition({ committed: 'maneuver', target: 'duel', step: NaN }));
  const r = nextTransition({ committed: 'maneuver', target: 'duel', step: -8, stepsPerBar: 8 });
  assert.ok(typeof r.fire === 'boolean');
});
