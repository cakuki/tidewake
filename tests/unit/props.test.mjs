import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PORT_DRESSING, PROP_TYPES, TARGET_HEIGHT, PROP_CULL_RADIUS,
  scaleForHeight, localToWorld, propWorldPlacement, placementsForType, clusterVisible,
} from '../../src/systems/props.js';

describe('props placement & cull math (#101)', () => {
  it('dressing covers exactly the declared prop types', () => {
    const used = new Set(PORT_DRESSING.map((d) => d.type));
    assert.deepEqual([...used].sort(), [...PROP_TYPES].sort());
    for (const t of PROP_TYPES) assert.ok(t in TARGET_HEIGHT, `missing target height for ${t}`);
  });

  it('scaleForHeight maps native height onto the target', () => {
    assert.equal(scaleForHeight(4, 16), 4);
    assert.equal(scaleForHeight(1.23, 2.46), 2);
    assert.equal(scaleForHeight(0, 16), 1);   // degenerate guard
    assert.equal(scaleForHeight(-1, 16), 1);
  });

  it('localToWorld is identity (plus translate) at angle 0', () => {
    const w = localToWorld(3, 5, 0, 100, 200);
    assert.ok(Math.abs(w.x - 103) < 1e-9);
    assert.ok(Math.abs(w.z - 205) < 1e-9);
  });

  it('localToWorld rotates by the jetty bearing (three.js Y convention)', () => {
    // angle = +PI/2: x' = lz, z' = -lx
    const w = localToWorld(1, 0, Math.PI / 2, 0, 0);
    assert.ok(Math.abs(w.x - 0) < 1e-9, `x=${w.x}`);
    assert.ok(Math.abs(w.z + 1) < 1e-9, `z=${w.z}`);
    const w2 = localToWorld(0, 1, Math.PI / 2, 0, 0);
    assert.ok(Math.abs(w2.x - 1) < 1e-9, `x=${w2.x}`);
    assert.ok(Math.abs(w2.z - 0) < 1e-9, `z=${w2.z}`);
  });

  it('seaward dressing lands seaward of the port at angle 0', () => {
    // angle 0 → local +z (seaward) maps to world +z; a deck barrel (z>0) sits seaward.
    const port = { x: 0, z: 0, angle: 0 };
    const barrel = propWorldPlacement({ type: 'barrel', x: 0, y: 3.1, z: 9, rot: 0 }, port);
    assert.ok(barrel.z > 0, `barrel should be seaward, z=${barrel.z}`);
    assert.equal(barrel.y, 3.1);
    // a palm (z<0) sits landward
    const palm = propWorldPlacement({ type: 'palm', x: 0, y: 2, z: -4, rot: 0 }, port);
    assert.ok(palm.z < 0, `palm should be landward, z=${palm.z}`);
  });

  it('propWorldPlacement folds the entry spin into the jetty bearing', () => {
    const port = { x: 10, z: 20, angle: 0.5 };
    const p = propWorldPlacement({ type: 'crate', x: 1, y: 3.1, z: 2, rot: 0.3 }, port);
    assert.ok(Math.abs(p.rotY - 0.8) < 1e-9, `rotY=${p.rotY}`);
  });

  it('placementsForType returns one world placement per matching entry', () => {
    const port = { x: 0, z: 0, angle: 0 };
    const barrels = placementsForType(port, 'barrel');
    const crates = placementsForType(port, 'crate');
    const palms = placementsForType(port, 'palm');
    assert.equal(barrels.length, 3);
    assert.equal(crates.length, 2);
    assert.equal(palms.length, 2);
    assert.ok(barrels.every((b) => b.type === 'barrel'));
  });

  it('clusterVisible draws inside the radius and culls beyond it', () => {
    const port = { x: 0, z: 0 };
    assert.equal(clusterVisible([0, 0, 0], port), true);
    assert.equal(clusterVisible([0, 0, PROP_CULL_RADIUS - 1], port), true);
    assert.equal(clusterVisible([0, 0, PROP_CULL_RADIUS + 1], port), false);
    // accepts {x,z} too
    assert.equal(clusterVisible({ x: PROP_CULL_RADIUS + 50, z: 0 }, port), false);
  });
});
