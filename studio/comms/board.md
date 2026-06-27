# Tidewake board — current loop

Loop-local kanban. Mirrors GitHub issues; Project Manager keeps it in lockstep.
Keep `Doing` small (limit WIP). Cards: `#issue — short title — owner`.

> **Loop 0** bootstrapped v0: a playable sloop on an animated sea with islands, plus the
> auto-release pipeline and this studio structure. **Loop 1** will be planned from GitHub
> issues — Product Manager prioritises, Project Manager + Tech Lead refine before building.

## Backlog (top)
- Give sailing a *point*: a first destination/port with a payoff (PM to slice).
- Placeholder → real glTF sloop within budget (Graphic Designer + Tech Lead).
- Grow the playtest + a manual smoke checklist (QA).

## To do (this loop)
- _(Loop 1 not yet planned — populate from prioritised issues.)_

## Doing
- _(empty)_

## Done
- Loop 0: v0 shipped — playable build + auto-release + studio structure.
- Loop 27: #59 Cannon Broadside — open fire (G) alongside the Insult Broadside duel; closed, depth follow-up #72 filed (v0.0.20260627130215).
- Loop 28: #63 Mobile MVP — installable PWA (manifest + brass-anchor icons, Add-to-Home-Screen) + heat-aware DPR cap atop existing touch controls/responsive HUD; closed. Follow-ups #74 (SW offline) + #75 (safe-area/landscape/low-end polish); docked overlap tracked in #66 (v0.0.20260627131832).
- Loop 29: PWA top-notch safe-area (owner request, §3c) — swept `env(safe-area-inset-*)` onto every top-anchored HUD element so nothing hides under the notch/status bar in standalone; also fixed the ≤560px media-query `#title` rule. #75 safe-area-top item done (partial; landscape/home-indicator/low-end remain) (v0.0.20260627133536).
- Loop 30: #73 Settings/options panel — self-contained `src/ui/settings.js` (per #53) with a ⚙ button / O key opening a ship's-brass control plate that renders feature toggles from a one-line registry. Ships **Sound** (live-backed by audio mute) + **Spyglass readout** (perf overlay, persisted); defaults keep the current look, weather #58 plugs in next. Persisted to localStorage, TDD'd (+11 tests = 260), playtest drives it. Closed #73 (v0.0.20260627135021).
- Loop 31: #76 **a1** Arcade island collision — islands now STOP the ship (no more phasing through land), soft & arcade-y. Pure `src/physics.js` resolver: forgiving circle hitboxes, radial push-out + slide along the coast, swept (no tunnelling), speed bled to ground-speed-made; docking preserved. Comic "Scraaape…" run-aground banner. +8 TDD tests (268); playtest asserts non-penetration; perf unchanged. **#76 stays OPEN** — remaining: (c) harbour/fight slow-to-stop, (b) ship-vs-ship, (a2) slide polish (v0.0.20260627140435).

## Blocked
- _(empty)_
