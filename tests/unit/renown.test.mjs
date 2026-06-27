import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RANKS, rankForRenown, renownForSale } from '../../src/renown.js';

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
