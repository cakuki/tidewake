import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serialize, deserialize, SAVE_VERSION } from '../../src/save.js';

// A representative "live" state shape, mirroring main.js's `state` but with the
// THREE.Vector3 reduced to its array form (the renderer-free contract).
function sampleState() {
  return {
    heading: 1.2345,
    speed: 22.5,
    throttle: 0.7,
    pos: [120.5, 0, -340.25],
  };
}

test('serialize → deserialize round-trips a good state', () => {
  const s = sampleState();
  const restored = deserialize(serialize(s));
  assert.equal(restored.heading, s.heading);
  assert.equal(restored.speed, s.speed);
  assert.equal(restored.throttle, s.throttle);
  assert.deepEqual(restored.pos, s.pos);
});

test('serialize stamps the current save version', () => {
  const obj = JSON.parse(serialize(sampleState()));
  assert.equal(obj.v, SAVE_VERSION);
});

test('serialize accepts a THREE.Vector3-like pos with a toArray()', () => {
  const s = {
    heading: 0.5, speed: 10, throttle: 0.3,
    pos: { toArray: () => [1, 2, 3] },
  };
  const restored = deserialize(serialize(s));
  assert.deepEqual(restored.pos, [1, 2, 3]);
});

test('deserialize rejects null / empty / non-string', () => {
  assert.equal(deserialize(null), null);
  assert.equal(deserialize(undefined), null);
  assert.equal(deserialize(''), null);
  assert.equal(deserialize(42), null);
});

test('deserialize rejects malformed JSON', () => {
  assert.equal(deserialize('{not json'), null);
  assert.equal(deserialize('}{'), null);
});

test('deserialize rejects an old / missing version', () => {
  const good = JSON.parse(serialize(sampleState()));
  const old = { ...good, v: SAVE_VERSION - 1 };
  assert.equal(deserialize(JSON.stringify(old)), null);
  const noV = { ...good };
  delete noV.v;
  assert.equal(deserialize(JSON.stringify(noV)), null);
});

test('deserialize rejects partial / missing fields', () => {
  const good = JSON.parse(serialize(sampleState()));
  for (const k of ['heading', 'speed', 'throttle', 'pos']) {
    const partial = { ...good };
    delete partial[k];
    assert.equal(deserialize(JSON.stringify(partial)), null, `missing ${k} should reject`);
  }
});

test('deserialize rejects non-finite / NaN numbers', () => {
  const good = JSON.parse(serialize(sampleState()));
  assert.equal(deserialize(JSON.stringify({ ...good, heading: 'x' })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, speed: null })), null);
  // JSON can't carry NaN/Infinity literally, but a coerced bad value should fail
  assert.equal(deserialize(JSON.stringify({ ...good, throttle: 'NaN' })), null);
});

test('deserialize rejects a malformed pos (wrong length / non-numbers)', () => {
  const good = JSON.parse(serialize(sampleState()));
  assert.equal(deserialize(JSON.stringify({ ...good, pos: [1, 2] })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, pos: 'here' })), null);
  assert.equal(deserialize(JSON.stringify({ ...good, pos: [1, 'b', 3] })), null);
});

test('deserialize clamps throttle to [0,1] and speed to >= 0', () => {
  const good = JSON.parse(serialize(sampleState()));
  const hi = deserialize(JSON.stringify({ ...good, throttle: 9, speed: -5 }));
  assert.equal(hi.throttle, 1);
  assert.equal(hi.speed, 0);
  const lo = deserialize(JSON.stringify({ ...good, throttle: -3 }));
  assert.equal(lo.throttle, 0);
});

test('deserialize rejects absurd / non-finite positions defensively', () => {
  const good = JSON.parse(serialize(sampleState()));
  // a position far beyond any sane world bound is treated as corrupt
  assert.equal(deserialize(JSON.stringify({ ...good, pos: [1e30, 0, 0] })), null);
});
