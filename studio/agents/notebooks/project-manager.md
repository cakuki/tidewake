# Project Manager — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/project-manager.md`; the charter's *Knowledge map* links here.

## 2026-07-01 — Deep-reading: making shipped depth legible (flow-of-teaching)

The battle epic (#135) is deep but silent — a wall of keys (E/SPACE/X/F/1/2) with no way in. Craft study on onboarding + slicing converges on one PM-relevant idea: **teaching is itself a flow problem, and it should be sliced vertically, not front-loaded.**

- **Just-in-time beats front-loading.** The strongest onboarding pattern is contextual: introduce one mechanic *at the moment the player needs it*, never a manual up front. Northgard-style contextual tips appear on the triggering event and don't block progress. Our per-phase battle HUD is already the perfect surface — the phase *is* the teachable moment.
- **Progressive disclosure = show only the verbs reachable now.** Reveal the current phase's key, hide the rest. This maps cleanly onto our existing phase state; no new system, just gating a prompt on `mode`/phase.
- **If it takes 3 slices before value appears, you sliced wrong.** Legibility work should be a vertical ladder — one key, one phase, playtested and shipped — not a "tutorial epic." Each slice is independently valuable: a new player can do *one more thing*.
- **Cross-connection (outside games): airport wayfinding.** Good signage never shows the whole terminal map at the entrance; it reveals only the next decision at each junction. Same discipline — legibility delivered *at the decision point*, spaced over the journey, not dumped at the door.

Wildcard steering note: sequence teaching by *first-encounter order*, so the ladder's order is discovered from playtest, not guessed.
