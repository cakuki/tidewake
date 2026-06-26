# Tidewake QA Checklist — living test instructions

The accumulating QA test cases. **Walk this top to bottom every loop**, in a real browser
(Chrome DevTools MCP — the headless swiftshader renderer draws the 3D scene dark, so visual
checks need a real browser). Capture the screenshot set as you go (see `RUBRIC.md`).

This list **only grows**. Every bug we fix becomes a permanent case here so it can never
silently come back.

## How to add a case
When a bug is found and fixed, append a new numbered case under the right section with:
- **what to do** (the repro/steps), **expect** (the correct behaviour),
- a `since:` note with the issue/PR or version where the bug was caught.

Never delete a case. If a feature is removed, mark the case `~~retired~~` with a date and why.

---

## Boot & stability
1. **Boots clean** — load the build; the console shows **no errors/exceptions**. _(seed)_
2. **Canvas is not black/void** — the ocean + sky render; the viewport is not a black/empty
   void. _(seed — guards the early "black ocean" bug)_
3. **Version stamp correct** — the on-screen version matches the deployed tag
   `v0.0.YYYYMMDDHHmmSS`. _(seed)_

## Ship movement & controls
4. **Ship accelerates and moves** — apply throttle; the ship gains speed and changes position. _(seed)_
5. **Steering changes heading** — steer left/right; the heading changes. _(seed)_
6. **Throttle alone does NOT change heading** — full throttle, no steering input → heading
   holds steady (only steering turns the ship). _(seed — guards drift/coupling regressions)_

## Sea, wake & world
7. **Wake foam at speed** — sailing at speed, foam/wake appears behind the ship. _(seed)_
8. **No wake at rest** — stationary, the wake foam is absent. _(seed)_
9. **World renders** — islands, sky, and HUD are all present on screen. _(seed)_

## HUD & feedback
10. **HUD updates live** — heading and speed readouts change as the ship turns and accelerates. _(seed)_

## Performance
11. **FPS reasonable** — frame rate stays in budget (no obvious jank/stutter while sailing). _(seed)_

## Audio _(add cases as the audio system lands)_
- _(none yet — Sound Engineer/Musician work not shipped)_

---

_Regression cases from fixed bugs go below their matching section above, newest `since:` noted._
