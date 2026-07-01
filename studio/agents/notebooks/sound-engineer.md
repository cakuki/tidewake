# Sound Engineer — deep-reading notebook

### 2026-07-01 — Earcons as a teaching signal: making battle depth audible

Deep-reading loop scoped to our no-asset WebAudio bus and the finished-but-opaque battle epic (#135): rich verbs — E / SPACE / X / F / 1 / 2 — with zero onboarding. Sound can carry the tutorial that the UI never got.

- **Earcons teach the rules.** A *consistent* confirm/cancel sound across every context is itself instruction — the player learns "that chime = it worked" without a tooltip. The corollary for us: **each battle verb needs its own stable, distinct confirmation earcon**, so firing E always *sounds* different from X, and the ear builds the verb map the HUD doesn't spell out. (SFXEngine UI-sound guide; devcom "Auditory Icons and Earcons".)
- **Affordance = sound that matches the action.** An earcon should resemble its verb (a metallic *ka-chunk* for load, an airy *whoosh* for evade), so the cue is self-describing on first hear — not an arbitrary bleep.
- **Availability is a distinct class of cue.** A short *ascending "ready" flourish* the moment a verb becomes legal (reload finished, boarding-range reached) tells a new player *when* to act — the single hardest thing to read in a fast per-phase HUD.
- **Duck under the ballad.** Any teaching earcon must ride *over* our reactive music via the existing manual sidechain (music sub-bus → setTargetAtTime), or the lesson drowns.

**Cross-connection (outside games):** the car **turn-signal tick** and a cockpit **"gear-locked" chirp** are pure availability/confirmation earcons — a rhythmic "this is armed and active" you monitor without looking. Our reload-ready cue should borrow that: felt, peripheral, never demanding the eyes leave the fight.
