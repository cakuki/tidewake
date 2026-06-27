---
id: 2026-06-27-mobile-hud-overlap
date: 2026-06-27
type: bug
status: accepted
value: "Mobile playability blocker: overlapping touch buttons make the town/trade screen unusable on a phone — directly undermines the iOS/mobile push (#63, #56). Hits every phone player, every dock."
feasibility: "TL: S. Pure CSS z-order/layout collision in index.html — fixed-px touch clusters (.tc-throttle/.tc-steer/.tc-action, z13) sit over the #trade panel (z11) and steal taps. Fix: hud.js renderTrade toggles body.classList('docked', !!port) (and a 'duelling' class); CSS hides the nav/duel touch clusters while docked — which also serves the auto-harbor 'disable navigation' goal. NOTE: touch controls live on main (#17, commit 324f770), not in the pm-desk tree."
decision: "ACCEPT P1 — owner accepted. Hide nav/duel touch clusters while docked (body.docked) + responsive positioning."
issue: "https://github.com/cakuki/tidewake/issues/66"
assets:
  - studio/feedback/assets/2026-06-27-mobile-hud-overlap-iphone12.jpeg
---

## Raw (owner's words — verbatim, never edited)

In iPhone12 buttons overlap the town view.

## Triage log (newest at the bottom)

- 2026-06-27T00:00Z — Captured at PM desk (mobile dump). status: raw. Screenshot (iPhone12, build
  v0.0.20260627113504): the steer/throttle ▲▼◀▶ touch buttons and the duel (crossed-swords) button
  overlap the "Gullet's Rest" trade panel — controls and the town/trade view collide. Direct mobile
  evidence for [[2026-06-27-mobile-support-feasibility]] / responsive-HUD work. Pinned under assets/.
- 2026-06-27T00:00Z — PM value note + TL feasibility recorded. status → assessed. PM recommendation:
  **ACCEPT P1** (mobile blocker, tiny fix; dovetails with [[2026-06-27-auto-harbor-on-approach]] and
  the #53 self-contained-UI standard). PM does not self-accept.
- 2026-06-27T00:00Z — Owner DECISION: **accept** ("accept all"). Issue #66 created. status → accepted.
  Added to ROADMAP M4/UX. Proposed P1 for loop PM+TL sign-off. Dovetails with #67's nav-disable.
