# Studio decisions (newest first)

Append-only. Each entry: date, the decision, and the *why*. Cross-role/architectural calls
live here so they aren't lost in transient inboxes. Owner-level calls (branding/strategy/big
architecture) are raised as `owner-decision` GitHub issues and recorded here once settled.

---

### 2026-06-27 — Retro 1: modularise `main.js` into `src/systems/`
**Decision.** Refactor `main.js` from a growing wiring file into a thin bootstrap plus a small
`src/systems/` registry where each feature self-registers (`init`/`update`). Reversible, no new
build step. Tracked as #24 (P1, Tech Lead).
**Why.** `main.js` had become the shared touch-point every parallel slice edits, quietly
serialising work that `PARALLEL.md` is meant to parallelise. Clean module seams unlock the
next gameplay-verb batch.

### 2026-06-27 — Retro 1: next priority is a playable gameplay verb
**Decision.** Before more polish, ship the first **gameplay verb**: a dockable port (#12) →
the simplest possible trade, then save/load (#11) so progress survives a refresh. A single glTF
ship (#13) goes in behind the existing ship seam when convenient.
**Why.** We have great sailing and nothing to sail toward; the north-star fantasy ("rise to
pirate or governor") isn't playable yet. One verb turns the toy into a game.

### 2026-06-27 — Retro 1: visual-regression gallery is a per-release habit
**Decision.** QA archives one gallery shot per release and diffs it against the previous
release; any regressed dimension is a bug and can block the gate. The headless gate stays the
functional gate but is treated as visually blind.
**Why.** Swiftshader renders the scene dark, so CI can't catch visual breakage (it missed the
invisible sail #23). A comparative human pass is the real visual gate.

### 2026-06-27 — Art direction: believable realism + swashbuckling comedy
**Decision.** Sea, sky, light, and world aim for atmospheric realism; ships, characters,
dialogue, and UI carry warm, witty, slightly exaggerated hand-crafted charm. Always original;
never imitate a named commercial franchise. Rule of thumb: realistic world, funny people.
**Why.** Differentiates Tidewake, keeps "fun first," and gives art/design a clear shared target.

### 2026-06-27 — Versioning: datetime release tags `v0.0.YYYYMMDDHHmmSS`
**Decision.** Every release is tagged with a UTC datetime-to-the-second; the workflow stamps
`src/version.js` and the on-screen version. Releases trigger only on game-code changes
(`src/`, `index.html`); docs/studio edits skip the pipeline.
**Why.** Several releases/hour need collision-free, monotonic, human-legible tags without manual
semver bookkeeping — and we must respect free GitHub Actions limits.

### 2026-06-27 — Stack: three.js, no build step, static ES modules
**Decision.** Tidewake is plain ES modules + three.js loaded from a CDN, served as static
files, deployed to GitHub Pages. No bundler/framework until a real pain demands one.
**Why.** Fastest path to "always shippable," trivial local run, minimal CI, maximum openness —
anyone can read and run the source directly.
