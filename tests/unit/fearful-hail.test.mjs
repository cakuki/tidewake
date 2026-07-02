// #175 "Dread's HEAR half" — when a dreaded foe FLEES on sight or STRIKES her colours early (#172), the
// world NAMES you: a short fearful hail that speaks your notoriety/title, sized to the dread and drawn
// anti-repeat from a small original pool. PURE line-picker, so the whole "do I HEAR the world fear me?"
// question unit-tests under `node --test`. Reuses the existing hail banner + the reputation-sting audio
// bus in main.js; this module only DECIDES the words — it invents no new UI or combat path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fearTier, pickFearfulHail, FEARFUL_HAILS,
} from '../../src/systems/fearful-hail.js';
import { titleFor } from '../../src/renown.js';

const TERROR = 1600;  // well past FEAR_FULL → notoriety saturates → the terror tier, pirate pole
const DREAD = 300;    // mid notoriety → the dread tier
const WARY = 150;     // just above the fear floor → a wary murmur (low tier)
const GOVERNOR = { infamy: 40, standing: 2000 }; // standing-dominant → governor pole (deferential)

test('fearTier: junk → 0, buckets 0/1/2, saturates at 2, monotonic non-decreasing', () => {
  assert.equal(fearTier(NaN), 0);
  assert.equal(fearTier(-500), 0);
  assert.equal(fearTier(0), 0);
  assert.equal(fearTier(TERROR), 2);
  assert.equal(fearTier(TERROR + 9000), 2);          // clamps at the top
  const t = fearTier(DREAD);
  assert.ok(t >= 0 && t <= 2);
  let prev = -1;
  for (let i = 0; i <= 3000; i += 50) { const v = fearTier(i); assert.ok(v >= prev); prev = v; }
});

test('every pooled line carries the {title} token so the world can NAME you', () => {
  for (const tierPool of FEARFUL_HAILS.feared) {
    assert.ok(Array.isArray(tierPool) && tierPool.length >= 2, 'each feared tier needs an anti-repeat pool');
    for (const line of tierPool) assert.ok(line.includes('{title}'), `feared line missing {title}: ${line}`);
  }
  assert.ok(FEARFUL_HAILS.deferential.length >= 2);
  for (const line of FEARFUL_HAILS.deferential) assert.ok(line.includes('{title}'), `deferential line missing {title}: ${line}`);
});

test('pickFearfulHail: the hail SPEAKS your title, and the tier matches your notoriety', () => {
  const p = pickFearfulHail({ infamy: TERROR, standing: 0 });
  const { title } = titleFor(TERROR, 0);
  assert.ok(p.text.includes(title), `the hail must name you (${title}): "${p.text}"`);
  assert.ok(!p.text.includes('{title}'), 'the {title} token must be substituted');
  assert.equal(p.tier, fearTier(TERROR));
  assert.equal(p.tier, 2);            // a Terror draws the terror-tier pool
  assert.equal(p.title, title);
  assert.equal(p.pole, 'pirate');
});

test('pickFearfulHail: tier scales the pool — a wary murmur vs terror are different words', () => {
  const wary = pickFearfulHail({ infamy: WARY, standing: 0, rng: () => 0 });
  const terror = pickFearfulHail({ infamy: TERROR, standing: 0, rng: () => 0 });
  assert.ok(wary.tier < terror.tier, 'notoriety must lift the fear tier');
  assert.notEqual(wary.text, terror.text, 'a different tier must read differently');
});

test('pickFearfulHail: pole-aware — the pirate road is FEARED, the governor road is DEFERENTIAL', () => {
  const feared = pickFearfulHail({ infamy: TERROR, standing: 0, rng: () => 0 });
  const respected = pickFearfulHail({ ...GOVERNOR, rng: () => 0 });
  assert.equal(feared.pole, 'pirate');
  assert.equal(respected.pole, 'governor');
  // the deferential hail is drawn from the respect pool (not the terror pool)
  const govTitle = titleFor(GOVERNOR.infamy, GOVERNOR.standing).title;
  assert.ok(FEARFUL_HAILS.deferential.some((l) => l.replace(/\{title\}/g, govTitle) === respected.text),
    `a governor-pole captain draws a deferential hail: "${respected.text}"`);
});

test('pickFearfulHail: anti-repeat — never the same line twice running', () => {
  let avoid = -1;
  const seen = [];
  for (let n = 0; n < 12; n++) {
    // sweep rng across the pool so a naive picker WOULD repeat without the anti-repeat guard
    const p = pickFearfulHail({ infamy: TERROR, standing: 0, rng: () => (n % 3) / 3, avoid });
    if (seen.length) assert.notEqual(p.index, avoid, `immediate repeat at n=${n} (index ${p.index})`);
    seen.push(p.index);
    avoid = p.index;
  }
  assert.ok(new Set(seen).size >= 2, 'the pool should vary across a session');
});

test('pickFearfulHail: junk-safe — no ledger still returns a spoken hail (never throws)', () => {
  const p = pickFearfulHail({});
  assert.ok(p && typeof p.text === 'string' && p.text.length > 0);
  assert.equal(p.tier, 0);
  assert.ok(!p.text.includes('{title}'));
});

test('pickFearfulHail: deterministic under an injected rng', () => {
  const a = pickFearfulHail({ infamy: TERROR, standing: 0, rng: () => 0.5 });
  const b = pickFearfulHail({ infamy: TERROR, standing: 0, rng: () => 0.5 });
  assert.equal(a.text, b.text);
  assert.equal(a.index, b.index);
});
