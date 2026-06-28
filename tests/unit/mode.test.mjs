import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createModeManager, isMode, MODES, canTransition, TRANSITIONS,
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
    m.leave();                          // BATTLE→TOWN is illegal (#106) — fall back to sail first
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

// #106 — mode-seam hardening (DL #3, theme 3). Now that #67 town + #94 sound depend on the
// keystone and battle-mode #100 is about to plug in, the seam must be a robust contract:
// a legal-transition graph, a multi-subscriber event bus, and a deterministic new-voyage reset.
//
// CREATIVE SPARK (Game Designer): SAILING is the hub — the open hand on the helm every stance
// falls back to. A fight can break out anywhere (even ashore), but you can NEVER make port
// mid-broadside: the seam itself refuses to let TOWN interrupt a BATTLE.
describe('mode — legal-transition guard (#106)', () => {
  it('pins the legal transition graph (SAILING is the hub; combat preempts; no port mid-fight)', () => {
    assert.deepEqual(TRANSITIONS[SAILING], [TOWN, BATTLE]); // rest can become either stance
    assert.deepEqual(TRANSITIONS[TOWN], [SAILING, BATTLE]); // leave harbour, or a fight breaks out
    assert.deepEqual(TRANSITIONS[BATTLE], [SAILING]);       // BATTLE only ends by returning to sail
  });

  it('canTransition resolves the full N×N matrix (incl. illegal BATTLE→TOWN)', () => {
    // Every same-mode pair is an allowed no-op.
    for (const m of MODES) assert.equal(canTransition(m, m), true, `${m}->${m}`);
    // The only illegal cross-mode move: you cannot make port mid-fight.
    assert.equal(canTransition(BATTLE, TOWN), false);
    // Everything else across the graph is legal.
    assert.equal(canTransition(SAILING, TOWN), true);
    assert.equal(canTransition(SAILING, BATTLE), true);
    assert.equal(canTransition(TOWN, SAILING), true);
    assert.equal(canTransition(TOWN, BATTLE), true);
    assert.equal(canTransition(BATTLE, SAILING), true);
  });

  it('canTransition rejects unknown modes on either side', () => {
    assert.equal(canTransition('kraken', SAILING), false);
    assert.equal(canTransition(SAILING, 'kraken'), false);
    assert.equal(canTransition(undefined, undefined), false);
  });

  it('enter() guards an illegal-but-known transition: returns false, state + subscribers untouched', () => {
    const seen = [];
    const m = createModeManager({ initial: BATTLE, onChange: (to, from) => seen.push([from, to]) });
    assert.equal(m.canEnter(TOWN), false);    // the seam advertises the refusal
    assert.equal(m.enter(TOWN), false);       // …and refuses without throwing (poll-safe)
    assert.equal(m.current, BATTLE);          // still mid-broadside
    assert.equal(m.playerPaused, true);
    assert.deepEqual(seen, []);               // an illegal move fires no event
    // The legal escape from BATTLE is always available.
    assert.equal(m.canEnter(SAILING), true);
    assert.equal(m.leave(), true);
  });

  it('a fight can break out ashore (TOWN→BATTLE legal), but not the reverse', () => {
    const m = createModeManager({ initial: TOWN });
    assert.equal(m.enter(BATTLE), true);  // combat preempts town
    assert.equal(m.current, BATTLE);
    assert.equal(m.enter(TOWN), false);   // …and town cannot reclaim a live fight
    assert.equal(m.current, BATTLE);
  });
});

describe('mode — multi-subscriber seam (#106)', () => {
  it('subscribe(fn) attaches independently; every subscriber sees each real transition', () => {
    const a = [], b = [];
    const m = createModeManager();
    m.subscribe((to, from) => a.push([from, to]));
    m.subscribe((to, from) => b.push([from, to]));
    m.enter(TOWN);
    m.leave();
    assert.deepEqual(a, [[SAILING, TOWN], [TOWN, SAILING]]);
    assert.deepEqual(b, [[SAILING, TOWN], [TOWN, SAILING]]);
  });

  it("a subscriber's exit fires exactly once on leave", () => {
    let exits = 0;
    const m = createModeManager();
    m.subscribe((to, from) => { if (from === TOWN) exits++; }); // count leaving-TOWN edges
    m.enter(TOWN);
    m.enter(TOWN); // no-op, no event
    m.leave();     // the one real exit from TOWN
    assert.equal(exits, 1);
  });

  it('unsubscribe() stops further notifications and is idempotent', () => {
    const seen = [];
    const m = createModeManager();
    const off = m.subscribe((to, from) => seen.push([from, to]));
    m.enter(TOWN);
    assert.equal(off(), true);   // removed
    assert.equal(off(), false);  // idempotent: already removed
    m.leave();                   // no longer observed
    assert.deepEqual(seen, [[SAILING, TOWN]]);
  });

  it('a throwing subscriber neither corrupts state nor blocks its peers', () => {
    const seen = [];
    const m = createModeManager();
    m.subscribe(() => { throw new Error('a banner blew up'); });
    m.subscribe((to, from) => seen.push([from, to]));
    assert.equal(m.enter(TOWN), true);     // transition still succeeds
    assert.equal(m.current, TOWN);         // state intact
    assert.deepEqual(seen, [[SAILING, TOWN]]); // the peer still ran
  });

  it('subscribe rejects a non-function', () => {
    const m = createModeManager();
    assert.throws(() => m.subscribe(42), /function/);
  });
});

describe('mode — deterministic new-voyage reset + invariants (#106)', () => {
  it('reset() deterministically returns to SAILING from any stance', () => {
    for (const initial of MODES) {
      const m = createModeManager({ initial });
      m.reset();
      assert.equal(m.current, SAILING, `reset from ${initial}`);
      assert.equal(m.playerPaused, false);
      assert.equal(m.reset(), false); // already sailing → no-op, still deterministic
    }
  });

  it('playerPaused === (current !== SAILING) holds across any legal sequence', () => {
    const m = createModeManager();
    const steps = [TOWN, BATTLE, SAILING, BATTLE, SAILING, TOWN, SAILING];
    for (const next of steps) {
      next === SAILING ? m.leave() : m.enter(next);
      assert.equal(m.playerPaused, m.current !== SAILING, `paused invariant at ${m.current}`);
    }
  });
});
