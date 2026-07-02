# Tech Lead — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/tech-lead.md`; the charter's *Knowledge map* links here.

### 2026-07-01 — Contextual button prompts & progressive disclosure (making earned depth legible)

Battle epic #135 shipped rich verbs (Maneuver→Board→Duel, keys E/Space/X/F/1/2) but teaches none of them. Grounding in our stack: Tidewake already has a `ui/` house standard (pure helpers + `create<Name>(root)` factory + tests, per `compass.js`/`raid-phases.js`), a pure `onboarding.js` decision machine, and a `codeForKey` helper — but the battle keys live as hand-written static HTML strings inside `hud.js` (e.g. the `duel-help` line), with no single source of truth and no just-in-time surfacing for a new player.

1. **Just-in-time contextual prompts beat permanent legends.** BotW-style, the game shows a key only when its action is *live* right now (near a hailable ship, hull ≤30% → "Board!"). Raises awareness without forcing action — autonomy preserved. Our `raid-phases.js` already names the *act*; it stops short of naming the *key for that act*. The prompt is the tutorial.
2. **One source of truth for keybindings.** Today the E/Space/X/F strings are hand-authored HTML scattered in `hud.js` — drift-prone and untestable. A single keymap table (mirroring `RAID_ACTS`) that both the prompt renderer and `codeForKey`/touch buttons read would kill the divergence risk.
3. **Progressive disclosure = show only the current task's controls.** "Responsive enabling": reveal the 1-2 keys relevant to *this* phase, disable the rest. Fits our lean HUD and the pure-model `ui/` house standard exactly.

**Cross-connection (outside games):** progressive disclosure is core SaaS onboarding UX (multi-step forms, contextual tooltips) — reveal features incrementally, never dump the manual.

**Cross-connection (within stack):** a keymap table is the input analogue of the `#24` systems registry — a thin single source of truth others read, not a framework.

Sources: acagamic.com (contextual prompts); gameuidatabase.com; uxpin.com / ixdf.org (progressive disclosure).

### 2026-07-02 — Deep-reading #5: depth as ONE new property reused across shipped systems (not a new epic)

With THE RISE closed, the cheapest deepening is the immersive-sim move: **a few global rules the world obeys, not scripted exceptions** ("player asks 'can I?', systems answer 'yes'" — TV Tropes/Wikipedia Immersive Sim). The recurring engineering shape across this cycle's research: *introduce one property and reuse it everywhere* — matching Tidewake's cheap-systemic, no-save-bump discipline.

1. **Wind as a global rule both hulls obey.** We already ship weather (#88, gameplay-weather deferred). Promote the wind vector to a property read by maneuver, aim AND escape: downwind = speed + a smoke-screen approach, upwind = the "weather gage" (dictate range). One property → emergent tactics, no new tech (Skeleton Code Machine on naval games; BotW fire+wind emergence). This is the natural home for #88's deferred gameplay half. **S/M.**
2. **Ammo type is one enum on the volley.** Chain-shot → shreds sails (foe can't flee → feeds the #172 surrender path); grape → thins crew (tilts the #135 boarding duel). A single pre-shot choice flows through the EXISTING `resolveBroadside` + boarding math — no new combat system, reuses the #24 systems-registry seam. **M.**
3. **A remembered rival is a tiny persistent state blob, not a subsystem.** The Nemesis pattern (one named captain who escalates/grudges) rides the shipped `state.objective`/bounty slot (#173) + the Ballad — the risk is the save-schema (#122): keep it ONE additive fail-open field so it round-trips. Maps to parked **named-persons #142**.

**Cross-connection (within stack):** wind-vector and ammo-enum are the *input analogue* of the keymap table (DL#4) and the #24 systems registry — a thin shared property others read, never a framework. The discipline: no idea earns a save bump unless it's derivable from already-persisted state.

Sources: Immersive Sim (TV Tropes/Wikipedia); Skeleton Code Machine (naval games); Emergent gameplay (Wikipedia/daydreamsoft); Nemesis System (Film Stories).
