// Fearful hail — Dread's HEAR half (#175, follow-up of #172 "The world fears you", epic #168 "The Rise").
//
// #172 shipped dread's SEE + FEEL: a weak, much-outclassed ship FLEES on sight / STRIKES her colours
// EARLY to a feared, bigger captain. It left the HEAR half silent — the sea blinked without a word. This
// closes that: when a dreaded foe reacts, the world NAMES you — a short fearful hail that speaks your
// notoriety/title, sized to how feared you are, drawn anti-repeat from a small original pool.
//
// PURE data + string math. No THREE, no DOM, no game state — the whole "do I HEAR the world fear me?"
// question unit-tests under `node --test`. This module only DECIDES the words; main.js surfaces them on
// the EXISTING hail banner (`hud.flashBanner`) + the EXISTING reputation-sting audio bus
// (`audio.playRepSting`, tier-aware) at the two #172 dread reaction edges (npc flee-on-sight + battle
// early-strike). It invents no new UI, no new audio recipe, and no new combat path.
//
// CREATIVE SPARK (Game Designer + Sound Engineer): the payoff of Infamy is a NUMBER you watch climb —
// until the moment a merchant turns tail and you HEAR her crew cry your name in terror. Your notoriety
// stops being a stat and becomes something the sea SPEAKS. The words scale with the fear you've earned
// (a wary murmur → a panicked strike → "the Devil sails today"), so climbing the pole is audible.

import { notoriety } from './dread.js';
import { titleFor } from '../renown.js';

const finite = (n, d = 0) => (Number.isFinite(n) ? n : d);
const clamp01open = (n) => Math.max(0, Math.min(0.9999999, finite(n, 0)));

// ── Fear tier — how loud the sea's fear is, read off the same notoriety ramp #172 flees against ───────
// notoriety(infamy) is [0,1] (0 at/below FEAR_FLOOR, 1 at/above FEAR_FULL). Three bands so the words
// grow with the name: a wary murmur (they clock a dangerous sail) → dread (nerve cracks, she runs) →
// terror (a legend on the water, every soul aboard breaks). Monotonic non-decreasing; junk → 0.
export const FEAR_TIER_DREAD = 0.25;  // notoriety at/above which a hail reads as real dread
export const FEAR_TIER_TERROR = 0.66; // notoriety at/above which it reads as outright terror

/**
 * Bucket a captain's Infamy into a fear tier (0 wary · 1 dread · 2 terror). PURE, junk-safe.
 * @param {number} infamy
 * @returns {0|1|2}
 */
export function fearTier(infamy) {
  const n = notoriety(infamy);
  if (n >= FEAR_TIER_TERROR) return 2;
  if (n >= FEAR_TIER_DREAD) return 1;
  return 0;
}

// ── The hail pools — original to Tidewake, salty + a wink of gallows humour. {title} is filled with the
// captain's current pole-aware title (renown.js titleFor), so the cry NAMES you. Keep each pool ≥2 so
// the anti-repeat picker always has a fresh line. The FEARED pools (pirate pole) scale by fear tier; the
// DEFERENTIAL pool (governor/neutral pole) is a respectful, wary acknowledgement rather than terror.
export const FEARFUL_HAILS = {
  feared: [
    // tier 0 — a wary murmur: they clock a known, dangerous name and give her a wide berth
    [
      "Ware that sail, lads — word is that's {title} yonder.",
      "Trim sharp and give her room; I'll not tangle with {title} today.",
      "Eyes to weather — those are {title}'s colours, or I'm a landsman.",
    ],
    // tier 1 — dread: nerve cracks, she comes about to run before the guns can bear
    [
      "God ha' mercy — it's {title}! Hard over, hard OVER!",
      "Strike, ye fools, strike! 'Tis {title} bearing down on us!",
      "Run her off the wind — that's {title}, and we're no match for her!",
    ],
    // tier 2 — terror: a legend on the water; every soul aboard breaks at once
    [
      "The Devil sails today — {title}! Every man for himself!",
      "It's {title}! Colours DOWN, colours down — no soul crosses her and swims!",
      "Sweet mercy, it's {title} herself! Cut the cargo loose and PRAY!",
    ],
  ],
  // pole = governor/neutral — the world RESPECTS more than it fears you: a wary tip of the hat, not a rout
  deferential: [
    "Make way — 'tis {title}, and we'll not cross her.",
    "Steady, lads; that's {title}. A nod, and we sail on friendly.",
    "Colours to {title} — let her pass with respect.",
  ],
};

/**
 * Choose the fearful hail a dreaded foe cries at a captain of this ledger — sized to notoriety (tier),
 * flavoured by dominant pole (feared vs deferential), with {title} substituted, drawn anti-repeat.
 * PURE + junk-safe + deterministic under an injected rng.
 *
 * @param {{infamy?:number, standing?:number, rng?:()=>number, avoid?:number}} p
 *   `avoid` is the pool index last spoken — the picker never returns it twice running (pool length ≥ 2).
 * @returns {{text:string, index:number, tier:0|1|2, title:string, pole:'pirate'|'governor'|'neutral'}}
 */
export function pickFearfulHail({ infamy = 0, standing = 0, rng = Math.random, avoid = -1 } = {}) {
  const inf = finite(infamy, 0), st = finite(standing, 0);
  const t = titleFor(inf, st);
  const tier = fearTier(inf);
  const pool = t.pole === 'pirate'
    ? (FEARFUL_HAILS.feared[tier] || FEARFUL_HAILS.feared[0])
    : FEARFUL_HAILS.deferential;
  const r = (typeof rng === 'function') ? rng() : Math.random();
  let i = Math.floor(clamp01open(r) * pool.length);
  if (i >= pool.length) i = pool.length - 1;                 // guard a rng() that returns exactly 1
  if (i === avoid && pool.length > 1) i = (i + 1) % pool.length; // anti-repeat: never the same line running
  const text = pool[i].replace(/\{title\}/g, t.title);
  return { text, index: i, tier, title: t.title, pole: t.pole };
}
