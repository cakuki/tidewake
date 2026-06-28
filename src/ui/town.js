// Town / market view (#96) — the DOM for the new TOWN mode. The owner wanted the market to be
// a PLACE you make landfall into, not a panel that flickers over the helm: harbour → ashore →
// the market, left only via an explicit "Set Sail" button. Follows the #53 house standard —
// the testable money math lives in PURE src/economy.js; this factory only owns its panel,
// paints the market board onto it, routes taps to buy/sell, and fires the Leave callback.
// Headless/test-safe: with no DOM it degrades to a no-op shell that still reports open-state +
// the docked port, so the QA hook works.
//
// CREATIVE SPARK (Game Designer): a town is people, not a price list. So the market opens with a
// barker's HOLLER — a different cry each visit, drawn from the port's own criers — and the panel
// reads like a quayside, not a spreadsheet. The single warm "⚓ Set Sail" plank is the only way
// back out: one obvious, reversible pull of the wheel (the #67 must-have), never a maze.

import { GOODS, PORTS, market, buy, sell, cargoUsed, HOLD_CAP } from '../economy.js';
import { renownTier, dominantPole } from '../renown.js';

export function createTown(opts = {}) {
  const getState = typeof opts.getState === 'function' ? opts.getState : () => null;
  const onLeave = typeof opts.onLeave === 'function' ? opts.onLeave : () => {};
  const root = opts.root ?? (typeof document !== 'undefined' ? document : null);
  // Touch parity (#17/#66): taps drive trades + the Leave plank when there's no keyboard.
  const TOUCH = !!(root && root.body && root.body.classList && root.body.classList.contains('touch'));

  let open = false, built = false;
  let $panel = null;
  let flash = '', flashUntil = 0; // transient "you bought/sold" / refusal banter
  let lastSig = '';

  const REFUSALS = {
    'no-coins': 'The trader eyes your purse and laughs. Not enough coin.',
    'no-room': 'Your hold is fit to burst — sell something or sail lighter.',
    'no-cargo': "You can't sell what you don't have. The market murmurs.",
  };

  function flashMsg(s) { flash = s; flashUntil = Date.now() + 2600; }

  // A buy/sell at the docked port — the one meaningful market interaction, wired straight to
  // the shared economy (coins + cargo + standing). Always re-renders so the board updates live.
  function doTrade(goodId, isSell) {
    const state = getState();
    if (!state || !state.port) return;
    const g = GOODS.find((x) => x.id === goodId);
    const r = isSell ? sell(state, goodId, 1, state.port) : buy(state, goodId, 1, state.port);
    if (r.ok) {
      const board = market(state.port, state.renown);
      const row = board.find((m) => m.id === goodId);
      const price = isSell ? row.sell : row.buy;
      flashMsg(`${isSell ? 'Sold' : 'Bought'} 1 ${g ? g.name : goodId} ${isSell ? 'for' : 'at'} ${price}c.`);
    } else {
      flashMsg(REFUSALS[r.reason] || 'No deal.');
    }
    lastSig = ''; // force a repaint
    render();
  }

  function ensureBuilt() {
    if (built || !root) return;
    $panel = root.querySelector?.('#town') ?? null;
    if ($panel) {
      // Delegated so re-renders never need re-binding: the Leave plank, and tap-to-trade rows.
      $panel.addEventListener('click', (e) => {
        if (e.target.closest?.('#town-leave')) { e.preventDefault(); onLeave(); return; }
        const tr = e.target.closest?.('.trow');
        if (tr && tr.dataset.good) doTrade(tr.dataset.good, !!e.target.closest('.ts'));
      });
    }
    built = true;
  }

  // The barker's cry — rotates through the port's own criers, refreshed slowly so a long stay
  // hears the quayside change its tune (#96 creative spark). Falls back to a generic holler.
  function barker(info) {
    const cries = (info && info.cryers) || [];
    if (!cries.length) return '"Step ashore, captain — the market\'s open!"';
    return cries[Math.floor(Date.now() / 6000) % cries.length];
  }

  function render() {
    ensureBuilt();
    if (!$panel) return;
    $panel.classList.toggle('show', open);
    $panel.setAttribute('aria-hidden', String(!open));
    if (!open) { lastSig = ''; return; } // only paint while ashore

    const state = getState() || {};
    const port = state.port;
    if (!port) { $panel.classList.remove('show'); return; }
    const renown = Number.isFinite(state.renown) ? state.renown : 0;
    const tier = renownTier(renown);
    const pole = dominantPole(state.infamy, state.standing);
    const info = PORTS[port] || {};
    const cry = barker(info);
    // Cheap cache: only touch the DOM when something the player can see changes.
    const sig = port + '|' + state.coins + '|' + JSON.stringify(state.cargo) + '|' + tier.tier + '|' + pole + '|' + flash + '|' + cry;
    if (sig === lastSig) return;
    lastSig = sig;

    const standingNote = tier.tier > 0
      ? ` · <span class="town-standing">${esc(tier.label)} — ${pole === 'pirate' ? 'they trade quick and watch the door' : 'terms in your favour'}</span>`
      : '';
    const rows = market(port, renown).map((row, i) => {
      const held = (state.cargo && state.cargo[row.id]) || 0;
      const spec = info.speciality === row.id ? ' spec' : (info.craving === row.id ? ' crave' : '');
      return `<tr class="trow${spec}" data-good="${row.id}"><td class="tk">${i + 1}</td>`
        + `<td class="tg">${row.icon} ${esc(row.name)}</td>`
        + `<td class="tb">${row.buy}</td><td class="ts">${row.sell}</td><td class="th">${held || ''}</td></tr>`;
    }).join('');

    const used = cargoUsed(state.cargo);
    $panel.innerHTML =
      `<div class="town-h">🏘 ${esc(port)}</div>`
      + `<div class="town-sub">${esc(info.blurb || 'A port town, alive with trade.')}</div>`
      + `<div class="town-master">${esc(info.harbourmaster || 'The harbourmaster nods you ashore.')}</div>`
      + `<div class="town-barker">${esc(cry)}</div>`
      + `<div class="town-purse">⛃ <b>${state.coins ?? 0}</b> coins · Hold <b>${used}/${HOLD_CAP}</b>${standingNote}</div>`
      + `<div class="town-market-h">⚖ The Market</div>`
      + `<table class="town-t"><thead><tr><th></th><th>good</th><th>buy</th><th>sell</th><th>hold</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<div class="town-msg">${flash && Date.now() < flashUntil ? esc(flash) : '&nbsp;'}</div>`
      + `<div class="town-trade-help">${TOUCH
          ? 'Tap a row to <b>buy</b> · tap its <b>sell</b> price to sell'
          : 'Press <b>1–5</b> to buy · <b>Shift+1–5</b> to sell'}</div>`
      + `<button id="town-leave" class="town-leave" type="button">⚓ Set Sail &nbsp;<span class="town-leave-key">(L)</span></button>`
      + `<div class="town-help">More to do ashore is coming — for now, trade your hold and set sail when you're ready.</div>`;
  }

  function setOpen(v) {
    const next = !!v;
    if (next === open) { if (open) render(); return; } // keep the live barker/market fresh
    open = next;
    render();
  }

  function init() {
    ensureBuilt();
    // Component-owned key (keeps main.js thin): L leaves the harbour when ashore. The market
    // buy/sell number keys are already owned by hud.js (they fire while docked) — desktop parity.
    try {
      (root?.defaultView ?? globalThis)?.addEventListener?.('keydown', (e) => {
        if (!open) return;
        const k = (e.key || '').toLowerCase();
        if (k === 'l') { e.preventDefault?.(); onLeave(); }
      });
    } catch { /* headless without a window — fine */ }
    return api;
  }

  const api = {
    init, render, setOpen,
    get isOpen() { return open; },
    get port() { const s = getState(); return (s && s.port) || null; },
  };
  return api;
}

// Minimal HTML-escape — port/good names are authored, but stay safe by habit.
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}
