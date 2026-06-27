# Studio decisions (newest first)

Append-only. Each entry: date, the decision, and the *why*. Cross-role/architectural calls
live here so they aren't lost in transient inboxes. Owner-level calls (branding/strategy/big
architecture) are raised as `owner-decision` GitHub issues and recorded here once settled.

---

### 2026-06-27 — Retro 3: adopt the shared-contract step before any parallel batch (#34)
**Decision.** No parallel dispatch across a **shared state/save/event seam** without a one-line
**contract artifact** (*name · shape · owner · consumers*) written down first — in
`comms/PARALLEL.md` §3a and on the issues — and **both slices assert against it** (a tiny shared
fixture/test). Disjoint *files* is not enough if two slices read/write the same `state` shape or
save schema. Added to `docs/runbook/LOOP.md` (PLAN step) and `PARALLEL.md`.
**Why.** The #29 trade-seam bug was a `state.port` getter + buy-by-name mismatch between two
parallel slices — and the PM's own deep-learning research had written exactly this lesson the same
night. A lesson that isn't operationalised into the runbook gets repeated; this closes that gap
(lightweight consumer-driven contract testing).

### 2026-06-27 — Retro 3: re-dispatch glitched (0-tool-use) subagents
**Decision.** A subagent that returns having used **0 tools** (empty / no-op) is a **transient
failure, not a result**: the orchestrator **auto-re-dispatches the same brief once** (twice at
most) and always confirms a subagent actually did the work (a release tag, files changed, a real
summary) before advancing. Added to the context-optimization discipline in `LOOP.md`.
**Why.** The glitch is silent; banked as "done," it stalls a cycle. A named standard response
beats ad-hoc rescue.

### 2026-06-27 — Retro 3: bias toward reactive verbs over inert content
**Decision.** The next block prioritises **the world reacting to the player** — port reputation
that reacts to renown (#39-followup) — ahead of more static content, then the CC0 glTF ship (#32)
for charm, then Insult Broadside (#33). Added as a runbook guardrail; PM/Game Designer practices
updated.
**Why.** Loops 7-11 made the fantasy legible (sail → trade → climb a named rank, NPCs giving the
sea life) but the rank is just a number with no consequences. The world doesn't yet *know the
player's name* — and reactivity is where both the drama and the comedy live. We've been adding
nouns faster than reactions.

### 2026-06-27 — Retro 2: creative roles drive every cycle (CREATIVE SPARK beat)
**Decision.** Every slice — even "technical" ones — names a **creative driver** (Game Designer
or Musician) and carries a 2-3 line **CREATIVE SPARK**: one authored charm/fun/feel beat
(banter, comic event, music sting, game-feel touch). Added as a mandatory loop step in
`docs/runbook/LOOP.md`; the cycle-runner reports the spark in its summary.
**Why.** Loops 4-6 shipped competent engineering with our two designated creative roles **dark** —
zero authored fun, zero music. That's a process bug: throughput was optimised at the cost of
creative surprise. The Spark makes authored character a first-class output, not a garnish.

### 2026-06-27 — Retro 2: give the verb a reward — port economy is next
**Decision.** Next highest-leverage slice is a **simple port economy** (#26): coins +
buy-low/sell-high cargo with per-port price spreads. Game Designer is the creative driver; pair
it with **activating the Musician** for a first adaptive-ready sailing theme (#27). Filed an NPC
ship (#28) as a P2 follow-on / parallel candidate.
**Why.** We shipped the first verb (arrive at a named port) and persistence, but arriving still
*pays nothing* — a door to an empty room. A coin economy converts "arrive" into "earn," gives a
stateable goal ("get rich enough to win a town"), and is the spend-side prerequisite for combat,
crew, and governance. Feel (music) and reward (economy) are the block's theme, not more polish.

### 2026-06-27 — Retro 2: parallel batches are the default now `main.js` is modular
**Decision.** With #24 done (`src/systems/` retired the wiring hotspot), the **default** unit of
work is a small **parallel batch** on disjoint files, not a lone serial slice — unless a real
dependency forces serialisation. Next block (#26 economy + #27 sailing theme) runs as one batch.
**Why.** Modularisation's whole point was to unlock parallel dev; loops 4-6 kept shipping serial
slices and left that payoff uncollected. Default-to-parallel proves and uses the investment.

### 2026-06-27 — Retro 2: the per-release gallery diff is now an enforced gate
**Decision.** For any **visible** change, archiving a `studio/qa/gallery/<version-tag>.png` shot
and diffing it against the previous release is a Definition-of-Done item the **cycle-runner fails
on** if missing — no shot, no release. Updated `docs/runbook/LOOP.md` and `studio/agents/qa.md`.
**Why.** Retro 1 made it a "habit"; loops 4-6 skipped it and the gallery stayed empty. An
aspirational habit decays — "0 escaped bugs" without a visual pass is luck, not a gate. Teeth.

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
