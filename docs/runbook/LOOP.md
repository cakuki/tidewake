# Tidewake — Development Loop Runbook

The operating runbook the studio follows on **every** development loop. Read
`studio/CONSTITUTION.md` first; this is its executable companion. **Living document:**
the Project Manager edits it after each retro (see Changelog at the bottom).

---

## 1. Purpose & cadence

- The loop **never stops**. We ship **several releases per hour** — tiny, always-playable
  increments.
- A **retrospective every 3–4 loops** (Section 4) feeds improvements back into this file.
- **Mind free GitHub Actions minutes.** Releases trigger **only** on game-code changes
  (`src/`, `index.html`). Docs/`studio/`/`*.md` edits do **not** burn minutes — batch them.
  Keep each cycle small and green on the first try; a failed CI run is wasted budget.

---

## 2. Loop steps

> Roles in **bold** lead each step; others assist. Pass concrete data through
> `studio/comms/` so context stays lean between cycles.

1. **PLAN** — *Product Manager + Project Manager + Tech Lead.*
   Refine the GitHub issue backlog, prioritise (`P0`–`P3`), resolve dependencies, link
   slices to their epic. Pick the **top 1–3 small slices** for this loop (each shippable in
   one increment). Update `studio/comms/board.md`: move chosen cards into **To do** with
   issue numbers and owners.
   **Shared-contract step before any parallel batch (Retro 3, #34):** if two slices in the
   batch will touch a **shared state/save/event seam** (the `state` shape, the save schema,
   an event/getter name, a panel's data contract), the **PM writes the contract down *first***
   — *name · shape · owner · consumers* — as a one-line entry in `studio/comms/PARALLEL.md`
   (and on the issues), and **both slices assert against it** (a tiny shared fixture/test).
   **No parallel dispatch across a shared seam without a contract artifact both sides assert.**
   Retro 3: the #29 trade-seam bug (a `state.port` getter + buy-by-name mismatch between two
   parallel slices) was *exactly* this — and the lesson was already in PM research the same
   night. A written-down contract turns "we both assumed the shape" into a checkable artifact
   (consumer-driven contract testing, lightweight).

2. **DESIGN + CREATIVE SPARK** — *Game Designer / Musician / Graphic Designer.*
   Add design/art detail to the chosen slice(s): crisp **acceptance criteria**, references,
   humour/tone notes, and any **assets** (models, textures, palettes) into `assets/`.
   **Every slice — even a "technical" one — names a creative driver (Game Designer or
   Musician) and a 2-3 line CREATIVE SPARK:** one charm/fun/feel beat the slice will carry
   (a line of harbourmaster banter, a comic price event, a music sting, a juicy bit of
   game-feel). This beat is **not optional and not skipped as "just technical"** — Retro 2
   found we shipped competent engineering with the two creative roles dark; the Spark exists
   so authored character rides along with mechanics. Cut it only if a creative driver
   explicitly says this slice carries none (rare).
   **Balance/tuning has an owner — the Game Designer (Retro 4).** Numbers that shape *fun* (rank
   curves, reward rates, price spreads, thresholds) are a first-class output, not an afterthought.
   Once per block the Game Designer runs a **tuning pass** answering one question — *"is the curve
   fun in a real session?"* — and tunes against actual session length, not a guess. Retro 4: we
   shipped the complete arc with a ~12,800 legend threshold a web session (~4.45 min median) can't
   reach, because tuning was no one's job. The first tuning pass is the renown curve (#57).

3. **TECH PLAN** — *Tech Lead.*
   For each slice write a short technical plan: **approach**, **files to touch**, **test
   plan**, and how the slice stays always-working. Note the plan on the issue or in the
   board card. Keep the `window.__tidewake` QA hook contract intact (see Section 6).

4. **BUILD** — *Software Developer.*
   Implement the **smallest always-working increment**. Keep the game booting and sailing at
   every commit. Preserve/extend the QA hook (`ready`, `version`, `fps`, `state`, `press`,
   `release`, `step`) so the headless gate keeps passing.

5. **PLAYTEST** — *QA.*
   Run `node tests/playtest.mjs` locally (must print `✓ PLAYTEST PASSED`, zero console
   errors). **Also** do a browser smoke check: serve locally, confirm the game boots, sails,
   and the new change actually works. **Capture a screenshot** (the playtest writes
   `docs/playtest.png`; grab an extra of the new feature if useful). The headless gate renders
   the 3D scene dark (swiftshader) and **cannot validate visuals** — so a real-browser pass is
   mandatory, not optional, whenever a visible change shipped. **Every release**, archive one
   shot to `studio/qa/gallery/<version-tag>.png` and diff it against the previous release's shot;
   any regressed dimension → file a bug and consider blocking the gate (Retro 1).
   **Enforced (Retro 2):** for any slice with a **visible** change, the cycle-runner subagent
   **fails the cycle** if no gallery shot was archived for this release — the per-release diff is
   a gate, not an aspiration. (Retro 1 made it a habit; loops 4-6 skipped it and the gallery
   stayed empty, so it now has teeth.)
   **The cycle-runner's QA step OWNS the visual pass (Retro 4) — not the orchestrator.** Capturing
   the Chrome-MCP gallery shot, scoring it, and diffing it against the previous release happens
   **inside the cycle-runner subagent**, which returns the visual verdict in its 5-line summary.
   The orchestrator must **not** burn its own (scarce) context doing manual screenshot QA each
   cycle — that's exactly the heavy work the context-optimization discipline says to delegate.
   **Build #37 (tolerance-based deterministic visual diff) — stop deferring it (Retro 4):** the
   diff is still eyeball-only and #37 has been open since cycle 10, losing to feature slices each
   block. A deterministic threshold-based diff (fixed viewport + `--force-device-scale-factor=1`,
   seeded RNG/time, a deterministic harness pose, `maxDiffPixelRatio ≈ 0.01–0.02`) turns the human
   pass into a real automated gate. Schedule it as a near-term slice, not "someday."
   **QA navigation & timing gotchas (Retro 3) — solve once, don't re-learn:**
   - **Coordinate mismatch.** `port.pos` is **`[x, z]`** (2D ground plane); ship `state.pos` is
     **`[x, y, z]`** (3D). When autopiloting the ship toward a port, map `port.pos[0]→x` and
     `port.pos[1]→z` (skip `y`); indexing the wrong axis sails you to nowhere. Prefer a shared
     QA navigation helper (e.g. `sailToPort(name)`) over re-deriving the math each pass.
   - **Synchronous `step()` ≠ wall-clock.** `tw.step(seconds)` advances the **sim** but not the
     wall clock, so **CSS fade-in transitions** (e.g. `#trade.show` opacity) read mid-flight.
     Before asserting opacity-based visibility, **wait real time (~600 ms)** or await
     `transitionend` — or disable animations for baselines. (Retro 3: this cost us false bug #30,
     a transition-timing artifact mistaken for a defect.)

6. **RELEASE** — *Software Developer + QA.*
   Commit the game-code change to `main`. CI runs the headless playtest gate, stamps the
   version, deploys to GitHub Pages, and tags `v0.0.YYYYMMDDHHmmSS`. **Verify the run is
   green** (`gh run watch`) and the **live URL serves 200**
   (`curl -sI https://cakuki.github.io/tidewake/`). If CI fails, fix-forward immediately —
   don't leave `main` red.

7. **NOTES & COMMS** — *Project Manager.*
   Move cards to **Done** in `studio/comms/board.md`. Append any cross-role decisions to
   `studio/comms/decisions.md` (dated). Close or update the GitHub issues with the release
   tag. Write short **release notes** (Product Manager owns the framing).

8. **LEARN** — *every role.*
   Spend a little time on self-improvement: study one industry best practice and record it
   under **"Practices adopted"** in your own `studio/agents/<role>.md`. Genuine craft, never
   manipulative.

> **Continuous observation (Tech Lead + Project Manager).** Beyond these steps, TL and PM
> **don't just wait for the retro** — they run a **continuous-observation pass each cycle and
> between cycles**, watching the real signals and adjusting the moment something can be improved
> or a problem prevented. **TL** watches CI health, code-quality drift, the `main.js` hotspot,
> and perf; **PM** watches issue hygiene, dependencies, cycle time, scope, and blocked cards.
> Either intervenes immediately (re-prioritise, file/split an issue, fix a flaky step, carve a
> seam, adjust the plan) rather than banking it for retro time. See the
> *Continuous observation & adjustment* section in each of their agent definitions.

---

## 3. Hourly stakeholder update (required ritual)

**Every hour**, send the owner (**ckk**) a Telegram update via the **notify-telegram** skill.
This is a required ritual, not optional. Include:

- **What changed** since the last update (slices shipped, decisions, blockers).
- The **current version/tag** and the **live URL** (https://cakuki.github.io/tidewake/).
- **At least one screenshot** produced by driving the **live build** in a real browser
  (Chrome MCP / Puppeteer). A short **screen-capture video/GIF** of the boat sailing is even
  better — prefer it when a visible change shipped.

### Video capture recipe (clarity over smoothness)

So clips read crisp, not muddy. **Prefer real captured frames to fake interpolated ones.**

1. **Capture more frames, higher quality.** Drive the live build and grab **~16–24 frames** at
   **higher resolution** (e.g. **1280px wide**) and good JPEG quality (**~90**). More real
   frames beats stretching a few.
2. **Assemble at a near-native framerate** (~**10–15 fps**) — match the rate you actually
   captured. Don't ask ffmpeg to invent motion.
3. **Do NOT use aggressive motion-compensated interpolation.** Avoid `minterpolate=mci` (and
   `mc_mode=aobmc`): it smears sparse frames into mud. Use **real frames as-is**, or at most
   `minterpolate=mi_mode=dup` (frame duplication, no warping) — or no interpolation at all.
4. **Encode for clarity:** `libx264`, **low CRF (~18–20)**, `-pix_fmt yuv420p`,
   `-movflags +faststart`. Keep the file **< ~15 MB** so Telegram accepts it inline.

```bash
# frames captured as frame_0001.jpg … (1280px wide, q~90)
ffmpeg -framerate 12 -i frame_%04d.jpg \
  -c:v libx264 -crf 18 -pix_fmt yuv420p -movflags +faststart \
  sail.mp4
# If you must hit a target fps, duplicate — never motion-warp — frames:
#   -vf "minterpolate=fps=24:mi_mode=dup"   # NOT minterpolate=mci
```

**Rule of thumb: prefer clarity over smoothness.** A slightly choppy but sharp clip of the boat
sailing beats a smooth, smeared one.

If a blocker or an `owner-decision` needs attention, surface it in the same update. Respect
quiet hours (no messages 01:00–07:00); batch and send at 07:00 if a window is skipped.

---

## 4. Retrospective ritual (every 3–4 loops, run AS A SUBAGENT)

The retro runs in its **own subagent**, not in the main orchestrator context (Retro 1 already
ran this way as a background subagent). The orchestrator dispatches one retro subagent, hands it
the recent loop log from `studio/comms/loop-state.md`, and keeps only the 5-line summary it
returns.

**Every retro reviews two things, not one:** **(a) the product/game** *and* **(b) the studio
itself — its workflow, collaboration, tooling, and process.** The explicit goal is to **optimise
our workflows so we produce better, MORE CREATIVE results** — higher throughput *and* higher
creative quality, not one at the other's expense. Ask, on the process side:

- *Where did process slow us or dull creativity?*
- *What workflow / tooling / communication change would raise **both throughput AND creative quality**?*
- *What will we change in the **runbook** or an **agent definition** as a result?*

So **process improvements are first-class retro outcomes**: action-items frequently edit this
runbook and the `studio/agents/<role>.md` definitions. The process is meant to improve itself.

The subagent:

1. Copies `studio/retros/TEMPLATE.md` to `studio/retros/<YYYY-MM-DD>-loop-NN.md` and runs it
   across all roles, reviewing **both the game and the studio's own process**: what went well,
   what didn't, and what workflow/tooling/agent change would lift throughput *and* creativity.
2. Records outcomes in that retro file and appends decisions to `studio/comms/decisions.md`
   (on behalf of the **Project Manager**).
3. **UPDATES THIS RUNBOOK** with the agreed improvements (this file is living — edit steps, add
   guardrails, tune cadence) and adds a **Changelog** entry below.
4. Resets **Loops since last retro** in `studio/comms/loop-state.md` and returns a 5-line
   summary (top finding, changes made, files touched) to the orchestrator.

---

## Deep-learning research loop (every 10 cycles)

A deliberate, periodic refresh: every role steps off the line, reads widely in its own
discipline, and brings inspiration — and a dash of serendipity — back into Tidewake. This is
**research only**: it produces *knowledge + backlog ideas*, never a code change. Any idea worth
building goes through a normal cycle/issue afterwards; the research loop **must not touch game
code** (`src/`, `index.html`).

**Trigger.** Track **Cycles since last deep-learning loop** in `studio/comms/loop-state.md`.
When it reaches **10**, the orchestrator runs this loop, then resets the counter to 0.

**Dispatch.** Fan out **one subagent per role (9 in parallel)**, each in its **own isolated
context** — never in the main orchestrator. Each role's subagent:

1. Uses **web research** (`WebSearch` / `WebFetch`) to study its discipline, reading a mix of
   **(a) current/new developments** (recent talks, articles, releases) **and (b) timeless/classic
   foundational references** — see the **## Research & deep learning** section in its own
   `studio/agents/<role>.md` for a starting reading list.
2. Distils **2–4 concrete takeaways** plus **at least one "wildcard / inspiration" idea** to try
   in the game (genuine craft + a deliberate spark of randomness from the wider world).
3. Writes back, dated `YYYY-MM-DD`, to **both**:
   - its own `studio/agents/<role>.md` — append to **## Practices adopted** (or a **## Research
     log**), refreshing its identity/skills/practices with what it learned;
   - its `studio/memory/<role>.md` — the durable record of takeaways + the wildcard.
4. Files any buildable wildcard as a backlog **idea/issue** for a future cycle (it does **not**
   implement it here).
5. Returns a short summary to the orchestrator; the orchestrator keeps only the summaries.

**Spirit.** Real sources, real craft, a little serendipity — never just-for-show, never
manipulative. The point is that each agent keeps growing and the game keeps surprising us.

---

## Context optimization (orchestrator discipline)

The main orchestrator must stay **lean** so the never-stopping loop survives context resets.

- **Delegate whole units of work to subagents** — a full cycle, a retro, the research loop —
  rather than running them inline. The orchestrator plans the dispatch and reads back summaries.
- **Persist state to files, not context.** `studio/comms/loop-state.md` is the persistent brain
  (current loop, counters, release, open enablers, loop log); `board.md`, `decisions.md`, and
  `inbox/<role>.md` carry concrete hand-offs. Pass data **through files**, never by holding it in
  the orchestrator's head.
- **Only summaries return to main.** A subagent does the heavy reading/building and returns a
  concise summary; the orchestrator keeps that, not the transcript.
- **Prefer one self-contained cycle-runner subagent per slice** that goes end-to-end:
  **plan → creative spark → build (TDD) → playtest (+ archive gallery shot) → commit → verify CI
  green → QA → update the board**, and returns a **5-line summary** (slice, the creative
  spark/charm beat, release tag, CI status, QA verdict, follow-ups). When the block is a
  **parallel batch** (the default post-#24), the orchestrator fans out one runner per disjoint
  slice and serialises the merges (`comms/PARALLEL.md`).
- After each delegated unit, the orchestrator updates `loop-state.md` (counters incl.
  *Cycles since last deep-learning loop* and *Loops since last retro*) and moves on.
- **Re-dispatch a glitched (0-tool-use) subagent (Retro 3).** A transient glitch occasionally
  makes a dispatched subagent **return having used 0 tools** (empty / did nothing). Treat an
  empty or no-op return as a **transient failure, not a result**: **automatically re-dispatch the
  same brief once** (twice at most) before investigating. The glitch is silent — if the
  orchestrator banks the empty return as "done," a cycle stalls — so always confirm a subagent
  *actually did the work* (a release tag, files changed, a real summary) before advancing.

---

## 5. Definition of Done & guardrails

**Definition of Done (a loop):**
- [ ] Chosen slice(s) implemented as the smallest always-working increment.
- [ ] `node tests/playtest.mjs` passes locally **and** in CI — zero console errors.
- [ ] Browser smoke check done; screenshot captured.
- [ ] Released to `main`: CI green, Pages deployed, tag `v0.0.…` created, live URL = 200.
- [ ] `board.md` updated (Done), decisions logged, GitHub issues closed/updated, release
      notes written.
- [ ] User-facing behaviour documented; each role did its LEARN step.

**Guardrails:**
- **Always shippable** — never merge a build that doesn't boot and sail.
- **Keep `main.js` thin** — it is the wiring hotspot that serialises parallel work. New
  features self-register through `src/systems/` (#24); don't grow `main.js` with per-feature
  logic. Tech Lead flags any slice that must touch it so the PM avoids a colliding batch.
- **Sequence a playable gameplay verb early** — favour slices that turn the sailing toy into a
  game (a port to dock at, something to trade, a reason to go somewhere) over more polish, until
  the north-star fantasy is actually playable (Retro 1, Product Manager).
- **Give the verb a reward, not just a destination** — once a verb exists (you can arrive
  somewhere), the next move is to make arriving *pay* (economy, payoff, a stated goal) before
  adding more verbs. Retro 2: "arrive" with no reward is a loading screen with a view.
- **Every slice carries a CREATIVE SPARK and names a creative driver** — Game Designer or
  Musician shapes one charm/fun/feel beat per slice; never ship a block with the creative roles
  dark (Retro 2). Authored character is a first-class output, not a garnish.
- **Default to a parallel batch now `main.js` is modular** — `src/systems/` retired the wiring
  hotspot (#24), so the *default* unit of work is a small **parallel batch** on disjoint files,
  not a lone serial slice — unless a real dependency forces serialisation. Prove the
  modularisation by collecting its payoff (Retro 2). **But: a parallel batch that crosses a
  shared state/save/event seam needs a written contract first (Step 1, Retro 3 / #34)** — disjoint
  *files* isn't enough if both slices read/write the same `state` shape or save schema.
- **Bias toward reactive verbs over inert content (Retro 3)** — the world now has plenty of
  *nouns* (ports, goods, NPC ships, a renown rank) but the rank is just a number on the player.
  Favour slices that make **the world respond to who the player is becoming** (ports greet/price
  by reputation, NPCs react to your legend) over adding more static content, until the world
  visibly *knows the player's name*. Reactivity is where both the drama and the comedy live.
- **The core arc is COMPLETE — tune it before you deepen it, and prefer depth over breadth (Retro
  4).** The spine now exists end-to-end: one boat → trade/fight → climb *either pole* (Infamy ↔
  Standing, #45) → get *crowned a legend* (#46). With a finished spine the priorities invert:
  **(1) make the arc reachable** — tune the renown/reward curve so a fresh player *feels* real
  progress in one short web session (#57) before anything else; a complete arc nobody reaches is a
  spine players never feel. **(2) add DEPTH that complements the spine** — atmosphere (weather &
  day-night #58), combat *weight* (ship-vs-ship cannon #59 alongside the Insult Broadside duel),
  a real first-win onboarding (#60) — over **thin BREADTH** (yet another port/good) that adds
  nouns without drama. The spine doesn't need more nouns; it needs to be *reachable, atmospheric,
  and dramatic*.
- **from-owner P1 bugs jump the feature queue (Retro 4).** Bugs the owner files through the PM
  Desk with `from-owner` + `P1` (e.g. #50 compass drift, #51 swell submerging ports/docks) fix
  *visible breakage* cheaply and make every shareable screenshot/clip clean. They are sequenced
  **ahead of feature slices**, not behind them — a visibly broken world taxes every capture.
- **Keep CI actions current** — when GitHub annotates a deprecated runtime (e.g. Node-20), raise
  a `tech`/`chore` issue and bump the action versions promptly; a deprecation becomes a hard CI
  failure later and stalls the whole loop.
- **Never imitate a named franchise** — original work only; no commercial game/franchise by
  name (Constitution).
- **Keep the public surface clean** — README and public docs stay tidy and audience-correct;
  no internal/persona leakage.
- **Owner decisions** (branding / strategy / big architecture) → a GitHub issue labelled
  `owner-decision` with options; never auto-adopt.
- **Protect Actions budget** — releases only on `src/`/`index.html`; group doc edits;
  get CI green the first time.

---

## 6. Commands cheat-sheet

```bash
# Run the game locally (serve from repo root, open http://localhost:8777/)
python3 -m http.server 8777            # or: npm run serve

# Headless play-test gate (writes docs/playtest.png; must print ✓ PLAYTEST PASSED)
node tests/playtest.mjs                # or: npm run playtest
node tests/playtest.mjs --keep-screenshot docs/feature.png   # custom screenshot path

# Watch the latest CI release run
gh run watch

# List releases / tags
gh release list

# Check the live build serves 200
curl -sI https://cakuki.github.io/tidewake/
```

**QA hook contract (`window.__tidewake`)** — keep these working for the gate:
`ready` (bool), `version`, `fps`, `state` (`{ speed, pos:[x,y,z] }`),
`press(key)`, `release(key)`, `step(seconds)` (deterministic, frame-rate independent).

---

## Changelog

- **2026-06-27 — Retro 4 (loops 16-19): the core fantasy arc is now COMPLETE.** Shipped the
  KEYSTONE two-pole renown split (Infamy ↔ Standing, #45), endgame legend milestones (crowned THE
  Terror / THE Governor, #46), a polish batch (#47/#41/#25 — #47's real root cause was OS
  key-repeat from a held throttle), and duel audio juice (#48). One boat → trade/fight → climb
  either pole → crowned a legend now exists end-to-end (182 tests). Headline product finding: with
  a finished spine the question flips to **depth vs. breadth**, and the single highest-leverage
  slice is **tuning the arc so players reach it** (the ~12,800 legend threshold is unreachable in a
  ~4.45-min web session). Headline process finding: the finished arc shipped *un-tuned* because
  **balance/tuning had no owner**. Changes: **Game Designer is now the standing balance/tuning
  owner** (per-block "is the curve fun in a real session?" pass); **the cycle-runner's QA step owns
  the Chrome-MCP gallery capture + diff** so the orchestrator stops doing manual visual QA each
  cycle (and **#37 deterministic visual diff** is scheduled, not deferred); new guardrails **"tune
  the complete arc before deepening it; prefer depth over breadth"** and **"from-owner P1 bugs jump
  the feature queue"**. Next block: tune the renown curve (#57), then weather/day-night (#58) and
  ship-vs-ship cannon combat (#59); onboarding (#60) + camera-astern (#49) as a follow-on batch.
  Deep-learning loop #2 is due. See `studio/retros/2026-06-27-retro-4.md`,
  `studio/agents/{game-designer,product-manager,qa,project-manager}.md`.
- **2026-06-27 — Retro 3 (loops 7-11):** the core fantasy is now legible — sail → trade for
  profit → climb a named renown rank, with wandering NPC ships giving the sea life; first music
  (#27) and first deep-learning research loop (#32-#40) both landed. Headline finding was a
  *process* one: the #29 trade integration-seam bug was a **known, unadopted lesson** (the PM's own
  #34 contract takeaway, written the same night). Changes: **adopted the #34 shared-contract step**
  into PLAN/PARALLEL (no parallel dispatch across a state/save/event seam without a one-line
  contract both sides assert); added a **re-dispatch rule for glitched 0-tool-use subagents**;
  added **QA navigation/timing gotchas** (`port.pos [x,z]` vs ship `[x,y,z]`; synchronous
  `step()` ≠ wall-clock → wait real time for CSS fades, the #30 false-bug lesson); new guardrail
  **bias toward reactive verbs over inert content**. Next block: port reputation reacting to renown
  (#39-followup) + the CC0 glTF ship (#32). See `studio/retros/2026-06-27-retro-3.md`,
  `studio/agents/{product-manager,game-designer,qa,project-manager}.md`, `studio/comms/PARALLEL.md`.
- **2026-06-27 — Retro 2 (loops 4-6):** first verb + persistence shipped, but the two creative
  roles (Game Designer, Musician) stayed dark and the gallery-diff habit lapsed. Changes: added a
  mandatory **CREATIVE SPARK** beat to the loop (every slice names a creative driver + one
  charm/fun/feel beat); made the **per-release gallery diff enforced** (cycle fails if a visible
  change ships no shot); **default to parallel batches** now `main.js` is modular (#24);
  guardrail "give the verb a reward, not just a destination." Next block activates the Musician
  (#27) + Game Designer-driven port economy (#26), run as a parallel batch. See
  `studio/retros/2026-06-27-retro-2.md`, `studio/agents/{game-designer,musician,qa}.md`.
- **2026-06-27 — Owner process improvements:** retros now explicitly review **both the game and
  the studio's own process** (workflow/collaboration/tooling), aiming for more throughput **and**
  more creative results; **Tech Lead + Project Manager run a continuous-observation pass each
  cycle and between cycles** (steer/prevent immediately, don't wait for the retro); added a
  concrete **video capture recipe** (more real frames, higher res/quality, no `minterpolate=mci`,
  libx264 low-CRF, <15 MB) to the hourly update. See `studio/retros/TEMPLATE.md`,
  `studio/agents/tech-lead.md`, `studio/agents/project-manager.md`.
- **2026-06-27 — Added deep-learning research loop (every 10 cycles), retro-as-subagent, and
  context-optimization discipline (owner request).**
- **2026-06-27 — Retro 1 (loops 0–3):** PLAYTEST step now requires a mandatory real-browser pass
  for visible changes (headless gate can't see visuals) and a per-release gallery diff vs. the
  previous shot. Added guardrails: keep `main.js` thin via `src/systems/` (#24); sequence a
  playable gameplay verb early (port #12 → trade) over polish; keep CI actions current (bump
  deprecated Node-20 runtimes). See `studio/retros/2026-06-27-retro-1.md`.
- **2026-06-27** — initial runbook (Loop 0 bootstrap).
