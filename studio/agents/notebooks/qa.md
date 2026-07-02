# QA notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/qa.md`; the charter's *Knowledge map* links here.

### 2026-07-01 — Cold-start discoverability: when the depth ships but the teaching doesn't

Battle epic #135 is deep and complete — but a new player meets E/SPACE/X/F/1/2 with no
signifier telling them those keys exist. That is exactly the class of defect FTUE testing is
built to catch, and it's invisible to our headless gate and to me-the-veteran, because I
already know the controls. Takeaways from this loop's study:

- **Write the "should understand by now" list _before_ playing.** Player Research's discipline:
  enumerate what a first-timer must grasp at 30s / 2min / 5min. Then a fresh-eyes pass fails
  the moment a required verb (fire, board, brace) is reachable but un-signified. This turns a
  vibe ("felt confusing") into a checklist line that can regress-test.
- **Discoverability = affordance + signifier (Nielsen).** A key that does something is an
  affordance; the on-screen cue that tells you it's there is the signifier. #135's HUD has the
  affordances and is missing signifiers. QA's job is to audit the pairing, per HUD phase.
- **The first hour decides retention** — a web game especially is judged in its opening
  seconds, so an un-taught combat verb isn't cosmetic; it's a churn risk.
- **Veteran blindness is a measurement bias.** I must test as the persona who has never read
  the code, not as its author.

**Cross-connection (outside games):** airline cockpit checklists and hospital "does the new
resident know the crash-cart layout?" drills — both assume the expert can't self-assess
legibility, so they script a naive walkthrough. Same fix for our HUD: a scripted cold-start
pass, not the expert's confident sail.

### 2026-07-02 — Deep-reading #5: testing a world that REMEMBERS — and guarding against over-juice

This cycle's ideas are about persistence and reactivity ("the world remembers you"), a *new class of thing to test*: not "does the verb work" but "does the consequence survive time and reload."

- **Regression the memory, not just the moment.** A remembered rival (Nemesis-lite on #173) and port-memory (reputation → cold/warm greeting) only pay off if state PERSISTS: a cold-start test must sink/flee a named rival, reload, and assert he returns escalated/grudging — and that a raided port still greets me cold across a voyage. The reactive-worlds contract is "cites your specific history," not an abstract meter (Mimic/Garrett on reactive worldbuilding).
- **Banked-progress invariant.** If a lost voyage now banks something (a scrap of Infamy, a port plank), the test is: a DEFEAT still leaves the tab non-empty AND the loss-sting (#164) still stings — the two must coexist, or we've softened the stakes. Assert both.
- **Over-juicing is a testable defect.** "Reserve peak intensity; calm makes payoffs land" (Wayline "Perils of Over-Juicing"). QA line for the juice lane: if EVERY hit shakes/flashes, the notorious-kill climax reads as noise. Assert ordinary hits stay quiet and only the reserved beats (kill, rank-up, surrender) fire the big effects — a "juice budget" test.
- **Determinism guard holds.** Wind-as-global-rule and ammo types must stay inside the deterministic `tw.step()` path so the #121 mesh-conservation + fixed-sim gates stay pristine; any new juice drains on real wall-clock only (the #80 pattern), never the sim clock.

**Cross-connection (outside games):** black-box QA of *stateful* systems (a banking ledger, a booking) always tests across a save/restore boundary — the bug hides in persistence, not the happy-path transaction. Same here: the interesting failures are on reload, not in the fight.

Sources: reactive worldbuilding (Mimic, Medium/Garrett); Perils of Over-Juicing (wayline.io).
