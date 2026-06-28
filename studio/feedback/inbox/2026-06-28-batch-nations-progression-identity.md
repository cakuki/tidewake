---
id: 2026-06-28-batch-nations-progression-identity
date: 2026-06-28
type: idea
status: raw           # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: ""             # loop refines
feasibility: ""       # loop assesses
decision: "RECORDED for the loop to refine/prioritise/deliver (owner direction 2026-06-28: 'record & let the loop tackle later'). NOT accepted from-owner builds. Net-new items filed as backlog epics #136–#142; two folded into existing issues (#135, #4); one sub-part already shipped (battle vs merchant). See mapping below."
issue: "#136 #137 #138 #139 #140 #141 #142 (+ folded #135, #4)"
assets: []
---

## Raw (owner's words — verbatim, never edited)

- I would love to see my ranking amongst other pirates. Leaderboard of most notorious pirates or popular sailors (marquees)?

- While writing this one popped up from the OG game, more cities and cities have a nation, which you can also fight for. Independent, national, or pirate ships. Plus battle vs merchant/cruise modes for the ship (which we already have with Black/Merchant). (yeah this seems to be a big one, maybe worth splitting)

- Def. more islands and cities. Different sizes of localities: camp, town, city etc.

- Fights btw other ships.

- City capture (for a nation).

- This is also a big and probably separate one: online game! Can we have an online session?

- Different map support? Fixed maps, or random map generation.

- Shipyards in some localities with different options for ship purchase and ship parts (guns, sails, etc). For feeling of progress. Player starts with a small boat/ship, then upgrades or buys a better/bigger ship with more cargo and personal capacity.

- Unique value over SMP (the OG Sid Meier's Pirates game, let's call it SMP from now on): let's have a name for each person. Starting with the player, creating a persona screen: name, character, etc. Every human (maybe even animals) having a name and some properties.

- Related with above: having name and props (what they are good at: sails, guns, etc.) for each person in each ship. We only see the ones in our ship of course. Might be more relevant also to have mutinity scenarios, having a royality score for each crew member. (What does one call ship crew if that's a pirate or merchant ship, do they differ?)

## Triage log (newest at the bottom)

- 2026-06-28T09:49Z — Captured at PM desk (owner batch). Per owner: **record & let the loop refine /
  prioritise / deliver**; PM gave initial feedback + deduped, did **not** run the full funnel. Disposition:

  | # | Owner item | Disposition |
  |---|-----------|-------------|
  | 1 | Pirate leaderboard / ranking (marquees) | **NEW → #136**. Builds on Infamy↔Standing (M7); needs named NPC captains; pairs w/ rival #133. |
  | 2 | Nations own cities; fight for a nation; ship allegiance (indep/national/pirate); battle vs merchant | **NEW (big, split) → #137**. Coord faction/bounty #92, M8. *Battle vs merchant already shipped (npc.js) — dropped.* |
  | 5 | City capture (for a nation) | **Folded into #137** (nations epic). |
  | 3 | More islands & cities; locality tiers (camp/town/city) | **NEW → #138**. Coord M2 world-data, town mode #96; gate breadth vs perf. |
  | 4 | Fights between other ships | **Partly in plan → commented #135** (cannons.js NPC-vs-NPC auto-resolver) + M5. New ask = make them *visible* events. |
  | 6 | Online game / multiplayer | **NEW (major architecture, owner-decision) → #139**. Needs an options brief before any build. |
  | 7 | Map support — fixed / random generation | **NEW → #140**. Coord M2/M4 + map view #54/#83; determinism for save & online. |
  | 8 | Shipyards — buy ships & parts; small→big progression | **NEW → #141**. Coord economy M3, M8 bigger ships, #135 workshop loadouts. |
  | 9 | Named persons + persona/character-creation; everyone named w/ props | **NEW (USP vs SMP) → #142**. Underpins #136 leaderboard + crew #4. |
  | 10 | Named crew + per-member skills + loyalty/mutiny | **Largely in plan → commented #4** (Crew & Reputation epic) + loyalty meter #124. Extension = *named* members w/ skills. |

  Owner's flavour question ("what to call pirate vs merchant crew?"): generically **crew / hands / sailors**;
  pirate crews historically called themselves **"the company"** (egalitarian articles & shares) — a natural
  fit for the per-member loyalty/mutiny mechanic vs a hierarchical merchant/navy crew. Noted on #4.
