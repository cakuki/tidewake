# Tidewake — Roadmap

How we get from "a sloop on a pretty sea" to "write your own pirate/governor legend" —
in tiny, always-shippable increments. We release several times an hour; every milestone
below is a *theme*, not a big-bang. Slices land continuously and the game stays playable
after each one.

Two tracks run in parallel:

- **Product** — what the player feels: mechanics, content, fun, funny.
- **Technical** — what makes it possible: engine, performance, pipeline, infra.

Two themes are **threaded through every milestone**, not parked in one:

- **🌊 Realism pass** — wind, swell, light, sound, and motion creeping ever closer to
  "believable sea." A little better every milestone.
- **🪶 Humour & writing** — port banter, item flavour, signage, loading tips, NPC voice.
  Comedy lands continuously, in small quotable doses.

See [`VISION.md`](VISION.md) for the fantasy and pillars. Issues on GitHub are the source
of truth for what's actually in flight; this file is the map.

---

## 📥 Owner feedback — accepted at the PM desk (2026-06-27)

Intake + triage session with the owner. All value- and feasibility-assessed; proposed priorities
await loop **PM + TL sign-off**. `from-owner` issues:

| Issue | Slice | Target | Prio |
|-------|-------|--------|------|
| [#49](https://github.com/cakuki/tidewake/issues/49) | Camera opens astern (over the bow) each session | M1 — Feel the Wind | P1 |
| [#50](https://github.com/cakuki/tidewake/issues/50) | Fix compass wind-indicator drift on turn | M1 — Feel the Wind | P1 |
| [#51](https://github.com/cakuki/tidewake/issues/51) | Tame oversized swell so coasts/docks stop submerging | M1 / 🌊 realism | P1 |
| [#52](https://github.com/cakuki/tidewake/issues/52) | Performance: measurement-first budget gate, then cull/LOD/shaders | M4 + ongoing 🌊/tech | P1 |
| [#53](https://github.com/cakuki/tidewake/issues/53) | Standard: self-contained, self-tested UI components | M9 / tech, ongoing | P2 |
| [#54](https://github.com/cakuki/tidewake/issues/54) | Toggleable bigger map for route planning (MVP) | M2 / M4 | P2 |
| [#55](https://github.com/cakuki/tidewake/issues/55) | ✅ Research done → [`docs/art-sourcing.md`](https://github.com/cakuki/tidewake/blob/main/docs/art-sourcing.md): CC0-first (Quaternius/Kenney Pirate Kits); hero-ship swap ready in [#32](https://github.com/cakuki/tidewake/issues/32) | Art & Audio direction | P2 (closed) |
| [#56](https://github.com/cakuki/tidewake/issues/56) | Owner-decision: mobile support (feasibility done, full build parked) | M4 — Touch the Horizon | P2 |
| [#62](https://github.com/cakuki/tidewake/issues/62) | Mobile **Phase 0** — real-device spike (FPS/heat/UX) to de-risk the build | M4 — Touch the Horizon | P2 |
| [#63](https://github.com/cakuki/tidewake/issues/63) | **iOS via WebView/PWA** (Approach 1) — wrap the web build for the App Store; native renderer parked | M4 — Touch the Horizon | P2 |
| [#65](https://github.com/cakuki/tidewake/issues/65) | Bug: ocean clips through the open hull (ship looks like it has water inside) | M1 / 🌊 realism | P1 |
| [#66](https://github.com/cakuki/tidewake/issues/66) | Bug: iPhone touch buttons overlap the town/trade panel | M4 / UX | P1 |
| [#67](https://github.com/cakuki/tidewake/issues/67) | **Auto-harbor on approach** — announce→slow→city view→nav off→Leave; visible+audible cues, short, reversible | M2 — Make Landfall | P1 |
| [#68](https://github.com/cakuki/tidewake/issues/68) | Seagulls — louder calls near the coast (SFX exists) + visual flock | Art & Audio / 🌊 | P2 |
| [#69](https://github.com/cakuki/tidewake/issues/69) | Per-town music (transposition-first); rides the #67 city view | Art & Audio | P2 |
| [#70](https://github.com/cakuki/tidewake/issues/70) | Ocean micro-details + sail-over delight; **standing rule: 1-2 per loop/retro** | 🪶 Humour (ongoing) | P2 |
| [#71](https://github.com/cakuki/tidewake/issues/71) | Islands TLC — palette/variety/props polish (coord w/ #61) | Art & Audio / 🌊 | P2 |
| [#61](https://github.com/cakuki/tidewake/issues/61) | Sunny/holiday **Caribbean sea-surface** — turquoise palette + sun glint + subtle detail (original shader, no franchise sampling) | M1 / 🌊 realism | P1 |
| [#76](https://github.com/cakuki/tidewake/issues/76) | **Solidify the sea** — island + ship collision + arcade slow-to-stop (a1/c/b/a2) — ✅ **DELIVERED & CLOSED** | M1 / 🌊 realism · M2 #67 · M6 #59 | P1 |

### Second intake (2026-06-28) — accepted

| Issue | Slice | Target | Prio |
|-------|-------|--------|------|
| [#94](https://github.com/cakuki/tidewake/issues/94) | **Unified sound & music system** — multiple rotating sailing tracks + per-town/city themes + battle music + proximity crossfade ("port nearby" cue). Absorbs #69; resolver built context-shaped for future zones #99 | M9 audio / 🌊, ongoing | P1 |
| [#95](https://github.com/cakuki/tidewake/issues/95) | **Mode system** — sailing/town/battle modes; player sailing pauses while NPCs keep moving; + battle-mode switch plumbing. Shared spine for #94 (battle/town music) & #96 | M2 / M6 / tech | P1 |
| [#96](https://github.com/cakuki/tidewake/issues/96) | **Town/city mode** — harbour→disembark→market as a deliberate mode left via a button (not a pop-up); fixes mobile market overlap (#66); room for town activities | M2 / M3 / M8 | P1 |
| [#97](https://github.com/cakuki/tidewake/issues/97) | **Living sea fauna** — flying gulls, jumping dolphins, ambient animals (instanced + culled; extends #68) | Art & Audio / 🌊 | P2 |
| [#93](https://github.com/cakuki/tidewake/issues/93) | **Ship's-wheel touch steering** — replace L/R buttons with a draggable wheel widget; camera-orbit coexistence solved by DOM layering (async desk's canonical ticket; my dup #98 closed, TL note folded in) | M4 / UX | P2 |
| [#99](https://github.com/cakuki/tidewake/issues/99) | **Sail zones** (future) — invisible regions driving sailing music; later hostility/weather. Producer of #94's `zoneId` context | later / 🌊 | P3 |
| [#100](https://github.com/cakuki/tidewake/issues/100) | **Game Designer: battle-modes research + owner brief** (arcade combat / loadouts from workshops / boarding→crew fight/captain duel; keep verbal duel, expand jabs). ✅ Brief delivered 2026-06-28; now the **design source-of-truth** for #135 | M6 | — |
| [#135](https://github.com/cakuki/tidewake/issues/135) | **Battle system — incremental: Option 2 (Maneuvering Battle) → then Option 4 (Three-Act Raid)**. Owner-chosen 2026-06-28; shipped as small gamer-testable slices (battle-mode shell → real-time broadside → workshop loadouts+ammo cycle → boarding→crew brawl→verbal duel → 50+ insults). **Current focused delivery lane.** Rides #95; reuses cannons.js/duel.js | M6 (Opt 2) → M7 (Opt 4 acts 2–3) | P1 |
| [#32](https://github.com/cakuki/tidewake/issues/32) | **Hero ship glTF swap** — adopt a CC0 Quaternius/Kenney Pirate Kit ship (per #55 research); procedural ship as async fallback. *Owner-greenlit 2026-06-28* | Art & Audio | P2 |
| [#101](https://github.com/cakuki/tidewake/issues/101) | **CC0 Pirate Kit props** — dress ports/islands/decks (jetties, barrels, crates, palms, lanterns, stalls); rides #32's loader pipeline; a few props per loop | Art & Audio / 🌊 | P2 |

> **#69 per-town music** is now the per-town-themes slice of the unified sound system **#94** (folded in, not a separate build).
> **#32 + #101 (art, 2026-06-28):** owner directed us to start using the **CC0 Pirate Kit** assets (Quaternius/Kenney, "Excellent" style fit per `docs/art-sourcing.md`/#55) — **ships and props**. CC0-only, original silhouettes, `CREDITS.md` (CONSTITUTION).
> **Carve-outs from the 2026-06-28 GO:** iOS/native renderer stays parked (#56/#62/#63 unchanged); battle **scenario** waits for the #100 brief — only the battle **switch** infra (#95) proceeds now.
> **Sequencing the owner set:** fix the open owner bugs first (#66 mobile overlap; #65 ✅ done), then build #95 → #94 → #93 → #97 → #96, with the art track (#32→#101) riding alongside. Loop PM+TL confirm priorities.
> **Battle is now the focused lane (2026-06-28, owner):** **#135** ships Option 2 as small slices, then grows into Option 4. Per the lane-switch gate (Working principles), the loop **stays on the battle lane until it delivers something impressive AND gamer-testable** before switching to another lane (e.g. music #94's deeper slices). BAU bug/UI fixes continue alongside. PM coordinates deliver→test→evaluate per slice.
> **Held — not yet planned:** a **Community Manager** role (post community updates, gather player feedback as a 4th test layer beyond unit/UI/QA) is recorded `record-only` at the owner's instruction — picked up **after the weekly usage reset**. See `studio/feedback/inbox/2026-06-28-community-manager-role.md`.

\* #76 ✅ delivered. All second-intake priorities are **proposed, pending loop PM + TL sign-off**.

---

## v0 — Set Sail ✅ SHIPPED

A playable prototype, live at https://cakuki.github.io/tidewake/.

- **Product:** animated ocean, a sloop with arcade sailing physics, wind that rewards
  sailing off the wind, scattered islands, follow camera with drag-to-orbit, HUD
  (heading / speed / wind).
- **Technical:** no build step — plain ES modules + three.js from CDN; deterministic
  `step()` sim hook; headless Puppeteer play-test gate; GitHub Actions release pipeline
  tagging `v0.0.YYYYMMDDHHmmSS` and deploying to Pages.

---

## M1 — Feel the Wind (sailing & game feel)

Make the core toy — sailing — genuinely satisfying and readable before adding systems.

- **Product:** on-screen wind indicator + sail-trim feedback (points of sail, "in irons"
  when pointed into the wind); speed/heel feedback on turns; gentle wake/foam at the bow;
  a comedic loading-tip line pool. 🌊 swell/light polish. 🪶 first tip-line voice.
- **Technical:** input polish (smoothed steering, key remap groundwork); save player
  position + heading to `localStorage`; FPS guard in the play-test gate; small refactor of
  ship state into its own module for future systems.

## M2 — Make Landfall (ports & first destinations)

Give the horizon a point: places you can sail *to* and dock at.

- **Product:** a docked **port marker** you can sail up to and "arrive" at; a minimap of
  nearby islands; named islands with flavour text; arrival toast with witty harbourmaster
  line. 🪶 port/harbour signage humour.
- **Technical:** world map data structure (islands/ports as data, not hand-placed meshes);
  proximity/trigger system; **glTF model loading** path proven by replacing the box sloop
  with a real ship model; ambient **sea + gull audio** with mute toggle.

## M3 — A Captain's Purse (economy & trade, first slice)

The first real choice loop: earn and spend.

- **Product:** simple port **trade screen** (buy low / sell high across 2–3 goods); coins
  in the HUD; cargo hold capacity; price differences between ports worth sailing for; a
  trader NPC with comic patter. 🪶 item/cargo flavour descriptions.
- **Technical:** save/load expands to coins + cargo + visited ports; lightweight UI layer
  (menus/panels) that doesn't fight the 3D canvas; data-driven goods/price tables.

## M4 — Touch the Horizon (reach, mobile, performance)

Widen who can play and how far they can roam.

- **Product:** **touch controls** for mobile (steer + throttle); responsive HUD; a bigger,
  more varied sea to explore. 🌊 distance fog / horizon haze tuning.
- **Technical:** **world streaming** — load/unload regions so the sea can grow without
  tanking performance; performance budget + profiling pass; mobile pixel-ratio + draw-call
  tuning; asset pipeline conventions documented in `assets/`.

## M5 — Not Alone Out Here (NPC ships & first encounters)

The sea gets inhabited — and a little dangerous.

- **Product:** **NPC ships** sailing routes (merchants, a patrol); hailing/encounter prompt;
  the first fork between "let it pass / trade / threaten." 🪶 rival-captain bluster lines.
- **Technical:** ship AI steering + path following reusing the sailing model; spawn/despawn
  tied to world streaming; encounter/event system groundwork.

## M6 — Powder & Plunder (ship combat, first slice)

Make the Pirate path real, simply and readably.

- **Product:** broadside **cannon fire**, hull damage, sinking, and loot pickup; flee-or-fight
  tension; the navy starts to care about your **Infamy**. 🌊 smoke/impact feel.
- **Technical:** projectile + collision system; damage/health state on ships; combat-aware
  AI states (engage / flee); audio for cannons and hits.

> **🗡️ Battle system [#135] — the M6 centrepiece (owner-chosen 2026-06-28).** Delivered as small,
> gamer-testable slices, **Option 2 first → then Option 4**:
> 1. Battle-mode shell (enter/leave on #95; banner, quarter-view camera, battle music #94, Flee).
> 2. Real-time broadside (steer for the beam, manual fire; reuses `cannons.js`).
> 3. Workshop loadouts + mid-combat ammo cycle (round/chain/grape/light/heavy/swivel; ties town mode #96).
> 4. Boarding → crew brawl → **verbal captain duel** (capture = Standing / sink = Infamy; `duel.js` is the climax).
> 5. Expanded verbal duel — 14 → 50+ insults, 7 categories (+ Superstition, + Hygiene), anti-repeat.
>
> Then **Option 4 (Three-Act Raid)** couples the phases (hull dmg → boarding odds; casualties → duel
> confidence) across M6 (act 1) + **M7** (acts 2–3). `cannons.js` turn-exchange is kept as the
> NPC-vs-NPC auto-resolver. Design source: #100.

## M7 — A Name on the Water (crew & reputation)

Make choices stick to you.

- **Product:** **reputation system** with two meters — **Infamy** and **Standing** — that
  the world reads (greetings, prices, who shoots first, which ports admit you); a small
  **crew** with morale and wages; bounties as Infamy rises. 🪶 reputation-flavoured NPC
  reactions.
- **Technical:** reputation/state model persisted to save; faction/relationship data;
  hooks so ports, NPCs, and encounters can query reputation.

## M8 — Two Legends (progression: Pirate & Governance paths)

Open both ways to win — and let them tangle.

- **Product:** **Pirate progression** (bigger ships, hideouts, infamy perks) and
  **Governance progression** (buy property, fund a port, **town/governance sim** with
  prosperity that grows over time); the interweave from `VISION.md` (buy legitimacy, fund
  raiders); titles and milestones for both. 🪶 council/townsfolk comedy, governor's-desk
  flavour.
- **Technical:** town simulation tick (economy/prosperity over time); ownership & investment
  data; long-horizon save/load robustness; progression unlock gates.

## M9 — Curtain & Polish (UX, audio, art direction, dialogue)

Tie the experience together and make it sing.

- **Product:** **main menu / new-game / settings**; a proper **dialogue system** for
  encounters and town characters; music + layered ambience; cohesive art & UI direction;
  onboarding for new captains. 🌊 full lighting/weather mood pass. 🪶 dialogue writing pass
  across the game.
- **Technical:** menu/UX framework hardening; audio mixing layer; art/asset direction doc
  and shader polish; accessibility + settings (volume, controls, reduce-motion);
  save-slot management.

---

## Always-on themes (every milestone)

- **🌊 Realism pass:** each milestone nudges sea, wind, light, motion, and sound toward
  "believable." Never a separate phase — always a slice or two in flight.
- **🪶 Humour & writing:** each milestone adds quotable, character-driven comedy — tips,
  signage, item flavour, NPC voice, dialogue. Grounded world, light heart, fun first.

## Working principles

- Every slice is small, play-tested in a real browser, and shipped on its own.
- The game is **always playable** after each release.
- Realism and humour advance *continuously*, not in a single dedicated milestone.
- Owner decisions (branding / strategy / big architecture) go to an `owner-decision` issue
  with options — never auto-adopted.

### Delivery doctrine (owner, 2026-06-28 — standing rules)

- **Fun & Working > fast delivery (owner, 2026-07-01):** the goal is **fun, not speed**. **Bare-minimum
  mechanics are rejected** — a slice that "works" but has no visible/audible/felt payoff is not done. The
  **felt/visible fun + progression payoff is part of the Definition of Done**: a purchase must *visibly
  change something* (buy a cannon → see it, hear it, feel enemies sink faster). Each agent **researches
  the definition of fun from real gamers** (reviews/comments) and designs to it. Source-of-truth &
  per-slice checklist: [`docs/design/what-makes-it-fun.md`](design/what-makes-it-fun.md). **WE ARE A GAME
  STUDIO.**

- **Self-eval bar:** every slice ships with a **clearly achievable, testable outcome**. If it can't be
  machine-verified, put a **human in the loop** (for now that human is **only the owner**). Plus a
  standing **self-improvement** duty — iterate on the *process itself* (raise self-awareness, fix the
  loop), not just the game. Pairs with #53 (self-tested UI) and the retro/self-eval cadence.
- **Business as usual:** always keep delivering **bug fixes + UI improvements** alongside the headline
  lane — the lights stay on.
- **Continuous visual quality (GD + GfxD, every loop):** the Game Designer and Graphic Designer keep
  **improving the visuals** and **sourcing free-to-use, style-matched models** as a standing per-loop
  habit (≥1 visual win / vetted model swap per loop) — **#143**, under Art & Audio epic #6. Guardrails:
  **CC0/self-made for core art** (public repo; CC-BY only with `CREDITS.md`; no NC/ND), original
  silhouettes, perf-budgeted (#52), matched to the sunny Caribbean look (#61). Pipeline: `docs/art-sourcing.md`, #32, #101.
- **Release cadence + daily rituals (owner, 2026-06-29):** the loop builds continuously to a **preview**
  channel, but the **public** game is promoted on a **human cadence** — **daily at 17:00 Berlin, 7 days a
  week** (list notes; weekends included) and a **marketed weekly release every Friday** that takes over
  that day's slot (extra-hardened, screenshots/clip; "no weekend frustration"). **Three channels routed by
  a simple landing page, stability `weekly > daily > preview`:** `/weekly/` (Fri, **tag + GitHub Release**)
  · `/daily/` (commit + date) · `/preview/` (remotely-viewable, commit + datetime). **Friday flow with room
  to fix:** intense QA **~14:00** → a **fix & stabilize window** (revert risky/unfinished work to a known
  stable state, re-QA) → **go/no-go ~16:30** → weekly release **17:00** — a solid weekend build, never a
  rushed one. The studio runs a **daily ritual schedule** — morning owner briefing, Mon weekly
  planning, sleep/defrag (memory), deep reading, pre-release hardening, release, daily retro — all
  **time-gated by the local loop** (`studio/comms/rituals.md`; `docs/runbook/LOOP.md` step 0.5). Spec:
  `docs/superpowers/specs/2026-06-29-loop-rituals-and-release-cadence-design.md`. Release infra (preview→
  public promote split) = **#145** (ops track, alongside the focused lane, not preempting it).
- **Focused-lane delivery + lane-switch GATE:** work the single most important improvement lane and
  **do not switch to another roadmap lane until the current one has shipped something impressive AND
  gamer-testable** over several loops. *Example: don't switch from the battle-system lane (#135) to the
  music lane until battle has delivered something impressive players can actually test.* The PM owns
  calling the gate.
