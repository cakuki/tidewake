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

2. **DESIGN** — *Game Designer / Graphic Designer (as needed).*
   Add design/art detail to the chosen slice(s): crisp **acceptance criteria**, references,
   humour/tone notes, and any **assets** (models, textures, palettes) into `assets/`. Skip
   if the slice is purely technical.

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

---

## 3. Hourly stakeholder update (required ritual)

**Every hour**, send the owner (**ckk**) a Telegram update via the **notify-telegram** skill.
This is a required ritual, not optional. Include:

- **What changed** since the last update (slices shipped, decisions, blockers).
- The **current version/tag** and the **live URL** (https://cakuki.github.io/tidewake/).
- **At least one screenshot** produced by driving the **live build** in a real browser
  (Chrome MCP / Puppeteer). A short **screen-capture video/GIF** of the boat sailing is even
  better — prefer it when a visible change shipped.

If a blocker or an `owner-decision` needs attention, surface it in the same update. Respect
quiet hours (no messages 01:00–07:00); batch and send at 07:00 if a window is skipped.

---

## 4. Retrospective ritual (every 3–4 loops)

1. Copy `studio/retros/TEMPLATE.md` to `studio/retros/<YYYY-MM-DD>-loop-NN.md` and run it
   with all roles: what went well, what didn't, what to change.
2. The **Project Manager records outcomes** in that retro file and appends decisions to
   `studio/comms/decisions.md`.
3. The **Project Manager UPDATES THIS RUNBOOK** with the agreed improvements (this file is
   living — edit steps, add guardrails, tune cadence) and adds a **Changelog** entry below.

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

- **2026-06-27 — Retro 1 (loops 0–3):** PLAYTEST step now requires a mandatory real-browser pass
  for visible changes (headless gate can't see visuals) and a per-release gallery diff vs. the
  previous shot. Added guardrails: keep `main.js` thin via `src/systems/` (#24); sequence a
  playable gameplay verb early (port #12 → trade) over polish; keep CI actions current (bump
  deprecated Node-20 runtimes). See `studio/retros/2026-06-27-retro-1.md`.
- **2026-06-27** — initial runbook (Loop 0 bootstrap).
