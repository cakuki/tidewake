// Settings / options panel — the early-phase home for FEATURE TOGGLES (#73).
//
// A self-contained, self-tested component (the #53 house standard, see src/ui/README.md):
//   (1) PURE registry/persistence logic, exported and unit-tested WITHOUT a browser, and
//   (2) a thin `createSettings(...)` factory that owns its DOM (the ⚙ button + the panel),
//       renders the toggle list from a REGISTRY, and persists stored toggles to localStorage.
//
// The panel is styled as a ship's brass control plate; new toggles register with ONE line
// (e.g. weather/day-night #58 plugs in here next — default OFF so the sunny look stays the
// default). See the "Registering a new toggle" note in src/ui/README.md.
//
// Two kinds of toggle live in the registry:
//   • STORED  — the settings store owns the value, persists it here, restores it on load
//               (e.g. the perf overlay; the future weather toggle). Default OFF keeps the look.
//   • LIVE    — the source of truth lives in another system that already persists itself
//               (e.g. Sound, backed by audio.js's own mute key). Marked `persist:false`; we
//               read it live and drive it via `apply`, never double-storing it.

export const STORE_KEY = 'tidewake.options';

// ---- Pure logic (browser-free, unit-tested) -------------------------------------------

/**
 * PURE — resolve each toggle's value from the registry + a parsed saved blob. A saved boolean
 * wins; anything missing or non-boolean falls back to the toggle's default. Unknown saved ids
 * are ignored, so an old save with a since-removed toggle (or a future one) never leaks in.
 * @param {Array<{id:string, default?:boolean}>} defs the toggle registry
 * @param {object} saved a parsed options blob (see parseOptions)
 * @returns {Object<string, boolean>} id → boolean value map
 */
export function resolveOptions(defs, saved) {
  const out = {};
  for (const d of defs) {
    const s = saved ? saved[d.id] : undefined;
    out[d.id] = typeof s === 'boolean' ? s : !!d.default;
  }
  return out;
}

/**
 * PURE — serialise only the PERSISTABLE toggles to a JSON string. Live toggles (persist:false)
 * are skipped: their home system persists them, and storing them twice invites drift. Values
 * are coerced to booleans so the store stays clean.
 * @param {Array<{id:string, persist?:boolean}>} defs
 * @param {Object<string, *>} values
 * @returns {string} JSON
 */
export function serializeOptions(defs, values) {
  const obj = {};
  for (const d of defs) {
    if (d.persist === false) continue; // live/external — not ours to store
    if (values && d.id in values) obj[d.id] = !!values[d.id];
  }
  return JSON.stringify(obj);
}

/**
 * PURE — parse a saved options blob safely. Returns a plain object map, or {} for null / junk /
 * non-object JSON (arrays, strings, numbers). Never throws.
 * @param {string|null|undefined} str
 * @returns {object}
 */
export function parseOptions(str) {
  if (!str) return {};
  try {
    const o = JSON.parse(str);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

/**
 * PURE — set a KNOWN toggle to a (coerced) boolean, returning a NEW value map. An unknown id is
 * a no-op (returns the same map) so a stray `setOption` can never invent a toggle.
 * @param {Array<{id:string}>} defs
 * @param {Object<string, boolean>} values
 * @param {string} id
 * @param {*} value
 * @returns {Object<string, boolean>}
 */
export function withOption(defs, values, id, value) {
  if (!defs.some((d) => d.id === id)) return values;
  return { ...values, [id]: !!value };
}

// ---- The component (browser-only; nothing here runs at import time) --------------------

/**
 * Build the settings panel. Finds its DOM (#settings-toggle button + #settings-panel) within
 * `root`, renders the toggle list, and persists stored toggles to `storage`. Headless/test-safe:
 * with no DOM it degrades to a no-op shell that still tracks option state (so the QA hook works).
 *
 * Register toggles with `register({ id, label, hint, default, apply, read, persist })` BEFORE
 * `init()`:
 *   • `apply(value)`  — drives the wired behaviour when the toggle changes (and on init).
 *   • `read()`        — (optional) live source of truth; presence makes the toggle LIVE
 *                       (persist defaults to false) — e.g. Sound reads audio mute.
 *   • `default`       — value when nothing is saved (visual toggles default false → sunny look).
 *
 * @returns API: { register, init, setOption, getOption, options, open, close, toggle, isOpen, render }
 */
export function createSettings(opts = {}) {
  const root = opts.root ?? (typeof document !== 'undefined' ? document : null);
  const storage = opts.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  const key = opts.key ?? STORE_KEY;

  const defs = [];
  let values = {};
  let open = false;
  let $btn = null, $panel = null, built = false;

  function load() {
    let saved = {};
    try { saved = parseOptions(storage?.getItem(key)); } catch { /* storage off — defaults */ }
    values = resolveOptions(defs, saved);
  }
  function persist() {
    try { storage?.setItem(key, serializeOptions(defs, values)); } catch { /* sail on */ }
  }
  function defOf(id) { return defs.find((d) => d.id === id); }

  // The EFFECTIVE value: a live toggle reads its wired source each time; a stored one reads the map.
  function effective(id) {
    const d = defOf(id);
    if (!d) return undefined;
    if (typeof d.read === 'function') {
      try { return !!d.read(); } catch { return !!values[id]; }
    }
    return !!values[id];
  }

  function options() {
    const o = {};
    for (const d of defs) o[d.id] = effective(d.id);
    return o;
  }

  function register(def) {
    if (!def || !def.id) return api;
    const d = {
      label: def.id, hint: '', default: false, apply: null, read: null, persist: undefined,
      ...def,
    };
    if (d.persist === undefined) d.persist = typeof d.read !== 'function';
    defs.push(d);
    load(); // re-resolve stored values now this toggle is known
    return api;
  }

  function setOption(id, value) {
    const d = defOf(id);
    if (!d) return options();
    const v = !!value;
    values = withOption(defs, values, id, v);
    if (d.persist !== false) persist(); // live toggles let their home system store them
    try { d.apply?.(v); } catch { /* a toggle must never break the game */ }
    render();
    return options();
  }

  function getOption(id) { return effective(id); }

  // Apply every toggle's current effective value once (used at init so defaults take hold:
  // perf overlay hidden, weather off, sound matching the persisted mute).
  function applyAll() {
    for (const d of defs) {
      try { d.apply?.(effective(d.id)); } catch { /* ignore */ }
    }
  }

  // ---- DOM (all guarded; a missing element degrades to a no-op) ----
  function ensureBuilt() {
    if (built || !root) return;
    $btn = root.querySelector?.('#settings-toggle') ?? null;
    $panel = root.querySelector?.('#settings-panel') ?? null;
    if ($btn) {
      $btn.addEventListener('click', (e) => { e.preventDefault(); toggle(); });
    }
    if ($panel) {
      // Delegated: tap a row (or its switch) to flip the toggle. Whole-row target keeps it
      // comfortably tappable on a phone.
      $panel.addEventListener('click', (e) => {
        const row = e.target.closest?.('.set-row');
        if (!row || !row.dataset.id) return;
        setOption(row.dataset.id, !effective(row.dataset.id));
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
    if (!open) return; // only paint while visible
    const rows = defs.map((d) => {
      const on = effective(d.id);
      return (
        `<div class="set-row" data-id="${d.id}" role="group" aria-label="${esc(d.label)}">`
        + `<div class="set-text"><div class="set-label">${esc(d.label)}</div>`
        + (d.hint ? `<div class="set-hint">${esc(d.hint)}</div>` : '')
        + `</div>`
        + `<button class="set-switch${on ? ' on' : ''}" type="button" role="switch"`
        + ` aria-checked="${on}" aria-label="${esc(d.label)}"><span class="set-knob"></span></button>`
        + `</div>`
      );
    }).join('');
    $panel.innerHTML =
      `<div class="set-h">⚙ Ship&rsquo;s Articles</div>`
      + `<div class="set-sub">Strike or hoist a flag as you please, Captain.</div>`
      + `<div class="set-rows">${rows}</div>`
      + `<div class="set-help">Tap a line to flip it &middot; <b>O</b> to open, <b>Esc</b> to close &middot; your choices are remembered</div>`;
    syncButton();
  }

  function setOpen(v) {
    open = !!v;
    syncButton();
    render();
  }
  function openPanel() { setOpen(true); }
  function close() { setOpen(false); }
  function toggle() { setOpen(!open); }

  function init() {
    load();
    ensureBuilt();
    applyAll(); // make every toggle's current value real (defaults take hold)
    // Component-owned keys (keeps main.js thin): 'o' toggles the panel, Esc closes it.
    try {
      (root?.defaultView ?? globalThis)?.addEventListener?.('keydown', (e) => {
        const k = (e.key || '').toLowerCase();
        if (k === 'o') { e.preventDefault?.(); toggle(); }
        else if (k === 'escape' && open) { close(); }
      });
    } catch { /* headless without a window — fine */ }
    syncButton();
    return api;
  }

  const api = {
    register, init, setOption, getOption, applyAll,
    open: openPanel, close, toggle, render,
    get options() { return options(); },
    get isOpen() { return open; },
  };
  return api;
}

// Minimal HTML-escape for labels/hints (they're authored strings, but stay safe by habit).
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}
