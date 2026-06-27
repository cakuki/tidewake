// HUD — every DOM/heads-up-display update lives here, fed the ship state each frame.
// Heading/speed read-outs, the ship-relative wind compass + point-of-sail label, the
// version stamp, and the non-blocking arrival toast. Keeps the per-label/per-band
// cache so the hot path only touches the DOM when something actually changed.
import { pointOfSail } from './physics.js';
import { VERSION } from './version.js';
import { GOODS, PORTS, HOLD_CAP, market, buy, sell, cargoUsed } from './economy.js';
import { rankForRenown, renownTier } from './renown.js';

const RAD2DEG = 180 / Math.PI;

export function createHud() {
  const $heading = document.getElementById('heading');
  const $speed = document.getElementById('speed');
  const $wind = document.getElementById('wind');
  const $windArrow = document.getElementById('windarrow');
  const $pos = document.getElementById('pos');
  const $toast = document.getElementById('toast');
  const $coins = document.getElementById('coins');
  const $cargo = document.getElementById('cargo');
  const $renown = document.getElementById('renown');
  const $rank = document.getElementById('rank');
  const $rankprog = document.getElementById('rankprog');
  const $trade = document.getElementById('trade');
  document.getElementById('version').textContent = VERSION;

  let lastPosLabel = '', lastPosBand = '';
  let toastTimer = null;
  // Captain's Ledger: only re-touch the DOM when renown changes, and flash on rank-up.
  // `lastRankIndex` starts null so the first frame (incl. a restored voyage) just adopts
  // the current rank silently — we only celebrate a rank the player *climbs into*.
  let lastRenown = -1, lastRankIndex = null;

  // ---- Trade panel + keyboard trading ---------------------------------------
  // We can't touch input.js/main.js, so the HUD owns a small, self-contained keydown
  // listener for the trade keys: number 1–5 BUY one unit, Shift+number SELL one unit.
  // It acts only while docked (state.port set) and never collides with W/A/S/D/M/N.
  let liveState = null;          // latest state, captured each update()
  let lastTradeSig = '';         // cheap cache so the panel only re-renders on change
  let flash = '', flashUntil = 0; // transient "you bought/sold" / refusal banter

  const REFUSALS = {
    'no-coins': 'The harbourmaster eyes your purse and laughs. Not enough coin.',
    'no-room': 'Your hold is fit to burst — sell something or sail lighter.',
    'no-cargo': "You can't sell what you don't have. The crowd murmurs.",
  };

  function flashMsg(s) { flash = s; flashUntil = Date.now() + 2600; }

  function doTrade(goodId, isSell) {
    if (!liveState || !liveState.port) return;
    const port = liveState.port;
    const g = GOODS.find((x) => x.id === goodId);
    const r = isSell ? sell(liveState, goodId, 1, port) : buy(liveState, goodId, 1, port);
    if (r.ok) {
      const board = market(port, liveState.renown);
      const price = isSell ? board.find((m) => m.id === goodId).sell
                           : board.find((m) => m.id === goodId).buy;
      flashMsg(`${isSell ? 'Sold' : 'Bought'} 1 ${g.name} ${isSell ? 'for' : 'at'} ${price}c.`);
    } else {
      flashMsg(REFUSALS[r.reason] || 'No deal.');
    }
    lastTradeSig = ''; // force a re-render
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', (e) => {
      // Layout-independent digit detection; ignore when typing in a field.
      const m = /^Digit([1-9])$/.exec(e.code || '');
      if (!m) return;
      const idx = Number(m[1]) - 1;
      if (idx < 0 || idx >= GOODS.length) return;
      if (!liveState || !liveState.port) return; // only while docked
      doTrade(GOODS[idx].id, e.shiftKey);
    });
  }

  // Render the docked port's market board into #trade (or hide it at sea).
  function renderTrade(state) {
    if (!$trade) return;
    const port = state && state.port;
    if (!port) {
      if ($trade.classList.contains('show')) $trade.classList.remove('show');
      lastTradeSig = '';
      return;
    }
    const renown = Number.isFinite(state.renown) ? state.renown : 0;
    const tier = renownTier(renown);
    const sig = port + '|' + state.coins + '|' + JSON.stringify(state.cargo) + '|' + tier.tier + '|' + flash;
    if (sig === lastTradeSig && $trade.classList.contains('show')) return;
    lastTradeSig = sig;

    const info = PORTS[port] || {};
    const cryer = (info.cryers && info.cryers[(Math.floor(Date.now() / 6000)) % info.cryers.length]) || '';
    // Standing badge (#43): how this port reckons you — and the trade-terms perk it earns.
    const standing = tier.tier > 0 ? ` · <span class="trade-standing">${tier.label} — terms in your favour</span>` : '';
    const rows = market(port, renown).map((row, i) => {
      const held = (state.cargo && state.cargo[row.id]) || 0;
      const spec = info.speciality === row.id ? ' spec' : (info.craving === row.id ? ' crave' : '');
      return `<tr class="trow${spec}"><td class="tk">${i + 1}</td><td class="tg">${row.icon} ${row.name}</td>`
        + `<td class="tb">${row.buy}</td><td class="ts">${row.sell}</td><td class="th">${held || ''}</td></tr>`;
    }).join('');

    $trade.innerHTML =
      `<div class="trade-h">⚓ ${port}${standing}</div>`
      + `<div class="trade-sub">${info.blurb || ''}</div>`
      + `<div class="trade-cry">${cryer}</div>`
      + `<table class="trade-t"><thead><tr><th></th><th>good</th><th>buy</th><th>sell</th><th>hold</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<div class="trade-msg">${flash && Date.now() < flashUntil ? flash : '&nbsp;'}</div>`
      + `<div class="trade-help">Press <b>1–5</b> to buy · <b>Shift+1–5</b> to sell · sail off to leave</div>`;
    $trade.classList.add('show');
  }

  // Always-on coins + cargo read-out in the corner HUD.
  function renderPurse(state) {
    if ($coins) $coins.textContent = state.coins;
    if ($cargo) $cargo.textContent = `${cargoUsed(state.cargo)}/${HOLD_CAP}`;
    renderLedger(state);
  }

  // Captain's Ledger: current rank title + renown + a hint of progress to the next rung.
  // Fires a celebratory toast the moment the player climbs into a new rank.
  function renderLedger(state) {
    const renown = Number.isFinite(state.renown) ? state.renown : 0;
    const rank = rankForRenown(renown);
    if (lastRankIndex !== null && rank.index > lastRankIndex) showRankUp(rank.title);
    lastRankIndex = rank.index;
    if (renown === lastRenown) return; // nothing to repaint
    lastRenown = renown;
    if ($renown) $renown.textContent = renown;
    if ($rank) $rank.textContent = rank.title;
    if ($rankprog) {
      $rankprog.textContent = rank.nextAt === null
        ? ' · top of the ledger ★'
        : ` · ${rank.nextAt - renown} to ${rank.nextTitle}`;
    }
  }

  // One-time wind name stamp (the breeze is fixed for the voyage).
  function setWind(name) { $wind.textContent = name; }

  // Arrival toast — a non-blocking banner that auto-dismisses. Reaching a port shows
  // "⚓ Made port at <Name>" plus a rotating harbourmaster greeting.
  function showArrival(portName, line) {
    $toast.classList.remove('rankup');
    $toast.innerHTML = `<div class="toast-title">⚓ Made port at ${portName}</div><div class="toast-line">${line}</div>`;
    $toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 5000);
  }

  // Rank-up flash — reuses the arrival toast, dressed in the ledger's green.
  const RANKUP_LINES = [
    'Word of your deeds travels the tideways.',
    'The harbourmasters have started spelling your name right.',
    'Someone, somewhere, is nervous. Excellent.',
    'Your legend gains a barnacle of weight.',
  ];
  function showRankUp(title) {
    if (!$toast) return;
    const line = RANKUP_LINES[Math.floor(Math.random() * RANKUP_LINES.length)];
    $toast.classList.add('rankup');
    $toast.innerHTML = `<div class="toast-title">⚑ You're now ${/^[AEIOU]/.test(title) ? 'an' : 'a'} ${title}!</div><div class="toast-line">${line}</div>`;
    $toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.classList.remove('show'); $toast.classList.remove('rankup'); }, 5000);
  }

  function update(state, maxSpeed) {
    liveState = state;
    renderPurse(state);
    renderTrade(state);

    let deg = Math.round((state.heading * 180 / Math.PI) % 360); if (deg < 0) deg += 360;
    $heading.textContent = deg;
    $speed.textContent = (state.speed / maxSpeed * 18).toFixed(1);

    // Wind indicator: arrow swings to the wind's bearing relative to the bow (the
    // dial is ship-relative, bow up). Point-of-sail label + colour follow the angle.
    $windArrow.setAttribute('transform', `rotate(${(state.windDir - state.heading) * RAD2DEG} 24 24)`);
    const sail = pointOfSail(state.heading, state.windDir);
    if (sail.label !== lastPosLabel) { $pos.textContent = sail.label; lastPosLabel = sail.label; }
    if (sail.band !== lastPosBand) { $pos.className = 'pos-' + sail.band; lastPosBand = sail.band; }
  }

  return { update, showArrival, setWind };
}
