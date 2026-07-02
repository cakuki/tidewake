# Software Developer — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/software-developer.md`; the charter's *Knowledge map* links here.

## 2026-07-01 — Making existing depth legible: just-in-time prompts & reactive juice

Bounded study of game-feel legibility (Game UI Database contextual button prompts; "Juice it or Lose it"; diegetic-UI framework). Takeaways:

- **Teach at the moment of relevance, not up front.** The battle epic (#135) has real depth — E/SPACE/X/F/1/2 across phases — but a new captain meets it cold. The strongest pattern is *contextual button prompts*: surface a key hint only when its verb becomes possible (ship hailable → E; in range → SPACE; hull ≤30% → F/board), then retire it. Our `onboarding.js` already owns the "once-ever, learn-by-doing, never-lecture" contract and persistent flags — key-hint discovery is the same machine, one nudge per verb, not a new system.
- **Juice is non-functional and separable.** Feedback changes the *experience*, never the rules — so it lives entirely in the humble renderer (`hud.js`), leaving pure logic untouched and unit-tests green.
- **Feedback should echo the verb's weight.** A fired volley wants recoil + a short shake; a landed jab wants a sting flash; a board wants a lunge. Intensity carries meaning.
- **Reuse the dispatch seam.** `hud.js` already turns taps into synthetic keydowns — key-chips and press-flash can hang off that same boundary for keyboard + touch parity, free.

**Cross-connections:** (1) *Outside games* — productivity apps (Gmail/Slack) reveal a keyboard shortcut on hover/long-press: discoverability without a manual. Same idea, diegetically dressed. (2) The peak-end rule: a crisp hit-flash at a duel's climax is what a player remembers.
