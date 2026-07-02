---
id: 2026-07-02-qa-must-play-quality-over-features
date: 2026-07-02
type: feedback
status: triaging
value: "SYSTEMIC: QA runs automated gates but does NOT actually play/investigate the game, so obvious quality issues (playdough harbours, pencil ships, one-tone music, ships through islands, beaching, un-angled combat, rescue interrupts) keep reaching the owner. Also a directive: improve existing before adding new. Plus genuine wins to reinforce."
feasibility: "Two tracks: (1) exploratory QA pass to reproduce+root-cause each bug (several are REGRESSIONS/incomplete: #161 isolation, #76 beaching, #129 music). (2) Codify 'QA plays the game' doctrine + 'improve existing before new' into canon/QA role/rituals."
decision: ""
issue: ""
assets: []
---

## Raw (owner's words — verbatim, never edited)

The cannon fight has these issues:
- Fight still can be interrupted by a rescue misson.
- Position & direction of the ship does not matter at all. All shots just hit the target.
- In SM's P (the og) in cannonball fight mode the game slows down and the screen is kind of locked. We do not need that but there should be a better experience.

TOP issues to me
- Fight issues I mentioned
- Town musics, still one tone, really? Remove them if you cannot fix it. But how hard is it to find 4-5 different free midi like music to assign to each city in this theme? COME ON!
- Still the player's ship is the only one that looks like a ship. ANd the ships to rescue are exception. Others look like pencils. Please find some more suitable ship models and make the loop deliver.
- Harbours still look like playdough. Yes the new prop additions are nice but don't we have a QA??? Is everyone going blind after playing this game for a while. Instead of adding new features let's just make the exising ones better.
- Other ships can sail through the whole islands :facepalm:
- My ship can get into many sandy beaches. I thought we fixed this.

GREAT THINGS:
- The name tags over the ship! AMAZING WORK. It's simple and looks so great! Amazing job team!
- New props around look great!
- I see how the fame system works, nice!

SUM:
- HAVE QA PLAY THE FUCKING GAME. And QA should not only test simple things. But sometimes play, go around, take screenshots and investigate. I cannot be the only one who can look at an harbour ant think the quality is so low.

## Triage log (newest at the bottom)

- 2026-07-02 — Captured. **Meta-issue = QA doesn't PLAY/investigate** (only automated gates) → obvious quality misses. Owner directive: **improve existing before adding new**. Bugs (several REGRESSIONS): fight-interrupted-by-rescue (#161 isolation incomplete), shots-always-hit / angle ignored, NPCs sail through islands, player beaches on sand (#76 regression), town music still a drone (#129 not delivered), NPC ships look like "pencils" (#144), harbours look like "playdough" (#143). **Wins to reinforce (tell the team):** ship name-tags (loved), new props, the fame system. Dispatched (a) an EXPLORATORY QA pass to reproduce+root-cause each with evidence, (b) a QA-plays-the-game doctrine codification.
- 2026-07-02 — (b) doctrine SHIPPED (commit 0bfdcac): CONSTITUTION + qa.md + rituals R3 + DELIVERY DoD 5a + ROADMAP/PRODUCT + `studio/qa/exploratory-checklist.md`. (a) exploratory QA pass still running.
- 2026-07-02 — Owner (related visual-quality item): *"Fix the martini olive flag carrier… Get rid of it."* Root-caused = the port BUOY marker in `src/ports.js` (sphere float + pole + pennant = olive-on-a-stick). → filed **#183** (from-owner P2, remove it). Folded into the exploratory QA pass for a screenshot.
