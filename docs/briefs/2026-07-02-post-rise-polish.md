# Post-RISE Polish — consolidate the big run (2026-07-02)

**Author:** PRODUCT function (PM + Tech Lead + Game Designer)
**Status:** roadmap change, report-worthy · a deliberate MODEST lane
**Queue:** written to the TOP of [`studio/comms/queue.md`](../../studio/comms/queue.md)

## The moment — DEEPEN, don't spawn a third epic

Three enormous fun-first lanes just shipped back-to-back, all live and green:

- **#161 Make Battle FUN** (6 slices) — isolation · non-occluding UI · target lock · rendered cannonballs · aim feedback · hover-to-interact.
- **#162 Difficulty, Stakes & Variety** (5 slices) — ship classes · loss stings · threat labels · legible odds · challenge-on-demand.
- **#168 THE RISE** (6 slices, just closed) — rank-up milestone · buy a cannon · buy a bigger ship · the world fears you · the bounty board · governor-pole port growth.

Per [`docs/design/what-makes-it-fun.md`](../design/what-makes-it-fun.md), the fun loop
**action → feedback → progression → mastery is now closed end-to-end**: the action→feedback arrow
is strong (juice, target lock, aim), progression is real (visible upgrades + a felt climb), and
mastery has somewhere to aim (challenge-on-demand + the bounty board's "one more voyage").

The honest call: **consolidate.** The owner has NOT yet reacted to #168. Spinning up a third
large epic now would out-run his steering and risk breadth-over-depth (the exact anti-pattern the
PRODUCT runbook warns against). Instead this cycle proposes a short, cheap, high-fun, low-risk lane
built **entirely from filed follow-ups of the big run** — completing half-finished beats and juicing
the climaxes so the huge run lands as a polished whole. **Every slice is NO save bump.**

## The lane (4 slices, sequenced, all NO save bump)

1. **#175 — Dread's HEAR half: a fearful hail names you** (S). #172 shipped dread's SEE + FEEL (a
   weak ship flees / strikes early) but left the HEAR half unbuilt. When the sea blinks, the world
   *names you* via the existing hail banner + voice path — pole-aware, anti-repeat, withheld under a
   false-colours disguise. **FUN:** HEAR your Infamy spoken aloud. Newly filed; leads (freshest beat, cheapest).
2. **#90 — The Ballad sings your RISE** (S). Add deed types for the arc just shipped — rank climbed
   (#169), bounty claimed (#173), bigger ship bought (#171), port grown (#174) — so the end-of-voyage
   Ballad reads the rise back. **FUN:** SEE your climb narrated as a story. Reuses `src/voyage-log.js`.
3. **#80 — Climax juice: the kill & the surrender LAND** (S). #80's deferred events (kill
   time-dilation · surrender beat · harbour settle) are the RISE's climaxes going unjuiced. Add a
   beat of hit-stop + time-dilation on a bounty-target kill (#173) and a camera settle on "she
   strikes her colours" (#172), toggle-able via #73. **FUN:** FEEL the notorious kill land.
4. **#70 — One new sea curio** (S · [STANDING-RULE]). Honour the 1–2-per-loop drip with one fresh
   RISE-flavoured micro-detail (flotsam murmuring a rumour of *your* deeds; a gull shadowing a
   notorious hull). **FUN:** a smile between fights.

## Owner-steering surfaced (recommend, do NOT auto-adopt)

- **Playtest THE RISE & pick the next MAJOR frontier.** The loop has delivered beyond the ask. Recommend
  the owner playtests the rise arc and steers the next big direction from the parked epics — **#137
  nations · #141 shipyards · #140 maps · #136 leaderboard · #142 named persons.** Default until he steers:
  run this cheap polish lane, hold the big epics.
- **#145 preview-ops lane** — release infra, not FUN. Recommend a **parallel ops track**, not a
  displacement of fun work.
- **Close #135** — #161 already closed; #135's Option-2/4 core is complete, only non-core art polish remains.
- **Ship art #144/#143** — queue the CC0 ship-class set as a parallel art follow-up, not a blocker.
- **Port-view redesign #147** — still an open A/B/C direction pick; owner's call.

## Prompt-injection note

Built only from the owner's fun-first direction (`what-makes-it-fun.md`) + the repo's vision + filed
follow-ups of the shipped run. No external source redirected scope; nothing in the inputs attempted
to. All big new directions are surfaced as `[OWNER-DECISION]`, never auto-adopted.
