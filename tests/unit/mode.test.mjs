import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createModeManager, isMode, MODES,
  SAILING, TOWN, BATTLE,
} from '../../src/mode.js';

describe('mode — the world-state machine (#95)', () => {
  it('exposes the three modes', () => {
    assert.deepEqual(MODES, [SAILING, TOWN, BATTLE]);
    assert.equal(SAILING, 'sailing');
    assert.equal(TOWN, 'town');
    assert.equal(BATTLE, 'battle');
  });

  it('isMode only accepts known modes', () => {
    assert.equal(isMode(SAILING), true);
    assert.equal(isMode(BATTLE), true);
    assert.equal(isMode('sea-shanty'), false);
    assert.equal(isMode(undefined), false);
  });

  it('boots in SAILING by default — the world is under way', () => {
    const m = createModeManager();
    assert.equal(m.current, SAILING);
    assert.equal(m.is(SAILING), true);
    assert.equal(m.playerPaused, false);
  });

  it('honours an explicit initial mode and rejects an unknown one', () => {
    assert.equal(createModeManager({ initial: TOWN }).current, TOWN);
    assert.throws(() => createModeManager({ initial: 'nope' }), /unknown mode/);
  });

  it('enter() transitions and pauses the player in TOWN / BATTLE', () => {
    const m = createModeManager();
    assert.equal(m.enter(BATTLE), true);
    assert.equal(m.current, BATTLE);
    assert.equal(m.is(BATTLE), true);
    assert.equal(m.playerPaused, true); // sailing pauses; the world keeps living
    assert.equal(m.enter(TOWN), true);
    assert.equal(m.current, TOWN);
    assert.equal(m.playerPaused, true);
  });

  it('entering the current mode is a no-op (returns false, no churn)', () => {
    const m = createModeManager({ initial: BATTLE });
    assert.equal(m.enter(BATTLE), false);
    assert.equal(m.current, BATTLE);
  });

  it('enter() guards against unknown modes', () => {
    const m = createModeManager();
    assert.throws(() => m.enter('kraken'), /unknown mode/);
    assert.equal(m.current, SAILING); // untouched after a rejected transition
  });

  it('leave() always returns to SAILING — the helm is the player\'s again', () => {
    const m = createModeManager({ initial: BATTLE });
    assert.equal(m.leave(), true);
    assert.equal(m.current, SAILING);
    assert.equal(m.playerPaused, false);
    assert.equal(m.leave(), false); // already sailing → no-op
  });

  it('fires onChange(to, from) only on a real transition', () => {
    const seen = [];
    const m = createModeManager({ onChange: (to, from) => seen.push([from, to]) });
    m.enter(BATTLE);   // sailing -> battle
    m.enter(BATTLE);   // no-op, no event
    m.leave();         // battle -> sailing
    assert.deepEqual(seen, [[SAILING, BATTLE], [BATTLE, SAILING]]);
  });
});
