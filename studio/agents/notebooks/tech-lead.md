# Tech Lead — deep-reading notebook

### 2026-07-01 — Contextual button prompts & progressive disclosure (making earned depth legible)

Battle epic #135 shipped rich verbs (Maneuver→Board→Duel, keys E/Space/X/F/1/2) but teaches none of them. Grounding in our stack: Tidewake already has a `ui/` house standard (pure helpers + `create<Name>(root)` factory + tests, per `compass.js`/`raid-phases.js`), a pure `onboarding.js` decision machine, and a `codeForKey` helper — but the battle keys live as hand-written static HTML strings inside `hud.js` (e.g. the `duel-help` line), with no single source of truth and no just-in-time surfacing for a new player.

1. **Just-in-time contextual prompts beat permanent legends.** BotW-style, the game shows a key only when its action is *live* right now (near a hailable ship, hull ≤30% → "Board!"). Raises awareness without forcing action — autonomy preserved. Our `raid-phases.js` already names the *act*; it stops short of naming the *key for that act*. The prompt is the tutorial.
2. **One source of truth for keybindings.** Today the E/Space/X/F strings are hand-authored HTML scattered in `hud.js` — drift-prone and untestable. A single keymap table (mirroring `RAID_ACTS`) that both the prompt renderer and `codeForKey`/touch buttons read would kill the divergence risk.
3. **Progressive disclosure = show only the current task's controls.** "Responsive enabling": reveal the 1-2 keys relevant to *this* phase, disable the rest. Fits our lean HUD and the pure-model `ui/` house standard exactly.

**Cross-connection (outside games):** progressive disclosure is core SaaS onboarding UX (multi-step forms, contextual tooltips) — reveal features incrementally, never dump the manual.

**Cross-connection (within stack):** a keymap table is the input analogue of the `#24` systems registry — a thin single source of truth others read, not a framework.

Sources: acagamic.com (contextual prompts); gameuidatabase.com; uxpin.com / ixdf.org (progressive disclosure).
