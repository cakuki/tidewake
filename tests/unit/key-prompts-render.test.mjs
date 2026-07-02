// Render drift-lock for the #159 diegetic age-of-sail keycap skin. The skin is CSS-only (rope-bound
// brass / ink-on-parchment) — so the glyph + verb text a player reads ON the brass keycap must be
// EXACTLY what the keymap source-of-truth (src/keymap.js) says, never a hand-typed label baked into the
// skin. This locks the rendered DOM against drift: dress the prompt however you like, the letters and
// words still come from KEYS. No jsdom in this repo — a tiny fake #key-prompts element captures the HTML
// the browser would render (same pattern as tests/unit/town-layout.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKeyPrompts } from '../../src/ui/key-prompts.js';
import { KEYS } from '../../src/keymap.js';

function fakeEl() {
  return {
    innerHTML: '',
    classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
  };
}
function fakeRoot(el) { return { querySelector: (s) => (s === '#key-prompts' ? el : null) }; }

// Pull the <kbd> glyph and its trailing verb for each rendered .kp span — the exact tokens on screen.
function rendered(html) {
  const out = [];
  const re = /<span class="kp [^"]*"><kbd class="kp-key">([^<]*)<\/kbd>\s*([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html))) out.push({ glyph: m[1], verb: m[2].trim() });
  return out;
}

test('#159 render: FIRE (+CHANGE SHOT) keycaps read verbatim from src/keymap.js', () => {
  const el = fakeEl();
  createKeyPrompts(fakeRoot(el)).update({ active: true, loaded: true, loadout: ['round', 'chain'] }, {});
  assert.deepEqual(rendered(el.innerHTML), [
    { glyph: KEYS.fire.glyph, verb: KEYS.fire.verb },
    { glyph: KEYS.cycle.glyph, verb: KEYS.cycle.verb },
  ]);
});

test('#159 render: a beaten foe renders the BOARD keycap from the keymap', () => {
  const el = fakeEl();
  createKeyPrompts(fakeRoot(el)).update({ active: true, canBoard: true, loadout: ['round'] }, {});
  assert.deepEqual(rendered(el.innerHTML), [
    { glyph: KEYS.board.glyph, verb: KEYS.board.verb },
  ]);
});

test('#159 render: a struck foe renders ACCEPT/PRESS keycaps from the keymap', () => {
  const el = fakeEl();
  createKeyPrompts(fakeRoot(el)).update({ active: true, surrenderPending: true }, {});
  assert.deepEqual(rendered(el.innerHTML), [
    { glyph: KEYS.accept.glyph, verb: KEYS.accept.verb },
    { glyph: KEYS.press.glyph, verb: KEYS.press.verb },
  ]);
});

test('#159 no-drift: every rendered token is a real keymap glyph/verb (no hard-coded skin label)', () => {
  // Drive every in-battle verb to the surface; assert each rendered token exists in the keymap. A skin
  // that hard-codes "SPACE" or re-labels a verb would surface a token absent from KEYS and fail here.
  const states = [
    { active: true, loaded: true, loadout: ['round', 'chain'] }, // fire, cycle
    { active: true, canBoard: true, loadout: ['round'] },        // board
    { active: true, surrenderPending: true },                    // accept, press
  ];
  const glyphs = new Set(Object.values(KEYS).map((k) => k.glyph));
  const verbs = new Set(Object.values(KEYS).map((k) => k.verb));
  for (const s of states) {
    const el = fakeEl();
    createKeyPrompts(fakeRoot(el)).update(s, {});
    const toks = rendered(el.innerHTML);
    assert.ok(toks.length > 0, 'expected at least one skinned prompt for a live battle state');
    for (const t of toks) {
      assert.ok(glyphs.has(t.glyph), `rendered glyph "${t.glyph}" is not in the keymap — a hard-coded skin label drifted`);
      assert.ok(verbs.has(t.verb), `rendered verb "${t.verb}" is not in the keymap — a hard-coded skin label drifted`);
    }
  }
});
