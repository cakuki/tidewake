// HUD — every DOM/heads-up-display update lives here, fed the ship state each frame.
// Heading/speed read-outs, the ship-relative wind compass + point-of-sail label, the
// version stamp, and the non-blocking arrival toast. Keeps the per-label/per-band
// cache so the hot path only touches the DOM when something actually changed.
import { pointOfSail } from './physics.js';
import { VERSION } from './version.js';
import { GOODS, PORTS, HOLD_CAP, market, buy, sell, cargoUsed } from './economy.js';
import { rankForRenown, renownTier, titleFor, dominantPole } from './renown.js';

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
  const $infamy = document.getElementById('infamy');
  const $standing = document.getElementById('standing');
  const $rank = document.getElementById('rank');
  const $rankprog = document.getElementById('rankprog');
  const $trade = document.getElementById('trade');
  const $duel = document.getElementById('duel');
  const $prompt = document.getElementById('challenge-prompt');
  document.getElementById('version').textContent = VERSION;

  let lastPosLabel = '', lastPosBand = '';
  let toastTimer = null;
  // Captain's Ledger: only re-touch the DOM when a pole changes, and flash on rank-up.
  // `lastRankIndex` starts null so the first frame (incl. a restored voyage) just adopts
  // the current rank silently — we only celebrate a rank the player *climbs into*.
  let lastLedgerSig = '', lastRankIndex = null;

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
    const pole = dominantPole(state.infamy, state.standing);
    const sig = port + '|' + state.coins + '|' + JSON.stringify(state.cargo) + '|' + tier.tier + '|' + pole + '|' + flash;
    if (sig === lastTradeSig && $trade.classList.contains('show')) return;
    lastTradeSig = sig;

    const info = PORTS[port] || {};
    const cryer = (info.cryers && info.cryers[(Math.floor(Date.now() / 6000)) % info.cryers.length]) || '';
    // Standing badge (#43/#45): how this port reckons you. The trade-terms perk is the
    // same, but a FEARED captain gets a wary note rather than a warm one.
    const badgeNote = pole === 'pirate'
      ? "they'd sooner you sailed on — but trade quick"
      : 'terms in your favour';
    const standing = tier.tier > 0 ? ` · <span class="trade-standing">${tier.label} — ${badgeNote}</span>` : '';
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

  // Captain's Ledger (#45): both poles — ⚔ Infamy + ⚖ Standing — plus the current
  // pole-aware title and a hint of which way you lean and how far to the next rung.
  // Fires a celebratory toast the moment the player climbs into a new rank.
  function renderLedger(state) {
    const infamy = Number.isFinite(state.infamy) ? state.infamy : 0;
    const standing = Number.isFinite(state.standing) ? state.standing : 0;
    const total = infamy + standing;
    const t = titleFor(infamy, standing);
    const rank = rankForRenown(total);
    if (lastRankIndex !== null && rank.index > lastRankIndex) showRankUp(t.title);
    lastRankIndex = rank.index;
    const sig = `${infamy}|${standing}|${t.title}`;
    if (sig === lastLedgerSig) return; // nothing to repaint
    lastLedgerSig = sig;
    if ($infamy) $infamy.textContent = infamy;
    if ($standing) $standing.textContent = standing;
    if ($rank) $rank.textContent = t.title;
    if ($rankprog) {
      const lean = t.pole === 'neutral' ? 'balanced' : t.leaning;
      $rankprog.textContent = rank.nextAt === null
        ? ` · ${lean} · top of the ledger ★`
        : ` · ${lean} · ${rank.nextAt - total} to next`;
    }
  }

  // One-time wind name stamp (the breeze is fixed for the voyage).
  function setWind(name) { $wind.textContent = name; }

  // Generic non-blocking banner (the shared toast). Auto-dismisses after `ms`.
  function flashBanner(title, line, ms = 5000) {
    if (!$toast) return;
    $toast.classList.remove('rankup');
    $toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-line">${line}</div>`;
    $toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), ms);
  }

  // Arrival toast — reaching a port shows "⚓ Made port at <Name>" + a greeting.
  function showArrival(portName, line) {
    flashBanner(`⚓ Made port at ${portName}`, line);
  }

  // ---- Insult-duel panel (#33) ----------------------------------------------
  // Reads a plain duel snapshot and paints the modal-ish panel: both morale bars,
  // the enemy's last line, and the numbered jab options. Cheap cache so the hot
  // path only touches the DOM when the duel actually changes.
  let lastDuelSig = '';
  function renderDuel(duel) {
    if (!$duel) return;
    if (!duel || !duel.active) {
      if ($duel.classList.contains('show')) { $duel.classList.remove('show'); lastDuelSig = ''; }
      // At sea (not dueling): hint when a ship is hailable.
      if ($prompt) $prompt.classList.toggle('show', !!(duel && duel.inRange));
      return;
    }
    if ($prompt) $prompt.classList.remove('show');
    const pPct = Math.round((duel.playerMorale / duel.maxMorale) * 100);
    const ePct = Math.round((duel.enemyMorale / duel.maxMorale) * 100);
    const sig = `${duel.enemyName}|${pPct}|${ePct}|${duel.enemyLine}|${duel.options.map((o) => o.id).join(',')}`;
    if (sig === lastDuelSig && $duel.classList.contains('show')) return;
    lastDuelSig = sig;
    const opts = duel.options.map((o, i) => `<li><b>${i + 1}</b>${o.line}</li>`).join('');
    $duel.innerHTML =
      `<div class="duel-h">⚔ Insult Broadside — ${duel.enemyName}</div>`
      + '<div class="duel-bars">'
      + `<div class="duel-bar you"><div class="lab"><span>Your crew</span><span>${Math.round(duel.playerMorale)}</span></div><div class="meter"><div class="fill" style="width:${pPct}%"></div></div></div>`
      + `<div class="duel-bar them"><div class="lab"><span>Their crew</span><span>${Math.round(duel.enemyMorale)}</span></div><div class="meter"><div class="fill" style="width:${ePct}%"></div></div></div>`
      + '</div>'
      + `<div class="duel-line">“${duel.enemyLine}”</div>`
      + `<ul class="duel-opts">${opts}</ul>`
      + '<div class="duel-help">Press <b>1–4</b> to fling a jab · a sharp one cracks their nerve, a poor one shakes yours</div>';
    $duel.classList.add('show');
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

  return { update, showArrival, setWind, renderDuel, flashBanner };
}
