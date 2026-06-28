// Golden mode-trace fixture (#107, DL #3 slice 4). The mode seam (#95/#106), the landfall gesture
// (#102) and combat-driven BATTLE are wired together in main.js; that wiring is the thing that rots
// silently as the state space grows. This is a PURE reproduction of that wiring — no THREE, no DOM —
// driven by a committed intent-log, asserting the EXACT mode-event sequence plus sampled gesture
// state. Every future mode-transition bug ships as a three-line edit to an intent-log here.
//
// The wiring under test (mirrors src/main.js):
//   • onChange(to, from): to===TOWN → landfall.land();  else from===TOWN → landfall.leave().   (~L232)
//   • combat drives BATTLE: fighting ? enter(BATTLE) : (is(BATTLE) && leave()).                  (~L561)
//   • landfall.step(dt) advances the gesture each frame on the sim's dt.                          (~L564)
//   • reset(): mode.reset() + landfall.reset() — a fresh voyage starts under sail, no gesture.    (~L374)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createModeManager, SAILING, TOWN, BATTLE } from '../../src/mode.js';
import { createLandfall, PHASES } from '../../src/systems/landfall.js';

// A faithful pure replica of main.js's mode + landfall + combat wiring. Returns the live machines,
// an `events` log of every real (from→to) transition, and the per-frame `tick(intent)` driver.
function makeWorld(opts = {}) {
  const events = [];
  const landfall = createLandfall(opts.landfall);
  const mode = createModeManager({
    onChange: (to, from) => {
      events.push([from, to]);
      if (to === TOWN) landfall.land();
      else if (from === TOWN) landfall.leave();
    },
  });
  // One simulation frame: optionally request TOWN, drive combat, then advance the gesture by dt.
  function tick({ town = false, fight = false, dt = 1 / 60 } = {}) {
    if (fight) { if (!mode.is(BATTLE)) mode.enter(BATTLE); }
    else if (mode.is(BATTLE)) mode.leave();
    if (town && mode.is(SAILING)) mode.enter(TOWN);
    landfall.step(dt);
  }
  function reset() { mode.reset(); landfall.reset(); }
  return { mode, landfall, events, tick, reset };
}

test('golden trace — SAILING→TOWN→BATTLE→SAILING emits the exact event sequence', () => {
  const w = makeWorld({ landfall: { landMs: 200, leaveMs: 200 } });

  // 1) Under sail. Nothing happening — no events, helm is the player's.
  w.tick({});
  assert.equal(w.mode.current, SAILING);
  assert.equal(w.mode.playerPaused, false);
  assert.equal(w.landfall.phase, PHASES.IDLE);

  // 2) Make port. SAILING→TOWN begins the landfall gesture; the helm is now paused.
  w.tick({ town: true });
  assert.equal(w.mode.current, TOWN);
  assert.equal(w.mode.playerPaused, true);
  assert.equal(w.landfall.phase, PHASES.LANDING);
  assert.ok(w.landfall.blend > 0 && w.landfall.blend < 1, 'gesture eased, not snapped');

  // …let the gesture run fully ashore (town view may take the screen only now).
  for (let i = 0; i < 20; i++) w.tick({ town: true });
  assert.equal(w.landfall.phase, PHASES.ASHORE);
  assert.equal(w.landfall.townReady, true);
  assert.equal(w.landfall.blend, 1);

  // 3) A fight breaks out ASHORE. TOWN→BATTLE is legal (combat can erupt anywhere); because we
  // left TOWN, the town gesture reverses (from===TOWN → landfall.leave()). Helm stays paused.
  w.tick({ fight: true });
  assert.equal(w.mode.current, BATTLE);
  assert.equal(w.mode.playerPaused, true);
  assert.equal(w.landfall.phase, PHASES.LEAVING, 'the town gesture eases back out when a fight erupts ashore');

  // 4) The fight ends. BATTLE→SAILING returns the helm; the gesture finishes easing back to sea.
  for (let i = 0; i < 20; i++) w.tick({ fight: false });
  assert.equal(w.mode.current, SAILING);
  assert.equal(w.mode.playerPaused, false);
  assert.equal(w.landfall.phase, PHASES.IDLE);
  assert.equal(w.landfall.blend, 0);

  // The golden sequence: exactly three real transitions, in order, no churn from no-op frames.
  assert.deepEqual(w.events, [[SAILING, TOWN], [TOWN, BATTLE], [BATTLE, SAILING]]);
});

test('golden trace — the SAILING↔TOWN round trip eases blend 0→1→0 (no snap, port view gated)', () => {
  const w = makeWorld({ landfall: { landMs: 300, leaveMs: 300 } });
  w.tick({ town: true });
  assert.equal(w.landfall.townReady, false, 'town view stays closed mid-gesture');
  for (let i = 0; i < 30; i++) w.tick({ town: true });
  assert.equal(w.landfall.blend, 1);
  assert.equal(w.landfall.townReady, true, 'town view opens only once ashore');
  // Set sail: leaving TOWN reverses the gesture; the view closes the instant we leave.
  // (town:false while ashore is a no-op for the mode here — we leave deliberately, as the UI does.)
  w.mode.leave();
  assert.equal(w.landfall.phase, PHASES.LEAVING);
  assert.equal(w.landfall.townReady, false);
  for (let i = 0; i < 30; i++) w.tick({});
  assert.equal(w.landfall.blend, 0);
  assert.equal(w.landfall.phase, PHASES.IDLE);
  assert.deepEqual(w.events, [[SAILING, TOWN], [TOWN, SAILING]]);
});

test('golden trace — reset() returns to a clean under-sail start from any point (new voyage)', () => {
  const w = makeWorld();
  w.tick({ town: true });
  for (let i = 0; i < 5; i++) w.tick({ fight: true }); // ashore then mid-fight, gesture in flight
  w.reset();
  assert.equal(w.mode.current, SAILING);
  assert.equal(w.mode.playerPaused, false);
  assert.equal(w.landfall.phase, PHASES.IDLE);
  assert.equal(w.landfall.blend, 0);
});
