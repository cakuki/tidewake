import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shipIndexFromObject, pickShipAction, actionLabel } from '../../src/systems/ship-picker.js';

// ---- shipIndexFromObject: raycast hit → ship index -------------------------------------------------

test('shipIndexFromObject: a hull nested under a ship group resolves to that ship index', () => {
  // Build a three-shaped graph: group → [shipA, shipB], each ship → hull mesh.
  const group = { children: [] };
  const shipA = { parent: group };
  const shipB = { parent: group };
  group.children.push(shipA, shipB);
  const hullA = { parent: shipA };
  const deckB = { parent: shipB };
  assert.equal(shipIndexFromObject(hullA, group), 0, 'hull under ship 0 → 0');
  assert.equal(shipIndexFromObject(deckB, group), 1, 'deck under ship 1 → 1');
});

test('shipIndexFromObject: a deeply nested mesh still walks up to its ship', () => {
  const group = { children: [] };
  const ship = { parent: group };
  group.children.push(ship);
  const mast = { parent: ship };
  const sail = { parent: mast };
  const flag = { parent: sail };
  assert.equal(shipIndexFromObject(flag, group), 0);
});

test('shipIndexFromObject: a hit outside the npc group is -1', () => {
  const group = { children: [{ parent: null }] };
  const stray = { parent: { parent: null } }; // belongs to some other subtree
  assert.equal(shipIndexFromObject(stray, group), -1);
  assert.equal(shipIndexFromObject(null, group), -1, 'null hit → -1');
  assert.equal(shipIndexFromObject({}, null), -1, 'null group → -1');
});

test('shipIndexFromObject: a cyclic graph cannot hang (guard bounds the walk)', () => {
  const group = { children: [] };
  const a = {}; const b = {};
  a.parent = b; b.parent = a; // a cycle that never reaches the group
  assert.equal(shipIndexFromObject(a, group), -1);
});

// ---- pickShipAction: which contextual verb for the pointed-at ship ----------------------------------

test('pickShipAction: at sea, an OUTLAW in range offers "target" (give battle)', () => {
  assert.equal(pickShipAction({ battleActive: false, index: 2, outlaw: true, inRange: true }), 'target');
});

test('pickShipAction: at sea, a peaceable hull in range offers "hail"', () => {
  assert.equal(pickShipAction({ battleActive: false, index: 0, outlaw: false, inRange: true }), 'hail');
});

test('pickShipAction: at sea, a ship out of range offers nothing (unreachable)', () => {
  assert.equal(pickShipAction({ battleActive: false, index: 0, outlaw: true, inRange: false }), null);
});

test('pickShipAction: in battle, the engaged foe offers "board" ONLY once she is boardable', () => {
  assert.equal(pickShipAction({ battleActive: true, foeIndex: 1, index: 1, canBoard: true }), 'board');
  assert.equal(pickShipAction({ battleActive: true, foeIndex: 1, index: 1, canBoard: false }), null,
    'a foe not yet battered has no click verb — fire with SPACE');
});

test('pickShipAction: hard battle isolation — a NON-foe is untouchable mid-fight (no stray hail)', () => {
  // Even a peaceable/outlaw hull that would be hailable at sea is null while a fight is live.
  assert.equal(pickShipAction({ battleActive: true, foeIndex: 1, index: 0, outlaw: true, inRange: true }), null);
  assert.equal(pickShipAction({ battleActive: true, foeIndex: 1, index: 2, outlaw: false, inRange: true }), null);
});

test('pickShipAction: no ship under the cursor (index < 0) is always null', () => {
  assert.equal(pickShipAction({ index: -1, outlaw: true, inRange: true }), null);
  assert.equal(pickShipAction({}), null, 'empty args → null');
});

// ---- actionLabel: the in-world prompt text ---------------------------------------------------------

test('actionLabel: each action has a non-empty prompt; unknown/null is empty', () => {
  assert.ok(actionLabel('target').length > 0);
  assert.ok(actionLabel('hail').length > 0);
  assert.ok(actionLabel('board').length > 0);
  assert.equal(actionLabel(null), '');
  assert.equal(actionLabel('nonsense'), '');
});
