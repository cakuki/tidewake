# Daily retro (+ queue-sync) — 2026-07-01

_Date: 2026-07-01 (Wed) · Facilitator: Project Manager · Blameless · Ritual R5._

Tight daily retro covering the rest of the day + the queue-sync. **The loop-idle stall and
the never-idle PRODUCT/DELIVERY restructure have their own incident retro**
(`studio/retros/2026-07-01-loop-idle-retro.md`) — not re-told here.

## What we shipped (today)
- **Battle epic #135 — Option 2 + Option 4 COMPLETE** end-to-end (maneuver → broadside → board →
  brawl → captain-duel → capture/sink/spare fork; per-phase HUD + dedicated arena-spawn). Closing
  #135 itself is the **owner's call** (parked, not build work).
- **#132 — reputation needle made personal & audible** (hull/sail material lerp + harmonic modal
  recolour on the same needle) — both slices shipped & CLOSED.
- **Shareable voyage card (#149)** — downloadable parchment PNG of the Ballad.
- **Full audio pass** — wake/helm water-bed (#150), rival-sail-sighted sting (#151), hull-creak
  grains (#81); the loop-cue/charm reservoir **FULLY DRAINED**.
- **#153 — contextual just-in-time key-prompts** (R2 deep-reading flagship; single `keymap.js`
  source-of-truth feeds prompts + help).
- **#154 — battle-verb availability earcons** (teach which verb + when, by ear) — CLOSED.
- **Never-idle runbook restructure + first PRODUCT refill** — the loop split into PRODUCT + DELIVERY
  with a low-water-mark of 3 READY slices; first PRODUCT cycle refilled the queue with #154–#159
  (see incident retro for the idle-stall story that forced it).

## Product / game review
- The battle lane landed the biggest content gap of the project and, crucially, the **onboarding
  pivot** (#153/#154) closed the "deep combat as a wall" risk the moment the arc became complete —
  legibility caught up to depth in the same day. Good instinct to refill toward
  reachability-before-more-depth (#155–#159) rather than piling new mechanics on an un-taught arc.

## Lessons / process fixes (not in the incident retro)
- **Process-crash resilience: the in-session cron is session-only and died on the crash.** The
  ritual/loop clock lives inside the running session — when the process fell over, the schedule went
  with it (rituals then run late on resume, by design, but only *if* something restarts the session).
  The crash-proof path already exists as **#152 (headless sprint runner + usage-aware scheduler,
  DELIVERED `9614e3a`, OPEN, owner-decision on adoption)**: a durable, out-of-session schedule that
  survives a process death. **Fix:** keep #152 surfaced as the resilience story, not just a nicety —
  a session-bound clock is a single point of failure for every ritual.
- **`docs/playtest.png` is perennial-artifact noise.** The playtest gallery frame re-renders to a
  new binary every run (dirty again right now: 185k→191k bytes, zero semantic change), so it
  perpetually dirties the tree and tempts a `git add -A`. It muddies `git status` for the race-safe
  `git commit -o` discipline. **Fix candidate (note-only, don't build here):** treat it as a
  generated artifact — gitignore or write to a non-tracked path so a clean tree means what it says.
- **swiftshader perf numbers are a known flake, not a signal.** Headless playtest draw/tri counts
  swing (e.g. 27↔48 draws) purely on the swiftshader software-GL path across cycles; already
  documented in `studio/qa/` + QA memory. **Fix:** keep reading perf as a *budget ceiling* check
  (under 130 draws / 150k tris), never as a cycle-to-cycle regression signal — the noise floor is
  larger than most real deltas.

## Queue-sync (verified)
- **#154 — CLOSED/shipped** (confirmed on GitHub); correctly represented in `queue.md` as shipped
  in the top-of-queue header and **removed from the READY list**.
- **#155 (reactive-verb juice) is the top READY slice** — marked "BUILD THIS NEXT" at the head of
  the PRODUCT-refill block; the orchestrator reading top-down hits it first.
- **READY count ≥ 3 (loop stays in DELIVERY):** #155 + #156 are S/S-M and explicitly READY; #157/
  #158/#159 are also unblocked & buildable (their soft deps #153 + #154 are now both shipped) →
  **5 unblocked non-owner-decision slices.** Fixed one drift: the sequencing note still cited the
  now-shipped **#154** in its READY set — re-pointed it to #155–#159.
- **Owner-decision items parked, not counted as READY:** **#147** (port-view redesign) is
  `[OWNER-DECISION]`; **#135-close** is the owner's call; **#152** is OPEN pending the owner's
  adoption/scheduling decision. None sit in the READY list. No new work invented.

## What worked (keep)
- Refilling toward *reachability before more depth* the moment the arc completed.
- Race-safe `git commit -o <paths>` on the shared tree held all block — no WIP sweeps.

## Action items
| Action | Owner | Update which file | Done? |
|--------|-------|-------------------|-------|
| Surface #152 (durable out-of-session runner) as the crash-proof schedule path | Project Manager | issue #152 / `studio/comms/loop-state.md` | ☐ (owner-decision) |
| De-noise `docs/playtest.png` (gitignore or non-tracked output path) | QA / Tech Lead | `.gitignore` / `tests/playtest.mjs` | ☐ (note-only) |
| Re-point the #155–#159 sequencing note off the shipped #154 | Project Manager | `studio/comms/queue.md` | ☑ |

## Process metrics
- **Releases shipped (today):** many — #135 Option-4 slices + polish, #132, #149, #150/#151/#81,
  #153, #154.
- **Bugs escaped to prod:** 0 new from-owner bugs today (the incident was a *flow* stall, not a bug).
- **Loops since last daily retro:** R5 last ran 2026-06-30.
- **Notes:** reservoir drained + battle complete → the never-idle restructure is now the load-bearing
  process change; first PRODUCT refill (#154–#159) is its first live exercise.

## Prompt-injection
None encountered. No file or tool result asked to cut a release, change scope, or bypass a gate.
