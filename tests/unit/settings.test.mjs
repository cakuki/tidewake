// Unit: the settings/options panel's PURE logic (#73; #53 self-tested-component standard).
// No browser — these are plain functions over a toggle REGISTRY (an array of definitions)
// and a saved blob. They hold the defaults / persistence-serialisation / get-set rules so the
// panel's behaviour is verifiable without a DOM. The factory (createSettings) wires the DOM.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveOptions, serializeOptions, parseOptions, withOption,
} from '../../src/ui/settings.js';

// A tiny registry standing in for the real one: a STORED toggle (perf, default off), a STORED
// toggle that defaults ON (weather seam would default OFF, but we cover both), and a LIVE toggle
// (sound) whose source of truth lives elsewhere (audio mute) — marked persist:false.
const DEFS = [
  { id: 'sound', default: true, persist: false }, // live: not stored here (audio.js owns it)
  { id: 'perf', default: false },                  // stored, default off — overlay hidden
  { id: 'weather', default: false },               // stored, default off — sunny stays default
];

test('resolveOptions falls back to each toggle default when nothing is saved', () => {
  const v = resolveOptions(DEFS, {});
  assert.equal(v.sound, true);
  assert.equal(v.perf, false);
  assert.equal(v.weather, false);
});

test('resolveOptions restores a saved boolean over the default', () => {
  const v = resolveOptions(DEFS, { perf: true, weather: false });
  assert.equal(v.perf, true);     // saved wins
  assert.equal(v.weather, false); // saved wins (matches default here)
  assert.equal(v.sound, true);    // not saved → default
});

test('resolveOptions ignores non-boolean / garbage saved values (uses default)', () => {
  const v = resolveOptions(DEFS, { perf: 'yes', weather: 1, sound: null });
  assert.equal(v.perf, false);
  assert.equal(v.weather, false);
  assert.equal(v.sound, true);
});

test('resolveOptions ignores unknown saved ids (forward-compatible)', () => {
  const v = resolveOptions(DEFS, { perf: true, ghostToggle: true });
  assert.equal(v.perf, true);
  assert.equal('ghostToggle' in v, false); // unknown ids never leak into state
});

test('the default for a future visual toggle (weather #58) is OFF — sunny stays default', () => {
  const v = resolveOptions(DEFS, {});
  assert.equal(v.weather, false);
});

test('serializeOptions persists only STORED toggles, never live ones', () => {
  const values = { sound: false, perf: true, weather: false };
  const json = serializeOptions(DEFS, values);
  const obj = JSON.parse(json);
  assert.equal('sound' in obj, false); // live toggle (persist:false) is NOT written here
  assert.equal(obj.perf, true);
  assert.equal(obj.weather, false);
});

test('serializeOptions coerces values to booleans', () => {
  const obj = JSON.parse(serializeOptions(DEFS, { perf: 1, weather: 0 }));
  assert.strictEqual(obj.perf, true);
  assert.strictEqual(obj.weather, false);
});

test('serialize → parse → resolve round-trips the stored toggles', () => {
  const before = { sound: false, perf: true, weather: true };
  const after = resolveOptions(DEFS, parseOptions(serializeOptions(DEFS, before)));
  assert.equal(after.perf, true);
  assert.equal(after.weather, true);
  assert.equal(after.sound, true); // live toggle wasn't stored → back to its default
});

test('parseOptions is crash-proof on junk / null / empty', () => {
  assert.deepEqual(parseOptions(null), {});
  assert.deepEqual(parseOptions(''), {});
  assert.deepEqual(parseOptions('not json'), {});
  assert.deepEqual(parseOptions('[1,2,3]'), {}); // arrays aren't an options map
  assert.deepEqual(parseOptions('"a string"'), {});
  assert.deepEqual(parseOptions('{"perf":true}'), { perf: true });
});

test('withOption sets a known toggle (coerced to bool) and leaves the rest', () => {
  const v0 = resolveOptions(DEFS, {});
  const v1 = withOption(DEFS, v0, 'weather', 1);
  assert.strictEqual(v1.weather, true);
  assert.equal(v1.perf, false);   // untouched
  assert.notEqual(v1, v0);        // returns a new object (no mutation)
  assert.equal(v0.weather, false); // original unchanged
});

test('withOption ignores an unknown id (no new key, no throw)', () => {
  const v0 = resolveOptions(DEFS, {});
  const v1 = withOption(DEFS, v0, 'nonsense', true);
  assert.equal('nonsense' in v1, false);
});
