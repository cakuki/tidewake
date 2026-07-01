// Keymap — the SINGLE source of truth for the deep-battle key labels (#153, R2 deep-reading flagship).
// The contextual just-in-time key-prompts (src/ui/key-prompts.js) AND the #battle panel's inline help
// (src/hud.js) both read these, so a key glyph or verb can never drift between the two teachers. Add a
// verb's key HERE, not as a hand-typed string in a template — that scatter is exactly the drift this kills.
//
// `glyph` is what the player sees on the keycap ("SPACE", "F", "1"); `verb` is the short action label.
// Pure data — no DOM, no browser — so it's import-safe from unit tests and the headless gate alike.
export const KEYS = {
  engage: { glyph: 'E',     verb: 'Give battle' },      // square up to the nearest ship (at-sea entry)
  fire:   { glyph: 'SPACE', verb: 'Fire — bring her abeam' }, // discharge the loaded broadside
  cycle:  { glyph: 'X',     verb: 'Change shot' },        // walk the fitted locker mid-fight
  board:  { glyph: 'F',     verb: 'Board her' },          // send the crew over the rail once she's beaten
  accept: { glyph: '1',     verb: 'Accept surrender' },   // take the quick capture (ransom + Standing)
  press:  { glyph: '2',     verb: 'Press the attack' },   // refuse quarter — sink or board her
  flee:   { glyph: 'E',     verb: 'Break off' },          // FLEE is always available while engaged
};
