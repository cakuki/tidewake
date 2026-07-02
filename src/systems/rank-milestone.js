// Rank-up milestone (#169, epic #168 "The Rise") — PURE, DOM-free and three.js-free logic for the
// felt "you rose" beat. Today the 8-rung ladder in `src/renown.js` (Bilge-rat → Corsair/Dread Captain
// on the pirate road, Harbourmaster/Magistrate on the governor road) is derived silently from the
// already-persisted infamy + standing: crossing a rung banks two numbers and NOTHING tells you you
// climbed. This module gives the rise a heartbeat — it detects a FORWARD rung crossing, chooses
// pole-appropriate title-card copy (dread for the pirate pole, respect for the governor pole), and
// guards the announcement so it fires ONCE per crossing.
//
// SAVE-FREE (stays v17): the "already announced" state is a TRANSIENT in-session baseline — the
// HIGHEST RUNG SEEN — seeded from the existing persisted rep on load. So a captain who loads in at a
// high rank never re-announces (baseline == current rung), and a rung dropped after a defeat (#164)
// and re-climbed never re-announces either (highest-seen, not current-rung). No new persisted field.
//
// Split: this pure core is unit-tested under `node --test`; main.js is the thin shell that drives the
// DOM card (hud.showRankUp) + the triumphant audio sting on a real crossing.

import { titleFor, RANKS } from '../renown.js';

/** The top rung index of the ladder (the legend summit). */
export const TOP_RANK = RANKS.length - 1;

// Pole-flavoured flourish pools — original, warm, a wink of comedy (Constitution tone). The pirate
// road leans into dread; the governor road into civic pride; neutral is the free captain on the rise.
// One is picked per card via an injectable RNG so the copy unit-tests deterministically (greetPlayer
// pattern in renown.js).
export const RANKUP_FLOURISHES = {
  pirate: [
    'Sailors lower their eyes as your sails crest the horizon.',
    'Your name is now muttered in every galley from here to the reef.',
    'Somewhere, a harbourmaster quietly reinforces his shutters.',
  ],
  governor: [
    'The council raises a glass to your good name.',
    'Ports set out their finest berth the moment your colours show.',
    'Your word now carries the weight of a signed writ.',
  ],
  neutral: [
    'Your legend gains a barnacle of weight.',
    'The sea remembers a captain on the rise.',
    'One more rung climbed toward whatever you are becoming.',
  ],
};

const ICONS = { pirate: '☠', governor: '⚖', neutral: '⚑' }; // ☠ ⚖ ⚑

/** English indefinite article for a title ("a Reaver" / "an Admiral"). */
function article(title) {
  return /^[AEIOU]/i.test(String(title || '')) ? 'an' : 'a';
}

/**
 * Pole-appropriate title-card copy for a rank-up. The pirate road names you as FEARED, the governor
 * road proclaims you with RESPECT, a neutral captain simply climbs. Pure + deterministic under an
 * injected RNG.
 * @param {string} title  the new rung's pole title (from renown.js titleFor)
 * @param {'pirate'|'governor'|'neutral'} pole
 * @param {() => number} [rnd]  defaults to Math.random
 * @returns {{icon:string, headline:string, flourish:string}}
 */
export function rankUpCopy(title, pole, rnd = Math.random) {
  const pool = RANKUP_FLOURISHES[pole] || RANKUP_FLOURISHES.neutral;
  const flourish = pool[Math.floor(rnd() * pool.length) % pool.length] || pool[0];
  const icon = ICONS[pole] || ICONS.neutral;
  let headline;
  if (pole === 'pirate') headline = `You are now feared as ${article(title)} ${title}`;
  else if (pole === 'governor') headline = `The council names you ${title}`;
  else headline = `You are now ${article(title)} ${title}`;
  return { icon, headline, flourish };
}

/**
 * Detect a FORWARD rank crossing against the highest rung already seen. PURE + junk-safe.
 * Returns the milestone to announce — the new rung's index, pole, title and ready-made card copy —
 * when the captain's current rung EXCEEDS `highestSeen`, else null. The base rung (Bilge-rat,
 * index 0) is never a "rank-up". A multi-rung leap reports the FINAL rung once, not each in between.
 * @param {number} highestSeen  the highest rung index seen so far (junk → -1)
 * @param {number} infamy       pirate-pole score
 * @param {number} standing     governor-pole score
 * @param {() => number} [rnd]
 * @returns {{index:number, title:string, pole:string, leaning:string, icon:string, headline:string, flourish:string} | null}
 */
export function detectRankUp(highestSeen, infamy, standing, rnd = Math.random) {
  const seen = Number.isFinite(highestSeen) ? highestSeen : -1;
  const { title, pole, leaning, index } = titleFor(infamy, standing);
  if (index <= 0 || index <= seen) return null; // the base rung never announces; only a NEW summit does
  return { index, title, pole, leaning, ...rankUpCopy(title, pole, rnd) };
}

/**
 * A stateful "highest rung seen" guard. Seed it with the captain's CURRENT rep on load so existing
 * progress never re-announces, then call `.check(infamy, standing)` each time the ledger may have
 * moved — it returns the milestone on a genuinely new forward crossing (and records the summit), or
 * null. This is the whole save-free once-only mechanism: no persisted field, purely in-session.
 * @param {number} infamy   current pirate-pole score at construction (the baseline)
 * @param {number} standing current governor-pole score at construction (the baseline)
 */
export function createRankMilestones(infamy, standing) {
  let highest = titleFor(infamy, standing).index; // silent baseline — the rung you loaded in at
  return {
    get highest() { return highest; },
    /** Returns the milestone to announce on a forward crossing (recording it), else null. */
    check(inf, std, rnd = Math.random) {
      const m = detectRankUp(highest, inf, std, rnd);
      if (m) highest = m.index;
      return m;
    },
  };
}
