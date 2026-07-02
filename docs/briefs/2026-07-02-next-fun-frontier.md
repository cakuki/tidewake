# Design brief — The next fun frontier: THE RISE

_2026-07-02 · PRODUCT function (PM + Tech Lead + Game Designer) · roadmap-change cycle at an inflection point._
_Epic: [#168](https://github.com/cakuki/tidewake/issues/168) · child slices [#169](https://github.com/cakuki/tidewake/issues/169)–[#174](https://github.com/cakuki/tidewake/issues/174)._

## Why now
Tonight the studio made **battle** genuinely fun — rich, varied, fair, juicy (#161 Make Battle FUN,
#162/#163–#167 Difficulty·Stakes·Variety, #158 per-phase music, #159 diegetic keycaps, #80 combat juice,
#70 sea-delight). Per `docs/design/what-makes-it-fun.md` the fun loop is **action → feedback → progression
→ mastery**. The **action → feedback** arrow is now strong. This cycle re-anchors on the game AS IT NOW IS
and finds the honest gap: **the feedback → PROGRESSION → mastery arrows are broken.**

## The honest fun-gap (verified against the source, 2026-07-02)
- **Nothing to spend spoils on that visibly grows your power.** Coin sinks: trade, home-port investment,
  tribute, repairs. **No shipyard; no persistent workshop upgrade.** The player's ship is a *fixed
  4-cannon sloop* (`src/ship.js`); the sloop→brig→frigate→man-o'-war class system (`src/ship-classes.js`,
  #163) exists **for NPCs only**. The owner's canonical fun example — *"buy a cannon → see it on the deck →
  hear a heavier boom → feel enemies sink faster"* — **does not exist at all.**
- **Beating a man-o'-war doesn't *feel* like you rose.** 8 ranks + pole titles live in `src/renown.js`
  (Bilge-rat → Dread Captain / Governor / Terror), all derived from the persisted infamy/standing — but
  **nothing announces a rank-up.** The rise is two silent numbers.
- **The world barely escalates.** Greetings / port-memory / price-favour react to renown, but **ships never
  flee or surrender a feared captain**, and there are **no bounties**.
- **No "one more voyage."** Pure sandbox; the only directed activity is a 60c rumour chase. Legends are
  terminal trophies, not goals that send you back out.

This is the vision's own **core loops #4 (grow reputation → unlock ships/allies/threats)** and **#5 (Invest
or Conquer)** — still unbuilt.

## External inspiration (WebSearch, July 2026)
- **The "just one more voyage" hook lives in visible, persistent upgrades between voyages.** Rogue Waters /
  roguelite progression writing: each run must directly feed *perceptible* ship/crew power in a hub you
  return to. Cosmetic-only / number-only progression is the #1 thing players call "hollow" (Sea of Thieves
  critiques).
- **A feared captain's reputation should turn the world against him by word of mouth.** Rise of Piracy:
  *"as word travels, even lonely ships would rather give up than face you head on."* Dread is something you
  watch happen on the water, not a stat.
- **Bigger ships are the most legible power fantasy** (sloop → galleon: more speed, more firepower, visible).

Sources: rogueliker.com/rogue-waters-review; gamerant roguelite-progression; riseofpiracy.com; seaofthieves
forums (progression / notoriety); gamespot Windrose ship guide.

## The frontier: **THE RISE** — close the reward → progression → mastery loop
Make the spoils you now earn from rich battles **visibly grow your ship and power**, mark your climb with a
**felt milestone**, make the **world escalate how it treats your legend**, and give a **goal** that sends
you back out. Deepen the now-rich battle/rise into a compelling *loop* — depth over breadth.

## The slices (sequenced by value · complexity · deps; each states its SEE/HEAR/FEEL beat)

1. **[#169] Rank-up milestone — the felt "you rose."** (S · no save bump) — LEAD; cheapest, frames the
   whole lane, gives every deed you already do a visible climb. Crossing a `renown.js` rank fires a title
   card + level-up sting. _SEE the title, HEAR the sting, FEEL the rise get a heartbeat._
2. **[#170] Buy a cannon at the Gunner's Workshop — SEE it on your deck.** (M · **save v17→v18**) — the
   owner's canonical broken-arrow fix. Persistent gun upgrade: extra cannon mesh on your deck + heavier
   boom + more broadside damage. _SEE the new gun, HEAR the heavier boom, FEEL enemies sink faster._
3. **[#171] Buy a bigger ship — the hull visibly grows.** (M · rides #170's v18) — give the PLAYER the
   existing class system; buy up sloop→brig→frigate. _SEE your ship dwarf the sloop you started in._
4. **[#172] The world fears you — weak ships flee / strike early to a feared captain.** (M · no bump) —
   Infamy rank bends NPC behaviour (bounded; only weak prey blinks). _SEE a sloop run from your sails._
5. **[#173] The bounty board — a named target + scaled reward.** (M · reuses persisted objective slot) —
   the "one more voyage" hook; reward feeds the upgrade loop. _SEE a bounty → chase → claim → spend._
6. **[#174] Governor-pole symmetry — invest spoils to grow your port VISIBLY.** (S/M · no bump) — the
   Standing road's equivalent of a bigger ship, so both paths feel complete. _SEE your port prosper._

**Sequencing rationale.** #169 is the highest leverage-per-cost win and gives immediate meaning to spoils,
so it leads. #170 is the flagship owner fix and carries the **only save bump** — its v18 schema must also
**reserve the player ship-class field** so #171 needs no further bump. #170→#171 are the visible power
fantasy; #172 makes the world react to it; #173 gives a reason to go earn more; #174 keeps the governor
pole symmetric. #172/#173/#174 are derived / transient — no bumps.

## Save-schema (#122 standing rule)
Only **#170** bumps (v17→v18). It must migrate every prior version forward, add a frozen v18 corpus blob,
and keep the coverage guard green — **and reserve the ship-class field for #171** so the lane bumps once.

## [OWNER-DECISION]s (recommend, never auto-adopt)
1. **Lane sequencing — The Rise (fun frontier) vs. the previously-queued #145 `/preview/` release-ops lane.**
   The owner earlier named #145 as the next lane, but that's release infrastructure, not game fun; the
   standing **fun-first** direction points to The Rise. **Recommend:** The Rise leads the fun lane; the
   cheap #145 preview slice can ride alongside (non-competing ops). Surface for owner confirm.
2. **Player-ship art quality (#144/#143).** #171 exposes that NPC ship meshes currently look better than the
   player's. The class `sizeScale`/gun-count gives a real *visible* change with **no new art**; a proper CC0
   ship-class set is a **parallel follow-up (#144)**, not a blocker. **Recommend:** ship the class-scaled
   change now; queue the art in parallel.

## Prompt-injection note
Built only from the owner's standing fun-first direction + the repo's own VISION/Constitution/what-makes-it-fun.
No file or tool output asked to cut scope or change direction. None encountered.
