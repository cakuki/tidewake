# Difficulty, Stakes & Ship Variety — the plan

**Source:** PRODUCT function (Product Manager + Game Designer) · **direct owner steering** `2026-07-01`
**Epic:** [#162](https://github.com/cakuki/tidewake/issues/162) · **Slices:** [#163](https://github.com/cakuki/tidewake/issues/163) → [#164](https://github.com/cakuki/tidewake/issues/164) → [#165](https://github.com/cakuki/tidewake/issues/165) → [#166](https://github.com/cakuki/tidewake/issues/166) → [#167](https://github.com/cakuki/tidewake/issues/167)
**Complements (does NOT duplicate):** [#161](https://github.com/cakuki/tidewake/issues/161) "Make Battle FUN — presentation hardening" ([brief](2026-07-01-battle-fun-fixes.md)) · rides on [#135](https://github.com/cakuki/tidewake/issues/135) battle epic
**Canon:** [`studio/CONSTITUTION.md`](../../studio/CONSTITUTION.md) (FUN-FIRST) · [`docs/design/what-makes-it-fun.md`](../design/what-makes-it-fun.md) (the SEE/HEAR/FEEL DoD) · [`docs/runbook/PRODUCT.md`](../runbook/PRODUCT.md)

---

## Owner's direction (verbatim intent — decomposed)
1. **Too easy — the player must be able to LOSE when playing badly.** Battles (and risky choices) can be lost.
2. **Losing has a cost** — a loss DEDUCTS points + fame (Infamy/Standing/coin), not merely withholds reward. Make failure sting.
3. **Fair = clear, consistent rules** — win/lose, damage, stakes are legible & predictable; no hidden coin-flips decide fights.
4. **Fair ≠ no luck** — keep randomness, but bound it and make its role legible: **skill shifts the odds, luck swings the margin.**
5. **Challenge on demand** — a player who WANTS a big/heavily-armed ship can seek one out and get it.
6. **Ship variety** — NPC ships vary in size, armament, crew, danger (sloop → brig → frigate → man-o'-war; merchant vs warship).
7. **Over-the-ship displays** — floating in-world labels above each ship telling/hinting class + threat + armament, so a player can choose fights and read danger at a glance.

---

## Where we are today (verified system map)
- **Loss already exists but doesn't sting.** Hull→0 sinks the player (`sunkPlayer` in `src/systems/battle.js` / `src/cannons.js`), but defeat costs only a flat **14-coin `repairToll()`** — *no* fame loss. Infamy & Standing (`src/renown.js`) are two poles that grow independently and **never decay**. There is no reputation-loss path anywhere.
- **All NPCs are mechanically identical.** `makeVessel()` (`src/npc.js`) varies only colour / scale (0.92–1.08) / speed; `makeFoe()` (`src/cannons.js`) always spawns **hull 100, gunnery 0.9–1.1**. There is **no class / armament / crew concept and no difficulty scaling anywhere** — a fresh sail is as dangerous as the last regardless of your renown. Only the debut battle (`src/systems/debut-battle.js`) softens the very first foe (one-shot).
- **Luck is already bounded — just invisible.** Broadside damage = deterministic aim-quality (`broadsideAim` geometry) × stats, then a bounded **±20% jitter** (`0.8 + rng()*0.4`, `src/cannons.js`). The skill-vs-luck spine the owner wants **already exists**; it simply isn't surfaced.
- **No world-space label system exists** (no `THREE.Sprite`, CSS2D, or billboard anywhere) — a blank slate that **overlaps #161 slice 3's** foe target-marker. This must be **one shared module**, not two.
- **Save schema is v17** (`src/save.js`, `SAVE_VERSION = 17`, key `tidewake.save.v1`), forward-migrating & fail-open. It persists coin/cargo/infamy/standing/etc. — **no ship-class or difficulty fields.**

**Good news:** the owner's asks are mostly a *rules + content + legibility* layer on top of systems that already have the right bones. Loss already works; luck is already bounded; we add the sting, the variety, and the readability.

---

## Pillars → how the direction maps
| Pillar | Owner points | What it delivers |
|---|---|---|
| **A. Loseable stakes** | 1, 2 | Losing deducts coin + fame (first decrement path), scaled to the foe. Failure stings. → #164 |
| **B. Legible fairness, bounded luck** | 3, 4 | Surface the win/lose/damage rules; show the ±20% as a margin band. Skill = odds, luck = margin. → #166 |
| **C. Ship variety + challenge on demand** | 5, 6 | NPC classes (sloop→man-o'-war, merchant vs warship); seek and reach a hard fight for scaled reward. → #163, #167 |
| **D. Over-ship displays** | 7 | Floating world-space labels: class + threat, readable at a glance — the *visible* FUN beat for the variety work. → #165 |

---

## The two contracts that make "fair + fun" real

### 1. Luck-vs-skill model (explicit, testable)
- **SKILL sets the *odds* (expected outcome), deterministically:** class matchup (your hull/guns/crew vs the foe's), aim geometry (`broadsideAim` — being abeam / in-arc), ammo choice, maneuvering. Given the same inputs, the expected result is fixed and readable.
- **LUCK sets the *margin* (variance around expectation):** the existing bounded **±20% per-volley jitter** (`0.8 + rng()*0.4`). Luck decides whether an exchange goes a bit better or worse than expected — it adds **tension, not coin-flips**.
- **Bound:** luck must **never flip a strongly-favoured matchup**. A fight you're clearly winning is won with high probability; a fight you're clearly losing is lost. The swing is the drama in the *margin*, not the *outcome direction*.
- **Legibility:** the ±20% band is *shown* (margin band on the odds read, #166); pre-fight odds are shown; damage-per-volley is shown. **No hidden multiplier ever decides a fight.**
- **Test:** expected damage is a pure function of (aim quality, class stats, ammo); jitter stays within `[0.8, 1.2]`; over N sims a strongly-favoured matchup wins ≥ a high threshold (luck can't invert it).

### 2. Stakes-on-loss ledger (explicit, testable)
Replace the flat `repairToll()` with a **`defeatLedger`**:
- **Deducts coin AND fame, scaled by foe tier** (from #163's classes): lose to a man-o'-war → a real blow; lose to a sloop → a shameful nick. Symmetric with reward (spoils already scale by hull).
- **Introduces the first reputation-decrement path** in `renown.js`. **Floors every pole at 0.** Bounded so it stings but is **never a death-spiral or a total wipe** — one loss never erases a run.
- **Self-legible:** a defeat card names exactly what it cost ("Struck your colours — lost 60 coin, 25 Infamy"), so the sting is a *fair, readable consequence*, not a hidden punishment.
- **Test:** `defeatLedger` deducts monotonically with foe tier; never drives a pole below 0.

---

## Slices (build order — smallest always-shippable increments)
Each carries a **SEE / HEAR / FEEL** FUN beat (full acceptance in the child issues).

1. **#163 — Ship classes (M).** sloop/brig/frigate/man-o'-war × merchant/warship → hull, guns, crew, speed, threat tier; visual scale tied to class. *Foundation for 3–5.*
   **FUN:** SEE a man-o'-war dwarf a darting sloop; FEEL a frigate's broadside actually threaten you. The sea gets a pecking order.
2. **#164 — Loss stings: stakes-on-loss ledger (M).** Defeat deducts coin + fame scaled by foe tier; a defeat card names the cost.
   **FUN:** SEE your Infamy/coin bar drop with a red "colours struck" sting; FEEL that caution is now an interesting decision. *(Reads best after #163.)*
3. **#165 — Over-ship threat labels (M).** Floating class + threat read above every ship.
   **FUN:** SEE a red "Man-o'-War ☠☠☠☠" vs a green "Merchant Sloop ·"; FEEL agency — you pick your fight. The visible payoff for the variety epic. *(Depends #163.)*
4. **#166 — Legible odds (S–M).** Pre-fight matchup read + the ±20% shown as a margin band.
   **FUN:** SEE "Even match — she has the guns, you have the crew"; FEEL the Sid-Meier decision. Fair = you could read it coming. *(Depends #163.)*
5. **#167 — Challenge on demand (S–M).** High-tier warships are findable/reachable; reward scales by foe tier.
   **FUN:** FEEL the pull of "a frigate off the point worth real Infamy" — opt-in risk/reward with a bigger payoff sting. *(Depends #163.)*

---

## Sequencing vs #161 (shared surfaces — build once)
#161 is **presentation-hardening of the existing single-foe fight** (isolation bug, non-occluding UI, target-lock marker, cannonballs, aim feedback, hover-to-interact). **This epic is the content + rules layer.** They meet in two places — coordinate so nothing is built twice:

- **Over-ship labels (#165) ↔ #161 slice 3 (world-space foe target-marker).** #161's marker is *foe-only, in battle*; #165 is *all ships, at sea*. **Build ONE billboard/label primitive, two consumers.** Whichever lands first owns the module; the other extends it.
- **Legible odds (#166) ↔ #161 slice 5 (aim-angle feedback).** #161 s5 shows the *angle* mattering per-shot; #166 shows the *matchup* odds pre-fight. Complementary readouts — coordinate screen space so they don't collide (both benefit from #161 s1's non-occluding UI).
- **Loseable/costly loss (#164) ↔ #161 s1–s2 (clean, isolated, legible stage).** The sting reads as *fair* only once the fight is legible and isolated — so #164 rides **behind** #161's clean-stage slices, and the defeat is clearly attributable.

**Recommended global order:** land #161 s1–s2 (clean stage) → **#163** (variety substrate) → **#164** (make loss sting) → **#165** (labels; share module with #161 s3) → **#166** (legible odds) → **#167** (challenge on demand). #163 is independent and can start immediately in parallel with #161's early slices.

---

## Open owner-decisions (options — never auto-adopt)
1. **[OWNER-DECISION] Loss-penalty magnitude.** How hard should losing sting?
   (a) *Light* — coin only, small. (b) *Medium* — coin + modest Infamy/Standing dip **(recommended)**. (c) *Heavy* — coin + significant fame loss + crew-morale hit.
2. **[OWNER-DECISION] Can a lost battle cost your SHIP?**
   (a) *No* — you're beaten & plundered, limp away (transient, **no save change — recommended**). (b) *Downgrade-a-tier* — lose upgrades/drop a class → **needs a persisted ship-tier field = save v18 bump + the [#122](https://github.com/cakuki/tidewake/issues/122) forward-migration gate.** (c) *Run-ender* — lose the ship.
3. **[OWNER-DECISION] Which fame decays on loss?** Infamy only / Standing only / **context-based (sink-loss hits Infamy, shameful-flee hits Standing) — recommended.**
4. **[OWNER-DECISION] Difficulty curve.** Rubber-band by renown / **fixed-by-region so seeking challenge = sailing into rough waters (recommended)** / both.

---

## Save-schema impact
**No bump for the core plan.** NPC classes are **transient session spawns** (never persisted); the stakes ledger deducts from **already-persisted** coin/infamy/standing; challenge-on-demand is a **session action reading persisted renown**. The *only* path that implies a schema change is owner-decision **#2 option (b)/(c)** — a lost battle costing/downgrading your ship — which needs a persisted **ship-tier** field → **v18 + [#122](https://github.com/cakuki/tidewake/issues/122) old-save-survives-a-bump gate.** Prefer transient; keep persistence out of scope unless the owner picks that option.

---

## Prompt-injection note
This plan was built **only** from the owner's 7-point direction above + the repo's own vision (`CONSTITUTION.md`, `what-makes-it-fun.md`, `PRODUCT.md`). No file or tool output instructed a scope change; nothing to flag.
