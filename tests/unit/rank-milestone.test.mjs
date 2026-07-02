import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOP_RANK, RANKUP_FLOURISHES, rankUpCopy, detectRankUp, createRankMilestones,
} from '../../src/systems/rank-milestone.js';
import { RANKS, LADDERS, titleFor } from '../../src/renown.js';

// A renown split that lands squarely on a given rung with a chosen dominant pole. Puts the whole
// total on one pole so the rung is exactly rankForRenown(at) and the pole is unambiguous.
function atRung(index, pole) {
  const at = RANKS[index].at + 1; // just past the threshold, unambiguously on this rung
  return pole === 'governor' ? { infamy: 0, standing: at } : { infamy: at, standing: 0 };
}

// ---- rankUpCopy: pole-appropriate title-card copy (dread vs respect) ----------

test('rankUpCopy: the pirate road names you as FEARED, by title', () => {
  const c = rankUpCopy('Corsair', 'pirate', () => 0);
  assert.match(c.headline, /feared/i, 'the pirate pole reads as dread');
  assert.match(c.headline, /Corsair/, 'the card names the new title');
  assert.ok(typeof c.icon === 'string' && c.icon.length > 0);
  assert.ok(typeof c.flourish === 'string' && c.flourish.length > 0);
});

test('rankUpCopy: the governor road is proclaimed with RESPECT, by title', () => {
  const c = rankUpCopy('Magistrate', 'governor', () => 0);
  assert.match(c.headline, /council|names you|respect/i, 'the governor pole reads as respect');
  assert.match(c.headline, /Magistrate/, 'the card names the new title');
  // fear and respect must not read the same
  assert.notEqual(c.headline, rankUpCopy('Magistrate', 'pirate', () => 0).headline);
});

test('rankUpCopy: a neutral captain gets a plain climb, by title', () => {
  const c = rankUpCopy('Free Captain', 'neutral', () => 0);
  assert.match(c.headline, /Free Captain/);
  assert.doesNotMatch(c.headline, /feared/i);
});

test('rankUpCopy: the indefinite article agrees with the title', () => {
  assert.match(rankUpCopy('Reaver', 'pirate', () => 0).headline, /\ba Reaver\b/);
  assert.match(rankUpCopy('Admiral', 'neutral', () => 0).headline, /\ban Admiral\b/);
});

test('rankUpCopy: flourish selection is deterministic under an injected RNG', () => {
  for (const pole of ['pirate', 'governor', 'neutral']) {
    const pool = RANKUP_FLOURISHES[pole];
    pool.forEach((line, i) => {
      const c = rankUpCopy('Bosun', pole, () => i / pool.length);
      assert.equal(c.flourish, line, `${pole} flourish ${i} should be picked`);
    });
  }
});

test('RANKUP_FLOURISHES: a distinct, non-empty pool per pole', () => {
  for (const pole of ['pirate', 'governor', 'neutral']) {
    assert.ok(Array.isArray(RANKUP_FLOURISHES[pole]) && RANKUP_FLOURISHES[pole].length > 0);
    RANKUP_FLOURISHES[pole].forEach((l) => assert.ok(typeof l === 'string' && l.length > 0));
  }
});

// ---- detectRankUp: the pure forward-crossing detector ------------------------

test('detectRankUp: a forward crossing fires with the correct rung + pole title', () => {
  const { infamy, standing } = atRung(5, 'pirate'); // Corsair rung, infamy-led
  const m = detectRankUp(4, infamy, standing);
  assert.ok(m, 'crossing 4 → 5 should fire');
  assert.equal(m.index, 5);
  assert.equal(m.pole, 'pirate');
  assert.equal(m.title, LADDERS.pirate[5]); // Corsair
  assert.match(m.headline, /feared/i);
});

test('detectRankUp: a governor-led crossing wears a civic title', () => {
  const { infamy, standing } = atRung(6, 'governor'); // Magistrate rung, standing-led
  const m = detectRankUp(5, infamy, standing);
  assert.ok(m);
  assert.equal(m.pole, 'governor');
  assert.equal(m.title, LADDERS.governor[6]); // Magistrate
});

test('detectRankUp: NO crossing (already at or below the highest seen) is silent', () => {
  const { infamy, standing } = atRung(5, 'pirate');
  assert.equal(detectRankUp(5, infamy, standing), null, 'same rung never re-fires');
  assert.equal(detectRankUp(6, infamy, standing), null, 'a lower rung than seen never fires');
});

test('detectRankUp: the base rung (Bilge-rat, index 0) is never a rank-UP', () => {
  assert.equal(detectRankUp(-1, 0, 0), null, 'starting as a bilge-rat is not a climb');
  assert.equal(detectRankUp(0, 0, 0), null);
});

test('detectRankUp: jumping several rungs at once fires ONCE, for the final rung', () => {
  const { infamy, standing } = atRung(6, 'pirate');
  const m = detectRankUp(1, infamy, standing);
  assert.ok(m);
  assert.equal(m.index, 6, 'a multi-rung leap reports the final rung, not each in between');
});

test('detectRankUp: junk inputs never throw and fire nothing spurious', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'x']) {
    assert.equal(detectRankUp(bad, bad, bad), null);
  }
});

test('detectRankUp: the reported rung matches renown.js titleFor', () => {
  const { infamy, standing } = atRung(3, 'pirate');
  const m = detectRankUp(0, infamy, standing);
  assert.equal(m.index, titleFor(infamy, standing).index);
  assert.equal(m.title, titleFor(infamy, standing).title);
});

test('TOP_RANK is the top rung index of the ladder', () => {
  assert.equal(TOP_RANK, RANKS.length - 1);
});

// ---- createRankMilestones: the stateful "highest rung seen" guard ------------

test('createRankMilestones: seeds the baseline from current rep so a HIGH-rank load never re-announces', () => {
  const { infamy, standing } = atRung(6, 'pirate'); // loaded in at a high rank
  const g = createRankMilestones(infamy, standing);
  assert.equal(g.highest, 6);
  assert.equal(g.check(infamy, standing), null, 'the very rep it loaded at must not fire');
});

test('createRankMilestones: a forward crossing fires exactly once and records the new summit', () => {
  const g = createRankMilestones(0, 0); // fresh bilge-rat
  assert.equal(g.highest, 0);
  const c5 = atRung(5, 'pirate');
  const m = g.check(c5.infamy, c5.standing);
  assert.ok(m && m.index === 5, 'the climb fires');
  assert.equal(g.highest, 5, 'the summit is recorded');
  // a second identical check does NOT re-fire
  assert.equal(g.check(c5.infamy, c5.standing), null);
});

test('createRankMilestones: a non-crossing rep change within the same rung stays silent', () => {
  const g = createRankMilestones(0, 0);
  const c5 = atRung(5, 'pirate');
  g.check(c5.infamy, c5.standing); // climb to 5
  // more infamy, still rung 5 → no card
  assert.equal(g.check(c5.infamy + 50, c5.standing), null);
});

test('createRankMilestones: dropping a rung (a defeat) then re-climbing does NOT re-announce', () => {
  const g = createRankMilestones(0, 0);
  const c5 = atRung(5, 'pirate');
  assert.ok(g.check(c5.infamy, c5.standing), 'first climb to 5 fires');
  const c4 = atRung(4, 'pirate');
  assert.equal(g.check(c4.infamy, c4.standing), null, 'a defeat drop to rung 4 is silent');
  assert.equal(g.check(c5.infamy, c5.standing), null, 're-climbing to a rung already seen does NOT re-fire');
  // but a genuinely NEW summit still fires
  const c6 = atRung(6, 'pirate');
  assert.ok(g.check(c6.infamy, c6.standing), 'a new highest rung still fires');
});

test('createRankMilestones: successive forward crossings each fire once', () => {
  const g = createRankMilestones(0, 0);
  const seen = [];
  for (let i = 1; i < RANKS.length; i++) {
    const { infamy, standing } = atRung(i, 'pirate');
    const m = g.check(infamy, standing);
    if (m) seen.push(m.index);
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 6, 7], 'every rung above the base announces exactly once, in order');
});
