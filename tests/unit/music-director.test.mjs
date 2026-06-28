import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  portProximity,
  resolveMix,
  PORT_CUE_RADIUS,
} from '../../src/music-director.js';
import { SAILING, TOWN, BATTLE } from '../../src/mode.js';

const DOCK = 90; // ports.js DOCK_RADIUS

test('PORT_CUE_RADIUS: the port becomes audible from further out than the dock radius', () => {
  assert.ok(PORT_CUE_RADIUS > DOCK, 'you hear the port before you can dock');
});

test('portProximity: 0 at/beyond the cue radius, 1 at/within the dock radius', () => {
  assert.equal(portProximity(Infinity, DOCK), 0, 'at sea → no port layer');
  assert.equal(portProximity(PORT_CUE_RADIUS, DOCK), 0, 'just at the cue edge → 0');
  assert.equal(portProximity(PORT_CUE_RADIUS + 50, DOCK), 0, 'beyond the cue edge → 0');
  assert.equal(portProximity(DOCK, DOCK), 1, 'at the dock radius → full');
  assert.equal(portProximity(0, DOCK), 1, 'on the dock → full');
});

test('portProximity: rises monotonically as you close in, always in [0,1]', () => {
  let prev = -1;
  for (let d = PORT_CUE_RADIUS + 20; d >= 0; d -= 10) {
    const p = portProximity(d, DOCK);
    assert.ok(p >= 0 && p <= 1, `out of range at ${d}: ${p}`);
    assert.ok(p >= prev, `not monotonic closing in at ${d}`);
    prev = p;
  }
});

test('portProximity: NaN / non-finite distance is safe (→0, never NaN)', () => {
  assert.equal(portProximity(NaN, DOCK), 0);
  assert.equal(portProximity(undefined, DOCK), 0);
});

test('resolveMix: default/empty context → open-sea bed only', () => {
  const m = resolveMix();
  assert.equal(m.sea, 1);
  assert.equal(m.port, 0);
});

test('resolveMix: SAILING far out → full sea, no port', () => {
  const m = resolveMix({ mode: SAILING, portDistance: Infinity, dockRadius: DOCK });
  assert.equal(m.sea, 1);
  assert.equal(m.port, 0);
});

test('resolveMix: SAILING at the dock radius → port up, sea ducked under it', () => {
  const m = resolveMix({ mode: SAILING, portDistance: DOCK, dockRadius: DOCK });
  assert.equal(m.port, 1, 'port layer full on close approach');
  assert.ok(m.sea > 0 && m.sea < 1, 'sea ducks but does not vanish');
});

test('resolveMix: SAILING crossfade is monotonic (closer → more port, less sea)', () => {
  const far = resolveMix({ mode: SAILING, portDistance: 200, dockRadius: DOCK });
  const mid = resolveMix({ mode: SAILING, portDistance: 140, dockRadius: DOCK });
  const near = resolveMix({ mode: SAILING, portDistance: 95, dockRadius: DOCK });
  assert.ok(far.port < mid.port && mid.port < near.port, 'port swells in');
  assert.ok(far.sea > mid.sea && mid.sea > near.sea, 'sea recedes');
});

test('resolveMix: TOWN → the port theme owns the mix, sea recedes to a hush', () => {
  const m = resolveMix({ mode: TOWN, portDistance: 0, dockRadius: DOCK });
  assert.equal(m.port, 1, 'town theme full ashore');
  assert.ok(m.sea < 0.2, 'sea is a distant hush');
});

test('resolveMix: BATTLE → the bed settles (both layers duck so combat reads)', () => {
  const sailing = resolveMix({ mode: SAILING, portDistance: Infinity, dockRadius: DOCK });
  const battle = resolveMix({ mode: BATTLE, portDistance: Infinity, dockRadius: DOCK });
  assert.equal(battle.port, 0, 'no port layer in a fight');
  assert.ok(battle.sea < sailing.sea, 'sea settles below the open-sea bed');
  assert.ok(battle.sea > 0, 'a low keel of music remains');
});

test('resolveMix: every output is a clean gain in [0,1] across modes & distances', () => {
  for (const mode of [SAILING, TOWN, BATTLE]) {
    for (const d of [0, 50, 90, 150, 260, 1000, Infinity]) {
      const m = resolveMix({ mode, portDistance: d, dockRadius: DOCK });
      for (const k of ['sea', 'port']) {
        assert.ok(Number.isFinite(m[k]), `${mode}@${d} ${k} finite`);
        assert.ok(m[k] >= 0 && m[k] <= 1, `${mode}@${d} ${k} in range: ${m[k]}`);
      }
    }
  }
});
