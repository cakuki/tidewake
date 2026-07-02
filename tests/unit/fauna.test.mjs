// Unit: the living-sea-fauna PURE flock math (#97; #53 self-tested standard). No three.js,
// no DOM — fauna-math.js maps a gull index to deterministic flight params, wheels each bird
// around the flock centre, fakes a wing-beat, picks a roost (ship at sea / shore near land),
// eases the centre smoothly, and decides when the whole flock is culled. We assert: params
// are deterministic + varied, a gull wheels on its circle facing its travel, the wing-beat
// stays bounded, the roost flips to the coast inside range, easing converges, and the cull
// fires only beyond the radius.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GULL_COUNT, FLOCK_HEIGHT, ROOST_RANGE, CULL_RADIUS, FLAP_DEPTH, WHEEL_MIN_R,
  COAST_VISIBLE_RANGE,
  gullParams, gullPosition, flapScale, roostTarget, easeTowards, shouldCull, coastPresence,
  DOLPHIN_COUNT, BREACH_HEIGHT, BREACH_FORWARD, BREACH_SPAN, POD_AHEAD, POD_BEAM,
  POD_SPAWN_MIN, POD_SPAWN_MAX, POD_SPACING,
  nextPodDelay, dolphinParams, breachArc, dolphinPosition, podSpawnOrigin,
} from '../../src/fauna-math.js';
import { COAST_AUDIO_RANGE, coastProximity } from '../../src/audio.js';

test('gullParams: deterministic, and a loose (varied) flock', () => {
  const a = gullParams(2);
  const b = gullParams(2);
  assert.deepEqual(a, b, 'same index → identical params (deterministic)');

  const radii = new Set();
  const phases = new Set();
  for (let i = 0; i < GULL_COUNT; i++) {
    const p = gullParams(i);
    assert.ok(p.radius >= WHEEL_MIN_R, 'radius respects the minimum wheel');
    assert.ok(p.angSpeed > 0, 'all birds wheel the same way (positive)');
    radii.add(p.radius);
    phases.add(p.phase.toFixed(4));
  }
  assert.ok(radii.size > 1, 'birds spread across several wheel radii');
  assert.ok(phases.size === GULL_COUNT, 'every bird gets a distinct phase (no clumping)');
});

test('gullPosition: rides its wheel at the flock height, facing its flight direction', () => {
  const p = gullParams(0);
  const center = { x: 100, y: FLOCK_HEIGHT, z: -50 };
  const a = gullPosition(p, center, 0);
  const b = gullPosition(p, center, 1);

  // Stays on its wheel: horizontal distance from centre ≈ radius at all times.
  const r0 = Math.hypot(a.x - center.x, a.z - center.z);
  const r1 = Math.hypot(b.x - center.x, b.z - center.z);
  assert.ok(Math.abs(r0 - p.radius) < 1e-9, 'sits on the wheel radius');
  assert.ok(Math.abs(r1 - p.radius) < 1e-9, 'still on the wheel a second later');

  // Altitude hugs the flock height (± the per-bird stagger + a gentle bob).
  assert.ok(Math.abs(a.y - (center.y + p.height)) <= p.bobAmp + 1e-9, 'altitude near flock height');

  // It actually moved (it's wheeling, not parked).
  assert.ok(Math.hypot(b.x - a.x, b.z - a.z) > 0.01, 'the bird wheels over time');

  // Faces along its velocity: stepping a tiny dt forward should advance roughly toward yaw.
  const eps = gullPosition(p, center, 0.001);
  const vx = eps.x - a.x, vz = eps.z - a.z;
  const moveYaw = Math.atan2(vx, vz);
  const dyaw = Math.atan2(Math.sin(moveYaw - a.yaw), Math.cos(moveYaw - a.yaw));
  assert.ok(Math.abs(dyaw) < 0.05, 'yaw points along the direction of travel');
});

test('flapScale: a bounded wing-beat that actually beats', () => {
  const p = gullParams(1);
  let lo = Infinity, hi = -Infinity;
  for (let t = 0; t < 2; t += 0.02) {
    const s = flapScale(p, t);
    assert.ok(s >= 1 - FLAP_DEPTH - 1e-9 && s <= 1 + 1e-9, 'flap stays within [1-depth, 1]');
    lo = Math.min(lo, s); hi = Math.max(hi, s);
  }
  assert.ok(hi - lo > FLAP_DEPTH * 0.5, 'the wings genuinely beat over time');
});

test('roostTarget: ship at sea, the shore when an island is near', () => {
  const ship = { x: 0, z: 0 };

  // No island → wheel over the ship.
  const sea = roostTarget(ship, null);
  assert.equal(sea.nearLand, false);
  assert.deepEqual([sea.x, sea.z], [0, 0]);

  // Island within range → drift to hang over the coast.
  const near = roostTarget(ship, { x: ROOST_RANGE - 50, z: 0 });
  assert.equal(near.nearLand, true);
  assert.equal(near.x, ROOST_RANGE - 50);

  // Island out of range → stay with the ship.
  const far = roostTarget(ship, { x: ROOST_RANGE + 200, z: 0 });
  assert.equal(far.nearLand, false);
  assert.deepEqual([far.x, far.z], [0, 0]);
});

test('easeTowards: converges to the target, frame-rate independent, no overshoot', () => {
  let v = 0;
  for (let i = 0; i < 600; i++) v = easeTowards(v, 100, 1 / 60); // ~10s at the gentle drift rate
  assert.ok(Math.abs(v - 100) < 0.5, 'eases home to the target');
  assert.ok(v <= 100 + 1e-9, 'never overshoots');
  assert.equal(easeTowards(5, 100, 0), 5, 'dt=0 is a no-op');

  // Monotonic approach (each step gets closer, never past).
  let prev = 0, cur = 0;
  for (let i = 0; i < 50; i++) { prev = cur; cur = easeTowards(cur, 10, 1 / 30); assert.ok(cur >= prev && cur <= 10 + 1e-9); }
});

test('shouldCull: hidden only beyond the cull radius', () => {
  const focus = { x: 0, z: 0 };
  assert.equal(shouldCull({ x: 0, z: 0 }, focus), false, 'right on top → visible');
  assert.equal(shouldCull({ x: CULL_RADIUS - 1, z: 0 }, focus), false, 'just inside → visible');
  assert.equal(shouldCull({ x: CULL_RADIUS + 1, z: 0 }, focus), true, 'just outside → culled');
});

test('coastPresence: full at the coast, none at open sea (the #68 pairing — SEE what you HEAR)', () => {
  // Right on the shore → the flock is fully present (opacity 1); the fun beat: gulls over the port.
  assert.equal(coastPresence(0), 1, 'on the coast → full presence');
  // At / beyond the range → 0 (empty sky, culled to 0 draws out at open sea).
  assert.equal(coastPresence(COAST_VISIBLE_RANGE), 0, 'at the range edge → gone');
  assert.equal(coastPresence(COAST_VISIBLE_RANGE + 5000), 0, 'far out at sea → gone (clamped, never negative)');
  assert.equal(coastPresence(Infinity), 0, 'no land anywhere → empty sky');
  assert.equal(coastPresence(-50), 1, 'inside the shoreline → clamped to full, never > 1');

  // Monotonic: the nearer the coast, the more present the flock (fades in, never pops).
  let prev = -1;
  for (let d = COAST_VISIBLE_RANGE; d >= 0; d -= 20) {
    const p = coastPresence(d);
    assert.ok(p >= prev, 'presence rises monotonically as the coast nears');
    assert.ok(p >= 0 && p <= 1, 'presence stays in [0,1]');
    prev = p;
  }

  // The visual presence is driven off the SAME coastDist + range as the #68 coastal CRIES, so the
  // birds you SEE and the cries you HEAR come alive over exactly the same coast (sight == sound).
  assert.equal(COAST_VISIBLE_RANGE, COAST_AUDIO_RANGE, 'flock range == audio range (one coast for eye + ear)');
  for (const d of [0, 120, 260, 400, COAST_VISIBLE_RANGE - 1]) {
    assert.ok(Math.abs(coastPresence(d) - coastProximity(d)) < 1e-9, `presence tracks the cry gain curve at ${d}`);
  }
  // Visible exactly where the cries are audible: present inside the range, gone at/after it.
  assert.ok(coastPresence(COAST_VISIBLE_RANGE - 1) > 0, 'just inside range → drawn (and audible)');
  assert.equal(coastPresence(COAST_VISIBLE_RANGE), 0, 'at range → silent AND unseen together');
});

// ── Dolphins (#110, phase 2) ─────────────────────────────────────────────────

test('nextPodDelay: maps 0..1 into [min,max] and clamps out-of-range', () => {
  assert.equal(nextPodDelay(0), POD_SPAWN_MIN, '0 → shortest gap');
  assert.equal(nextPodDelay(1), POD_SPAWN_MAX, '1 → longest gap');
  assert.equal(nextPodDelay(0.5), (POD_SPAWN_MIN + POD_SPAWN_MAX) / 2, 'mid → midpoint');
  assert.equal(nextPodDelay(-3), POD_SPAWN_MIN, 'clamps below 0');
  assert.equal(nextPodDelay(9), POD_SPAWN_MAX, 'clamps above 1');
  // Irregular: a metronome would never feel alive, so the gap genuinely spans a range.
  assert.ok(POD_SPAWN_MAX > POD_SPAWN_MIN, 'the gap is a real range, not a constant');
});

test('dolphinParams: deterministic, a spread pod with a staggered cascade', () => {
  assert.deepEqual(dolphinParams(2), dolphinParams(2), 'same index → identical (deterministic)');

  const lanes = new Set();
  const delays = [];
  for (let i = 0; i < DOLPHIN_COUNT; i++) {
    const p = dolphinParams(i);
    lanes.add(p.lateral);
    delays.push(p.delay);
    assert.ok(p.delay >= 0 && p.delay <= 1 - BREACH_SPAN + 1e-9, 'delay leaves room for the full leap');
  }
  assert.equal(lanes.size, DOLPHIN_COUNT, 'every dolphin gets its own lateral lane (no overlap)');
  // The pod is spread across at least one full spacing (a pod, not a single file).
  assert.ok(Math.max(...[...lanes]) - Math.min(...[...lanes]) >= POD_SPACING, 'pod spans real width');
  // Cascade: later dolphins start their leap later (monotonic non-decreasing delays).
  for (let i = 1; i < delays.length; i++) assert.ok(delays[i] >= delays[i - 1], 'leaps cascade');
  assert.equal(delays[0], 0, 'the lead dolphin breaches first');
});

test('breachArc: a bounded leap — surfaces, peaks mid, dives, pitching out then in', () => {
  assert.equal(breachArc(0).rise, 0, 'starts at the waterline');
  assert.ok(Math.abs(breachArc(1).rise) < 1e-9, 'back under at the end');
  assert.ok(Math.abs(breachArc(0.5).rise - BREACH_HEIGHT) < 1e-9, 'peaks at the apex');

  for (let u = 0; u <= 1.0001; u += 0.02) {
    const r = breachArc(u).rise;
    assert.ok(r >= -1e-9 && r <= BREACH_HEIGHT + 1e-9, 'rise stays within [0, height]');
  }
  assert.ok(breachArc(0.15).pitch > 0, 'nose pitches UP on the way out');
  assert.ok(breachArc(0.85).pitch < 0, 'nose pitches DOWN on the dive');
  assert.ok(Math.abs(breachArc(0.5).pitch) < 1e-9, 'level at the apex');
  // Clamps: progress outside [0,1] never throws or escapes the band.
  assert.equal(breachArc(-1).rise, 0);
  assert.ok(Math.abs(breachArc(2).rise) < 1e-9);
});

test('dolphinPosition: rides the heading lane, surfaces mid-leap, faces forward', () => {
  const origin = { x: 100, y: 0, z: -40 };
  const heading = 0; // +Z forward
  const p = dolphinParams(0); // lead dolphin, delay 0

  // At its apex the lead dolphin is above water on the heading axis.
  const apex = dolphinPosition(p, origin, heading, 0.35); // u≈0.5 for delay 0, span 0.7
  assert.ok(apex.surfaced, 'the dolphin is above water mid-leap');
  assert.ok(apex.y > origin.y, 'it has risen off the waterline');
  assert.equal(apex.yaw, heading, 'it faces along the pod heading');

  // Before its window opens it sits at the waterline (rise 0).
  const under = dolphinPosition(dolphinParams(DOLPHIN_COUNT - 1), origin, heading, 0);
  assert.ok(!under.surfaced, 'a delayed dolphin is still under at progress 0');
  assert.ok(Math.abs(under.y - origin.y) < 1e-9, 'sits exactly at the waterline');

  // Heading rotates the lane: with heading=PI/2, forward is +X. The lead dolphin (no lateral
  // for the mid index, but index 0 has a lane) advances mostly along +X as progress climbs.
  const a = dolphinPosition(p, origin, Math.PI / 2, 0.05);
  const b = dolphinPosition(p, origin, Math.PI / 2, 0.55);
  assert.ok(b.x - a.x > 1, 'swims forward along the (rotated) heading');
});

test('podSpawnOrigin: surfaces ahead of the bow and off the chosen beam', () => {
  const ship = { x: 0, z: 0 };
  // Heading 0 (+Z): ahead is +Z, starboard (+1) is +X.
  const star = podSpawnOrigin(ship, 0, 1, 0);
  assert.ok(Math.abs(star.z - POD_AHEAD) < 1e-9, 'POD_AHEAD ahead of the bow');
  assert.ok(Math.abs(star.x - POD_BEAM) < 1e-9, 'POD_BEAM off to starboard');
  const port = podSpawnOrigin(ship, 0, -1, 0);
  assert.ok(port.x < 0, 'the other side surfaces to port');
  assert.equal(star.y, 0, 'sits at the given sea level');
  // The pod surfaces well off the hull — never inside the ship.
  assert.ok(Math.hypot(star.x, star.z) > 30, 'never breaches on top of the player');
});
