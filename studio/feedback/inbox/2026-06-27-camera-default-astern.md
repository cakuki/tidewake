---
id: 2026-06-27-camera-default-astern
date: 2026-06-27
type: feature         # bug | feature | idea | feedback
status: accepted      # raw | triaging | needs-clarification | assessed | accepted | parked | declined
value: "Tiny fix, daily friction removed — every new session currently forces a manual ~180° drag before the player can sail comfortably; the chase view (camera astern, looking over the bow) is the expected default. Pure UX win for every player, every session."
feasibility: "TL: S (≈ one line). Cause: input.js default camYaw = Math.PI places the camera ahead of the bow looking back; the offset isn't persisted so it resets each session. Approach: set default camYaw = 0 → camera sits astern, lookAt faces forward over the bow; drag-to-orbit still works from there. Minimal/reversible, single consumer (sailing.js). Worth a small QA assertion that the camera sits behind the ship."
decision: "ACCEPT — P1 quick UX win (one-line default). Owner accepted in decisions round."
issue: "https://github.com/cakuki/tidewake/issues/49"
assets: []            # paths under studio/feedback/assets/
---

## Raw (owner's words — verbatim, never edited)

Start the navigation from the back of the ship. I have to change the view with mouse in each new session.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (bulk dump, paragraph 4 of 5). status: raw. Small default-camera
  ask: each new session should open with the camera astern (looking forward over the bow) rather than
  forcing a manual drag-to-orbit. Awaiting owner go-ahead before triage.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded (see frontmatter). status → assessed.
- 2026-06-27T00:00Z — PM recommendation: **ACCEPT** (P1 quick win — one-line default change). Awaiting
  owner decision. PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept**. Issue #49 created
  (https://github.com/cakuki/tidewake/issues/49). status → accepted. Added to ROADMAP M1. Proposed
  priority P1 logged on the issue for loop PM+TL sign-off.
