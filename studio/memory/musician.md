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
