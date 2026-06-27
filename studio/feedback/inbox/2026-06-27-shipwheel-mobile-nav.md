---
id: 2026-06-27-shipwheel-mobile-nav
type: idea
status: accepted
source: owner channel (Telegram), 2026-06-27 16:18
assets: []
issue: https://github.com/cakuki/tidewake/issues/93
value: "Mobile feel: a draggable brass wheel is both easier (one continuous control vs two taps) and more fun/on-theme than L/R buttons — lifts the phone experience now the PWA installs. High value."
feasibility: "TL: S–M, risk Low. Camera-coexistence (owner's worry) is already structurally solved — orbit binds pointerdown on the canvas, touch controls live in a separate #touch-controls layer that preventDefault(), so a wheel placed there owns its region for free. src/ui/wheel.js per #53 (pure angle→rudder helper + thin DOM factory) replacing the data-hold a/d cluster; setPointerCapture + preventDefault; first slice maps drag to existing held a/d keys (zero physics change), proportional steerAxis as fast follow."
---

## Raw (verbatim)
> "Navigation could be more fun and easy for mobile though. I'll explain more later but a ship wheel would be nice for example."

## Triage log
- 2026-06-27 — Captured. Owner explicitly said **"I'll explain more later"** → holding at
  `needs-clarification`; do NOT design/build until he elaborates. Direction: make **mobile
  navigation more fun + easier**, with a **ship's-wheel** steering control as one example (likely a
  draggable on-screen wheel for touch steering, replacing/augmenting the current touch buttons).
- Related: mobile touch HUD (#75 polish), and the existing touch controls shipped in #63.
- 2026-06-28 — **Owner elaboration (PM desk).** Verbatim direction: *"instead of two buttons it'd
  be nice to rotate a ship steering wheel ⚙️. Not on whole screen as it's for camera but a specific
  place could have a wheel image which player can rotate."* → Scope is now clear:
  - **Replace the two L/R steer buttons** with a single **rotatable wheel widget** the player drags
    to turn; wheel *angle* maps to rudder/heading rate.
  - **Anchored to a specific HUD spot** (a fixed control zone), **NOT** a full-screen gesture —
    full-screen drag stays reserved for the **camera orbit**. So the wheel must own its own touch
    region and not fight the camera.
  - Visual: an actual **wheel image** that rotates with the drag (readable, on-theme brass/wood).
  status → `triaging`.
- 2026-06-28 — **TL feasibility + owner GO.** TL confirmed camera coexistence is already solved by the
  DOM-layer separation (low risk). Owner's blanket GO (2026-06-28, "unblock all topics") covers mobile
  nav. **ACCEPTED P2** → tracked on **#93** (async desk already filed this from-owner 2026-06-27; my duplicate #98 closed, TL feasibility folded into #93). status → accepted.

## Value (preliminary)
Mobile feel is a fresh owner focus now the PWA is installable; better touch steering directly lifts
the phone experience. Pending the owner's fuller explanation to scope properly.
