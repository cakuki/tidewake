import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestPort, isDocked, dockingUpdate } from '../../src/physics.js';

// Synthetic ports laid out on a line so distances are easy to reason about.
const PORTS = [
  { name: 'Saltpurse Quay', x: 0, z: 0 },
  { name: 'Barnacle Bottom', x: 100, z: 0 },
  { name: "Gullet's Rest", x: 0, z: 200 },
];

test('nearestPort: picks the closest port by horizontal distance', () => {
  const near = nearestPort({ x: 10, z: 0 }, PORTS);
  assert.equal(near.port.name, 'Saltpurse Quay');
  assert.ok(Math.abs(near.distance - 10) < 1e-9);

  const near2 = nearestPort({ x: 90, z: 0 }, PORTS);
  assert.equal(near2.port.name, 'Barnacle Bottom');
});

test('nearestPort: ignores y/height and returns null for empty list', () => {
  const near = nearestPort({ x: 0, z: 205 }, PORTS);
  assert.equal(near.port.name, "Gullet's Rest");
  assert.equal(nearestPort({ x: 0, z: 0 }, []), null);
});

test('isDocked: true inside the radius, false outside', () => {
  assert.equal(isDocked({ x: 0, z: 50 }, PORTS[0], 85), true);
  assert.equal(isDocked({ x: 0, z: 90 }, PORTS[0], 85), false);
  // exactly on the boundary counts as docked
  assert.equal(isDocked({ x: 85, z: 0 }, PORTS[0], 85), true);
});

test('dockingUpdate: arrival fires once on entry, then stays quiet while docked', () => {
  const R = 85;
  // approaching from the south, still outside every port
  let s = dockingUpdate(null, { x: 0, z: -120 }, PORTS, R);
  assert.equal(s.arrived, false);
  assert.equal(s.dockedName, null);

  // crosses into the radius -> arrives once
  s = dockingUpdate(s.dockedName, { x: 0, z: -60 }, PORTS, R);
  assert.equal(s.arrived, true);
  assert.equal(s.dockedName, 'Saltpurse Quay');

  // still inside -> no repeat arrival
  s = dockingUpdate(s.dockedName, { x: 0, z: 20 }, PORTS, R);
  assert.equal(s.arrived, false);
  assert.equal(s.dockedName, 'Saltpurse Quay');
});

test('dockingUpdate: leaving re-arms, returning fires again', () => {
  const R = 85;
  let s = dockingUpdate('Saltpurse Quay', { x: 0, z: 300 }, PORTS, R); // sailed away
  assert.equal(s.arrived, false);
  assert.equal(s.dockedName, null);

  s = dockingUpdate(s.dockedName, { x: 0, z: 50 }, PORTS, R); // back again
  assert.equal(s.arrived, true);
  assert.equal(s.dockedName, 'Saltpurse Quay');
});

test('dockingUpdate: sailing straight from one port into another fires for the new one', () => {
  const R = 85;
  const s = dockingUpdate('Saltpurse Quay', { x: 100, z: 0 }, PORTS, R);
  assert.equal(s.arrived, true);
  assert.equal(s.dockedName, 'Barnacle Bottom');
});
