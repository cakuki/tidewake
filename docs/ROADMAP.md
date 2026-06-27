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
| [#55](https://github.com/cakuki/tidewake/issues/55) | Research: art-asset sourcing strategy + budget | Art & Audio direction | P2 |
| [#56](https://github.com/cakuki/tidewake/issues/56) | Owner-decision: mobile support (feasibility done, full build parked) | M4 — Touch the Horizon | P2 |
| [#62](https://github.com/cakuki/tidewake/issues/62) | Mobile **Phase 0** — real-device spike (FPS/heat/UX) to de-risk the build | M4 — Touch the Horizon | P2 |
| [#61](https://github.com/cakuki/tidewake/issues/61) | Sunny/holiday **Caribbean sea-surface** — turquoise palette + sun glint + subtle detail (original shader, no franchise sampling) | M1 / 🌊 realism | P1 |

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
