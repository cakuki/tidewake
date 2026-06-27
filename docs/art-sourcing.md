# Art-asset sourcing — strategy, sources & recommendation

**Issue:** [#55](https://github.com/cakuki/tidewake/issues/55) (research) · unblocks [#32](https://github.com/cakuki/tidewake/issues/32) (hero-ship glTF)
**Author:** Graphic Designer + PM · **Date:** 2026-06-27 · **Status:** research complete
**Audience:** Tidewake studio designers + devs.

Tidewake ships **zero image/model assets today** — the world is 100% procedural (see
`src/ship.js`). This doc surveys real, citable, permissively-licensed sources of low-poly
age-of-sail 3D models, weighs cost vs. effectiveness, and recommends an approach for the
**hero ship (#32)**. Licensing rules from `studio/CONSTITUTION.md`: prefer **CC0**, **original
work only**, **never imitate a named commercial franchise** (applies to AI prompts too), and
this is a **public repo** — every shipped asset must be license-clean and attributable.

---

## The stack constraint (read before sourcing)

- **No build step.** Static ES modules on GitHub Pages, three.js via CDN **import map**
  (`three@0.160.0`, `index.html` line ~527). A model must be a small **glTF/GLB** fetched at
  runtime from `assets/` (in-repo) or a CDN.
- **Loader is already available** — no new dependency: `three/addons/loaders/GLTFLoader.js`
  resolves through the existing import map (and `DRACOLoader.js` if we ever compress).
- **Perf budget:** 130 draws / 150k tris total; current build sits at **77 draws / 85.2k tris**.
  A hero ship should be **one (or a few) draw calls and a few-thousand tris** — well within
  budget. Watch file size too (keep the GLB small; `assets/` is in-repo).
- **Integration contract** the procedural ship satisfies and a glTF must match: **bow toward
  +Z**, overall **length ~16 units**, masthead ~22 units up, and a child `Group` exposed as
  `group.userData.flag` (animated by `sailing.js`/`main.js` for the pennant flap). A swapped
  model needs scaling/orienting to this and a re-attached flag node.

---

## Sources surveyed (verified 2026-06-27)

| Source | License (exact) | Format | Style fit | Attribution | Notes |
|---|---|---|---|---|---|
| **Quaternius — Pirate Kit** ([link](https://quaternius.com/packs/piratekit.html)) | **CC0** (public domain) | **glTF**, FBX, OBJ, Blend | Excellent — sunny, chunky low-poly, animated | **None required** (we credit anyway) | 71 models w/ textures+anims (Nov 2023). Verified CC0 on source page. |
| **Kenney — Pirate Kit** ([link](https://kenney.nl/assets/pirate-kit)) | **CC0** (public domain) | glTF/OBJ/FBX (Kenney standard) | Excellent — flat-colour, ultra-low-poly, very lightweight | **None required** | Tags incl. `boat`/`ship`; game-ready stylised kit. Verified CC0. |
| **Poly Pizza** ([link](https://poly.pizza/search/pirate%20ship)) | **MIXED — per-model** (CC0 *and* CC-BY) | GLB download | Good — aggregates Quaternius/Kenney/Poly-by-Google + others | **Depends on model** | Convenient hub, but **must check each model's licence**; not uniformly CC0. |
| **Sketchfab** (CC0 collections, e.g. [plaggy CC0](https://sketchfab.com/plaggy/collections/cc0-public-domain-free-models-c1af6539a9ee49f4b3d51fabd6c25a85)) | Mostly **CC-BY**; some **CC0** | glTF (auto-convert) | Varies; many high quality | Usually **required** | Filter to CC0 only. The prominent "Low-Poly Pirate Ship" (Greggory_Fisher) is **CC-BY** and **73.2k tris** — attribution-bound *and* too heavy for a hero hull. Avoid unless CC0 + light. |
| **Khronos glTF-Sample-Models** ([link](https://github.com/KhronosGroup/glTF-Sample-Models)) | Mixed (mostly permissive) | glTF/GLB | N/A (not pirate) | Per-model | Use only to **smoke-test the GLTFLoader path**, not for shipping art. |
| **awesome-cc0** ([link](https://github.com/madjin/awesome-cc0)) | Index of CC0 sources | — | — | — | Meta-list; handy for future CC0 hunting (textures, audio, models). |

**Honesty note on licences:** CC0 = public domain, **no attribution legally required** (we
attribute as courtesy + good open-source hygiene). CC-BY = **attribution legally required** —
fine to use if we credit correctly, but it adds an obligation we'd rather avoid for the hero
asset. Poly Pizza and Sketchfab are **mixed**; never assume CC0 — confirm on the individual
model page before download. (Textures/skybox for #55's build spike: **Poly Haven** HDRIs and
**ambientCG** PBR surfaces are CC0 — out of scope here but the same rules apply.)

---

## Cost vs. effectiveness

| Option | $ cost | Effort | Style fit | Perf | Verdict |
|---|---|---|---|---|---|
| **Download CC0 kit ship** (Quaternius/Kenney) | **$0** | **S–M** | High (matches sunny low-poly) | Excellent (few-k tris, 1–few draws) | ✅ **Recommended** |
| Improve procedural ship (`src/ship.js`) | $0 | S each pass | Already coherent | Already good | ✅ **Fallback / parallel** |
| Commission / paid marketplace | $5–50+/asset | M (sourcing+licence vetting) | Variable | Variable | ⛔ Not now (budget-conscious, open repo) |
| AI-generated 3D (Meshy/Tripo etc.) | ~$10–30/mo | M, rough output | Inconsistent; needs cleanup | Variable | ⛔ Draft-only; not for the hero hull |

CC0-first is the clear call: it's free, license-clean for a public repo, and the
Quaternius/Kenney pirate kits already match the existing sunny, hand-crafted low-poly look —
so the swap *raises* fidelity without a style break. AI 2D (duel portraits / parchment UI) is
a separate, defensible spend tracked under #55's broader budget recommendation, **not** part
of the hero-ship swap.

---

## Recommendation for the hero ship (#32)

1. **Primary: Quaternius Pirate Kit ship (CC0).** Best style match (warm, chunky, animated
   low-poly), glTF-native, public domain. Pick the small sloop/ship mesh closest to the
   current sloop silhouette; export/trim to a single GLB. Verify the exact mesh's tri count on
   download (target a few-k tris, one material if possible).
2. **Alternative: Kenney Pirate Kit ship (CC0).** Even lighter, flatter-shaded — ideal if we
   want maximum perf headroom or a more cartoon read. Same CC0 freedom.
3. **Fallback: keep & keep improving the procedural ship.** `src/ship.js` is already a
   coherent, budget-friendly hull. If no kit mesh lands the silhouette cleanly, an incremental
   procedural polish pass is a valid, zero-risk ship. (The two aren't exclusive — we can ship
   the glTF and keep the procedural code as a fallback path.)

**Integration plan (the #32 build slice, separate cycle):**
- Add `assets/ship/` with the GLB + a `LICENSE.txt`/`CREDITS` note (source URL + "CC0").
- Load via `GLTFLoader` (already in the import map — no new dep). Async load with the
  procedural ship as the loading/fallback placeholder so the game stays playable if the fetch
  fails (resilience matches our "always shippable" rule).
- **Match the contract:** scale to length ~16, orient bow → +Z, set `castShadow`/`receiveShadow`,
  and **re-attach a flag `Group` as `userData.flag`** so the existing pennant animation keeps
  working. Confirm draw-call/tri delta against the 130/150k budget with Tech Lead.
- Effort: **S–M** (mostly orient/scale/flag-wiring + a perf check); TDD doesn't apply (art),
  QA verifies tone + readability in-engine per the Definition of Done.

**Attribution / licensing plan:**
- Even though CC0 needs no credit, add a repo **`CREDITS.md`** (or `assets/CREDITS.md`) listing
  each asset: name, author, source URL, licence. Good open-source manners + future-proofs us if
  we ever mix in a CC-BY asset (which *would* legally require it).
- Per `assets/` convention, drop a short licence note beside the file.

**Licensing caveat for the public repo (must respect):**
- **Only ship CC0 (or self-made) for the hero ship.** Do not commit a CC-BY/NC asset without
  the required attribution — and prefer avoiding attribution-bound assets for core art.
- **Never** a named-franchise lookalike — original silhouette only (CONSTITUTION rule).
- On Poly Pizza / Sketchfab, **confirm the per-model licence** before download; don't trust the
  search category.

---

## Quick reference — go-to CC0 sources

- **Models:** Quaternius (quaternius.com), Kenney (kenney.nl) — both CC0, glTF.
- **HDRI / skybox / envMap:** Poly Haven (polyhaven.com) — CC0.
- **PBR surfaces / textures:** ambientCG (ambientcg.com) — CC0.
- **Aggregator (check per-model licence):** Poly Pizza (poly.pizza).
- **Meta-index:** awesome-cc0 (github.com/madjin/awesome-cc0).
- **Loader smoke-test only:** Khronos glTF-Sample-Models.
