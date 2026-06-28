// Golden REACTIVE-LOOP replay fixture (#123, DL #4 hardening — the pre-battle hardening trio with
// #120/#122). #107 golden-traced the MODE seam; this pins the OTHER core loop — the town→rumour→
// sail→reward spine — as a deterministic, committed replay so it cannot silently drift as #112's
// payoff and richer rewards land. Builds on the #107 mode-trace pattern: a PURE reproduction of
// main.js's reactive-loop wiring (no THREE, no DOM, no wall-clock), driven by a seeded intent-log,
// asserting the EXACT event sequence PLUS sampled state (coins, reputation, objective resolved,
// the Ballad verse, the ashore digests). Every future regression in that spine ships as a small
// edit to the golden sequence here.
//
// The wiring under test (mirrors src/main.js):
//   • onArrive(port): resolvesAt(objective,port) → coins += payoffFor(); logDeed(rumour); objective=null
//     (the #112 arrival payoff); then shouldEnterTown → enter TOWN, capturing ashoreSnapshot.   (~L1033, L320)
//   • the tavern "listen for word" verb composes rumours from live state; a 2-listen pairs a
//     reputation line with a chase-able trade target (composeRumours).                            (~L694)
//   • chaseObjective(target): makeObjective(target) → state.objective (the pin you steer toward).  (~L705)
//   • leaveHarbour(): composeAshoreDigest(landfallSnapshot, now) → the "While you were ashore…"
//     recap, THEN cast off.                                                                        (~L732)
//   • the chased-rumour payoff sings a `rumour` verse into the Ballad (#78).                        (~L1038)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeRumours } from '../../src/rumours.js';
import { makeObjective, resolvesAt, payoffFor, RUMOUR_REWARD_COINS } from '../../src/objectives.js';
import { recordEvent, composeBallad } from '../../src/voyage-log.js';
import { snapshotAshore, composeAshoreDigest } from '../../src/systems/ashore-digest.js';

// A faithful PURE replica of main.js's reactive-loop wiring around a tiny shared `state`. Returns
// the live state, an `events` log of every step, and the intent drivers. Each driver mirrors the
// named main.js function so a regression there surfaces as a golden-sequence diff here.
function makeVoyage(seed = {}) {
  const events = [];
  const state = {
    coins: seed.coins ?? 100,
    infamy: seed.infamy ?? 0,
    standing: seed.standing ?? 0,
    cargo: {},
    objective: null,
    voyageLog: [],
    docked: null,
  };
  let ashoreSnapshot = null; // captured the instant town takes the screen (main.js: onChange→TOWN)

  // The live world the tavern reads — port + who you've become + the deeds on your log.
  function world() {
    return { port: state.docked, infamy: state.infamy, standing: state.standing, deeds: state.voyageLog };
  }

  // onArrive (main.js ~L1033 + L320): pay off a chased rumour, sing it into the Ballad, clear the
  // pin, then make landfall into TOWN — capturing the landfall snapshot the digest will read.
  function arrive(port) {
    events.push(['arrive', port]);
    if (resolvesAt(state.objective, port)) {
      const { coins } = payoffFor(state.objective);
      state.coins += coins;
      state.voyageLog = recordEvent(state.voyageLog, { type: 'rumour', name: port, coins });
      state.objective = null; // the chase is done — clear the pin (resolvesAt now blocks a double-pay)
      events.push(['reward', coins]);
    }
    state.docked = port;
    ashoreSnapshot = snapshotAshore(state); // town takes the screen
    events.push(['make-port', port]);
    return state;
  }

  // The tavern verb (main.js ~L694): listen for word. Pure compose from live state.
  function listen(opts = {}) {
    const r = composeRumours(world(), opts);
    events.push(['listen', state.docked, r.length]);
    return r;
  }

  // chaseObjective (main.js ~L705): take a typed target up as a tracked sea-objective.
  function chase(target) {
    const obj = makeObjective(target);
    if (obj) { state.objective = obj; events.push(['chase', obj.target.name]); }
    return obj;
  }

  // leaveHarbour (main.js ~L732): compose the "While you were ashore…" digest from the landfall→now
  // deltas BEFORE casting off, then set sail.
  function setSail() {
    const port = state.docked;
    const digest = composeAshoreDigest(ashoreSnapshot, snapshotAshore(state), { port });
    ashoreSnapshot = null;
    state.docked = null;
    events.push(['set-sail', port]);
    return digest;
  }

  return { state, events, arrive, listen, chase, setSail, ballad: () => composeBallad(state.voyageLog) };
}

// The committed golden replay: ONE captain, the whole rumour→reward spine end-to-end. Seeded
// (fresh, unknown captain, 100 coins at Saltpurse Quay), so the same world yields the same word,
// the same heading, the same payoff, the same verse — every time.
test('golden replay — listen→chase→sail→arrive→reward→ashore-digest pins the whole spine', () => {
  const v = makeVoyage({ coins: 100, infamy: 0, standing: 0 });

  // 1) Make port A. A fresh visit: nothing to pay off, town takes the screen (snapshot captured).
  v.arrive('Saltpurse Quay');
  assert.equal(v.state.coins, 100);
  assert.equal(v.state.objective, null);

  // 2) Listen for word. A 2-rumour listen pairs "who you are" (a reputation line, no target) with
  //    "where to sail" (a chase-able trade tip) — the golden pairing the composer promises.
  const heard = v.listen({ count: 2, nonce: 0 });
  assert.equal(heard.length, 2);
  assert.equal(heard[0].target, null, 'first word is reputation flavour — nothing to chase');
  assert.deepEqual(heard[1].target, { kind: 'port', name: 'Barnacle Bottom' }, 'second word names a real heading');

  // 3) Accept the tip — chase it. The chart now carries a pin to a real port, with a modest payoff.
  const obj = v.chase(heard[1].target);
  assert.ok(obj && obj.status === 'active');
  assert.equal(obj.target.name, 'Barnacle Bottom');
  assert.equal(obj.payoff.coins, RUMOUR_REWARD_COINS);

  // 4) Set sail from A. The "While you were ashore…" digest reads back the heading you took up
  //    (objective null at landfall → set at cast-off): the living-world promise made legible.
  const digestA = v.setSail();
  assert.deepEqual(digestA.lines, ['You cast off with word to chase — a heading set for Barnacle Bottom.']);

  // 5) Sail to the target and arrive. The tip pays off: a deterministic 60-coin bounty, the chase
  //    clears, and the deed is sung into the Ballad. (steps emit arrive → reward → make-port.)
  v.arrive('Barnacle Bottom');
  assert.equal(v.state.coins, 160, '100 seed + 60 rumour bounty');
  assert.equal(v.state.objective, null, 'the pin clears the instant it pays off');

  // Reputation is UNTOUCHED by a pure rumour chase — it pays coin, not renown (an explicit guard:
  // the tip rewards the detour without becoming a legend printer).
  assert.equal(v.state.infamy, 0);
  assert.equal(v.state.standing, 0);

  // The Ballad now carries the rumour verse, naming the port reached and the coin it earned.
  const ballad = v.ballad();
  assert.equal(
    ballad.lines[1],
    'You chased a tavern whisper clean to Barnacle Bottom, and for once the rumour ran true — 60 coins the richer for trusting a hunched regular with a thirst.',
  );

  // 6) Set sail from the target. A quiet call (the dealings already banked before the snapshot):
  //    the digest still speaks the living-world line — one ambient verse, never silence.
  const digestB = v.setSail();
  assert.equal(digestB.lines.length, 1);
  assert.match(digestB.lines[0], /Barnacle Bottom/);

  // THE GOLDEN SEQUENCE — the exact spine, in order, with no churn.
  assert.deepEqual(v.events, [
    ['arrive', 'Saltpurse Quay'],
    ['make-port', 'Saltpurse Quay'],
    ['listen', 'Saltpurse Quay', 2],
    ['chase', 'Barnacle Bottom'],
    ['set-sail', 'Saltpurse Quay'],
    ['arrive', 'Barnacle Bottom'],
    ['reward', 60],
    ['make-port', 'Barnacle Bottom'],
    ['set-sail', 'Barnacle Bottom'],
  ]);
});

test('golden replay — the spine is fully deterministic: same seed → identical run', () => {
  function run() {
    const v = makeVoyage({ coins: 100, infamy: 0, standing: 0 });
    v.arrive('Saltpurse Quay');
    const heard = v.listen({ count: 2, nonce: 0 });
    v.chase(heard[1].target);
    v.setSail();
    v.arrive('Barnacle Bottom');
    v.setSail();
    return { events: v.events, coins: v.state.coins, ballad: v.ballad().text };
  }
  const a = run();
  const b = run();
  assert.deepEqual(a.events, b.events);
  assert.equal(a.coins, b.coins);
  assert.equal(a.ballad, b.ballad, 'same world → same ballad text (drives panel AND share)');
});

test('golden replay — a resolved chase never double-pays on a second arrival (regression guard)', () => {
  const v = makeVoyage({ coins: 100 });
  v.arrive('Saltpurse Quay');
  const heard = v.listen({ count: 2, nonce: 0 });
  v.chase(heard[1].target);
  v.setSail();
  v.arrive('Barnacle Bottom');      // pays off → 160
  assert.equal(v.state.coins, 160);
  v.setSail();
  v.arrive('Barnacle Bottom');      // back again, no live pin → resolvesAt(null) is false, no pay
  assert.equal(v.state.coins, 160, 'the cleared pin cannot re-pay');
  // Exactly one reward event + one rumour verse in the whole voyage.
  assert.equal(v.events.filter((e) => e[0] === 'reward').length, 1);
  assert.equal(v.state.voyageLog.filter((e) => e.type === 'rumour').length, 1);
});
