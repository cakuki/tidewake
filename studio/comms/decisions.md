# Studio decisions (newest first)

Append-only. Each entry: date, the decision, and the *why*. Cross-role/architectural calls
live here so they aren't lost in transient inboxes. Owner-level calls (branding/strategy/big
architecture) are raised as `owner-decision` GitHub issues and recorded here once settled.

---

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
