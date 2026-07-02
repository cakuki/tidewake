# Sound Engineer — deep-reading notebook

> **Index (newest first).** Durable patterns graduate up to `studio/memory/sound-engineer.md`; the charter's *Knowledge map* links here.

### 2026-07-01 — Earcons as a teaching signal: making battle depth audible

Deep-reading loop scoped to our no-asset WebAudio bus and the finished-but-opaque battle epic (#135): rich verbs — E / SPACE / X / F / 1 / 2 — with zero onboarding. Sound can carry the tutorial that the UI never got.

- **Earcons teach the rules.** A *consistent* confirm/cancel sound across every context is itself instruction — the player learns "that chime = it worked" without a tooltip. The corollary for us: **each battle verb needs its own stable, distinct confirmation earcon**, so firing E always *sounds* different from X, and the ear builds the verb map the HUD doesn't spell out. (SFXEngine UI-sound guide; devcom "Auditory Icons and Earcons".)
- **Affordance = sound that matches the action.** An earcon should resemble its verb (a metallic *ka-chunk* for load, an airy *whoosh* for evade), so the cue is self-describing on first hear — not an arbitrary bleep.
- **Availability is a distinct class of cue.** A short *ascending "ready" flourish* the moment a verb becomes legal (reload finished, boarding-range reached) tells a new player *when* to act — the single hardest thing to read in a fast per-phase HUD.
- **Duck under the ballad.** Any teaching earcon must ride *over* our reactive music via the existing manual sidechain (music sub-bus → setTargetAtTime), or the lesson drowns.

**Cross-connection (outside games):** the car **turn-signal tick** and a cockpit **"gear-locked" chirp** are pure availability/confirmation earcons — a rhythmic "this is armed and active" you monitor without looking. Our reload-ready cue should borrow that: felt, peripheral, never demanding the eyes leave the fight.

### 2026-07-02 — Deep-reading #5: negative space — silence is what makes the payoff HIT

We've shipped a lot of reactive audio (per-phase battle layers, town cues, gulls, fearful hails). The next depth isn't MORE sound — it's the **held breath**: reserve peak intensity, use calm for contrast (Wayline "Perils of Over-Juicing" / "Negative Space"; game-feel sources). A single cue lands as an *event* only after silence.

- **A beat of quiet before the win.** On a surrender, briefly duck ALL combat layers to near-silence for ~1s (the manual sidechain bus already exists) BEFORE the reputation sting + the #80 camera-settle fires. The win becomes *felt* — it's a subtraction, near-free. **S, cheap.**
- **The held-breath pre-battle.** As you close to firing range, thin the open-sea theme to a lone low drone + swelling gull cries (#68) so the first cannon volley *breaks* the quiet. Deepens the #158 per-phase signatures + the #135 legibility (you HEAR the fight about to start). **M, cheap** (reuses the layer-crossfade + coastal system).
- **A CHARGED rank-up, not an instant card.** THE RISE rank-up (#169) fires a sting instantly; give it a ~0.8s rising WebAudio swell that *releases* on a bass "thunk" as the new rank snaps in — anticipation signals importance before payoff ("The World's Most Satisfying Checkbox"). Deepens rank-up + reputation stings. **S, cheap** (procedural, a tween).
- **Reharmonise a town by your reputation.** As notoriety in a port rises, re-voice its docked cue (#129) from warm major toward a darker minor under the SAME tune — towns audibly "fear" you over voyages. A chord-table swap on existing synth voices; deepens per-town identity + fearful hails (#175). Maps onto parked **nations #137**. **M, cheap.**

**Cross-connection (outside games):** a symphony's grand pause / the dramatic rest before the timpani hit — conductors buy the impact with the silence in front of it. Our surrender-hush and rank-up wind-up are the same trick: the loudest moment needs the quietest one before it.

Sources: Perils of Over-Juicing / Negative Space (wayline.io); The World's Most Satisfying Checkbox (notbor.ing); reharmonisation (thegameaudioco / Kit Varney).
