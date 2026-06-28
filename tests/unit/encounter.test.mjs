// Unit: the at-sea encounter PURE logic (#125 — emergent rescue-vs-plunder). No browser —
// the seeded spawn cadence, the founderer placement, and the choice→reward/pole resolution
// are plain deterministic functions, so the whole moral beat is verifiable without a DOM
// (the #53 self-tested-component standard). The thin controller (createEncounter) and the
// scene/HUD wiring live in src/systems/encounter.js + main.js; only pure pieces are tested here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rollNextSpawn, dueToSpawn, placeFounderer, resolveEncounter, pickFromPool,
  pickFoundererName, createEncounter,
  SPAWN_MIN_DISTANCE, SPAWN_JITTER, SPAWN_RANGE, CHOICE_RANGE, DESPAWN_RANGE,
  RESCUE_STANDING, PLUNDER_INFAMY, PLUNDER_COINS,
} from '../../src/systems/encounter.js';

// A tiny deterministic RNG stub: replays a fixed sequence (then loops) so a test pins exact rolls.
function seq(values) { let i = 0; return () => values[(i++) % values.length]; }

// ---- spawn cadence (seeded + deterministic) -------------------------------------------

test('rollNextSpawn returns a distance in [MIN, MIN+JITTER), driven only by the rng', () => {
  assert.equal(rollNextSpawn(() => 0), SPAWN_MIN_DISTANCE);
  assert.equal(rollNextSpawn(() => 0.999999), SPAWN_MIN_DISTANCE + SPAWN_JITTER - 1);
  const mid = rollNextSpawn(() => 0.5);
  assert.ok(mid >= SPAWN_MIN_DISTANCE && mid < SPAWN_MIN_DISTANCE + SPAWN_JITTER);
});

test('dueToSpawn fires only once the sailed distance reaches the threshold', () => {
  assert.equal(dueToSpawn(100, 200), false);
  assert.equal(dueToSpawn(200, 200), true);
  assert.equal(dueToSpawn(250, 200), true);
});

// ---- founderer placement (ahead of the bow, within view) ------------------------------

test('placeFounderer drops the wreck ahead of the ship at ~SPAWN_RANGE', () => {
  const at = placeFounderer([0, 0], 0, () => 0.5); // heading 0 = +Z, no bearing offset at rng 0.5
  // rng 0.5 → zero bearing offset → dead ahead on +Z.
  assert.ok(Math.abs(at.x) < 1e-6);
  assert.ok(Math.abs(at.z - SPAWN_RANGE) < 1e-6);
  const d = Math.hypot(at.x, at.z);
  assert.ok(Math.abs(d - SPAWN_RANGE) < 1e-6);
});

test('placeFounderer spawns within the choice range so the wreck reads immediately', () => {
  for (let r = 0; r <= 1; r += 0.1) {
    const at = placeFounderer([10, -20], 1.2, () => r);
    const d = Math.hypot(at.x - 10, at.z + 20);
    assert.ok(Math.abs(d - SPAWN_RANGE) < 1e-6);
    assert.ok(SPAWN_RANGE <= CHOICE_RANGE, 'a fresh founderer must sit inside the choice range');
  }
});

// ---- choice → reward + reputation pole -------------------------------------------------

test('resolveEncounter(rescue) pays the GOVERNOR pole (Standing), no infamy/coin', () => {
  const r = resolveEncounter('rescue');
  assert.equal(r.choice, 'rescue');
  assert.equal(r.pole, 'governor');
  assert.equal(r.standing, RESCUE_STANDING);
  assert.equal(r.infamy, 0);
  assert.equal(r.coins, 0);
});

test('resolveEncounter(plunder) pays the PIRATE pole (Infamy) + coin, no standing', () => {
  const r = resolveEncounter('plunder');
  assert.equal(r.choice, 'plunder');
  assert.equal(r.pole, 'pirate');
  assert.equal(r.infamy, PLUNDER_INFAMY);
  assert.equal(r.coins, PLUNDER_COINS);
  assert.equal(r.standing, 0);
});

test('resolveEncounter rejects an unknown choice', () => {
  assert.equal(resolveEncounter('dither'), null);
  assert.equal(resolveEncounter(), null);
});

test('the two poles are genuinely opposite — rescue lifts Standing, plunder lifts Infamy', () => {
  assert.ok(resolveEncounter('rescue').standing > 0);
  assert.ok(resolveEncounter('plunder').infamy > 0);
  assert.equal(resolveEncounter('rescue').infamy, 0);
  assert.equal(resolveEncounter('plunder').standing, 0);
});

// ---- name + line pickers (deterministic) ----------------------------------------------

test('pickFromPool is deterministic and always in-bounds', () => {
  const pool = ['a', 'b', 'c'];
  assert.equal(pickFromPool(pool, () => 0), 'a');
  assert.equal(pickFromPool(pool, () => 0.999999), 'c');
  assert.equal(pickFromPool([], () => 0.5), '');
});

test('pickFoundererName returns a non-empty characterful name', () => {
  const n = pickFoundererName(() => 0.5);
  assert.equal(typeof n, 'string');
  assert.ok(n.length > 0);
});

// ---- the controller: seeded lifecycle, headless-safe ----------------------------------

test('createEncounter spawns deterministically once enough sea is sailed', () => {
  let pos = [0, 0];
  const enc = createEncounter({ getShipPos: () => pos, getShipHeading: () => 0, rng: seq([0]) });
  // rng 0 → nextAt === SPAWN_MIN_DISTANCE; nothing yet.
  assert.equal(enc.state.active, false);
  enc.update(1, {});                 // first frame: just latches lastPos, no distance yet
  assert.equal(enc.state.active, false);
  pos = [0, SPAWN_MIN_DISTANCE - 1]; // not quite enough
  enc.update(1, {});
  assert.equal(enc.state.active, false);
  pos = [0, SPAWN_MIN_DISTANCE + 5]; // crossed the threshold → a founderer appears
  enc.update(1, {});
  assert.equal(enc.state.active, true);
  assert.ok(enc.state.ship && Number.isFinite(enc.state.ship.x));
});

test('canSpawn:false suppresses a spawn (paused helm / in town)', () => {
  let pos = [0, 0];
  const enc = createEncounter({ getShipPos: () => pos, getShipHeading: () => 0, rng: seq([0]) });
  enc.update(1, { canSpawn: false });
  pos = [0, SPAWN_MIN_DISTANCE + 50];
  enc.update(1, { canSpawn: false });
  assert.equal(enc.state.active, false); // never spawns while suppressed
});

test('forceSpawn raises a founderer immediately (the QA spawn hook)', () => {
  const enc = createEncounter({ getShipPos: () => [100, 100], getShipHeading: () => 0, rng: seq([0.5]) });
  assert.equal(enc.forceSpawn(), true);
  assert.equal(enc.state.active, true);
  assert.equal(enc.forceSpawn(), false); // already an encounter up → no double-spawn
});

test('choose(rescue) resolves to the governor pole and fires onResolve once', () => {
  let resolved = null;
  const enc = createEncounter({
    getShipPos: () => [0, 0], getShipHeading: () => 0, rng: seq([0.5]),
    onResolve: (r) => { resolved = r; },
  });
  enc.forceSpawn();
  const name = enc.state.name;
  const r = enc.choose('rescue');
  assert.equal(r.pole, 'governor');
  assert.equal(r.standing, RESCUE_STANDING);
  assert.equal(enc.state.active, false);          // despawns cleanly on choice
  assert.equal(resolved.name, name);              // onResolve carries the ship's name
  assert.equal(enc.choose('plunder'), null);      // no second choice once resolved
});

test('choose(plunder) resolves to the pirate pole + coin', () => {
  const enc = createEncounter({ getShipPos: () => [0, 0], getShipHeading: () => 0, rng: seq([0.5]) });
  enc.forceSpawn();
  const r = enc.choose('plunder');
  assert.equal(r.pole, 'pirate');
  assert.equal(r.infamy, PLUNDER_INFAMY);
  assert.equal(r.coins, PLUNDER_COINS);
  assert.equal(enc.state.active, false);
});

test('a founderer despawns (a missed chance) once you sail well clear of it', () => {
  let pos = [0, 0];
  let missed = false;
  const enc = createEncounter({
    getShipPos: () => pos, getShipHeading: () => 0, rng: seq([0.5]),
    onDespawn: () => { missed = true; },
  });
  enc.forceSpawn();
  assert.equal(enc.state.active, true);
  pos = [0, DESPAWN_RANGE + SPAWN_RANGE + 50]; // sail far past the wreck
  enc.update(1, {});
  assert.equal(enc.state.active, false);
  assert.ok(missed);
});

test('inRange reflects whether the player is close enough to choose', () => {
  let pos = [0, 0];
  const enc = createEncounter({ getShipPos: () => pos, getShipHeading: () => 0, rng: seq([0.5]) });
  enc.forceSpawn(); // dropped at SPAWN_RANGE dead ahead (+Z), within CHOICE_RANGE
  assert.equal(enc.inRange(), true);
  pos = [0, -(CHOICE_RANGE + SPAWN_RANGE + 10)]; // back well away
  assert.equal(enc.inRange(), false);
});

test('reset re-seeds the cadence and clears any live encounter (a fresh voyage)', () => {
  let pos = [0, 0];
  const enc = createEncounter({ getShipPos: () => pos, getShipHeading: () => 0, rng: seq([0.5]) });
  enc.forceSpawn();
  enc.reset();
  assert.equal(enc.state.active, false);
  assert.equal(enc.state.sailed, 0);
  assert.equal(enc.snapshot().active, false);
});

test('snapshot is a plain JSON-safe object for the QA hook', () => {
  const enc = createEncounter({ getShipPos: () => [0, 0], getShipHeading: () => 0, rng: seq([0.5]) });
  enc.forceSpawn();
  const snap = enc.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
  assert.equal(snap.active, true);
  assert.equal(typeof snap.name, 'string');
});
