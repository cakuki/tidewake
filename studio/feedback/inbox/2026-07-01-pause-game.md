---
id: 2026-07-01-pause-game
date: 2026-07-01
type: feature
status: accepted
value: "Basic QoL/control — freeze the action and resume. Useful any time (step away, catch your breath), and especially while combat readability is in flux."
feasibility: "S. The sim has a deterministic step(seconds) hook (window.__tidewake.step) + a central update loop — gate the sim advance on a paused flag, duck/pause audio, show a PAUSED overlay, resume in place. Distinct from town-mode's partial pause (#95). Keep the headless gate's direct step() path unaffected."
decision: "Accept — small BAU-friendly slice. Filed from-owner."
issue: "https://github.com/cakuki/tidewake/issues/160"
assets: []
---

## Raw (owner's words — verbatim, never edited)

Feature request: pause game

## Triage log (newest at the bottom)

- 2026-07-01 — Captured. Simple QoL. PM+TL sketch: S, low risk — a global pause (freeze sim + overlay + resume), distinct from the mode system's partial pauses. Filed from-owner.
