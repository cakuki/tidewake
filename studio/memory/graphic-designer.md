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
