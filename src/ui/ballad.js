// "The Ballad of Your Voyage" panel (#78) — the thin, browser-only DOM for the anecdote
// factory. Follows the #53 house standard: ALL the testable logic (record/dedupe/compose)
// lives in the PURE, browser-free src/voyage-log.js; this factory only owns its DOM (the 📜
// button + the parchment panel), maps the composed ballad onto it, and handles the
// copy-to-clipboard share. Headless/test-safe: with no DOM it degrades to a no-op shell that
// still exposes open/close state + the live ballad text so the QA hook works.

import { composeBallad } from '../voyage-log.js';
import { buildShareCard } from '../share-card.js';

// The parchment palette (mirrors the in-game scroll CSS in index.html) — kept here so the
// downloaded PNG reads like the same torn page from the log: warm paper, brown ink, gilt title.
const CARD_INK = {
  paperTop: '#f6e7c2', paperMid: '#ecd6a8', paperBot: '#e3c98f',
  frame: 'rgba(120,86,40,.55)', frameInner: 'rgba(255,240,200,.5)',
  rule: 'rgba(120,86,40,.42)', title: '#5a3d18', opening: '#5a3d18',
  verse: '#3a2c14', footer: '#6b5226', mark: '#7a5a2c',
  shadow: 'rgba(255,245,215,.55)',
};
const CARD_SERIF = 'Georgia, "Times New Roman", "Iowan Old Style", serif';

/**
 * Build the Ballad panel.
 * @param {object} opts
 * @param {() => Array<object>} opts.getEvents  reads the live voyage log (the source of truth)
 * @param {Document} [opts.root]               defaults to document
 * @param {Navigator} [opts.clipboard]         clipboard host (defaults to navigator); injectable for tests
 * @returns API: { open, close, toggle, isOpen, render, ballad, copy }
 */
export function createBallad(opts = {}) {
  const getEvents = typeof opts.getEvents === 'function' ? opts.getEvents : () => [];
  const root = opts.root ?? (typeof document !== 'undefined' ? document : null);
  const nav = opts.clipboard ?? (typeof navigator !== 'undefined' ? navigator : null);

  let open = false;
  let $btn = null, $panel = null, built = false;
  let copyNote = '';        // transient "copied!" feedback
  let copyNoteTimer = null;

  // The current ballad, composed fresh from the live log each read.
  function ballad() { return composeBallad(getEvents()); }

  function ensureBuilt() {
    if (built || !root) return;
    $btn = root.querySelector?.('#ballad-toggle') ?? null;
    $panel = root.querySelector?.('#ballad-panel') ?? null;
    if ($btn) $btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
    if ($panel) {
      // Delegated: the Copy button copies the ballad; tapping the backdrop margin does nothing.
      $panel.addEventListener('click', (e) => {
        if (e.target.closest?.('#ballad-image')) { e.preventDefault(); shareImage(); }
        else if (e.target.closest?.('#ballad-copy')) { e.preventDefault(); copy(); }
      });
    }
    built = true;
  }

  function syncButton() {
    if (!$btn) return;
    $btn.classList.toggle('on', open);
    $btn.setAttribute('aria-pressed', String(open));
    $btn.setAttribute('aria-expanded', String(open));
  }

  function render() {
    ensureBuilt();
    if (!$panel) return;
    $panel.classList.toggle('show', open);
    $panel.setAttribute('aria-hidden', String(!open));
    syncButton();
    if (!open) return; // only paint while visible
    const b = ballad();
    const body = b.lines.map((l) => `<p class="bal-line">${esc(l)}</p>`).join('');
    $panel.innerHTML =
      `<div class="bal-h">📜 ${esc(b.title)}</div>`
      + `<div class="bal-scroll">${body}</div>`
      + `<div class="bal-actions">`
      + `<button id="ballad-copy" class="bal-copy" type="button">Copy to share</button>`
      + `<button id="ballad-image" class="bal-copy bal-img" type="button">Save as image</button>`
      + `<span class="bal-note" role="status">${esc(copyNote)}</span>`
      + `</div>`
      + `<div class="bal-help">Your deeds, sung back to you &middot; <b>B</b> to open, <b>Esc</b> to close</div>`;
  }

  function setOpen(v) { open = !!v; render(); }
  function openPanel() { setOpen(true); }
  function close() { setOpen(false); }
  function toggle() { setOpen(!open); }

  function flashNote(s) {
    copyNote = s;
    if (copyNoteTimer) { try { clearTimeout(copyNoteTimer); } catch { /* */ } }
    try {
      copyNoteTimer = setTimeout(() => { copyNote = ''; if (open) render(); }, 2600);
    } catch { /* no timers (headless) — leave the note */ }
    if (open) render();
  }

  // Copy the ballad to the clipboard so the player can paste/share it. Prefers the async
  // Clipboard API; falls back to a hidden <textarea> + execCommand for older/insecure
  // contexts. Always resolves a boolean and NEVER throws (a flourish must never break play).
  async function copy() {
    const text = ballad().text;
    // Preferred path: the async Clipboard API.
    try {
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(text);
        flashNote('Copied! Paste it anywhere and share your tale.');
        return true;
      }
    } catch { /* fall through to the legacy path */ }
    // Legacy fallback: a hidden textarea + execCommand('copy').
    try {
      const doc = root && root.createElement ? root : (typeof document !== 'undefined' ? document : null);
      if (doc && doc.body && doc.execCommand) {
        const ta = doc.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        doc.body.appendChild(ta);
        ta.select();
        const ok = doc.execCommand('copy');
        doc.body.removeChild(ta);
        flashNote(ok ? 'Copied! Paste it anywhere and share your tale.' : 'Copy unavailable — select the text to copy it.');
        return !!ok;
      }
    } catch { /* clipboard simply unavailable */ }
    flashNote('Copy unavailable — select the text to copy it.');
    return false;
  }

  // ---- Share as an image (#149) -------------------------------------------------------
  // Render the live ballad onto a 2D canvas (parchment art + typography from the pure card
  // model in src/share-card.js), then let the player download it as a clean PNG — the natural
  // viral hook beyond copy-as-text. Browser-only + fully guarded: no DOM/canvas → graceful
  // no-op, so the headless playtest gate never touches this path.

  // Paint the positioned card model onto a 2D context. Pure-ish: only draws, no side effects
  // beyond the context. The model owns all geometry; this owns only the parchment look.
  function paintCard(ctx, card) {
    const { width: W, height: H, padX, textWidth } = card;
    // Parchment ground — a warm diagonal wash, same gradient as the in-game scroll.
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, CARD_INK.paperTop);
    g.addColorStop(0.6, CARD_INK.paperMid);
    g.addColorStop(1, CARD_INK.paperBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // A double rule frame — brown ink with an inner gilt line, like a proclamation's border.
    ctx.lineWidth = 2;
    ctx.strokeStyle = CARD_INK.frame;
    ctx.strokeRect(18, 18, W - 36, H - 36);
    ctx.lineWidth = 1;
    ctx.strokeStyle = CARD_INK.frameInner;
    ctx.strokeRect(24, 24, W - 48, H - 48);

    ctx.textBaseline = 'alphabetic';

    // Title — gilt serif, centred, with a soft paper-light shadow for a stamped feel.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = CARD_INK.title;
    ctx.shadowColor = CARD_INK.shadow;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 1;
    ctx.font = `700 ${card.title.size}px ${CARD_SERIF}`;
    card.title.wrapped.forEach((line, i) => {
      ctx.fillText(line, W / 2, card.title.y + i * card.title.lineHeight);
    });
    ctx.restore();

    // Divider flourish — a thin rule with a small centred diamond.
    const dy = card.divider.y;
    ctx.strokeStyle = CARD_INK.rule;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(padX, dy); ctx.lineTo(W / 2 - 14, dy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2 + 14, dy); ctx.lineTo(W - padX, dy); ctx.stroke();
    ctx.fillStyle = CARD_INK.rule;
    ctx.save(); ctx.translate(W / 2, dy); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-4, -4, 8, 8); ctx.restore();

    // Verses — left-aligned ink. The opening stands apart (upright, gilt); verses are italic;
    // the footer is small and muted. Faithful to the panel's first/last-line styling.
    ctx.textAlign = 'left';
    for (const b of card.blocks) {
      if (b.role === 'opening') { ctx.fillStyle = CARD_INK.opening; ctx.font = `600 ${b.size}px ${CARD_SERIF}`; }
      else if (b.role === 'footer') { ctx.fillStyle = CARD_INK.footer; ctx.font = `italic ${b.size}px ${CARD_SERIF}`; }
      else { ctx.fillStyle = CARD_INK.verse; ctx.font = `italic ${b.size}px ${CARD_SERIF}`; }
      b.wrapped.forEach((line, i) => {
        ctx.fillText(line, padX, b.y + i * b.lineHeight);
      });
      // hush the unused-var linter without touching geometry
      void textWidth;
    }

    // Maker's mark — a small anchored sign-off, centred, letter-spaced by hand.
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = CARD_INK.mark;
    ctx.font = `600 ${card.watermark.size}px ${CARD_SERIF}`;
    ctx.fillText(`⚓ ${card.watermark.text.toUpperCase().split('').join(' ')}`, W / 2, card.watermark.y);
    ctx.restore();
  }

  // Build a fresh canvas of the current ballad and return it (or null when there's no DOM).
  // Exposed on the API so QA can capture the artifact without triggering a download.
  function renderShareCanvas() {
    const doc = root && root.createElement ? root : (typeof document !== 'undefined' ? document : null);
    if (!doc || !doc.createElement) return null;
    let canvas, ctx;
    try {
      canvas = doc.createElement('canvas');
      ctx = canvas.getContext && canvas.getContext('2d');
    } catch { return null; }
    if (!ctx) return null;
    const card = buildShareCard(ballad());
    const scale = 2; // device scale for crisp text on retina + social re-compression
    canvas.width = Math.round(card.width * scale);
    canvas.height = Math.round(card.height * scale);
    ctx.scale(scale, scale);
    paintCard(ctx, card);
    return canvas;
  }

  function triggerDownload(doc, url, filename) {
    const a = doc.createElement('a');
    a.href = url; a.download = filename;
    a.style.position = 'fixed'; a.style.opacity = '0';
    (doc.body || doc.documentElement).appendChild(a);
    a.click();
    try { setTimeout(() => { try { a.remove(); } catch { /* */ } }, 0); } catch { /* */ }
  }

  // Render + download the ballad as a PNG. Always resolves a boolean and NEVER throws (a
  // flourish must never break play). Prefers toBlob (object URL); falls back to a data URL.
  async function shareImage() {
    let canvas;
    try { canvas = renderShareCanvas(); } catch { canvas = null; }
    if (!canvas) { flashNote('Image unavailable — Copy works as a fallback.'); return false; }
    const doc = root && root.createElement ? root : (typeof document !== 'undefined' ? document : null);
    const win = (root && root.defaultView) || (typeof globalThis !== 'undefined' ? globalThis : null);
    const filename = 'tidewake-ballad.png';

    // Preferred path: toBlob → object URL → anchor download.
    const ok = await new Promise((resolve) => {
      try {
        if (canvas.toBlob) {
          canvas.toBlob((blob) => {
            if (!blob || !win?.URL?.createObjectURL) { resolve(false); return; }
            try {
              const url = win.URL.createObjectURL(blob);
              triggerDownload(doc, url, filename);
              setTimeout(() => { try { win.URL.revokeObjectURL(url); } catch { /* */ } }, 4000);
              resolve(true);
            } catch { resolve(false); }
          }, 'image/png');
          return;
        }
      } catch { /* fall through */ }
      resolve(false);
    });
    if (ok) { flashNote('Saved! Your ballad, ready to share.'); return true; }

    // Fallback: a data URL anchor (older/locked-down contexts).
    try {
      const url = canvas.toDataURL('image/png');
      triggerDownload(doc, url, filename);
      flashNote('Saved! Your ballad, ready to share.');
      return true;
    } catch { /* no raster export available at all */ }
    flashNote('Image unavailable — Copy works as a fallback.');
    return false;
  }

  function init() {
    ensureBuilt();
    // Component-owned key (keeps main.js thin): 'b' toggles the ballad, Esc closes it.
    try {
      (root?.defaultView ?? globalThis)?.addEventListener?.('keydown', (e) => {
        const k = (e.key || '').toLowerCase();
        if (k === 'b') { e.preventDefault?.(); toggle(); }
        else if (k === 'escape' && open) { close(); }
      });
    } catch { /* headless without a window — fine */ }
    syncButton();
    return api;
  }

  const api = {
    init, open: openPanel, close, toggle, render, copy,
    shareImage, renderShareCanvas,
    ballad,
    get isOpen() { return open; },
  };
  return api;
}

// Minimal HTML-escape — the ballad is authored text, but stay safe by habit (names flow in).
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}
