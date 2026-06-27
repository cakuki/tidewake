import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RANKS, rankForRenown, renownForSale,
  renownTier, standingPriceModifier, greetPlayer, GREETINGS,
  dominantPole, titleFor, LADDERS,
} from '../../src/renown.js';

test('RANKS is a non-empty ladder starting at 0 with strictly ascending thresholds', () => {
  assert.ok(Array.isArray(RANKS) && RANKS.length >= 6);
  assert.equal(RANKS[0].at, 0);
  for (let i = 1; i < RANKS.length; i++) {
    assert.ok(RANKS[i].at > RANKS[i - 1].at, `threshold ${i} must exceed ${i - 1}`);
    assert.ok(typeof RANKS[i].title === 'string' && RANKS[i].title.length > 0);
  }
});

test('rankForRenown returns the exact rank at each threshold', () => {
  RANKS.forEach((rank, i) => {
    const r = rankForRenown(rank.at);
    assert.equal(r.index, i, `at ${rank.at} expected index ${i}`);
    assert.equal(r.title, rank.title);
  });
});

test('rankForRenown returns the previous rank just below a threshold', () => {
  for (let i = 1; i < RANKS.length; i++) {
    const r = rankForRenown(RANKS[i].at - 1);
    assert.equal(r.index, i - 1, `just below threshold ${i} should be rank ${i - 1}`);
  }
});

test('rankForRenown(0) is the lowest rank with valid progress', () => {
  const r = rankForRenown(0);
  assert.equal(r.index, 0);
  assert.equal(r.title, RANKS[0].title);
  assert.ok(r.progress >= 0 && r.progress <= 1);
});

test('rank index is monotonic non-decreasing as renown climbs', () => {
  let prev = -1;
  for (let renown = 0; renown <= RANKS[RANKS.length - 1].at + 5000; renown += 37) {
    const r = rankForRenown(renown);
    assert.ok(r.index >= prev, `index dropped at renown=${renown}`);
    prev = r.index;
  }
});

test('progress always sits in [0,1]', () => {
  for (let renown = 0; renown <= RANKS[RANKS.length - 1].at + 5000; renown += 17) {
    const { progress } = rankForRenown(renown);
    assert.ok(progress >= 0 && progress <= 1, `progress out of range at ${renown}: ${progress}`);
  }
});

test('the top rank has no next threshold and full progress', () => {
  const top = rankForRenown(RANKS[RANKS.length - 1].at + 99999);
  assert.equal(top.index, RANKS.length - 1);
  assert.equal(top.nextAt, null);
  assert.equal(top.nextTitle, null);
  assert.equal(top.progress, 1);
});

test('a mid-ladder rank advertises the next threshold + title', () => {
  const r = rankForRenown(RANKS[1].at);
  assert.equal(r.nextAt, RANKS[2].at);
  assert.equal(r.nextTitle, RANKS[2].title);
});

test('rankForRenown treats negative / non-finite renown as the lowest rank', () => {
  for (const bad of [-1, -9999, NaN, Infinity, -Infinity, undefined, null, 'x']) {
    const r = rankForRenown(bad);
    assert.equal(r.index, 0, `bad renown ${bad} should be rank 0`);
    assert.ok(r.progress >= 0 && r.progress <= 1);
  }
});

test('renownForSale increases with profit and is never negative', () => {
  assert.equal(renownForSale(0), 0);
  assert.ok(renownForSale(50) > renownForSale(0));
  assert.ok(renownForSale(200) > renownForSale(50));
  assert.ok(renownForSale(1000) > renownForSale(200));
});

test('renownForSale clamps junk input to 0', () => {
  for (const bad of [-1, -500, NaN, Infinity, -Infinity, undefined, null, 'lots']) {
    assert.equal(renownForSale(bad), 0, `bad earnings ${bad} should yield 0 renown`);
  }
});

// ---- Reputation tiers: the world's three reactions to your legend ------------

test('renownTier: three tiers keyed off the rank ladder, with labels', () => {
  const lowest = renownTier(0);
  assert.equal(lowest.tier, 0);
  assert.equal(lowest.key, 'unknown');
  assert.ok(typeof lowest.label === 'string' && lowest.label.length > 0);
  // Bilge-rat / Deckhand = Unknown
  assert.equal(renownTier(RANKS[1].at).tier, 0);
  // Bosun..First Mate = Known
  assert.equal(renownTier(RANKS[2].at).key, 'known');
  assert.equal(renownTier(RANKS[4].at).key, 'known');
  // Sea Captain and above = Renowned
  assert.equal(renownTier(RANKS[5].at).key, 'renowned');
  assert.equal(renownTier(RANKS[RANKS.length - 1].at).tier, 2);
});

test('renownTier: monotonic non-decreasing as renown climbs', () => {
  let prev = -1;
  for (let r = 0; r <= RANKS[RANKS.length - 1].at + 5000; r += 53) {
    const { tier } = renownTier(r);
    assert.ok(tier >= prev, `tier dropped at renown=${r}`);
    prev = tier;
  }
});

test('renownTier: junk renown is the lowest tier', () => {
  for (const bad of [-1, NaN, Infinity, undefined, null, 'x']) {
    assert.equal(renownTier(bad).tier, 0);
  }
});

test('standingPriceModifier: zero at the bottom, modest and bounded at the top', () => {
  assert.equal(standingPriceModifier(0), 0);
  for (let r = -100; r <= RANKS[RANKS.length - 1].at + 5000; r += 41) {
    const f = standingPriceModifier(r);
    assert.ok(f >= 0 && f <= 0.05, `modifier out of sane bounds at ${r}: ${f}`);
  }
});

test('standingPriceModifier: improves (rises) with renown, monotonic', () => {
  assert.ok(standingPriceModifier(RANKS[5].at) > standingPriceModifier(0));
  let prev = -1;
  for (let r = 0; r <= RANKS[RANKS.length - 1].at + 2000; r += 31) {
    const f = standingPriceModifier(r);
    assert.ok(f >= prev, `modifier dropped at ${r}`);
    prev = f;
  }
});

test('greetPlayer: returns a tier-appropriate line, substituting {port} and {title}', () => {
  const first = () => 0; // deterministic: always the first line of the pool
  const low = greetPlayer(0, 'Saltpurse Quay', first);
  assert.equal(low, GREETINGS.unknown[0].replace(/\{port\}/g, 'Saltpurse Quay').replace(/\{title\}/g, 'Bilge-rat'));
  assert.ok(!/\{port\}|\{title\}/.test(low), 'no unresolved placeholders');

  const high = greetPlayer(RANKS[5].at, 'Saltpurse Quay', first);
  const title = rankForRenown(RANKS[5].at).title; // Sea Captain
  assert.equal(high, GREETINGS.renowned[0].replace(/\{port\}/g, 'Saltpurse Quay').replace(/\{title\}/g, title));
  assert.ok(high.includes(title), 'a renowned captain is greeted by title');
});

test('greetPlayer: every greeting in every pool resolves cleanly for any tier', () => {
  for (const renown of [0, RANKS[3].at, RANKS[6].at]) {
    const { key } = renownTier(renown);
    GREETINGS[key].forEach((_, i) => {
      const line = greetPlayer(renown, 'Barnacle Bottom', () => i / GREETINGS[key].length);
      assert.ok(line.length > 0 && !/\{port\}|\{title\}/.test(line));
    });
  }
});

// ---- Two poles: Infamy (pirate) vs Standing (governor) (#45) -----------------

test('LADDERS: three pole ladders (pirate/governor/neutral), each as deep as RANKS', () => {
  for (const pole of ['pirate', 'governor', 'neutral']) {
    assert.ok(Array.isArray(LADDERS[pole]), `missing ladder for ${pole}`);
    assert.ok(LADDERS[pole].length >= RANKS.length, `${pole} ladder must cover every rung`);
    LADDERS[pole].forEach((t) => assert.ok(typeof t === 'string' && t.length > 0));
  }
  // Pirate and governor top rungs read distinctly (no accidental overlap up high).
  assert.notEqual(LADDERS.pirate.at(-1), LADDERS.governor.at(-1));
});

test('dominantPole: infamy-dominant → pirate, standing-dominant → governor', () => {
  assert.equal(dominantPole(1000, 100), 'pirate');
  assert.equal(dominantPole(100, 1000), 'governor');
});

test('dominantPole: a near-balanced ledger reads neutral', () => {
  assert.equal(dominantPole(0, 0), 'neutral');
  assert.equal(dominantPole(500, 500), 'neutral');
  assert.equal(dominantPole(520, 480), 'neutral'); // small lead stays balanced
});

test('dominantPole: junk inputs are treated as zero (neutral, no crash)', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'x']) {
    assert.equal(dominantPole(bad, bad), 'neutral');
  }
  assert.equal(dominantPole(1000, NaN), 'pirate'); // bad standing → 0
  assert.equal(dominantPole(NaN, 1000), 'governor');
});

test('titleFor: an infamy-dominant captain wears a piratical title', () => {
  const { title, pole, leaning } = titleFor(8000, 200); // Dread tier, infamy-led
  assert.equal(pole, 'pirate');
  assert.ok(LADDERS.pirate.includes(title), `"${title}" should be a pirate title`);
  assert.ok(typeof leaning === 'string' && leaning.length > 0);
});

test('titleFor: a standing-dominant captain wears a civic title', () => {
  const { title, pole } = titleFor(200, 8000); // governor-led
  assert.equal(pole, 'governor');
  assert.ok(LADDERS.governor.includes(title), `"${title}" should be a civic title`);
});

test('titleFor: a balanced captain wears a neutral title', () => {
  const { title, pole } = titleFor(4000, 4000);
  assert.equal(pole, 'neutral');
  assert.ok(LADDERS.neutral.includes(title));
});

test('titleFor: rung climbs with total renown (infamy + standing)', () => {
  const low = titleFor(50, 0).index;
  const high = titleFor(9000, 0).index;
  assert.ok(high > low, 'a bigger total reaches a higher rung');
  // total drives the rung: same total, same rung, regardless of split
  assert.equal(titleFor(1000, 1000).index, rankForRenown(2000).index);
});

test('titleFor: junk inputs default to the lowest neutral rung without crashing', () => {
  const { title, pole, index } = titleFor(NaN, undefined);
  assert.equal(index, 0);
  assert.equal(pole, 'neutral');
  assert.equal(title, LADDERS.neutral[0]);
});

test('greetPlayer: a feared (pirate) port reaction differs from a respected (governor) one at the top tier', () => {
  const hi = RANKS[6].at; // renowned tier
  const feared = greetPlayer(hi, 'Saltpurse Quay', () => 0, 'pirate');
  const respected = greetPlayer(hi, 'Saltpurse Quay', () => 0, 'governor');
  assert.notEqual(feared, respected, 'fear and respect should not greet you the same');
  assert.ok(!/\{port\}|\{title\}/.test(feared) && !/\{port\}|\{title\}/.test(respected));
  // the feared captain is greeted by a piratical title; the respected by a civic one
  assert.ok(feared.includes(titleFor(hi, 0).title));
  assert.ok(respected.includes(titleFor(0, hi).title));
});

test('greetPlayer: pole defaults to neutral and stays back-compatible', () => {
  const first = () => 0;
  const neutral = greetPlayer(RANKS[5].at, 'Saltpurse Quay', first);
  assert.equal(neutral, GREETINGS.renowned[0]
    .replace(/\{port\}/g, 'Saltpurse Quay')
    .replace(/\{title\}/g, titleFor(RANKS[5].at / 2, RANKS[5].at / 2).title));
});
