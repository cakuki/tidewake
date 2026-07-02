# Project Manager — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/project-manager.md`; the charter's *Knowledge map* links here.

## 2026-07-01 — Deep-reading: making shipped depth legible (flow-of-teaching)

The battle epic (#135) is deep but silent — a wall of keys (E/SPACE/X/F/1/2) with no way in. Craft study on onboarding + slicing converges on one PM-relevant idea: **teaching is itself a flow problem, and it should be sliced vertically, not front-loaded.**

- **Just-in-time beats front-loading.** The strongest onboarding pattern is contextual: introduce one mechanic *at the moment the player needs it*, never a manual up front. Northgard-style contextual tips appear on the triggering event and don't block progress. Our per-phase battle HUD is already the perfect surface — the phase *is* the teachable moment.
- **Progressive disclosure = show only the verbs reachable now.** Reveal the current phase's key, hide the rest. This maps cleanly onto our existing phase state; no new system, just gating a prompt on `mode`/phase.
- **If it takes 3 slices before value appears, you sliced wrong.** Legibility work should be a vertical ladder — one key, one phase, playtested and shipped — not a "tutorial epic." Each slice is independently valuable: a new player can do *one more thing*.
- **Cross-connection (outside games): airport wayfinding.** Good signage never shows the whole terminal map at the entrance; it reveals only the next decision at each junction. Same discipline — legibility delivered *at the decision point*, spaced over the journey, not dumped at the door.

Wildcard steering note: sequence teaching by *first-encounter order*, so the ladder's order is discovered from playtest, not guessed.

## 2026-07-02 — Deep-reading #5: the "one more voyage" hook — session shape + banked progress

THE RISE closed the fun loop end-to-end; the PM question now is *retention* — what brings a captain back tomorrow. Study on roguelite time-respect + session design converges on beats we can slice cheaply from shipped systems.

- **Give the voyage a session shape: "Today's Tide."** Session-shaped goals respect player time and give a clean "done for today" beat (GameRant "respect your free time"; Returnal/daily-run patterns). A rotating 1–3 short goals on the shipped bounty board (#173) — sink a sloop, run contraband, duck a governor patrol, with a purse — gives a crisp arc you can finish in one sitting and a reason to return. Maps onto the parked **leaderboard #136** (a daily-run ranking is the natural v2). **M.**
- **Never close the tab empty-handed.** "One more run" lives between reset difficulty and banked power — even a LOST voyage should bank something visible (Infamy scrap / rumour / a plank on the home port) and the Ballad (#90) records the defeat as a chapter (Bugnet; GameRant). This GUARDS the loss-sting (#164): still stings, never purely punitive. **S/M.**
- **The remembered rival is the retention flagship.** One persistent named captain who escalates if he beats you / grudges if he escaped, narrated by the Ballad — the Nemesis pattern makes bespoke stories cheaply (Kasavin/Hades; Nemesis System). Slice as a vertical ladder: (1) a rival persists + returns → (2) he escalates → (3) the Ballad names the feud → (4) port NPCs reference him. Each slice independently shippable; don't file a "rival epic." Maps to parked **named-persons #142**.
- **Meta-progression must not trivialise the skill core.** Buy-a-bigger-ship (#171) should unlock tougher bounties in step (region-fixed difficulty #167) — a PM guardrail on the whole RISE economy, not new work.

**Cross-connection (outside games):** Duolingo's daily streak + "you're done for today" screen — a bounded, repeatable session with visible banked progress is the retention engine, not more content. Our "Today's Tide" + banked-loss is the same shape, dressed as the sea.

Sources: roguelite time-respect (GameRant, Bugnet); Hades narrative-as-retention (GameDeveloper/Kasavin); Nemesis System (Film Stories); session/daily-run design (Returnal coverage).
