// Unit: the pure key→code helper that lets touch buttons synthesise the exact
// KeyboardEvents the keyboard handlers already recognise (#17). DOM wiring itself
// is covered by the playtest; here we just pin the mapping.
import test from 'node:test';
import assert from 'node:assert/strict';
import { codeForKey } from '../../src/input.js';

test('codeForKey maps letters to KeyX', () => {
  assert.equal(codeForKey('f'), 'KeyF');
  assert.equal(codeForKey('m'), 'KeyM');
  assert.equal(codeForKey('W'), 'KeyW');
});

test('codeForKey maps digits to DigitN (so hud.js trade keys fire)', () => {
  assert.equal(codeForKey('1'), 'Digit1');
  assert.equal(codeForKey('5'), 'Digit5');
});

test('codeForKey leaves unknown keys untouched', () => {
  assert.equal(codeForKey('Enter'), 'Enter');
  assert.equal(codeForKey('-'), '-');
});
