---
id: 2026-07-02-deep-reading
date: 2026-07-02
type: idea
status: raw
value: ""
feasibility: ""
decision: ""
issue: ""
assets: []
---

## Raw (source — R2 Deep-Reading ritual, 2026-07-02)

Standout ideas from the daily **R2 Deep-Reading** ritual — a coordinated pass (3 research
fan-outs across craft: the "one-more-voyage" hook + fiction↔non-fiction, the reactive/emergent
world + naval depth, and audiovisual polish + game feel), folded back into all 8 role notebooks
(`studio/agents/notebooks/<role>.md`, entry **Deep-reading #5**).

**This is a shortlist for PM triage — not accepted work.** Do NOT build on the spot; run the normal
discovery funnel + GD fun-sign-off, and get owner sign-off before any issue is filed. Prompt-injection
note: web content was treated as untrusted reference only; no page attempted to redirect scope (one
source skipped on an expired TLS cert, not followed).

**Framing (what shipped, so these BUILD not repeat):** the big run is done — battle-fun #161,
difficulty/variety #162, and **THE RISE #168** (rank-up → buy-cannon → bigger-ship → world-fears-you →
bounty-board → port-growth). Per `docs/design/what-makes-it-fun.md` the fun loop
**action→feedback→progression→mastery is now closed end-to-end.** So the ideas below bias toward the
*next* axis — **the "one more voyage" hook: make the world REMEMBER what you did with that loop** —
plus cheap systemic combat depth and juice/atmosphere polish. Every idea is designed to lean on
already-persisted state (no save bump where possible), matching the post-RISE consolidation stance.

### The convergence (independent roles landed on the same axis)

Across all three research passes, the recurring signal was **"the world remembers you"** — a persistent
named rival, ports that visibly/audibly react to your reputation, and never-closing-the-tab-empty-handed.
That agreement is the read: the highest-leverage *next* frontier isn't a new verb, it's turning the
closed RISE loop into a **remembered, replayable world** — the retention / "one more voyage" hook. The
shortlist leads with that cluster, then cheap combat-depth and juice/atmosphere polish that make it land.

## Shortlist (deduplicated, prioritised)

### P1 — the "one more voyage" hook (the convergence)

1. **The Remembered Rival (Nemesis-lite)** — Size **M/L**. Upgrade the shipped bounty board (#173) into
   ONE persistent named captain who *escalates* if he beats you (bigger ship next voyage) or *grudges* if
   he escaped — and the end-of-voyage Ballad (#90) already narrates the feud. Slice as a vertical ladder
   (persists+returns → escalates → Ballad names the feud → port NPCs reference him), each independently
   shippable — NOT a "rival epic". *Fun beat:* a rivalry that is uniquely YOURS — the bespoke story you'd
   retell. *Builds on:* bounty board #173 + Ballad #90 + world-fears-you #172. **Maps to parked
   owner-decision #142 (named persons).** Risk: one additive fail-open save field (#122 discipline).
   **Raised by game-designer, tech-lead, project-manager (Nemesis) + the fiction pass (real rival captains).**

2. **The port remembers you** — Size **M**. Ports react VISIBLY and AUDIBLY to your reputation: a feared
   pirate makes landfall to shutters closing, doubled guards, a "WANTED" poster, and the town's docked
   cue re-voiced from warm major toward a darker minor under the *same* tune; a respected governor sees
   banners + a lit quay + a warmer harmony. All keyed off the already-persisted reputation value. *Fun
   beat:* you SEE and HEAR your reputation on the streets — show, don't tell the needle. *Builds on:*
   reputation needle + per-town musical identity #129/#69 + town props #101 + fearful hails #175 +
   grow-home-port #174. **Maps to parked owner-decision #137 (nations/factions).**
   **Raised by graphic-designer, sound-engineer, musician, and the reactive-world pass.**

3. **Never close the tab empty-handed** — Size **S/M**. Even a LOST voyage banks something visible (a scrap
   of Infamy, a rumour, a plank on the home-port fund) and the Ballad records the defeat as a *chapter*.
   *Fun beat:* "one more voyage" lives between reset difficulty and rising power — you never quit empty.
   *Builds on:* THE RISE #168 + loss-stings #164 + Ballad #90 + port-growth #174. **Guardrail:** the loss
   must still STING (#164) — banked progress and the sting must coexist, or the stakes soften. **Raised by
   game-designer, project-manager (roguelite meta-progression).**

4. **"Today's Tide" — a session goal** — Size **M**. A rotating 1–3 short voyage goals on the bounty board
   (sink a sloop, run contraband, duck a governor patrol) with a purse — a crisp arc you can finish in one
   sitting and a reason to return tomorrow. *Fun beat:* a clean "done for today" beat that respects your
   time. *Builds on:* bounty board #173. **Maps to parked owner-decision #136 (leaderboard)** — a daily-run
   ranking is the natural v2. **Raised by project-manager (session-shaped goals).**

### P2 — cheap systemic combat depth (deepen the shipped battle)

5. **Choose your shot: ammo types** — Size **M**. A legible pre-volley pick — round / **chain-shot** (shreds
   sails → foe slows, can't flee, feeds the #172 surrender path) / **grape** (thins crew → tilts the #135
   boarding duel). One enum threaded through the EXISTING `resolveBroadside` + boarding math; the default
   (round) stays byte-identical. *Fun beat:* one choice reshapes the whole fight — a skill decision before
   you fire. *Builds on:* the volley/aim #161 + ship classes #163 + boarding/duel #135 + world-fears-you
   #172. **Raised by the reactive-world + software-developer passes.**

6. **The weather gage: wind as a global rule** — Size **S/M**. Promote the wind vector (we already ship
   weather #88) to a property BOTH hulls obey: downwind = speed + a smoke-screen approach; upwind = the
   "weather gage" (dictate range). One reused property → emergent tactics, no new system — and the natural
   home for #88's deferred *gameplay*-weather half. *Fun beat:* positioning and the sky suddenly matter to
   every chase. *Builds on:* weather #88 + battle maneuver #135. **Raised by the reactive-world/tech-lead pass.**

### P2 — identity & comedy (grounded fiction↔non-fiction)

7. **The crew votes the articles** — Size **M**. After a win, a funny high-stakes **plunder-split** payout
   beat drawn from real pirate "articles of agreement" (crews were democracies; exact shares, even
   disability comp): stingy shares breed mutiny rumours (feed the Ballad), generous shares buy loyalty.
   *Fun beat:* grounded history + Monkey-Island comedy on top of THE RISE economy. *Builds on:* THE RISE
   economy #168 + rumours→Ballad #90. **Raised by the fiction↔non-fiction cross-connection.**

8. **Fear you can SEE on your own ship** — Size **S**. Render Infamy on the hull the way THE RISE shows
   bought cannons (#170): black sails, trophy flags, a fiercer figurehead — DERIVED from the persisted
   infamy value (no save bump), and a bad loss visibly strips a trophy. *Fun beat:* fame you can see —
   and lose. *Builds on:* THE RISE visible progression #170/#171 + loss-stings #164. Cheap, procedural.
   **Raised by graphic-designer + the reactive-world pass (Sea of Thieves notoriety).**

### P3 — juice & atmosphere polish (make the shipped payoffs LAND harder)

9. **Negative space: the held breath before the payoff** — Size **S** (each). "Reserve peak intensity; calm
   makes payoffs land." Three cheap subtractions/additions on shipped beats: (a) duck ALL combat layers to
   near-silence for ~1s before a surrender sting + the #80 camera-settle; (b) a CHARGED rank-up — a ~0.8s
   rising swell releasing on a bass "thunk" as the new rank snaps (vs the instant #169 card); (c) a payoff
   colour-grade pulse (warm saturation + soft vignette + one-frame bloom) on a notorious kill / rank-up,
   a single full-screen pass (~0 extra draws). *Fun beat:* the wins feel *bigger* for free. *Builds on:*
   juice #80 + rank-up #169 + sidechain bus + day-night/weather #58/#88. **Raised by sound-engineer,
   graphic-designer, software-developer.**

10. **The shantyman calls, the crew answers** — Size **M–L**. A procedural call-and-response shanty layer on
    calm long voyages — a lead phrase answered by a crew-chorus "hey!" on the downbeat, tempo-locked to the
    shipped bar-clock, swelling when the sea is calm and dropping in battle. NO vocal files (synth "oohs";
    watch CPU voice count). *Fun beat:* huge fun-per-byte for an age-of-sail game — the crew becomes an
    instrument. *Builds on:* rotating sea themes #94 + the bar-clock. **Raised by sound-engineer + musician
    + the shanty cross-connection.**

## Triage log (newest at the bottom)

- 2026-07-02 — Filed by the R2 Deep-Reading coordinator as a shortlist for PM triage. Coordinated 3-way
  research fan-out; findings folded into all 8 role notebooks (Deep-reading #5). No GitHub issues filed
  and `queue.md` untouched — that's the PM session's job. Ideas #1/#2/#4 map onto parked owner-decision
  frontiers (#142 named persons / #137 nations / #136 leaderboard) — surface as owner options, don't
  auto-adopt.
