# Graphic Designer — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/graphic-designer.md`; the charter's *Knowledge map* links here.

### 2026-07-01 — Deep-learning loop #4: just-in-time key-prompts, per-phase HUD legibility

Grounded in the shipped battle epic (#135): deep per-phase naval combat with many keys (E/SPACE/X/F/1/2) and **no onboarding** — a new player faces depth they can't reach. Lens today: make existing depth *legible and discoverable* without new systems.

- **Information minimalism = show a prompt only at the exact moment it's actionable, then fade it.** Modern adaptive-HUD practice (stealth indicator only when hidden; objective fades on arrival) maps straight onto our per-phase combat: a key-prompt should only exist while its verb is *possible in this phase*. The battle HUD already knows the phase — gate prompt visibility on it. Near-zero cost, huge FTUE gain.
- **Contextual button prompts are the invisible tutorial.** Celeste/Portal/Northgard teach by surfacing one hint at the relevant moment, learn-by-doing, never a wall of text. Our fix isn't a tutorial screen — it's per-phase prompts that *are* the teaching.
- **Diegetic > overlay for charm.** Dead Space/Metroid Prime dissolve HUD into the world; our key-prompts can wear an age-of-sail skin (rope-bound brass keycaps, ink-on-parchment glyphs) so legibility and identity are the same asset.
- **Reputation needle legibility is a colour/contrast problem, not a redesign.** A needle reads instantly only with a clear neutral-zero and warm/cool poles that survive haze.

**Cross-connection (outside games):** automotive **AR-HUD navigation prompts** research shows a cue timed and placed to the exact decision point (the intersection) beats an always-on display for driver response — same principle: right cue, right instant, then gone.

Sources: Wayline (diegetic interfaces); Game UI Database (contextual button prompts); UX Collective (game onboarding); AR-HUD navigation prompt study (NCBI).

### 2026-07-02 — Deep-reading #5: SHOW the reputation — the port and the ship as your story, told silently

The reputation needle is a meter; the deeper (and cheaper-than-a-meter-redesign) move is **environmental storytelling — mood from lighting/colour + a few placed props, not geometry** (Wayline "environmental storytelling"; low-poly aesthetics craft).

- **The port reacts VISIBLY to who you are.** A feared pirate makes landfall to shutters closing, doubled guards, a "WANTED" poster; a respected governor to banners and a lit quay — keyed off the existing reputation value and the #101 pooled town props (#174 already grows the port visibly). Show, don't tell the needle. Maps onto parked **nations #137** / lightly **named-persons #142**. **S/M, cheap** (instanced props we already pool).
- **Fear you can SEE on your own hull.** Render Infamy on the ship the way THE RISE shows bought cannons (#170): black sails, trophy flags, a fiercer figurehead — derived from persisted infamy, and a bad loss strips a trophy. Fame you can see and lose. **S, cheap.**
- **A payoff colour-grade pulse.** On a notorious kill / rank-up, briefly push warm saturation + a soft vignette + a one-frame bright bloom, then settle — a single full-screen pass, geometry-free, ~0 extra per-object draws (WebGLFundamentals fog; LearnOpenGL bloom). Deepens the #80 kill-juice + #58/#88 day-night/weather. **S, cheap.**
- **Exponential fog sells distance-to-land for free** — pairs with the coastal gulls swelling (#68/#97): the coast fades up out of haze rather than popping in. Cheap depth cue, screen-space.

**Cross-connection (outside games):** retail store-window merchandising — a shopper reads a whole brand from the lighting + two props in the window before entering. Same as our dock: the player should read "they fear you here" from the shutters and the poster before a single line of text.

Sources: Reclaiming environmental storytelling (wayline.io); WebGL Fog (webglfundamentals); Bloom (LearnOpenGL); low-poly atmosphere craft (Wayline).
