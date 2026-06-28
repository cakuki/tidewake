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
import {
  makeObjective, resolvesAt, payoffFor, RUMOUR_REWARD_COINS,
  makeContestedObjective, tickContest, contestRemaining, isClaimed,
} from '../../src/objectives.js';
import { recordEvent, composeBallad } from '../../src/voyage-log.js';
import { snapshotAshore, composeAshoreDigest } from '../../src/systems/ashore-digest.js';
import { createLandfall } from '../../src/systems/landfall.js';

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

// ---- DETERMINISM-PARITY (#131, DL #5) ------------------------------------------------------------
// The gap this closes: the LIVE game loop integrates the reactive-loop's time-driven systems with a
// SINGLE variable `dt = Math.min(clock.getDelta(), 0.05)` per rAF frame (main.js loop() ~L1186),
// while the headless `tw.step()` AND every golden replay above drive them in FIXED 1/60 sub-steps
// (main.js step() ~L1500). Two integrators — so the replay only ever proved the path players never
// run, and a frame-rate-dependent regression in a loop system could sail clean through the gate.
//
// This pins the two paths together. The reactive-loop spine has two PURE dt-integrated systems that
// the live loop ticks on `f.dt` (src/systems/registry.js): the #133 contested-rumour soft clock
// (tickContest) and the #102 landfall gesture (landfall.step). We drive ONE seeded run through BOTH
// integration paths — a faithful mirror of the live variable-dt feeder and the headless fixed-dt
// feeder — and assert the sampled state converges within tolerance. A system whose integration is
// frame-rate-DEPENDENT (a non-linear dt term, or a per-CALL effect that scales with sub-step count)
// makes the two paths diverge and trips these assertions: the variable-vs-fixed-dt divergence class
// is now caught structurally, not by luck. (This is also the parity contract #36's fixed-timestep
// must preserve when it lands.)

// Faithful mirror of the LIVE loop's dt feed (main.js loop ~L1186): ONE update per rAF frame, each
// frame's real duration clamped to the 0.05 spiral-of-death cap. `tick(acc, dt)` advances the system.
function driveVariable(tick, frameTimes) {
  let acc;
  for (const ft of frameTimes) acc = tick(acc, Math.min(ft, 0.05));
  return acc;
}
// Faithful mirror of the HEADLESS replay/`tw.step()` feed (main.js step ~L1500-1503): slice a total
// sim-duration into fixed 1/60 sub-steps. Same total sim-time as the variable run it's compared to.
function driveFixed(tick, seconds) {
  const fixed = 1 / 60;
  let accSec = seconds, acc;
  while (accSec > 0) { const dt = Math.min(fixed, accSec); acc = tick(acc, dt); accSec -= dt; }
  return acc;
}
// A deterministic "juddery" variable-frame sequence (a laggy device: steady 60fps, the odd 30fps
// hitch, an occasional frame that pegs the 0.05 cap) — none over the cap, so no sim-time is lost and
// the only thing under test is variable-vs-fixed dt SLICING. Summed → the equal sim-time fed to fixed.
const JUDDER = [0.016, 0.017, 0.033, 0.05, 0.012, 0.05, 0.021, 0.008, 0.05, 0.033, 0.016, 0.044];
const JUDDER_TOTAL = JUDDER.reduce((s, d) => s + Math.min(d, 0.05), 0); // ≈0.34s of sim-time

test('determinism-parity — the contested soft clock reaches the same race state under live variable-dt and replay fixed-dt', () => {
  // A seeded contested chase (#133): a fixed 5s budget so JUDDER_TOTAL (~0.34s) leaves the rival
  // well short of claiming — we're asserting the clock ADVANCES identically, not its end-state alone.
  const seed = () => makeContestedObjective(
    { kind: 'port', name: 'Barnacle Bottom', x: 300, z: -120 },
    { rival: 'The Gull', budget: 5, fromX: 0, fromZ: 0 },
  );
  const tick = (obj, dt) => tickContest(obj ?? seed(), dt);

  const live = driveVariable(tick, JUDDER);
  const replay = driveFixed(tick, JUDDER_TOTAL);

  // Same sim-time in → same elapsed out (within FP tolerance from the two summation orders), and the
  // same race verdict. A frame-rate-dependent clock would make these drift apart.
  assert.ok(Math.abs(live.contest.elapsed - replay.contest.elapsed) < 1e-9,
    `soft-clock elapsed must match across integrators: live=${live.contest.elapsed} replay=${replay.contest.elapsed}`);
  assert.ok(Math.abs(contestRemaining(live) - contestRemaining(replay)) < 1e-9, 'remaining grace must match');
  assert.equal(isClaimed(live), isClaimed(replay), 'the claimed verdict must not depend on frame rate');
  assert.equal(isClaimed(live), false, 'short run: the rival has not claimed it yet');

  // And drive PAST the budget the same two ways — both must agree the rival claimed it.
  const overTotal = 6.0;
  const overFrames = Array(Math.ceil(overTotal / 0.05)).fill(0.05); // capped frames, summing to 6s
  const liveOver = driveVariable(tick, overFrames);
  const replayOver = driveFixed(tick, overTotal);
  assert.equal(isClaimed(liveOver), true, 'live: the clock runs out → rival claims');
  assert.equal(isClaimed(replayOver), isClaimed(liveOver), 'fixed-dt agrees the rival claimed');
});

test('determinism-parity — the landfall gesture eases to the same blend under live variable-dt and replay fixed-dt', () => {
  // The #102 make-port gesture is the other pure dt-integrated reactive-loop system (landfall.step on
  // f.dt). Mid-gesture (JUDDER_TOTAL ~0.34s into the 0.9s landing) the eased blend must be identical
  // whichever way the same sim-time was sliced — else the camera/grade would depend on frame rate.
  const tick = (lf, dt) => { (lf = lf ?? createLandfall()).land(); lf.step(dt); return lf; };
  const live = driveVariable(tick, JUDDER);
  const replay = driveFixed(tick, JUDDER_TOTAL);
  assert.ok(Math.abs(live.blend - replay.blend) < 1e-9,
    `landfall blend must match across integrators: live=${live.blend} replay=${replay.blend}`);
  assert.equal(live.phase, replay.phase, 'the gesture phase must not depend on frame rate');
  assert.ok(live.blend > 0 && live.blend < 1, 'mid-gesture: eased but not yet fully ashore');

  // Drive past the full landing duration both ways — both must land ASHORE at blend 1.
  const tickPlain = (lf, dt) => { lf.step(dt); return lf; };
  const a = createLandfall(); a.land();
  const b = createLandfall(); b.land();
  const liveDone = driveVariable((lf, dt) => tickPlain(lf ?? a, dt), Array(40).fill(0.05)); // 2s > 0.9s
  const replayDone = driveFixed((lf, dt) => tickPlain(lf ?? b, dt), 2.0);
  assert.equal(liveDone.phase, 'ashore');
  assert.equal(replayDone.phase, liveDone.phase, 'fixed-dt also reaches ashore');
  assert.equal(liveDone.blend, 1);
  assert.equal(replayDone.blend, 1);
});
