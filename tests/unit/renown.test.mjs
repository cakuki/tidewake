import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  RANKS, rankForRenown, renownForSale,
  renownTier, standingPriceModifier, greetPlayer, GREETINGS,
  dominantPole, titleFor, LADDERS,
  earnedLegend, LEGEND_AT, LEGENDS, legendBeat,
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

// ---- Endgame legends: the payoff of the two-pole arc (#46) -------------------

test('LEGEND_AT is the top rung of the ladder', () => {
  assert.equal(LEGEND_AT, RANKS[RANKS.length - 1].at);
  assert.ok(LEGEND_AT > 0);
});

// ---- Single-session curve (#57): reachable in one short web sitting ----------

test('LEGEND_AT is in single-session reach (low thousands, not a multi-hour grind)', () => {
  // A focused ~10-20 min session of trading/dueling must plausibly crown a legend.
  assert.ok(LEGEND_AT <= 4000, `legend must be reachable in a sitting, got ${LEGEND_AT}`);
  assert.ok(LEGEND_AT >= 1000, 'but still an earned, non-trivial summit');
});

test('the ladder rewards early then stretches: rung gaps strictly increase', () => {
  // Early ranks come fast (dopamine); later ranks pace out (aspirational).
  let prevGap = -1;
  for (let i = 1; i < RANKS.length; i++) {
    const gap = RANKS[i].at - RANKS[i - 1].at;
    assert.ok(gap > prevGap, `gap to rung ${i} (${gap}) must exceed the previous (${prevGap})`);
    prevGap = gap;
  }
  // The very first named rank lands within roughly one strong action (fast first win).
  assert.ok(RANKS[1].at <= 60, `first named rank should arrive fast, got ${RANKS[1].at}`);
});

test('a typical trading session climbs into the renowned tier (mid-upper ladder)', () => {
  // Model ~12 solid sales of ~400-coin proceeds — a believable focused session.
  let standing = 0;
  for (let i = 0; i < 12; i++) standing += renownForSale(400);
  assert.ok(standing > 0);
  assert.ok(rankForRenown(standing).index >= 5, `a session should reach Sea Captain+, got index ${rankForRenown(standing).index} at ${standing}`);
});

test('a typical trading session can plausibly reach a legend (dedicated player)', () => {
  // ~16 strong sales (good hauls) crosses the summit — a dedicated single sitting.
  let standing = 0;
  for (let i = 0; i < 16; i++) standing += renownForSale(450);
  assert.ok(standing >= LEGEND_AT, `~16 strong sales should reach legend, got ${standing} vs ${LEGEND_AT}`);
  assert.equal(earnedLegend(0, standing).governor, true);
});

test('titleFor at sample renown values reads the expected rungs', () => {
  assert.equal(titleFor(0, 0).title, 'Bilge-rat');
  // an infamy-led captain just past the first rung wears the first pirate rung
  assert.equal(titleFor(RANKS[1].at, 0).title, LADDERS.pirate[1]);
  // a standing-led captain mid-ladder wears a civic rung
  assert.equal(titleFor(0, RANKS[4].at).title, LADDERS.governor[4]);
  // maxing a pole reads its crown
  assert.equal(titleFor(LEGEND_AT, 0).title, LADDERS.pirate.at(-1));
  assert.equal(titleFor(0, LEGEND_AT).title, LADDERS.governor.at(-1));
});

test('LEGENDS: distinct pirate + governor crowns, each with title/icon/flavour', () => {
  for (const which of ['pirate', 'governor']) {
    const L = LEGENDS[which];
    assert.ok(L && typeof L.title === 'string' && L.title.length > 0, `${which} needs a title`);
    assert.ok(typeof L.icon === 'string' && L.icon.length > 0);
    assert.ok(typeof L.flourish === 'string' && L.flourish.length > 0, `${which} needs a comedic flourish`);
  }
  assert.notEqual(LEGENDS.pirate.title, LEGENDS.governor.title);
  // The legend title matches the very top rung of its pole ladder.
  assert.equal(LEGENDS.pirate.title, LADDERS.pirate.at(-1));
  assert.equal(LEGENDS.governor.title, LADDERS.governor.at(-1));
});

test('legendBeat returns the celebration data for a pole, null otherwise', () => {
  assert.equal(legendBeat('pirate').title, LEGENDS.pirate.title);
  assert.equal(legendBeat('governor').title, LEGENDS.governor.title);
  assert.equal(legendBeat('nonsense'), null);
});

test('earnedLegend: below the threshold earns no legend', () => {
  assert.deepEqual(earnedLegend(0, 0), { pirate: false, governor: false });
  assert.deepEqual(earnedLegend(LEGEND_AT - 1, 0), { pirate: false, governor: false });
  assert.deepEqual(earnedLegend(0, LEGEND_AT - 1), { pirate: false, governor: false });
});

test('earnedLegend: crossing the top as a pirate earns ONLY the pirate legend', () => {
  const e = earnedLegend(LEGEND_AT, 0);
  assert.equal(e.pirate, true);
  assert.equal(e.governor, false);
  // a strong pirate lean past the top also qualifies
  assert.equal(earnedLegend(LEGEND_AT + 5000, 200).pirate, true);
});

test('earnedLegend: crossing the top as a governor earns ONLY the governor legend', () => {
  const e = earnedLegend(0, LEGEND_AT);
  assert.equal(e.governor, true);
  assert.equal(e.pirate, false);
  assert.equal(earnedLegend(200, LEGEND_AT + 5000).governor, true);
});

test('earnedLegend: a balanced captain at the top earns neither (no pole to crown)', () => {
  // total >= LEGEND_AT but evenly split → neutral, no legend until you commit to a pole
  assert.deepEqual(earnedLegend(LEGEND_AT / 2, LEGEND_AT / 2), { pirate: false, governor: false });
});

test('earnedLegend: both legends are reachable (one per maxed pole, mergeable over time)', () => {
  // each pole, maxed in turn, crowns its own legend; ORing the two yields a true Legend
  const a = earnedLegend(LEGEND_AT, 0);     // pirate run
  const b = earnedLegend(0, LEGEND_AT);     // governor run
  const merged = { pirate: a.pirate || b.pirate, governor: a.governor || b.governor };
  assert.deepEqual(merged, { pirate: true, governor: true });
});

test('earnedLegend: junk inputs earn nothing and never throw', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined, null, 'x']) {
    assert.deepEqual(earnedLegend(bad, bad), { pirate: false, governor: false });
  }
});
