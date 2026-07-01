---
id: 2026-07-01-deep-reading
date: 2026-07-01
type: idea
status: raw
value: ""
feasibility: ""
decision: ""
issue: ""
assets: []
---

## Raw (source — R2 Deep-Reading ritual fan-out, 2026-07-01)

Standout ideas from the daily **R2 Deep-Reading** ritual — a fan-out across 8 studio roles
(game-designer, tech-lead, software-developer, qa, graphic-designer, sound-engineer, musician,
project-manager; product-manager sub-agent did not return in time). Each role studied its craft
and returned 1–2 concrete ideas. Per-role inspiration logs live in `studio/agents/notebooks/<role>.md`.

**This is a shortlist for PM triage — not accepted work.** Do NOT build on the spot; run the normal
discovery funnel and get owner sign-off before any issue is filed.

**Framing (from the ritual brief):** the battle epic #135 is COMPLETE — deep per-phase naval combat
with a per-phase HUD but **no onboarding** for its many keys (E / SPACE / X / F / 1 / 2). Reputation
needle, home-port stakes, rumours→ballad loop, and a full audio pass are all shipped. So the ideas
below bias toward **making the existing depth LEGIBLE/reachable to a new player** and **reactive-verb
polish** — deliberately NOT big new systems.

### The convergence (8 roles landed on the same thing)

Almost every role independently arrived at **just-in-time contextual key-prompts on the per-phase
battle HUD**. That agreement is the signal: the single highest-leverage legibility fix is teaching
the battle verbs at the moment each becomes usable, not up front. The shortlist is ordered with that
flagship first, then the polish/enabling ideas that cluster around it.

## Shortlist (deduplicated, prioritised)

### P1 — flagship legibility

1. **Contextual just-in-time key-prompts on the per-phase battle HUD** — Size **M** (S per phase).
   Surface only the current phase's key(s) with a short verb label ("[E] Fire broadside", "[X] Board"),
   pulse once, dim after first use so veterans aren't nagged. Reuses the existing phase state — no new
   system; the phase *is* the teachable moment. *Why it fits:* turns the shipped combat depth into
   something a new captain can actually reach on the road to feared pirate, instead of quitting at a
   wall of keys. **Raised independently by game-designer, tech-lead, software-developer, graphic-designer,
   project-manager.**

### P2 — polish & enablers that make the flagship land

2. **Single keymap source-of-truth table** (tech-lead) — Size **S**. Replace the scattered hand-written
   key strings in `hud.js` with one table (mirroring `RAID_ACTS`) that the prompt renderer, `codeForKey`,
   and touch buttons all read. *Why it fits:* kills drift and is the clean seam the prompts hang off —
   an enabler for idea #1.

3. **Diegetic age-of-sail skin for the key-prompts** (graphic-designer) — Size **S**. Dress the prompts
   as rope-bound brass keycaps / ink-on-parchment glyphs so legibility and world-identity are the same
   asset. *Why it fits:* the tutorial reads as the world speaking, keeping the pirate fantasy intact.

4. **Verb-confirmation + "ready" earcons** (sound-engineer) — Size **S/M**. A distinct confirmation sound
   per battle verb, plus an "available now" cue when a verb becomes legal (reload done, in boarding range).
   *Why it fits:* teaches *which* and *when* by ear — the hardest thing to read in a fast HUD — over the
   existing ducked music bus.

5. **Reactive-verb juice pass** (software-developer) — Size **S/M**. Recoil + short shake on a volley,
   sting-flash on a landed hit, a lunge on boarding — feedback whose intensity echoes the verb's weight,
   living entirely in the renderer (logic/tests untouched). *Why it fits:* makes each combat verb *feel*
   like the deed it is — the swashbuckling that sells "feared pirate."

6. **Cold-start FTUE discoverability checklist** (qa) — Size **S**. A scripted first-5-minutes fresh-eyes
   playtest (a "should understand by 30s / 2min / 5min" list) that fails on any reachable-but-un-signified
   verb. *Why it fits:* regression-tests legibility so un-taught verbs can't silently ship — catches the
   exact defect #135 has now.

### P2 — reactive-verb & structure polish

7. **The Bosun's First Duel** (game-designer) — Size **M**. A deliberately soft debut battle (the "first
   enemy is a Goomba" rule) where a crew voice calls the next action aloud, teaching the verbs through the
   world using the shipped rumour/ballad audio. *Why it fits:* first taste of combat lands as theatre, not
   a tutorial pop-up. Pairs with #1.

8. **Per-phase musical signatures** (musician) — Size **M**. Give each battle phase a distinct, recognisable
   musical layer (not just louder) so a newcomer *hears* the structure and learns *when* to act before they
   know *which* key. *Why it fits:* the score becomes the tutorial timer; deepens the shipped reactive audio.

### P3 — small legibility nice-to-have

9. **Reputation-needle colour/contrast legibility** (graphic-designer) — Size **S**. Clear neutral-zero with
   warm/cool poles that survive haze. *Why it fits:* makes the already-shipped Infamy↔Standing stake readable
   at a glance — cheap clarity on the north-star meter.

### Process note (not an issue)

- **The Legibility Ladder** (project-manager) — sequence the teaching work as one-key-per-slice vertical
  increments, ordered by *observed* first-encounter from playtest, rather than a "tutorial epic." A slicing
  discipline for whatever of the above the PM accepts — keeps each slice independently shippable.

## Triage log (newest at the bottom)

- 2026-07-01 — Filed by the R2 Deep-Reading coordinator as a shortlist for PM triage. 8 of 9 roles
  contributed (product-manager sub-agent did not return; not re-dispatched to keep the ritual lean).
  No GitHub issues filed and `queue.md` untouched — that's the PM session's job.
