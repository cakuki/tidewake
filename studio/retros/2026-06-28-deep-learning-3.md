# Deep-Learning research loop #3 — 2026-06-28

**Research only — no game code.** The HARD-triggered DL ritual (~11 cycles since DL #2, cadence ~10),
preempted by the owner mode-system P1 batch (#95/#67/#96/#94) which has now drained. Fanned out **one
research subagent per role (9 in parallel)**; each read its own `studio/agents/<role>.md` reading list +
the Constitution, refreshed its `## Research log` + `studio/memory/<role>.md`, and returned a short
findings brief. The orchestrator kept only the summaries (this doc). Deduped against DL #1 (#32–#40) and
DL #2 (#78–#85) and the open backlog.

**Roles consulted (9):** game-designer · graphic-designer · musician · sound-engineer ·
software-developer · tech-lead · qa · product-manager · project-manager.

**Where the build is now (the grounding):** a landable core fantasy arc + rich reputation/Infamy↔Standing
+ deception-as-a-verb (False Colours / Letters of Marque) + cannon combat + a shareable Ballad/Captain's
Log + named world + a CC0 glTF hero ship; and a **NEW owner-directed MODE SYSTEM** landing — a
sailing/town/battle state machine (`src/mode.js`, world continues underneath a paused helm) → a real
town/market mode via auto-harbour (#67/#96) → a unified mode-aware sound system (#94). Battle-mode #100
is held for an 08:00 owner brief (treated as context only here).

---

## Headline cross-cutting themes

**1. The town must be a DESTINATION, not a menu — reactive verbs ashore.** The single strongest product
signal, raised independently by Game Design and Product. A town is a vending machine until it has *a
function you return for*. The pirate pole already has reactive verbs; the governor pole and "ashore" are
still numbers. Antidotes: a tavern verb (*listen for word* → procedural rumours that set soft sea
objectives), a town that *remembers your deeds* across visits (the pirate↔governor branch made spatial),
a one-line "while you were ashore…" digest that makes the living world legible, and ONE persistent
resource/home-port that flows across all three modes so mode-select is a loop, not a worse sandbox.

**2. The mode TRANSITION is the drama — sell it across every discipline at once.** All five craft roles
(design / art / music / sound / dev) converged on the same beat unprompted: *making landfall should be a
crafted multi-sensory gesture, not a snap or a load screen.* Eased camera to a moored framing + a
`townBlend` warm grade + calmed swell (paused helm = glassy water, a reactive verb) + a music swell and
on-beat stinger + a constant-power crossfade of the audio bed + a "we've made port" punch — reversed on
Leave Harbour. Each mode owns its own camera/control/sound/grade grammar so town *reads as a place*.

**3. Harden the mode SEAM now, before three half-built modes leak.** Engineering, QA and Process formed a
tight chorus: the keystone (#95) is a 1→N enabler, not a peer slice. Make enter/leave a real,
multi-subscriber, disposable, legal-transition-guarded, per-mode-budgeted, save-safe seam — and gate the
gate's trust to match (N×N transition-matrix test, a cross-mode pause invariant generalising the
snap-freeze guard, a mode-aware audio assertion, a golden mode-trace). Cap modes-in-flight at ONE; ship
town end-to-end before battle. The seam also unlocks a real perf win (throttle ocean work + DPR in town).

**4. Mode-aware audio is acoustic SPACE, not just volume — and needs a musical, testable seam.** Music +
Sound converged on: a bar-clock that quantises transitions to the downbeat; constant-power crossfades
(linear sums of non-coherent beds dip ~3 dB — a "hole in the water"); per-mode procedural reverb impulse
responses (open sea vs stone harbour) so making port changes the *room*; per-town identity via modal
recolour + timbre over raw transposition (the `playbackRate`/`detune` pitch-tempo trap; Safari lacks
`detune`); and proximity as a continuous parameter, not a boolean radius.

**5. Two reservoir enablers just got more leverage.** **#36 fixed-timestep** is no longer nice-to-have:
"the world keeps living under a paused helm" *requires* a sim that steps independently of input/render —
`playerPaused` is its natural seam. And the **#84/#85 renderer-adapter** is the natural home for per-mode
render settings. Promote #36 ahead of #84.

---

## Prioritised shortlist — candidate slices filed (all below the P1 mode batch)

Buildable wildcards, deduped, asset-light, original-work-only, reactive-verbs-first. Each goes through a
normal cycle if adopted; most ride the in-flight mode batch.

| # | Slice | Lens | Pri |
|---|-------|------|-----|
| **#102** | Landfall: the mode transition as a crafted multi-sensory gesture | design+art+audio (theme 2) | P2 |
| **#103** | Town tavern "listen for word" — procedural rumours set soft sea objectives | design (theme 1) | P2 |
| **#104** | The port remembers you — persistent per-town reputation state (+ "Your Harbour" stretch) | design (theme 1) | P2 |
| **#105** | "While you were ashore…" living-world consequence digest on Leave Harbour | design (theme 1) | P2 |
| **#106** | Mode lifecycle hardening — enter/leave hooks, multi-subscriber seam, legal-transition guard, per-mode disposal | tech (theme 3) | P2 |
| **#107** | Mode-transition QA coverage — N×N matrix + cross-mode pause invariant + mode-aware audio assertion + golden trace | tech+qa (theme 3) | P2 |
| **#108** | Per-mode perf budget + throttle world work in town (promote #36) | tech (themes 3+5) | P2 |
| **#109** | Mode-aware audio craft — constant-power crossfade + bar-clock transitions + procedural per-mode reverb (rides #94) | audio (theme 4) | P3 |

**Sequencing note:** #106 is the natural first DL #3 slice once the P1 mode batch (#95/#67/#96/#94)
drains — it hardens the seam everything else plugs into. #107 should ride alongside it. #102–#105 are the
depth that turns the town mode from a panel into a place; #108/#109 are perf/audio depth that ride their
respective systems.

---

## DL counter

**DL #3 done → counter reset to 0.** Next deep-learning loop due ~10 cycles out (DL #2 ran after loop 33;
DL #3 after the mode-batch drain). Reflected in `studio/comms/loop-state.md`.
