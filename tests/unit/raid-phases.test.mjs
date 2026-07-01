// Unit: the per-phase raid tracker's PURE model (#135, Option-4 polish; #53 component standard).
// No browser — raidPhaseModel is a plain function of the battle + duel snapshots. It names WHICH
// ACT of the Three-Act Raid the player is in (⚔ Maneuver → 🪝 Boarding → 🗣 Duel) and surfaces the
// coupling state the player EARNED (hull battered → boarding advantage; bloodied boarding → duel
// footing). Read-only: it invents no mechanics, only reads flags already on the snapshots.
import test from 'node:test';
import assert from 'node:assert/strict';
import { raidPhaseModel, RAID_ACTS, boardAdvantagePct } from '../../src/ui/raid-phases.js';

test('no raid → null model (nothing to show at sea / in a plain hail-duel)', () => {
  assert.equal(raidPhaseModel(null, null), null);
  assert.equal(raidPhaseModel({ active: false }, { active: false }), null);
  // A duel reached by hailing (NOT boarding) is not a raid — the strip stays hidden.
  assert.equal(raidPhaseModel({ active: false }, { active: true, boarded: false }), null);
});

test('battle active, hull high → Maneuver act (index 0), later acts still to come', () => {
  const m = raidPhaseModel({ active: true, canBoard: false, boarded: false }, { active: false });
  assert.equal(m.actKey, 'maneuver');
  assert.equal(m.actIndex, 0);
  assert.deepEqual(m.acts.map((a) => a.state), ['active', 'todo', 'todo']);
  assert.equal(m.acts[0].icon, '⚔');
});

test('Maneuver act with no surrender surfaces no coupling line yet', () => {
  const m = raidPhaseModel({ active: true, canBoard: false, boarded: false, boardEdge: 0 }, { active: false });
  assert.equal(m.coupling, null);
});

test('struck colours mid-maneuver surfaces the surrender beat', () => {
  const m = raidPhaseModel({ active: true, canBoard: false, boarded: false, surrenderPending: true }, {});
  assert.equal(m.actKey, 'maneuver');
  assert.equal(m.coupling.tone, 'surrender');
  assert.match(m.coupling.text, /strikes her colours/i);
});

test('canBoard → Boarding act (index 1), Maneuver marked done', () => {
  const m = raidPhaseModel({ active: true, canBoard: true, boarded: false, boardEdge: 0 }, { active: false });
  assert.equal(m.actKey, 'boarding');
  assert.equal(m.actIndex, 1);
  assert.deepEqual(m.acts.map((a) => a.state), ['done', 'active', 'todo']);
});

test('a hull battered past the boarding line shows the earned boarding advantage', () => {
  const m = raidPhaseModel({ active: true, canBoard: true, boarded: false, boardEdge: 0.20 }, {});
  assert.equal(m.coupling.tone, 'good');
  assert.match(m.coupling.text, /boarding advantage \+20%/i);
});

test('boarding right on the line (no edge) shows the neutral grapple hint, not a bogus advantage', () => {
  const m = raidPhaseModel({ active: true, canBoard: true, boarded: false, boardEdge: 0 }, {});
  assert.equal(m.coupling.tone, 'neutral');
  assert.doesNotMatch(m.coupling.text, /advantage/i);
});

test('a boarded duel → Duel act (index 2), the first two acts done', () => {
  const m = raidPhaseModel({ active: false }, { active: true, boarded: true, confidenceDent: 0 });
  assert.equal(m.actKey, 'duel');
  assert.equal(m.actIndex, 2);
  assert.deepEqual(m.acts.map((a) => a.state), ['done', 'done', 'active']);
  assert.equal(m.acts[2].icon, '🗣');
});

test('a clean boarding → steady footing; a bloodied one → shaken footing (from confidenceDent)', () => {
  const clean = raidPhaseModel({ active: false }, { active: true, boarded: true, confidenceDent: 0 });
  assert.equal(clean.coupling.tone, 'good');
  assert.match(clean.coupling.text, /steady footing/i);

  const bloody = raidPhaseModel({ active: false }, { active: true, boarded: true, confidenceDent: 14 });
  assert.equal(bloody.coupling.tone, 'warn');
  assert.match(bloody.coupling.text, /shaken footing −14/i);
});

test('the duel act wins even if a stale battle snapshot still reads active', () => {
  const m = raidPhaseModel({ active: true, canBoard: true }, { active: true, boarded: true });
  assert.equal(m.actKey, 'duel');
});

test('boardAdvantagePct rounds the edge to a whole percent and never goes negative', () => {
  assert.equal(boardAdvantagePct(0.20), 20);
  assert.equal(boardAdvantagePct(0.347), 35);
  assert.equal(boardAdvantagePct(0), 0);
  assert.equal(boardAdvantagePct(-1), 0);
  assert.equal(boardAdvantagePct(undefined), 0);
});

test('RAID_ACTS is the three-act order with icons + labels', () => {
  assert.deepEqual(RAID_ACTS.map((a) => a.key), ['maneuver', 'boarding', 'duel']);
  assert.deepEqual(RAID_ACTS.map((a) => a.label), ['Maneuver', 'Boarding', 'Duel']);
});
