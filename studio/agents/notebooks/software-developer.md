# Software Developer — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/software-developer.md`; the charter's *Knowledge map* links here.

## 2026-07-01 — Making existing depth legible: just-in-time prompts & reactive juice

Bounded study of game-feel legibility (Game UI Database contextual button prompts; "Juice it or Lose it"; diegetic-UI framework). Takeaways:

- **Teach at the moment of relevance, not up front.** The battle epic (#135) has real depth — E/SPACE/X/F/1/2 across phases — but a new captain meets it cold. The strongest pattern is *contextual button prompts*: surface a key hint only when its verb becomes possible (ship hailable → E; in range → SPACE; hull ≤30% → F/board), then retire it. Our `onboarding.js` already owns the "once-ever, learn-by-doing, never-lecture" contract and persistent flags — key-hint discovery is the same machine, one nudge per verb, not a new system.
- **Juice is non-functional and separable.** Feedback changes the *experience*, never the rules — so it lives entirely in the humble renderer (`hud.js`), leaving pure logic untouched and unit-tests green.
- **Feedback should echo the verb's weight.** A fired volley wants recoil + a short shake; a landed jab wants a sting flash; a board wants a lunge. Intensity carries meaning.
- **Reuse the dispatch seam.** `hud.js` already turns taps into synthetic keydowns — key-chips and press-flash can hang off that same boundary for keyboard + touch parity, free.

**Cross-connections:** (1) *Outside games* — productivity apps (Gmail/Slack) reveal a keyboard shortcut on hover/long-press: discoverability without a manual. Same idea, diegetically dressed. (2) The peak-end rule: a crisp hit-flash at a duel's climax is what a player remembers.

## 2026-07-02 — Deep-reading #5: systemic combat texture + fear-you-can-SEE, all derived (no save bump)

Post-RISE, the highest-leverage code is *presentation/logic derived from state we already persist* — deepening feel without a #122 migration.

- **Ammo-type pick = a pure choice threaded through existing math.** Round / chain (shreds sails → slows, can't flee) / grape (thins crew → tilts boarding). Lives as a pre-volley enum consumed by `resolveBroadside`/boarding; combat math stays unit-tested and byte-identical when the default (round) is chosen. Legible skill choice, no new mechanic. **M.**
- **Localized damage as three pips, not a sim.** Split the foe's single HP read into hull (sink) / sails (speed) / crew (boarding) — three quick pips over the existing over-ship billboard (#161-s3 / #165 pooled labels, 0 draw cost). *Where* you hit now matters alongside *the angle*. Keep fights short so it stays crunchy, not a spreadsheet. **M.**
- **Fear you can SEE on your OWN ship.** Render Infamy on the hull the way deck-cannons show in THE RISE (#170): black sails / trophy flags / a fiercer figurehead, DERIVED from the persisted infamy value (no save bump), and a bad loss visibly strips a trophy. Instanced/pooled, cheap. Fame you can see and lose. **S.**
- **Juice: stack redundant channels on the ONE moment (Vlambeer "Art of Screenshake").** The notorious kill already slow-mos — layer a barrel recoil-jolt, a lingering pooled splinter cloud (permanence), and one pitch-randomised crack on the SAME beat via the existing shake bus. Renderer-only, logic/tests untouched. **S.**

**Cross-connection:** the recoil/splinter stack is the peak-end rule again — the kill is what the player carries out of the fight; make that single frame the juiciest thing on screen.

Sources: Art of Screenshake (Nijman, archive.org); Skeleton Code Machine (naval damage models); Sea of Thieves notoriety (SoT forums).
