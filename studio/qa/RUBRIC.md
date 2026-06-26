# Tidewake QA Rubric — production-quality scoring

Score the loop's **screenshot set** (spawn, sailing at speed, mid-turn with wake, near an
island, second camera angle) against the dimensions below. The point is to make "good"
**measurable and comparable across releases** — and to catch quality sliding backward.

Capture shots in a real browser via **Chrome DevTools MCP** (`take_screenshot`); the headless
swiftshader renderer draws the 3D scene dark, so it cannot be used for visual scoring.

## Scoring scale (per dimension)
- **5** — Excellent; ships with pride.
- **4** — Good; minor nits.
- **3** — Acceptable; works but unremarkable.
- **2** — Weak; noticeable problems.
- **1** — Broken/embarrassing.

## Dimensions
| # | Dimension | What to look for |
|---|-----------|------------------|
| 1 | **Composition / readability** | Horizon, framing, contrast; the scene reads at a glance; no clutter or void. |
| 2 | **Art consistency & tone-fit** | Realistic sea/sky/light **and** warm swashbuckling-comedy charm; coherent palette; original (no franchise lookalike). |
| 3 | **Visual juice / feel** | Wake foam, motion, light, response — does it feel alive and satisfying at speed and mid-turn? |
| 4 | **Performance (fps / jank)** | Frame rate in budget; no stutter, tearing, or pop-in in the captures/play. |
| 5 | **UI clarity** | HUD readable instantly; heading/speed/version legible; charm without muddiness. |
| 6 | **Better-or-not-worse than last release** | Compared to the previous gallery shot, has anything regressed? |

## The regression rule
1. Open the previous release's image in `studio/qa/gallery/` next to today's set.
2. Score all six dimensions.
3. **If any dimension scores below last release (or below 3), file a `bug` issue** with both
   shots attached and route it to the owning role (Graphic Designer / Sound Engineer / Dev).
4. A regression on a core dimension is grounds to **block the release** — escalate to PM.

## Recording the score
Note the per-dimension scores + the overall verdict in the build's release-notes handoff to
PM, and keep the durable lesson in `studio/memory/qa.md`. Archive the representative shot to
`studio/qa/gallery/<version-tag>.png`.
