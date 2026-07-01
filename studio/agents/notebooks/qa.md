# QA notebook

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
