// #172 "The world fears you" — the DREAD model. Weak, outclassed ships blink at a feared/big captain;
// peers and apex foes stand. PURE logic, so the whole "does the sea part before me?" question unit-tests
// under `node --test`. Reuses the existing flee (npc.js) + strike-colours (board.offersSurrender) paths;
// this module only decides WHETHER the gap is wide enough to make a foe bolt on sight or strike early.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  notoriety, classAdvantage, dreadScore, foeFirmness, dreadPressure,
  fleesOnSight, earlyStrikeMoraleLine, strikesEarly,
  FEAR_FLOOR, FEAR_FULL, CLASS_FULL_GAP, MORALE_BREAK_FRAC,
} from '../../src/systems/dread.js';
import { offersSurrender } from '../../src/systems/board.js';

// A high-infamy captain in a frigate, and her weak prey vs a peer vs an apex.
const NOTORIOUS = 1500;                 // well past FEAR_FULL → notoriety saturates at 1
const FRIGATE = 3;                      // the biggest hull the player can currently buy (#171)
const PREY = { foeTier: 1, foeRole: 'merchant' };   // a darting merchant sloop
const PEER = { foeTier: 4, foeRole: 'warship' };    // a warship frigate — a fair fight
const APEX = { foeTier: 5, foeRole: 'warship' };    // a warship man-o'-war — the deep-sea terror (#167)

test('notoriety: junk/below-floor → 0, saturates to 1, monotonic non-decreasing', () => {
  assert.equal(notoriety(NaN), 0);
  assert.equal(notoriety(-500), 0);
  assert.equal(notoriety(FEAR_FLOOR - 1), 0);
  assert.equal(notoriety(FEAR_FLOOR), 0);
  assert.equal(notoriety(FEAR_FULL), 1);
  assert.equal(notoriety(FEAR_FULL + 9000), 1);
  const mid = notoriety((FEAR_FLOOR + FEAR_FULL) / 2);
  assert.ok(mid > 0 && mid < 1);
  let prev = -1;
  for (let i = 0; i <= 2000; i += 50) { const n = notoriety(i); assert.ok(n >= prev); prev = n; }
});

test('classAdvantage: only a BIGGER player counts; a smaller/equal player earns none; saturates', () => {
  assert.equal(classAdvantage(1, 3), 0);           // you are smaller → no size dread
  assert.equal(classAdvantage(3, 3), 0);           // equal → none
  assert.ok(classAdvantage(3, 1) > 0);             // a frigate over a sloop → advantage
  assert.equal(classAdvantage(1 + CLASS_FULL_GAP, 1), 1); // a full-gap advantage saturates
  assert.equal(classAdvantage(1 + CLASS_FULL_GAP * 3, 1), 1); // and clamps
});

test('dreadScore in [0,1]; grows with both notoriety and class advantage', () => {
  const green = dreadScore({ playerInfamy: 0, playerTier: 1, ...PREY });
  const notorious = dreadScore({ playerInfamy: NOTORIOUS, playerTier: 1, ...PREY });
  const bigAndNotorious = dreadScore({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PREY });
  assert.equal(green, 0);
  assert.ok(notorious > green);                 // reputation alone builds dread
  assert.ok(bigAndNotorious > notorious);       // + a size gap builds more
  assert.ok(bigAndNotorious <= 1 && bigAndNotorious > 0);
});

test('foeFirmness: rises with foe tier + a warship stiffener; an apex warship never breaks (>1)', () => {
  assert.ok(foeFirmness(1, 'merchant') < foeFirmness(4, 'warship'));
  assert.ok(foeFirmness(3, 'warship') > foeFirmness(3, 'merchant')); // a warship holds firmer than a trader
  assert.ok(foeFirmness(5, 'warship') > 1);     // a warship man-o'-war: dread (≤1) can never clear it
  assert.equal(foeFirmness(NaN), foeFirmness(1, 'warship')); // junk tier → gentlest, default warship
});

test('fleesOnSight: a feared frigate captain parts the weak — the FUN beat', () => {
  assert.equal(fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PREY }), true);
});

test('fleesOnSight: a PEER does NOT flinch (#172 — an even fight stands)', () => {
  assert.equal(fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PEER }), false);
});

test('fleesOnSight: the APEX man-o-war still fights (protects #167 challenge-on-demand)', () => {
  assert.equal(fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...APEX }), false);
});

test('fleesOnSight: a GREEN/unknown captain scares no one', () => {
  assert.equal(fleesOnSight({ playerInfamy: 0, playerTier: 1, ...PREY }), false);
});

test('fleesOnSight: reputation ALONE (no size gap) still bolts weak prey — notoriety has weight', () => {
  // a Terror in a starting sloop vs an equal-class merchant sloop
  assert.equal(fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: 1, ...PREY }), true);
  // …but the same Terror-in-a-sloop does not scare a warship frigate
  assert.equal(fleesOnSight({ playerInfamy: NOTORIOUS, playerTier: 1, ...PEER }), false);
});

test('fleesOnSight: a moderately-feared frigate (below the #79 colours threshold) still bolts weak prey', () => {
  // infamy 150 sits under colours.js MENACE_TIERS[1]=200, so this is DREAD, not the #79 colours-flee
  assert.equal(fleesOnSight({ playerInfamy: 150, playerTier: FRIGATE, ...PREY }), true);
  assert.equal(fleesOnSight({ playerInfamy: 150, playerTier: FRIGATE, ...APEX }), false);
});

test('earlyStrikeMoraleLine: dread pressure LIFTS the surrender line above the vanilla break', () => {
  assert.equal(earlyStrikeMoraleLine(0), MORALE_BREAK_FRAC);        // no dread → the vanilla line, unchanged
  assert.ok(earlyStrikeMoraleLine(0.7) > MORALE_BREAK_FRAC);        // dread → she yields at higher morale (sooner)
  assert.ok(earlyStrikeMoraleLine(-0.5) <= MORALE_BREAK_FRAC + 1e-9); // negative pressure never lifts it
});

test('strikesEarly: a dreaded, wounded, rattled foe strikes SOONER than vanilla', () => {
  const pressure = dreadPressure({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PREY });
  // above the vanilla 0.25 morale break AND above the vanilla 0.5 hull ceiling → vanilla would NOT strike…
  assert.ok(pressure > 0);
  assert.equal(strikesEarly({ moraleFrac: 0.4, hullFrac: 0.55, pressure }), true);
});

test('strikesEarly: a PEER never strikes early (pressure ≤ 0) — the duel is still decided by skill', () => {
  const pressure = dreadPressure({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PEER });
  assert.ok(pressure <= 0);
  assert.equal(strikesEarly({ moraleFrac: 0.1, hullFrac: 0.4, pressure }), false);
});

test('strikesEarly: fails safe on a fresh/undamaged foe and on junk input', () => {
  const pressure = dreadPressure({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PREY });
  assert.equal(strikesEarly({ moraleFrac: 1, hullFrac: 1, pressure }), false); // full nerve + full hull → stands
  assert.equal(strikesEarly({ moraleFrac: 0.1, hullFrac: 0.9, pressure }), false); // hull barely scratched → no early yield
  assert.equal(strikesEarly({}), false); // junk / no dread → never fires (falls back to vanilla strikesColours)
});

test('composes with offersSurrender: the dread early-strike feeds the EXISTING white-flag path (no new system)', () => {
  const pressure = dreadPressure({ playerInfamy: NOTORIOUS, playerTier: FRIGATE, ...PREY });
  const early = strikesEarly({ moraleFrac: 0.4, hullFrac: 0.55, pressure });
  // a dread early-strike OR the vanilla yield opens the SAME offer…
  assert.equal(offersSurrender({ yielded: early, boarded: false, quarterRefused: false }), true);
  // …refusing quarter latches (no re-offer loop) and boarding owns its own path (no double-trigger)
  assert.equal(offersSurrender({ yielded: true, boarded: false, quarterRefused: true }), false);
  assert.equal(offersSurrender({ yielded: true, boarded: true, quarterRefused: false }), false);
});
