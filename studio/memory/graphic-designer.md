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

- 2026-06-27 (#55 sourcing research) — **Art-sourcing call: CC0-first, verified.** Go-to CC0
  3D = **Quaternius** + **Kenney** Pirate Kits (both confirmed CC0, glTF, no attribution
  required); HDRI/sky = **Poly Haven**; PBR surfaces = **ambientCG**; aggregator = **Poly Pizza**
  (MIXED CC0/CC-BY — check each model). **Sketchfab is mostly CC-BY** (attribution-bound) — the
  prominent "Low-Poly Pirate Ship" is CC-BY *and* 73.2k tris (too heavy); filter to CC0 + light.
  Hero ship (#32) = swap to a Quaternius/Kenney CC0 ship via `GLTFLoader` (already in the import
  map), match the contract (bow +Z, length ~16, re-attach `userData.flag`), procedural ship stays
  as fallback. Always add a `CREDITS.md` even for CC0 (manners + future CC-BY safety). Full report:
  `docs/art-sourcing.md`. Effort S–M. Caveat: public repo → CC0/self-made only for core art.
