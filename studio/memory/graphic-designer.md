# Graphic Designer — long-term memory

Durable art-direction decisions and asset notes. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: all visuals are three.js primitives + shaders. Ship is a
  box-hull placeholder; world is a sky dome, scattered island shapes, and fog.
- 2026-06-27 — **Palette/mood (v0)**: horizon haze `#9ec6d8`, warm sun, teal shallows
  `#4fb4cc` → deep `#16607f`, sky `#bfe0ee`→`#2b6aa3`. Rule: never show void-black.
- 2026-06-27 — **Direction contract**: realistic atmospheric sea/light; expressive,
  slightly exaggerated, hand-crafted charm for ships/characters/UI. Original, no franchise lookalikes.
- 2026-06-27 — **First priorities**: plan the placeholder→real-art path (glTF sloop within
  budget); set up `assets/` license-attribution discipline before sourcing anything.
- 2026-06-27 — **Asset sources (CC0, license-clean)**: Quaternius + Kenney Pirate Kits (glTF,
  CC0, ships+characters), Poly Haven HDRIs/skies (CC0). Stylised sea = Gerstner displacement +
  depth-difference shoreline foam + animated Voronoi noise (no FFT). Cheap charm = Fresnel rim
  light, vertical gradient sky dome, FBM height fog, toon gradientMap on characters only.
- 2026-06-27 — **AI texturing**: free text→PBR (AITextured/GoEnhance/ZSky) for one hero material
  at ≤1K, baked/atlased; check per-tool output license before shipping.
- 2026-06-27 (DL#2) — **NPR is a direction, not a filter**: keep sea/sky PBR-realistic; reserve NPR
  (toon `gradientMap` banding, rim light, ink outlines, watercolour colour-bleed) for ships/characters/UI
  — the warm-charm half. 2025 AI/diffusion toon-shading is offline-only, not runtime.
- 2026-06-27 (DL#2) — **Stylised water is layered + a CPU height-mirror for buoyancy**: 2025 kits =
  Gerstner swell silhouette + 1–3 separate foam layers (whitecap/ambient/shoreline) + foam tied to
  wake/surface-compression, plus a cheap CPU mirror of the wave function so the ship pitches/rolls with
  the sea. The CPU mirror is the top charm-per-byte hull upgrade and is no-build math, not a shader rewrite.
- 2026-06-27 (DL#2) 🎨 **Wildcard — "the living chart"**: render the #54 map as a weathered watercolour
  sea-chart (parchment grain, inked coastlines, drifting watercolour sea, compass rose, a self-writing
  dotted rhumb-line wake). Separate render target = freedom to be painterly without breaking world
  realism; realism outside, painted chart within. → filed.

- 2026-06-28 (DL#3) — **TOWN-mode visual identity (mode system landed).** Today TOWN is just a HUD
  banner + bell + DOM market panel over a still-sailing sea — no world identity. Asset-light, reactive
  to the `mode` flag (`src/mode.js`), driven off the `onChange(TOWN)` seam already wired in main.js:
  (1) tween one `townBlend` 0→1 uniform that warms fog + lifts exposure and eases the camera to a
  moored "ashore" framing — mode change as a felt *settle*, not a panel reveal; (2) bias light toward
  **golden-harbour** (lerp sun colour/elevation/ambient via `daynight.js`) — different light = different
  place; (3) **calm the water** — lerp swell amplitude (`swell.js`/`ocean.js`) toward a "moored" glassy
  value + stop the wake (helm paused → reactive verb); (4) additive **lantern dots** (`Points`) on the
  docked island, opacity = townBlend × nightness, so the settlement glows up at dusk. 🎨 Wildcard —
  **"harbour diorama"**: tilt-shift miniature (vignette + focus band + edge desaturation) gated on
  `mode.is(TOWN)` to snap open-horizon *passage* into intimate *place*; pair with a procedural quayside
  CSS skin on `#town` (woodgrain/parchment gradients, no images). Dedup-clean vs DL#1/#2. → filed.
- 2026-06-27 (#55 sourcing research) — **Art-sourcing call: CC0-first, verified.** Go-to CC0
  3D = **Quaternius** + **Kenney** Pirate Kits (both confirmed CC0, glTF, no attribution
  required); HDRI/sky = **Poly Haven**; PBR surfaces = **ambientCG**; aggregator = **Poly Pizza**
  (MIXED CC0/CC-BY — check each model). **Sketchfab is mostly CC-BY** (attribution-bound) — the
  prominent "Low-Poly Pirate Ship" is CC-BY *and* 73.2k tris (too heavy); filter to CC0 + light.
  Hero ship (#32) = swap to a Quaternius/Kenney CC0 ship via `GLTFLoader` (already in the import
  map), match the contract (bow +Z, length ~16, re-attach `userData.flag`), procedural ship stays
  as fallback. Always add a `CREDITS.md` even for CC0 (manners + future CC-BY safety). Full report:
  `docs/art-sourcing.md`. Effort S–M. Caveat: public repo → CC0/self-made only for core art.
- 2026-06-28 — **Battle system #135 (Option 2 → 4) is the focused lane — it needs a visual grammar.**
  Each battle slice wants art that reads instantly and stays perf-cheap: a clear **"BATTLE" mode banner**,
  a distinct **quarter-view battle camera** feel, **smoke / muzzle-flash / impact juice** (event-tied,
  short, toggle-able — pairs with juice pass #80), and readable **boarding / crew-brawl** staging.
  Workshop loadouts (cannons/ammo) and the town **workshop** can dress from the greenlit **CC0 Pirate
  Kit props (#101)** riding #32's loader. Keep the **sunny Caribbean vibe (#61)** intact — combat juice
  must not darken the palette. CC0/self-made only (public repo); `CREDITS.md` always.
- 2026-06-28 — **Delivery doctrine applies to art too:** ship art in **small, testable slices** with a
  human-in-the-loop check (owner) when "does it look right?" can't be auto-verified; stay on the battle
  lane's visual needs until it lands something impressive + gamer-testable before switching lanes.
- 2026-06-28 — **Standing owner order (#143): improve visuals + source style-matched free models EVERY
  loop.** This is now a per-loop habit (≥1 visual win or vetted model swap each GfxD loop), not just the
  one-off #32/#101. I own the sourcing+integration: hunt CC0 (Quaternius/Kenney first per
  `docs/art-sourcing.md`), filter to **light + CC0/self-made for core art** (public repo; CC-BY only
  with `CREDITS.md`; no NC/ND), keep **original silhouettes**, **perf-budget** tris/draw-calls (#52),
  match the **sunny Caribbean** look (#61), integrate via `GLTFLoader` to the ship contract. Always
  `CREDITS.md`. Under Art & Audio epic #6.
