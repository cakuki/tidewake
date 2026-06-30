// The Ballad's "share as an image" — the PURE, DOM-free half (#149; #78/#90 follow-up).
// Following the #53 house standard, the testable work lives here and the thin raster lives in
// src/ui/ballad.js. This module turns a composed ballad (title + lines from src/voyage-log.js)
// into a fully POSITIONED card model — every text block laid out, every line word-wrapped, the
// canvas height computed — so the DOM side just loops and fills. Deterministic + browser-free:
// the same ballad always lays out the same card, and the whole thing unit-tests under node:test.
//
// On-brand by design (Constitution: warm, witty, hand-crafted): the model mirrors the in-game
// parchment scroll — a gilt title, a divider flourish, italic verses, a muted footer, and a
// small "Tidewake" maker's mark — so the downloaded PNG reads like a torn page from the log.

const BALLAD_TITLE_FALLBACK = 'The Ballad of Your Voyage';

function isStr(s) { return typeof s === 'string' && s.trim().length > 0; }

// Card geometry, in CSS pixels (the raster multiplies by a device scale for crispness). A
// portrait-leaning card sized for a social post; height flexes to the verses. All tunable via
// opts.layout, but the defaults are the shipped look.
export const CARD_LAYOUT = {
  width: 1080,
  padX: 78,
  padTop: 76,
  padBottom: 60,
  titleSize: 48,
  titleLh: 60,
  titleMaxChars: 30,
  dividerGap: 30,        // space below the title block, above the divider rule
  dividerToBody: 34,     // space below the rule, above the first verse
  bodySize: 27,
  bodyLh: 40,
  blockGap: 16,          // space between verses
  footerSize: 22,
  footerLh: 31,
  bodyMaxChars: 58,
  watermarkGap: 38,      // space above the maker's mark
  watermarkSize: 23,
};

/**
 * PURE — greedy word-wrap to a maximum characters-per-line. Keeps whole words (a long ship
 * name rides its own line rather than being hacked apart), preserves order, never throws, and
 * always returns at least one line. Deterministic, so the card model and its tests are stable.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function wrapText(text, maxChars) {
  const max = Math.max(1, Math.floor(Number(maxChars)) || 1);
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) { cur = w; continue; }
    if (cur.length + 1 + w.length <= max) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * PURE — lay out a composed ballad into a positioned share-card model: a wrapped, baseline-
 * positioned title, a divider, one text block per ballad line (opening / verse / footer roles
 * for styling), a maker's mark, and the total canvas height. The DOM raster (src/ui/ballad.js)
 * consumes this verbatim. Tolerant of a junk/empty ballad. Never throws, never touches the DOM.
 * @param {{title?:string, lines?:string[]}} ballad  the output of composeBallad()
 * @param {{layout?:object}} [opts]
 * @returns {{width:number, height:number, padX:number, textWidth:number,
 *   title:{text:string,wrapped:string[],size:number,lineHeight:number,y:number},
 *   divider:{y:number},
 *   blocks:Array<{role:string,size:number,lineHeight:number,wrapped:string[],y:number}>,
 *   watermark:{text:string,size:number,y:number}, layout:object}}
 */
export function buildShareCard(ballad, opts = {}) {
  const L = { ...CARD_LAYOUT, ...(opts.layout || {}) };
  const title = isStr(ballad?.title) ? ballad.title : BALLAD_TITLE_FALLBACK;
  const srcLines = Array.isArray(ballad?.lines) ? ballad.lines.filter(isStr) : [];
  const textWidth = L.width - L.padX * 2;

  const titleWrapped = wrapText(title, L.titleMaxChars);

  // Role each ballad line: the first is the balladeer's opening (set apart), the last is the
  // footer (the small "sung at the rail" sign-off), everything between is a sung verse.
  const last = srcLines.length - 1;
  const blocks = srcLines.map((text, i) => {
    const role = i === 0 ? 'opening' : (i === last ? 'footer' : 'verse');
    const footer = role === 'footer';
    return {
      role,
      size: footer ? L.footerSize : L.bodySize,
      lineHeight: footer ? L.footerLh : L.bodyLh,
      wrapped: wrapText(text, L.bodyMaxChars),
      y: 0, // filled in below
    };
  });

  // Flow the blocks down the card, recording each one's first-line baseline.
  let y = L.padTop;
  const titleY = y + L.titleSize;
  y += titleWrapped.length * L.titleLh;
  y += L.dividerGap;
  const dividerY = y;
  y += L.dividerToBody;

  for (const b of blocks) {
    b.y = y + b.size;                       // baseline of this block's first wrapped line
    y += b.wrapped.length * b.lineHeight;
    y += L.blockGap;
  }
  if (blocks.length) y -= L.blockGap;       // no trailing gap after the final block

  y += L.watermarkGap;
  const watermarkY = y + L.watermarkSize;
  y += L.watermarkSize + L.padBottom;

  return {
    width: L.width,
    height: Math.ceil(y),
    padX: L.padX,
    textWidth,
    title: { text: title, wrapped: titleWrapped, size: L.titleSize, lineHeight: L.titleLh, y: titleY },
    divider: { y: dividerY },
    blocks,
    watermark: { text: 'Tidewake', size: L.watermarkSize, y: watermarkY },
    layout: L,
  };
}
