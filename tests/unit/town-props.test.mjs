import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOWN_PROP_KINDS, TOWN_PROP_CULL_RADIUS,
  LANTERN_MIN, LANTERN_MAX, STALL_MIN, STALL_MAX,
  localLanterns, localStalls, townPropLayout,
  propWorldPlacement, placementsForKind, townPropPlacements, clusterVisible,
} from '../../src/systems/town-props.js';

// The three real ports (ports.js PORT_NAMES) — the layout must vary across these + be stable each.
const PORTS = ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"];

describe('loose town props — seeded placement & cull (#101 phase 3)', () => {
  it('layout covers exactly the declared kinds', () => {
    const layout = townPropLayout('Saltpurse Quay');
    assert.deepEqual(Object.keys(layout).sort(), [...TOWN_PROP_KINDS].sort());
  });

  it('is DETERMINISTIC — the same port lays out identically every call', () => {
    for (const name of PORTS) {
      assert.deepEqual(townPropLayout(name), townPropLayout(name), `${name} drifted`);
      assert.deepEqual(localLanterns(name), localLanterns(name));
      assert.deepEqual(localStalls(name), localStalls(name));
    }
  });

  it('every port earns lanterns + stalls within the declared count ranges', () => {
    for (const name of PORTS) {
      const l = localLanterns(name), s = localStalls(name);
      assert.ok(l.length >= LANTERN_MIN && l.length <= LANTERN_MAX, `${name} lanterns=${l.length}`);
      assert.ok(s.length >= STALL_MIN && s.length <= STALL_MAX, `${name} stalls=${s.length}`);
    }
  });

  it('different towns get DIFFERENT arrangements (per-town character)', () => {
    const sig = (name) => JSON.stringify(townPropLayout(name));
    const sigs = new Set(PORTS.map(sig));
    assert.equal(sigs.size, PORTS.length, 'all three ports should look distinct');
  });

  it('lanterns hug the quay edges + stride seaward on the deck top', () => {
    for (const name of PORTS) {
      for (const e of localLanterns(name)) {
        assert.equal(e.y, 3.1, 'lanterns stand on the jetty deck top');
        assert.ok(Math.abs(e.x) > 3.0 && Math.abs(e.x) < 3.6, `lantern x hugs the edge (${e.x})`);
        assert.ok(e.z > 0, `lantern is seaward on the planks (z=${e.z})`);
        assert.ok(e.z < 38, `lantern stays on the jetty (z=${e.z})`);
      }
    }
  });

  it('stalls sit on the landward plaza, clear of the framing palms', () => {
    for (const name of PORTS) {
      for (const e of localStalls(name)) {
        assert.equal(e.y, 2.0, 'stalls stand on the shore, same height as the palms');
        assert.ok(Math.abs(e.x) <= 7, `stall stays clear of the palms/warehouses (x=${e.x})`);
        assert.ok(e.z >= -1 && e.z <= 4, `stall clusters at the jetty foot (z=${e.z})`);
      }
    }
  });

  it('propWorldPlacement folds the entry spin into the jetty bearing', () => {
    const port = { name: 'x', x: 10, z: 20, angle: 0.5 };
    const p = propWorldPlacement({ x: 1, y: 3.1, z: 2, rot: 0.3 }, port);
    assert.ok(Math.abs(p.rotY - 0.8) < 1e-9, `rotY=${p.rotY}`);
    assert.equal(p.y, 3.1);
  });

  it('at angle 0 world placement is local + translate (seaward stays seaward)', () => {
    const port = { name: 'Saltpurse Quay', x: 100, z: 200, angle: 0 };
    const p = propWorldPlacement({ x: 3, y: 3.1, z: 9, rot: 0 }, port);
    assert.ok(Math.abs(p.x - 103) < 1e-9, `x=${p.x}`);
    assert.ok(Math.abs(p.z - 209) < 1e-9, `z=${p.z}`);
  });

  it('placementsForKind returns one world placement per local entry', () => {
    const port = { name: 'Barnacle Bottom', x: 0, z: 0, angle: 0 };
    const lanterns = placementsForKind(port, 'lantern');
    const stalls = placementsForKind(port, 'stall');
    assert.equal(lanterns.length, localLanterns('Barnacle Bottom').length);
    assert.equal(stalls.length, localStalls('Barnacle Bottom').length);
  });

  it('townPropPlacements exposes every kind', () => {
    const port = { name: "Gullet's Rest", x: 5, z: -5, angle: 1.2 };
    const all = townPropPlacements(port);
    assert.deepEqual(Object.keys(all).sort(), [...TOWN_PROP_KINDS].sort());
    assert.ok(all.lantern.length > 0 && all.stall.length > 0);
  });

  it('cull: a cluster draws inside the radius and is hidden (0 cost) beyond it', () => {
    const port = { x: 0, z: 0 };
    assert.equal(clusterVisible([0, 0, 0], port, TOWN_PROP_CULL_RADIUS), true);
    assert.equal(clusterVisible([0, 0, TOWN_PROP_CULL_RADIUS - 1], port, TOWN_PROP_CULL_RADIUS), true);
    assert.equal(clusterVisible([0, 0, TOWN_PROP_CULL_RADIUS + 1], port, TOWN_PROP_CULL_RADIUS), false);
  });

  it('junk / empty port name never throws (fail-open dressing)', () => {
    assert.doesNotThrow(() => townPropLayout(undefined));
    assert.doesNotThrow(() => townPropLayout(''));
    assert.doesNotThrow(() => placementsForKind({ name: null, x: 0, z: 0, angle: 0 }, 'lantern'));
  });
});
