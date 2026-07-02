// HUD — every DOM/heads-up-display update lives here, fed the ship state each frame.
// Heading/speed read-outs, the version stamp, and the non-blocking arrival toast. The
// ship-relative wind compass + point-of-sail label now live in their own self-contained,
// self-tested component (src/ui/compass.js) — the pattern HUD pieces are migrating to (#53).
// Keeps the per-label/per-band cache so the hot path only touches the DOM when changed.
import { VERSION } from './version.js';
import { GOODS, PORTS, HOLD_CAP, market, buy, sell, cargoUsed } from './economy.js';
import { rankForRenown, renownTier, titleFor, dominantPole, legendBeat } from './renown.js';
import { governorshipBeat } from './systems/home-port.js';
import { colourById } from './colours.js';
import { createCompass } from './ui/compass.js';
import { createRaidPhases } from './ui/raid-phases.js';
import { createKeyPrompts } from './ui/key-prompts.js';
import { KEYS } from './keymap.js';

export function createHud() {
  const $heading = document.getElementById('heading');
  const $speed = document.getElementById('speed');
  const $wind = document.getElementById('wind');
  const compass = createCompass();   // self-contained wind compass component (#53)
  const raidPhases = createRaidPhases(); // per-phase Three-Act Raid tracker (#135, Option-4 polish)
  const keyPrompts = createKeyPrompts(); // contextual just-in-time battle key-prompts (#153, onboarding)
  const $toast = document.getElementById('toast');
  const $coins = document.getElementById('coins');
  const $cargo = document.getElementById('cargo');
  const $infamy = document.getElementById('infamy');
  const $standing = document.getElementById('standing');
  const $rank = document.getElementById('rank');
  const $rankprog = document.getElementById('rankprog');
  const $trade = document.getElementById('trade');
  const $duel = document.getElementById('duel');
  const $cannons = document.getElementById('cannons');
  const $battle = document.getElementById('battle'); // real-time broadside panel (#135 slice 2)
  const $encounter = document.getElementById('encounter'); // foundering-ship choice panel (#125)
  const $prompt = document.getElementById('challenge-prompt');
  const $legend = document.getElementById('legend');
  const $legendBadge = document.getElementById('legend-badge');
  const $goal = document.getElementById('goal'); // invisible-onboarding goal card (#60)
  document.getElementById('version').textContent = VERSION;

  // Touch mode (#17): input.js sets `body.touch` before the HUD is built. When set, the
  // trade rows and duel jabs become tappable so trading/dueling work without a keyboard.
  const TOUCH = typeof document !== 'undefined' && !!document.body && document.body.classList.contains('touch');

  let toastTimer = null;
  // Captain's Ledger: only re-touch the DOM when a pole/title changes. The rank-UP celebration
  // moved to the pure milestone system (#169), driven from main.js.
  let lastLedgerSig = '';

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

  // Tappable trade (#17, touch only): tap a row to buy one unit, tap its sell price to
  // sell one. Delegated on the panel so re-renders don't need re-binding. Desktop is
  // untouched — the listener is never attached unless we're in touch mode.
  if (TOUCH && $trade) {
    $trade.addEventListener('click', (e) => {
      const tr = e.target.closest('.trow');
      if (!tr || !tr.dataset.good) return;
      doTrade(tr.dataset.good, !!e.target.closest('.ts'));
    });
  }
  // Tappable duel jabs (#17, touch only): tap an option to fling it. We dispatch the
  // same digit keydown the keyboard would, so main.js's duel handler runs unchanged.
  if (TOUCH && $duel) {
    $duel.addEventListener('click', (e) => {
      const li = e.target.closest('.duel-opts li');
      if (!li || li.dataset.jab === undefined) return;
      const n = Number(li.dataset.jab) + 1;
      dispatchEvent(new KeyboardEvent('keydown', { key: String(n), code: 'Digit' + n, bubbles: true }));
    });
  }
  // Tappable cannon aims (#59, touch only): tap an aim to fire it — same digit-keydown
  // trick as the duel, so main.js's cannon handler runs unchanged.
  if (TOUCH && $cannons) {
    $cannons.addEventListener('click', (e) => {
      const li = e.target.closest('.cannon-opts li');
      if (!li || li.dataset.aim === undefined) return;
      const n = Number(li.dataset.aim) + 1;
      dispatchEvent(new KeyboardEvent('keydown', { key: String(n), code: 'Digit' + n, bubbles: true }));
    });
  }

  // Tappable FIRE button (#135 slice 2, touch only): tap to discharge the loaded broadside — we
  // dispatch the same Space keydown the keyboard would, so main.js's fire handler runs unchanged.
  if ($battle) {
    $battle.addEventListener('click', (e) => {
      // The loaded-shot chip (#135 slice 3) cycles the shot — tappable on every device (desktop also
      // has the X key). We dispatch the same keydown main.js's handlers run, so wiring stays in one place.
      if (e.target.closest('.battle-shot')) {
        dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', bubbles: true }));
        return;
      }
      // Tappable BOARD button (#135 slice 4): once she's beaten (≤30% hull), tap to board — dispatch the
      // same F keydown the keyboard would, so main.js's boarding handler runs unchanged. Checked BEFORE
      // FIRE because the touch board button reuses the .battle-fire class for layout.
      if (e.target.closest('[data-board]')) {
        dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true }));
        return;
      }
      // Tappable FIRE button (#135 slice 2, touch only): tap to discharge the loaded broadside.
      if (TOUCH && e.target.closest('.battle-fire')) {
        dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      }
    });
  }

  // Tappable rescue/plunder choice (#125, touch only): tap a choice to dispatch the same digit
  // keydown the keyboard would (1 rescue / 2 plunder), so main.js's encounter handler runs unchanged.
  if (TOUCH && $encounter) {
    $encounter.addEventListener('click', (e) => {
      const li = e.target.closest('.enc-opts li');
      if (!li || !li.dataset.enc) return;
      const n = li.dataset.enc === 'rescue' ? 1 : 2;
      dispatchEvent(new KeyboardEvent('keydown', { key: String(n), code: 'Digit' + n, bubbles: true }));
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
      return `<tr class="trow${spec}" data-good="${row.id}"><td class="tk">${i + 1}</td><td class="tg">${row.icon} ${row.name}</td>`
        + `<td class="tb">${row.buy}</td><td class="ts">${row.sell}</td><td class="th">${held || ''}</td></tr>`;
    }).join('');

    $trade.innerHTML =
      `<div class="trade-h">⚓ ${port}${standing}</div>`
      + `<div class="trade-sub">${info.blurb || ''}</div>`
      + `<div class="trade-cry">${cryer}</div>`
      + `<table class="trade-t"><thead><tr><th></th><th>good</th><th>buy</th><th>sell</th><th>hold</th></tr></thead><tbody>${rows}</tbody></table>`
      + `<div class="trade-msg">${flash && Date.now() < flashUntil ? flash : '&nbsp;'}</div>`
      + `<div class="trade-help">${TOUCH
          ? 'Tap a row to <b>buy</b> · tap its <b>sell</b> price to sell · sail off to leave'
          : 'Press <b>1–5</b> to buy · <b>Shift+1–5</b> to sell · sail off to leave'}</div>`;
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
    // The rank-UP celebration now lives in the pure milestone system (#169), driven from main.js so it
    // can also fire the audio sting and use a robust "highest rung seen" guard — the ledger read-out
    // here just paints the current numbers/title.
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

  // ---- False Colours chip (#79) ---------------------------------------------
  // The HUD button that shows (and cycles, via main.js's click handler) the colours flown:
  // true black vs false merchant. The `lie` class lets it read as a sly disguise when set.
  const $coloursToggle = document.getElementById('colours-toggle');
  function renderColours(id) {
    if (!$coloursToggle) return;
    const def = colourById(id);
    $coloursToggle.innerHTML = `${def.icon} <b>${def.short}</b>`;
    $coloursToggle.classList.toggle('lie', !!def.deceptive);
    $coloursToggle.setAttribute('aria-label', `Flying ${def.name}. Press C to change colours.`);
    $coloursToggle.title = `Colours: ${def.name} (C)`;
  }

  // One-time wind name stamp (the breeze is fixed for the voyage).
  function setWind(name) { $wind.textContent = name; }

  // Generic non-blocking banner (the shared toast). Auto-dismisses after `ms`.
  function flashBanner(title, line, ms = 5000) {
    if (!$toast) return;
    $toast.classList.remove('rankup');
    $toast.classList.remove('defeat'); // clear the red defeat skin so a normal banner reads normal
    $toast.innerHTML = `<div class="toast-title">${title}</div><div class="toast-line">${line}</div>`;
    $toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), ms);
  }

  // ---- The "Colours Struck" defeat card (#164) ------------------------------
  // Loss stings: when a fight is LOST the toast turns RED and NAMES the cost — the fame + coin the
  // defeat just deducted (see systems/renown.js defeatLedger). The player SEES their colours struck
  // and their legend + purse visibly DROP, so picking reckless fights now carries a felt risk. Reuses
  // the shared toast (already docked clear of the battle-camera safe-zone, #161 slice 2) so it never
  // occludes the framed ship. `lastDefeat` is exposed for the headless QA hook to assert the cost.
  let lastDefeat = null;
  function showDefeat({ foeName = 'She', pole = 'infamy', fameLoss = 0, coinLoss = 0 } = {}) {
    const poleLabel = pole === 'standing' ? 'Standing' : 'Infamy';
    lastDefeat = { foeName, pole, poleLabel, fameLoss, coinLoss };
    const cost = `−${fameLoss} ${poleLabel}, −${coinLoss} coin`;
    flashBanner('⚑ Colours Struck',
      `${foeName} rakes you under — you strike your colours and limp away. Plundered: <b>${cost}</b>.`);
    if ($toast) $toast.classList.add('defeat'); // re-add after flashBanner cleared it — the red sting
  }
  /** The last defeat card's named cost (or null) — for the headless QA gate. */
  function defeatCard() { return lastDefeat; }

  // Arrival toast — reaching a port shows "⚓ Made port at <Name>" + a greeting.
  function showArrival(portName, line) {
    flashBanner(`⚓ Made port at ${portName}`, line);
  }

  // ---- Invisible-onboarding goal card (#60) ---------------------------------
  // A small, diegetic objective card for a brand-new captain — names the loop in one
  // breath. Non-blocking (pointer-events: none) and self-clearing: main.js shows it on a
  // fresh voyage and hides it the moment the captain acts (their first dock). Cheap cache.
  let lastGoalSig = '';
  function showGoal(goal) {
    if (!$goal || !goal) return;
    const sig = goal.title + '|' + goal.line;
    if (sig === lastGoalSig && $goal.classList.contains('show')) return;
    lastGoalSig = sig;
    $goal.innerHTML = `<div class="goal-title">${goal.title}</div><div class="goal-line">${goal.line}</div>`;
    $goal.classList.add('show');
  }
  function hideGoal() {
    if (!$goal) return;
    if ($goal.classList.contains('show')) { $goal.classList.remove('show'); lastGoalSig = ''; }
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
    const opts = duel.options.map((o, i) => `<li data-jab="${i}"><b>${i + 1}</b>${o.line}</li>`).join('');
    $duel.innerHTML =
      `<div class="duel-h">⚔ Insult Broadside — ${duel.enemyName}</div>`
      + '<div class="duel-bars">'
      + `<div class="duel-bar you"><div class="lab"><span>Your crew</span><span>${Math.round(duel.playerMorale)}</span></div><div class="meter"><div class="fill" style="width:${pPct}%"></div></div></div>`
      + `<div class="duel-bar them"><div class="lab"><span>Their crew</span><span>${Math.round(duel.enemyMorale)}</span></div><div class="meter"><div class="fill" style="width:${ePct}%"></div></div></div>`
      + '</div>'
      + `<div class="duel-line">“${duel.enemyLine}”</div>`
      + `<ul class="duel-opts">${opts}</ul>`
      + `<div class="duel-help">${TOUCH ? 'Tap' : 'Press <b>1–4</b>'} to fling a jab · a sharp one cracks their nerve, a poor one shakes yours</div>`;
    $duel.classList.add('show');
  }

  // ---- Cannon-broadside panel (#59) -----------------------------------------
  // The duel panel's teeth-y twin: two HULL bars, the foe's last line / a volley quip,
  // and the numbered aim options. Same cheap-cache discipline as renderDuel. When the
  // cannonade is active it also hides the at-sea hail/fire prompt (it runs after
  // renderDuel each frame, so an active engagement wins the prompt).
  let lastCannonSig = '';
  function renderCannons(c) {
    if (!$cannons) return;
    if (!c || !c.active) {
      if ($cannons.classList.contains('show')) { $cannons.classList.remove('show'); lastCannonSig = ''; }
      return; // at sea: renderDuel owns the prompt (range is shared), so we leave it be
    }
    if ($prompt) $prompt.classList.remove('show'); // an active fight hides the prompt
    const pPct = Math.round((c.playerHull / c.maxHull) * 100);
    const ePct = Math.round((c.enemyHull / c.maxHull) * 100);
    // Their crew NERVE (#72): break it with chain-shot and they strike their colours (a capture,
    // not a kill). Older snapshots without morale degrade gracefully (no nerve bar shown).
    const hasMorale = typeof c.enemyMorale === 'number' && c.maxMorale > 0;
    const mPct = hasMorale ? Math.round((c.enemyMorale / c.maxMorale) * 100) : 0;
    const sig = `${c.foeName}|${pPct}|${ePct}|${mPct}|${c.lastLine}|${c.round}`;
    if (sig === lastCannonSig && $cannons.classList.contains('show')) return;
    lastCannonSig = sig;
    const opts = c.options.map((o) => `<li data-aim="${o.i}"><b>${o.i + 1}</b>${o.label}</li>`).join('');
    const nerveBar = hasMorale
      ? `<div class="duel-bar nerve"><div class="lab"><span>Their nerve</span><span>${Math.round(c.enemyMorale)}</span></div><div class="meter"><div class="fill" style="width:${mPct}%"></div></div></div>`
      : '';
    $cannons.innerHTML =
      `<div class="cannon-h">🔥 Cannon Broadside — ${c.foeName}</div>`
      + '<div class="duel-bars">'
      + `<div class="duel-bar you"><div class="lab"><span>Your hull</span><span>${Math.round(c.playerHull)}</span></div><div class="meter"><div class="fill" style="width:${pPct}%"></div></div></div>`
      + `<div class="duel-bar them"><div class="lab"><span>Their hull</span><span>${Math.round(c.enemyHull)}</span></div><div class="meter"><div class="fill" style="width:${ePct}%"></div></div></div>`
      + nerveBar
      + '</div>'
      + `<div class="duel-line">“${c.lastLine}”</div>`
      + `<ul class="duel-opts cannon-opts">${opts}</ul>`
      + `<div class="duel-help">${TOUCH ? 'Tap' : 'Press <b>1–2</b>'} to fire · broadside sinks her for infamy · chain-shot breaks their nerve — they may strike their colours</div>`;
    $cannons.classList.add('show');
  }

  // ---- Real-time broadside panel (#135 slice 2) -----------------------------
  // The deliberate-stance fight: two HULL bars, a live AIM cue (bring her ABEAM, then FIRE), a
  // reload read-out, and the foe's last line / a volley quip. Same cheap-cache discipline as the
  // cannonade panel; reuses the #cannons inner bar/line classes, scoped under #battle.
  let lastBattleSig = '';
  function renderBattle(b) {
    if (!$battle) return;
    if (!b || !b.active) {
      if ($battle.classList.contains('show')) { $battle.classList.remove('show'); lastBattleSig = ''; }
      return; // at sea: renderDuel/renderCannons own the prompt
    }
    if ($prompt) $prompt.classList.remove('show'); // an active fight hides the at-sea prompt
    const pPct = Math.round((b.playerHull / b.maxHull) * 100);
    const ePct = Math.round((b.enemyHull / b.maxHull) * 100);
    const loaded = !!b.loaded;
    const inArc = !!b.inArc;
    const ready = loaded && inArc;
    const qPct = Math.round((b.aimQuality || 0) * 100);
    const status = !loaded ? '⟳ Reloading the guns…'
      : inArc ? `🎯 ABEAM to ${b.aimSide} — FIRE!`
      : '↪ Bring her broadside to bear…';
    // The LOADED shot (#135 slice 3): which shot is at the rack + its one-line effect. Cycled with X
    // (or, on touch, by tapping the chip). Falls back gracefully if an older snapshot has no ammo.
    const ap = b.ammoProfile || null;
    const shotLabel = ap ? `${ap.icon} ${ap.name} · ${ap.tag}` : '';
    // Boarding (#135 slice 4): once she's beaten to ≤30% hull, a "Board!" finisher lights — sending the
    // crew over the rail for a quick brawl, then her captain's verbal duel decides the prize.
    const canBoard = !!b.canBoard;
    const sig = `${b.foeName}|${pPct}|${ePct}|${loaded}|${inArc}|${qPct}|${b.lastLine}|${b.round}|${b.ammo || ''}|${canBoard}`;
    if (sig === lastBattleSig && $battle.classList.contains('show')) return;
    lastBattleSig = sig;
    $battle.innerHTML =
      `<div class="cannon-h">⚔ Broadside — ${b.foeName}</div>`
      + '<div class="duel-bars">'
      + `<div class="duel-bar you"><div class="lab"><span>Your hull</span><span>${Math.round(b.playerHull)}</span></div><div class="meter"><div class="fill" style="width:${pPct}%"></div></div></div>`
      + `<div class="duel-bar them"><div class="lab"><span>Their hull</span><span>${Math.round(b.enemyHull)}</span></div><div class="meter"><div class="fill" style="width:${ePct}%"></div></div></div>`
      + '</div>'
      + (canBoard
        ? `<button class="battle-board" data-board="1" type="button" title="Board her">⚔ BOARD HER!${TOUCH ? '' : ' <span class="battle-shot-key">(F)</span>'}</button>`
        : `<div class="battle-aim${ready ? ' hot' : ''}">${status}</div>`)
      + (shotLabel
        ? `<button class="battle-shot" data-shot="1" type="button" title="Cycle loaded shot">🎱 ${shotLabel}${TOUCH ? '' : ' <span class="battle-shot-key">(X)</span>'}</button>`
        : '')
      + `<div class="duel-line">“${b.lastLine || 'Steer for her beam and run out the guns.'}”</div>`
      + (TOUCH
        ? (canBoard
          ? '<button class="battle-fire board" data-board="1">⚔ BOARD</button>'
          : `<button class="battle-fire" data-fire="1"${ready ? '' : ' disabled'}>🔥 FIRE</button>`)
        : (canBoard
          ? `<div class="duel-help">She’s beaten — <b>${KEYS.board.glyph}</b> to BOARD her, or keep firing to sink her</div>`
          : `<div class="duel-help">Steer <b>A/D</b> abeam · <b>${KEYS.fire.glyph}</b> fires · <b>${KEYS.cycle.glyph}</b> cycles shot · <b>${KEYS.flee.glyph}</b> breaks off</div>`));
    $battle.classList.add('show');
  }

  // ---- Per-phase raid tracker (#135, Option-4 polish) -----------------------
  // The compact strip that makes the Three-Act Raid legible: which act you're in + the coupling
  // you earned. Reads the battle + duel snapshots (read-only); the pure model + DOM live in the
  // self-contained src/ui/raid-phases.js component. Called each frame from main.js's hud system.
  function renderRaidPhases(battle, duel) { raidPhases.update(battle, duel); }

  // ---- Contextual just-in-time key-prompts (#153) ---------------------------
  // The onboarding for the deep battle system: surfaces the key(s) for the action that JUST became
  // possible (fire · change shot · board · accept/press) and fades each once used. Pure model + DOM
  // live in the self-contained src/ui/key-prompts.js; reads the battle + duel snapshots (read-only).
  // Returns the battle-verb EARCON name to ring this frame (#154), or undefined — main.js arms it on
  // the music bus. The visual strip is painted here; the audio edge is decided by the same component.
  function renderKeyPrompts(battle, duel) { return keyPrompts.update(battle, duel); }

  // ---- Foundering-ship encounter panel (#125) -------------------------------
  // Reads a plain encounter snapshot and paints the rescue-vs-plunder choice — the founderer's
  // name + a plea line + the two numbered choices. Reuses the duel panel's inner classes (scoped
  // under #encounter with its own accent in index.html). Cheap cache so the hot path only touches
  // the DOM on a real change. While a founderer is alongside it also hides the at-sea hail/fire
  // prompt (it runs after renderDuel/renderCannons each frame, so the moral beat wins the prompt).
  let lastEncSig = '';
  const ENC_PLEA = [
    'Help us, for pity\'s sake — she\'s going down beneath us!',
    'Captain! We\'re foundering — take us off before she sinks!',
    'For mercy\'s sake, throw us a line — we can\'t hold her!',
  ];
  function renderEncounter(enc) {
    if (!$encounter) return;
    if (!enc || !enc.active) {
      if ($encounter.classList.contains('show')) { $encounter.classList.remove('show'); lastEncSig = ''; }
      return;
    }
    if ($prompt) $prompt.classList.remove('show'); // a live founderer claims the moment
    const plea = ENC_PLEA[(enc.name || '').length % ENC_PLEA.length];
    const sig = `${enc.name}|${enc.inRange}`;
    if (sig === lastEncSig && $encounter.classList.contains('show')) return;
    lastEncSig = sig;
    $encounter.innerHTML =
      `<div class="enc-h">🆘 ${enc.name} — foundering!</div>`
      + `<div class="duel-line">“${plea}”</div>`
      + `<ul class="duel-opts enc-opts">`
      + `<li data-enc="rescue"><b>1</b> Rescue her crew — the lawful road (Standing)</li>`
      + `<li data-enc="plunder"><b>2</b> Plunder the wreck — take the spoils (coin · Infamy)</li>`
      + `</ul>`
      + `<div class="duel-help">${TOUCH ? 'Tap a choice' : 'Press <b>1</b> to rescue · <b>2</b> to plunder'} · who you become is your answer</div>`;
    $encounter.classList.add('show');
  }

  // ---- Rank-up milestone card (#169, epic #168 "The Rise") ------------------
  // The felt "you rose" beat: crossing into a new rung fires a title card in the ledger's green,
  // NAMING the new title with pole-appropriate tone (dread for the pirate road, respect for the
  // governor road). Reuses the shared toast (already docked clear of the #161-s2 battle-camera
  // safe-zone) so it never occludes the framed ship, and the mobile guard (#146) rides with it.
  // The detection + copy live in the PURE src/systems/rank-milestone.js core; this is the thin
  // presenter — main.js hands it a ready-made {icon, headline, flourish, title, pole} card. The
  // last card is exposed for the headless QA gate to assert the crossing fired the right title.
  let lastRankUp = null, rankUpCount = 0;
  function showRankUp(card = {}) {
    const { icon = '⚑', headline = '', flourish = '', title = '', pole = 'neutral' } = card;
    rankUpCount += 1; // a monotonic fire-count so the headless gate can assert once-only / no re-fire
    lastRankUp = { icon, headline, flourish, title, pole, count: rankUpCount };
    if (!$toast) return;
    $toast.classList.remove('defeat'); // clear the red loss skin so the rise reads triumphant
    $toast.classList.add('rankup');
    $toast.innerHTML = `<div class="toast-title">${icon} ${headline}</div><div class="toast-line">${flourish}</div>`;
    $toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.classList.remove('show'); $toast.classList.remove('rankup'); }, 5000);
  }
  /** The last rank-up card shown (or null) — for the headless QA gate. */
  function rankUpCard() { return lastRankUp; }

  // ---- Endgame legend overlay (#46) -----------------------------------------
  // The payoff beat: a near-full-screen proclamation crowning the player THE Terror /
  // THE Governor — believable grandeur with a wink of comedy. Fired once per newly-earned
  // crown; the sandbox keeps playing beneath it. Dismiss with any key (or it fades on its
  // own). A persistent corner badge then remembers the crown.
  let legendTimer = null;
  let legendShownAt = 0;
  function hideLegend() {
    if (!$legend) return;
    $legend.classList.remove('show');
    if (legendTimer) { clearTimeout(legendTimer); legendTimer = null; }
  }
  // The shared crown overlay: a near-full-screen proclamation, reused by the pole legends (#46)
  // and the named home-isle governorship (#119). `beat` carries the title + flavour; `kicker` is
  // the small heading above it ("A LEGEND IS MADE" / "A GOVERNOR IS NAMED").
  function showCrown(beat, stats = {}, kicker = 'A LEGEND IS MADE') {
    if (!$legend || !beat) return;
    const crown = `${beat.icon} You are now THE ${beat.title.toUpperCase()}`;
    const both = stats.both
      ? '<div class="legend-both">⚔⚖ Feared AND respected — a true Legend of the Tidewake. The bards have simply given up keeping score.</div>'
      : '';
    $legend.innerHTML =
      `<div class="legend-card">`
      + `<div class="legend-kicker">${kicker}</div>`
      + `<div class="legend-title">${crown}</div>`
      + `<div class="legend-proclaim">${beat.proclaim}</div>`
      + `<div class="legend-flourish">${beat.flourish}</div>`
      + both
      + `<div class="legend-stats">⚔ Infamy ${stats.infamy ?? 0} · ⚖ Standing ${stats.standing ?? 0} · ★ Renown ${stats.renown ?? 0} · ⛃ ${stats.coins ?? 0}c · ${stats.title || beat.title}</div>`
      + `<div class="legend-help">The sea is still yours — press <b>any key</b> to sail on, or <b>N</b> for a new voyage</div>`
      + `</div>`;
    $legend.classList.add('show');
    legendShownAt = Date.now();
    // Safety net only: the overlay persists until the player acts (key / click). The long
    // auto-timer just guarantees it can never get permanently stuck if input is lost.
    if (legendTimer) clearTimeout(legendTimer);
    legendTimer = setTimeout(hideLegend, 12000);
  }
  function showLegend(pole, stats = {}) {
    showCrown(legendBeat(pole), stats, 'A LEGEND IS MADE');
  }
  // The home-isle governorship crown (#119) — the named mirror of showLegend, driven by the
  // captain's claimed home harbour.
  function showGovernorship(harbour, stats = {}) {
    const beat = governorshipBeat(harbour);
    showCrown(beat, stats, beat ? beat.kicker : 'A GOVERNOR IS NAMED');
  }
  // Dismiss on the player's next deliberate input — a fresh keydown or a click/tap.
  // We ignore OS key-repeat (e.repeat) so a *held* throttle key (W/A/S/D, often down the
  // instant the crown is earned) doesn't blow the proclamation away before it's read, and
  // a short grace window absorbs the very keystroke that crossed the threshold.
  function dismissLegend(e) {
    if (!$legend || !$legend.classList.contains('show')) return;
    if (e && e.type === 'keydown' && e.repeat) return;
    if (Date.now() - legendShownAt < 350) return;
    hideLegend();
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', dismissLegend);
    window.addEventListener('pointerdown', dismissLegend);
  }

  // Persistent corner badge: once a crown is earned it stays shown in the HUD.
  let lastBadgeSig = '';
  function renderLegendBadge(state) {
    if (!$legendBadge) return;
    const lg = state.legends || {};
    const earned = [];
    if (lg.pirate) earned.push(legendBeat('pirate'));
    if (lg.governor) earned.push(legendBeat('governor'));
    // The named home-isle governorship (#119) earns its own badge segment alongside the pole legends.
    const govBeat = state.governorship ? governorshipBeat(state.harbour) : null;
    const sig = earned.map((e) => e.title).join('+') + (govBeat ? `|gov:${govBeat.title}` : '');
    if (sig === lastBadgeSig) return;
    lastBadgeSig = sig;
    const labels = [];
    if (earned.length === 2) labels.push('★ Legend of the Tidewake');
    else if (earned.length === 1) labels.push(`${earned[0].icon} Legend: ${earned[0].title}`);
    if (govBeat) labels.push(`${govBeat.icon} ${govBeat.title}`);
    if (!labels.length) { $legendBadge.classList.remove('show'); $legendBadge.textContent = ''; return; }
    $legendBadge.textContent = labels.join('  ·  ');
    $legendBadge.classList.add('show');
  }

  function update(state, maxSpeed) {
    liveState = state;
    renderPurse(state);
    renderLegendBadge(state);
    renderTrade(state);

    let deg = Math.round((state.heading * 180 / Math.PI) % 360); if (deg < 0) deg += 360;
    $heading.textContent = deg;
    $speed.textContent = (state.speed / maxSpeed * 18).toFixed(1);

    // Ship-relative wind compass + point-of-sail label — owned by its own component (#53).
    compass.update(state);
  }

  return { update, showArrival, setWind, renderColours, renderDuel, renderCannons, renderBattle, renderRaidPhases, renderKeyPrompts, renderEncounter, flashBanner, showDefeat, defeatCard, showRankUp, rankUpCard, showLegend, showGovernorship, showGoal, hideGoal };
}
