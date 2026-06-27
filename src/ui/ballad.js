// "The Ballad of Your Voyage" panel (#78) — the thin, browser-only DOM for the anecdote
// factory. Follows the #53 house standard: ALL the testable logic (record/dedupe/compose)
// lives in the PURE, browser-free src/voyage-log.js; this factory only owns its DOM (the 📜
// button + the parchment panel), maps the composed ballad onto it, and handles the
// copy-to-clipboard share. Headless/test-safe: with no DOM it degrades to a no-op shell that
// still exposes open/close state + the live ballad text so the QA hook works.

import { composeBallad } from '../voyage-log.js';

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
        if (e.target.closest?.('#ballad-copy')) { e.preventDefault(); copy(); }
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
