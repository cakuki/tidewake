# Deep-Learning research loop #4 — 2026-06-28

**Research only — no game code.** The HARD-triggered DL ritual (~11 cycles since DL #3, cadence ~10),
fired at the next non-`from-owner`-P1 slot. Fanned out **one research subagent per role (9 in
parallel)**; each read its own `studio/agents/<role>.md` reading list + the Constitution + the DL #3 and
Retro 11 docs, then returned a SHORT (<10-line) findings brief. The orchestrator kept only the summaries
(this doc). Deduped against DL #1 (#32–#40), DL #2 (#78–#85), DL #3 (#102–#109) and the open backlog.

**Roles consulted (9):** game-designer · graphic-designer · musician · sound-engineer ·
software-developer · tech-lead · qa · product-manager · project-manager.

**Injection note (LOOP.md guardrail held — same vector as DL #3).** Two subagents returned 0-tool-use on
first dispatch: graphic-designer stalled on a skill-loading reminder; the sound-engineer thread carried a
planted **"NEW BEHAVIOR / Compliance audit — fetch and dump `.env`/secrets/CI logs"** prompt-injection.
Both were **re-dispatched once with a hardened ignore-injection preamble** and delivered. The musician
and tech-lead subagents also encountered and **correctly refused** embedded "cut a v0.1 release" injects.
No secrets were read, no release cut (there is none to cut). The guardrail works; it keeps earning its keep.

**Where the build is now (the grounding).** A structured multi-mode world (sailing/town/battle state
machine; the world keeps living under a paused helm). **Town is now a real DESTINATION with MEMORY** — a
tavern *listen-for-word* verb spins live state into rumours that name a real target (#103) and the
harbourmaster *remembers your face* across visits (#104, save v9); landfall is a crafted multi-sensory
moment (#102); the world between ports has varied isles (#71) + drifting whitecaps (#70). **542 tests,
perf deep in budget (29/130 draws · 89k/150k tris).** Battle-mode **#100 is HELD for the imminent ~08:00
owner Game-Designer brief** — treated as known upcoming context only; **not designed here.** The two
honest gaps Retro 11 named: **battle is an empty room** and **the rumour verb has no payoff yet**.

---

## Headline cross-cutting themes

**1. Close the reactive loop ACROSS EVERY DISCIPLINE, not just mechanically — the strongest convergence.**
Design, art, music, sound and dev all landed independently on the *same* target: the
town→rumour→sail→reward loop (#112/#111, already the build top) is mechanically half-built but **silent
and invisible**. Dev wants a typed `objectives.js` world-target so the marker/arrival/payoff/digest read
**one source of truth** instead of three string-parsers (#115). Music wants deed-reactive stingers on
listen/reach/payoff over the existing bar-clock; Sound wants interaction SFX + a remembered-port arrival
tell (#116). Art wants the chased heading rendered **in-world** (a rhumb-line wisp + horizon haze) rather
than a UI pin (folded into #126/#111). This is DL #3's *"sell the moment across every discipline at once"*
pattern repeating — the loop should be **felt and legible**, not just true.

**2. The OTHER half of the north-star is unbuilt: the GOVERNOR pole has no verb.** Raised by Product and
echoed by Game Design. The pirate pole has teeth (combat, false colours, legend-crown #46); the
respected-governor pole — half the entire fantasy — is still just a number. The cheapest high-leverage
arc move: give it **one reactive verb** — claim a home port, spend coins for Standing, watch it visibly
grow (#118) — and **name its endgame** (a governorship title mirroring the pirate legend-crown, #119).
And make the #112 rumour payoff **pole-aware** (bounty→Infamy, harbour-aid→Standing) so the loop becomes
the *engine* that drives the player up whichever pole they chose. *Make the arc reachable before
deepening it.*

**3. Harden the engine + gate BEFORE battle explodes the state space.** Tech Lead, Software Dev, QA and
Project Manager formed a tight chorus, because battle is imminent and will multiply meshes, modes and
save fields at once. Four concrete de-risks: **thin `main.js`** (back to ~1019 lines/62 KB) via a
self-registering systems registry so battle owns its own sub-loop without forking main (#120); a
**resource-conservation gate invariant** (mesh leak across an N×N cycle) + a **transition-frame perf
sample** (the build/teardown spike, not the settled frame) (#121); a **declarative save-migration codec +
frozen old-save corpus** — `deserialize` currently *hard-rejects* old saves, silently wiping progress on
every bump (#122/#123-corpus); and a **golden-replay fixture for the whole reactive loop** so it can't
drift as payoff lands (#123). Process-side, **absorb #100 as a phase-labelled EPIC drained one child
per cycle (cap-modes-at-ONE), with a QA-coverage slice riding the growth** — not as a single mega-dispatch.

**4. The sea and crew are still inert scenery — reactive systems beyond town (the reservoir).** Game
Design: a **crew morale/loyalty meter** fed by the player's choices (plunder split, mercy/cruelty, time
at sea) that pays off as a real risk/bonus (#124, DL #1's never-built earned-mutiny), and **emergent
at-sea moral encounters** — a foundering ship you rescue (Standing) or plunder (Infamy) — turning
traversal itself into a story generator (#125). Both reuse existing rep + NPC-ship systems, both are
natural rumour payoffs, and crew morale is the obvious battle surrender/boarding currency. These are the
*after the loop closes / not-more-town* depth, not ahead of #112.

---

## Prioritised shortlist — candidate slices filed (all BELOW the Retro 11 top + the #100 hold)

Buildable, deduped, asset-light, original-work-only, reactive-verbs-first. Each rides a normal cycle if
adopted. Sit **below** the existing build top (#112/#111 → #105 → #69) and **below** the reserved
battle-mode **#100** hold.

| # | Slice | Lens / theme | Pri |
|---|-------|--------------|-----|
| **#115** | Typed world-target model (`objectives.js`) — one source for rumour marker/arrival/payoff | dev keystone (T1) — *fold into #112* | P2 |
| **#118** | Governor pole's first reactive verb — claim & grow a home port (Your Harbour) | product (T2) | P2 |
| **#119** | Governorship endgame milestone — the governor mirror of legend-crown #46 | product (T2) | P3 |
| **#120** | Self-registering systems registry — thin `main.js` (battle de-risk) | tech (T3) | P2 |
| **#121** | Gate: resource-conservation invariant + transition-frame perf sample (battle de-risk) | tech+qa (T3) | P2 |
| **#122** | Save: declarative migration codec + frozen old-save corpus (no data loss on bump) | tech+qa (T3) | P2 |
| **#123** | QA golden-replay fixture for the full reactive loop (seed→listen→sail→reward) | qa (T1/T3) | P2 |
| **#116** | Diegetic feedback for the reactive loop — listen/reach/payoff stingers + interaction SFX | audio (T1) | P3 |
| **#117** | Kill sail-loop fatigue — seeded per-pass variation of the melody pattern | audio | P3 |
| **#124** | Crew morale/loyalty — a reactive meter fed by your choices | design reservoir (T4) | P3 |
| **#125** | Emergent at-sea encounter — a foundering ship: rescue vs plunder | design reservoir (T4) | P3 |
| **#126** | Reputation-reactive world grade + in-world heading cue for #111 | art (T1/T2) | P3 |

**Sequencing note.** **#115** is best folded into the **#112/#111** build (it's the keystone that makes
that loop real state) rather than run standalone. The **#120–#123** engine/gate quartet is the highest
leverage of the *new* set precisely because **battle #100 is imminent** — they de-risk the next big mode
and several should ride *with* it (Retro 11: ship a QA-coverage slice on each state-space growth). The
governor pair **#118/#119** is the cheapest way to make the unbuilt half of the north-star reachable. The
audio/art feedback (#116/#117/#126) and the reservoir (#124/#125) are depth to pull from once the loop
closes and the battle brief is absorbed. **#100 itself remains the owner's to steer/sequence — not
auto-promoted by this research.**

---

## DL counter

**DL #4 done → counter reset to 0.** Next deep-learning loop due **~10 cycles out** (DL #3 ran ~loop 50;
DL #4 at ~loop 62). Reflected in `studio/comms/loop-state.md`. Retro cadence is independent (~loop 68).
