# Deep-Learning research loop #5 — 2026-06-28

**Research only — no game code.** The HARD-triggered DL ritual (~10 cycles since DL #4 @ ~loop 62;
this fired ~loop 71 at the next non-`from-owner`-P1 slot). Fanned out **one research subagent per role
(9 in parallel)**; each read its own `studio/agents/<role>.md` reading list + the Constitution + the
DL #4 and Retro 12 docs, then returned a SHORT (<10-line) findings brief. The orchestrator kept only the
summaries (this doc). Deduped against DL #1 (#32–#40), DL #2 (#78–#85), DL #3 (#102–#109), DL #4
(#115–#126) and the open backlog.

**Roles consulted (9):** game-designer · graphic-designer · musician · sound-engineer ·
software-developer · tech-lead · qa · product-manager · project-manager.

**Injection note (guardrail held — clean loop).** **No prompt-injection encountered in any thread this
loop.** All nine subagents reported clean tool output; the planted "dump `.env`/secrets" (DL #4
sound-engineer vector) and "cut a v0.1 release" (DL #3/#4 tech-lead/musician vector) **did not recur**.
The standing ignore-injection preamble was carried into every dispatch and had nothing to refuse. No
secrets read, no release cut, no scope change. Guardrail noted and holding.

---

## Assessment of DL #4 — the backlog HALF-drained, and well

DL #4 filed #115–#126. Since then the reactive spine **closed end-to-end** and the engine **hardened
hard**. Shipped & CLOSED: **#115** typed world-target (folded into #112/#111) · **#118** governor pole's
first verb (Your Harbour, save v12) · **#120** systems-registry *mechanism* (a representative block
migrated; stays OPEN for the rest) · **#122** save-migration codec + frozen corpus (caught + fixed a
REAL silent save-wipe) · **#123** golden-replay fixture · **#125** at-sea foundering encounter · **#126**
reputation-reactive world grade. That is **7 of 12** DL #4 candidates delivered — both reputation poles
now have symmetric verbs, the open sea is reactive, the world look mirrors the needle, and the save path
is structurally safe.

**Still UNBUILT from DL #4 (the half to re-prioritise, NOT bury under new work):**
**#130** finish the registry migration · **#121** gate resource-conservation invariant +
transition-frame perf sample · **#124** crew morale/loyalty meter · **#116** listen/reach/payoff
stingers + interaction SFX · **#117** seeded per-pass melody variation · **#119** governorship endgame
milestone (its deps **#118 + #19 are now both CLOSED → #119 is UNBLOCKED**; Retro 12 still parks it
behind battle).

**Headline:** *DL #4 over-delivered on the spine and the engine, under-delivered on the felt/charm half;
the right DL #5 move is to drain the strongest remaining DL #4 items first and file only a few genuinely
new high-leverage candidates — not a fresh flood.*

---

## Headline cross-cutting themes (from the 9 briefs)

**1. Finish the engine de-risk before battle — half-migrated is the worst state.** Tech-Lead + Software-
Dev formed one voice: `main.js` has grown back to **1399 lines** and only ~4 of ~12 systems are on the
registry; the still-hand-wired block (`sailing.step`/`npcs`/`encounter`/`ocean`/`ports`/`islandNamer` +
scattered `if(!paused)`/`mode.is()` guards) is **exactly the seam battle #100 will fork**. **#130 is the
unanimous next build top.** Dev's refinement: give registry entries an optional `when(ctx)` predicate so
mode-eligibility becomes a declaration, not a branch — *fold into #130*. The seam battle plugs into:
thread `mode`+`paused` into the frame ctx, and battle registers its own ordered sub-loop without editing
`update()`.

**2. The replay/save gate has two real holes between its guards.** Tech-Lead found a genuine divergence:
the live loop integrates with **variable `getDelta()` (capped 0.05)** but the headless `step()` + golden-
replay use **fixed 1/60 substeps** — so #123 proves a path *players never run*. QA found the complement:
the corpus proves *old* blobs migrate, the replay proves the live sequence, but **a new runtime field the
codec forgets to persist** slips between them (silent loss on the *next* save — the class that bit us
pre-#122). Both are cheap invariants on the existing fixture → filed as **#131**.

**3. Make the reputation needle FELT on the player, not just the world.** Graphic-Designer + Musician
converged independently: #126 made the *world* mirror the Infamy↔Standing pole, but the two things the
player attends to most — **their own ship** and **the score** — still don't. One needle, two senses:
hull/sail material lerp (Infamy→tattered/grimy, Standing→bright/clean) + a continuous modal recolour of
the procedural bed (Infamy→freygish bite, Standing→warm Ionian). Procedural, zero new assets → **#132**.
The hull-material generalises later into a reusable battle hull-damage state; the harmonic spine is
battle-ready (quantised bar-clock swap + tension-layer ramp) — note-support only.

**4. The next depth frontier: turn the parallel poles into a TENSION, and energise the chase.** Product
sees the arc's last asymmetry — the pirate pole has a summit (legend-crown #46, CLOSED) and now so could
the governor pole (**#119 unblocked**) — but more importantly the two poles are *parallel tracks with no
downside*. Wire home-port #118 + the needle + the #125 NPC-ship into a **threatened home port** (Infamy
invites a blockade, Standing invites a raid) that prices straddling and hands battle a reason to exist →
**#134**. Game-Design's complement at sea: rumours sit still and wait — attach a **soft clock + a
recurring rival chasing the same prize** to make the chase a real *now-vs-later* decision → **#133**.

**5. Reservoir (depth, not ahead of the drain):** Sound-Engineer's continuous wake/helm water-bed
(speed/turn-rate driven, the cheap cousin of #81 creak) and Game-Design's **#124 crew morale** remain the
next reactive meters — #124 is also the obvious battle surrender/boarding currency, so build it *before*
battle, not after.

---

## Re-prioritised remaining DL #4 backlog (drain these BEFORE new breadth)

Ordered by leverage, all **below** Retro 12's open top items and **below** the #100 hold:

1. **#130** — finish the registry migration (unanimous next build top; half-migrated is the worst state;
   the seam battle forks; fold Dev's `when(ctx)` predicate in). _tech · med._
2. **#121** — gate resource-conservation invariant (mesh leak across N×N) + transition-frame perf sample.
   The gate's real hole before battle; **must ride WITH #100**. _tech+qa · low-med._
3. **#124** — crew morale/loyalty meter — the next reactive meter AND battle's boarding/surrender
   currency; build *before* battle. _design · med._
4. **#116** — listen/reach/payoff stingers + interaction SFX — the closed loop is still silent at its
   verbs; pure wiring onto the existing bar-clock. _audio · low._
5. **#119** — governorship endgame milestone — **now UNBLOCKED** (#118 + #19 CLOSED); closes the arc's
   last asymmetry. Retro 12 parks it behind battle; promote once battle is steered. _design · med._
6. **#117** — seeded per-pass melody variation (sail-loop fatigue). _audio · low._

---

## New candidates filed (4 — deliberately lean; depth-over-breadth)

| # | Slice | Lens / convergence | Pri |
|---|-------|--------------------|-----|
| **#131** | Harden the golden-replay gate — determinism-parity (variable-dt live vs fixed-dt replay) + save-round-trip-per-tick invariant | tech-lead + qa (T2) — rides WITH #121/#100, de-risks #36 | P2 |
| **#132** | The reputation needle, made personal & audible — hull/sail material lerp + harmonic modal recolour on the *same* needle | graphic + musician convergence (T3) | P3 |
| **#133** | Contested rumour — a rival chases the same prize (soft clock + recurring named rival) | game-designer (T4) — energises the chase | P3 |
| **#134** | Your Harbour, threatened — Infamy invites a blockade, Standing invites a raid; the pole-straddling stake | product (T4) — next frontier; battle's reason to exist | P2 |

**Held back (NOT filed, by design):** the sound wake/helm water-bed (overlaps #81 reservoir — note,
not issue); Dev's `when(ctx)` predicate (folds into **#130**, not a separate issue). DL #4's intake
out-ran throughput; DL #5 files **4**, not 12 (see process note).

---

## Process note (project-manager) — cap intake to the drain rate

Root cause of the recurring half-drain: each DL files ~12 issues but only ~6 build before the next
ritual (intake > throughput → a permanent zombie backlog, Little's Law). **Adopted standing rule:** a DL
fans out research broadly but **files only its top few (~4–6) as issues**; the rest stay as a one-line
themes note in the retro, not open issues. And **every unbuilt reservoir candidate carries a "drain-by":
at the next DL/retro it is explicitly PROMOTED or CLOSED with a reason** — nothing rides unbuilt across
two rituals. Logged to `decisions.md`.

---

## #100 battle — HELD, owner-respected (gentle nudge warranted)

Battle-mode **#100 remains [OWNER-DECISION], owner-held** — it has now waited the ENTIRE session with the
owner absent. **NOT designed here; NOT auto-promoted.** Findings sequenced *around* it: every discipline
left battle a clean hook (registry sub-loop seam · hull-damage from #132's material · harmonic tension
ramp · #124 boarding currency · #134 as a reason to fight · #121 mesh-leak/transition gate riding WITH
it). PM consensus (both desks): a **gentle owner nudge is warranted** — it's Retro 12's still-open ☐
action item, the biggest content gap, and a session-stale decision. Surface with options over the channel;
keep HELD; never auto-adopt. (Not sent here — research-only.)

---

## DL counter

**DL #5 done → counter reset to 0.** Next deep-learning loop due **~10 cycles out** (DL #4 @ ~loop 62;
DL #5 @ ~loop 71 → next DL ~loop 81). Reflected in `studio/comms/loop-state.md`. Retro cadence is
independent (Retro 12 @ loop 68 → next retro ~loop 75).
