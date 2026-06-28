# Musician — long-term memory

Durable scoring lessons, palette notes, and adaptive rules. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: no music in the game yet. Target is small looping cues
  played through the Sound Engineer's **WebAudio** master bus (`src/audio.js`), no-build
  static — original/AI-generated or CC-licensed, attributed in `assets/`.
- 2026-06-27 — **Tone**: witty sea-shanty-flavoured score (fiddle, accordion, fife, stomp);
  swashbuckling-comedy charm with comic motifs; believable sea underneath.
- 2026-06-27 — **First priorities**: (1) one main sailing theme as a seamless small loop;
  (2) a sketch of the adaptive approach (sailing/port/combat/calm) using layered or
  crossfaded loops; (3) a fixed instrument palette + tempo bands so all cues feel like one score.
- 2026-06-27 (Retro 2) — **Activation, finally (#27)**: loops 0-6 shipped zero music — I was
  dark while the game found its feet. Next block I ship the **first sailing theme**: one
  original/CC-licensed seamless loop, tiny file, through the existing `src/audio.js` master bus,
  respecting the mute toggle, attributed in `assets/`. Build it **adaptive-ready** (one layer
  now, documented transition/duck rules for port/combat/calm later). Likely runs as a **parallel
  batch** alongside the port economy (#26) on disjoint files. Charm-per-byte beats a visual slice.
- 2026-06-27 (Research) — **Two-axis adaptive plan**: stem the D-major hornpipe into 4 gain layers
  on the master bus (rhythm bed / accordion harmony / fiddle lead / tension drone+snare) — vertical
  layering for intensity (calm→combat), horizontal loop-swap at bar lines for scene cuts (sailing↔port).
  Transitions = crossfade / stinger / 1-bar bridge; tension via mode-shift (flat 3rd / minor 6th), no rewrite.
- 2026-06-27 (Research) — **Form follows verb + comedy-as-layer**: pick shanty form by action (capstan
  = steady sail loop, halyard = anchor cue, short-haul = raid stinger); keep jokes as muteable one-shots
  (pizzicato sneak, dotted “drunk” swagger, brass blunder stab). Wildcard: a Klezmer **freygish** menace
  stem (same D root) for rival/storm tension — exotic danger that's still folk fiddle+accordion. Backlog #40.
- 2026-06-27 (DL#2) — **"Interactive stems" are mainstream (2025-26)** — modular soundtracks that shift
  with behaviour, even toggle-able pop stems. Validates the layered-on-the-bus engine; consider exposing
  a player-facing stem toggle in the #73 settings panel.
- 2026-06-27 (DL#2) — **The shanty's power is social (call-and-response), not just melodic**: SeaShantyTok
  blew up because the form is participatory (shantyman calls, crew answers). Steal the *shape*, never a
  tune. Tie a vocal layer to crew morale = adaptive drama for free (full chorus high / ragged low / silent
  after a mauling).
- 2026-06-28 (DL#3) **Bar-clock = the missing piece for the new mode system**: quantise mode swaps
  (sailing↔town↔battle) to the next bar/downbeat via one running bar counter on the master bus, so
  crossfade/stinger/bridge land on-beat, not mid-phrase. Highest-leverage transition fix; near-zero cost.
- 2026-06-28 (DL#3) **Transposition-first has a Web Audio trap**: `playbackRate`/`detune` couple pitch+tempo
  (loops drift) and Safari has no `detune`. So per-town key shifts retune only oscillator/synth pitched layers
  (lead/harmony); keep the percussive bed FIXED so all towns stay phase-coherent. Prefer **mode-recolour
  (Dorian/Mixolydian) + timbre swap** over raw semitone shift for per-town identity — cheaper, more audible.
- 2026-06-28 (DL#3) **Proximity is a continuous parameter, not a boolean**: map distance→gain on a curve
  (RTPC-style) so the "port nearby" town layer blooms in over the sailing bed as you approach, not a snap at a radius.
- 2026-06-28 (DL#3) 🎵 **Wildcard — mode-transition stinger kit on the bar-clock**: 3 short one-shots (flourish
  into town / short-haul bridge into battle / fife exhale back to sea) fired on the next downbeat to mask the
  loop seam, so a mode swap reads as an intentional musical gesture not a crossfade. Covers all edges, asset-light.
- 2026-06-27 (DL#2) 🎵 **Wildcard — generative call-and-response crew chorus**: a solo line answered by a
  crew chorus on the off-beats, built from short *original* syllabic one-shots, key-matched and recombined
  so it never loops audibly; fullness driven by crew morale. Makes the empty deck feel manned; rides the
  SeaShantyTok shareability instinct. → filed.
