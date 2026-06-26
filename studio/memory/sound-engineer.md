# Sound Engineer — long-term memory

Durable audio lessons, mix targets, and asset notes. Grows over time; keep entries short.

- 2026-06-27 — **Starting state**: no audio in the game yet. Target is **WebAudio**
  (`AudioContext`) via a small `src/audio.js`, one master bus, no-build static — clips loaded
  as small CC0/clear-licensed or AI-generated files, attributed in `assets/`.
- 2026-06-27 — **Tone**: believable sea realism in ambience (waves, wind, hull creak, gulls)
  + warm comedic stingers for moments. Real sea underneath, a grin on top.
- 2026-06-27 — **First priorities**: (1) audio bootstrap + autoplay-gesture gate + master
  mix; (2) looping sea ambience that varies (no audible tile); (3) one spatial cue (gulls or
  cannon) via `PannerNode`; keep total audio download tiny.
