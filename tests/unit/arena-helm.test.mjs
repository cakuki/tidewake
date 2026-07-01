import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  arenaHelm, wrapAngle, ARENA_HOLD_RANGE, ARENA_RANGE_BAND, ARENA_FLEE_MORALE,
} from '../../src/npc-ai.js';

// The dedicated arena-foe helm (#135, Option-4 final slice). PURE: relative position + her nerve →
// a stance, a desired heading and a throttle. No rng, no state — every case is deterministic.

// Shortest angular gap between two headings.
const gap = (a, b) => Math.abs(wrapAngle(a - b));

test('flee: a nerve-broken foe runs directly away from the player', () => {
  // Player off to the foe's +x; broken morale must send her heading the opposite way.
  const h = arenaHelm({ foeX: 0, foeZ: 0, foeHeading: 0, playerX: 200, playerZ: 0, moraleFrac: 0.1 });
  assert.equal(h.state, 'flee');
  assert.equal(h.throttle, 1, 'she claps on all sail to run');
  const away = Math.atan2(-200, 0); // heading from player→foe direction (away from player)
  assert.ok(gap(h.desiredHeading, away) < 1e-9, 'she steers straight away from the player');
});

test('flee threshold sits BELOW the strike-colours line (0.25) so surrender fires first', () => {
  assert.ok(ARENA_FLEE_MORALE < 0.25, 'a foe you are beating strikes her colours before she would flee');
  // Right at the strike line she is NOT yet fleeing.
  const h = arenaHelm({ foeX: 0, foeZ: 0, playerX: 0, playerZ: ARENA_HOLD_RANGE, moraleFrac: 0.25 });
  assert.notEqual(h.state, 'flee');
});

test('close: a distant foe bears straight down on the player', () => {
  const far = ARENA_HOLD_RANGE + ARENA_RANGE_BAND + 200;
  const h = arenaHelm({ foeX: 0, foeZ: 0, playerX: 0, playerZ: far, moraleFrac: 1 });
  assert.equal(h.state, 'close');
  assert.equal(h.throttle, 1);
  const toPlayer = Math.atan2(0, far); // straight at the player (+z)
  assert.ok(gap(h.desiredHeading, toPlayer) < 1e-9, 'she heads straight for the player to shorten range');
});

test('open: a fouling-close foe falls off to re-open the range', () => {
  const near = ARENA_HOLD_RANGE - ARENA_RANGE_BAND - 40;
  const h = arenaHelm({ foeX: 0, foeZ: 0, playerX: 0, playerZ: near, moraleFrac: 1 });
  assert.equal(h.state, 'open');
  assert.ok(h.throttle < 1, 'she eases off rather than ramming');
  const away = Math.atan2(0, -near);
  assert.ok(gap(h.desiredHeading, away) < 1e-9, 'she steers away to open the range');
});

test('beam: in the fighting band she seeks the player\'s beam, not his bow', () => {
  // Player at +z, heading 0 → his starboard beam points +x. Foe at the origin, in the band.
  const h = arenaHelm({ foeX: 0, foeZ: 0, playerX: 0, playerZ: ARENA_HOLD_RANGE, playerHeading: 0, moraleFrac: 1 });
  assert.equal(h.state, 'beam');
  assert.ok(h.throttle > 0 && h.throttle < 1);
  const straightAtPlayer = Math.atan2(0, ARENA_HOLD_RANGE); // === 0
  assert.ok(gap(h.desiredHeading, straightAtPlayer) > 0.3, 'she crosses to a beam station, not bow-on');
});

test('beam: she commits to whichever of the player\'s beams she already lies nearer', () => {
  // Player at origin heading 0: starboard beam = +x, port beam = −x. Put the foe well to −x (port side),
  // in the band, and she should steer toward the player's PORT beam station (−x), not the starboard one.
  const h = arenaHelm({ foeX: -ARENA_HOLD_RANGE, foeZ: 0, playerX: 0, playerZ: 0, playerHeading: 0, moraleFrac: 1 });
  assert.equal(h.state, 'beam');
  // The port station is at roughly (−holdRange, 0); from the foe just below it, the heading points +z-ish
  // toward it — the key assertion is she does NOT cross the whole arena to the +x starboard station.
  const dir = Math.sin(h.desiredHeading); // +x component of her heading
  assert.ok(dir <= 0.05, 'she does not steer across to the far (starboard) beam');
});

test('pure + deterministic: identical inputs give an identical decision', () => {
  const inp = { foeX: 12, foeZ: -34, foeHeading: 0.7, playerX: 90, playerZ: 45, playerHeading: -1.1, moraleFrac: 0.7 };
  assert.deepEqual(arenaHelm(inp), arenaHelm(inp));
});
