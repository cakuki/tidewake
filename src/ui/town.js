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
import { composeRumours } from '../rumours.js';
import {
  isHome, canClaim, canInvest, investCost, investStanding, harbourGreeting, harbourLevelName,
  governorTitle, CLAIM_STANDING, MAX_LEVEL,
} from '../systems/home-port.js';
import {
  isActiveThreat, threatTitle, threatBlurb, canPayTribute, standFirmOdds,
} from '../systems/harbour-threat.js';
import { AMMO, AMMO_TYPES } from '../systems/ammo.js';
import { nextCannonCost, totalGuns, canBuyCannon, sanitizeExtraCannons, MAX_EXTRA_CANNONS } from '../systems/gun-upgrade.js';

export function createTown(opts = {}) {
  const getState = typeof opts.getState === 'function' ? opts.getState : () => null;
  const onLeave = typeof opts.onLeave === 'function' ? opts.onLeave : () => {};
  // Chase a rumour (#111/#112/#115): hand the chosen rumour's TYPED target up to main.js, which
  // sets the active objective (a map marker + an arrival payoff). No-op if not wired.
  const onChase = typeof opts.onChase === 'function' ? opts.onChase : () => {};
  // Listen for word (#116): a soft "cup-an-ear" diegetic cue when the room leaks you a rumour, so the
  // reactive loop's first beat is felt, not silent. Called with the surfaced rumours so main.js can
  // colour the cue by what was actually heard (trade tip vs whisper vs danger). No-op if unwired.
  const onListen = typeof opts.onListen === 'function' ? opts.onListen : () => {};
  // Your Harbour (#118): claim the docked port as your home harbour, or invest coin to grow it.
  // main.js owns applying Standing/coin + persisting; here we just route the tap. No-op if unwired.
  const onClaim = typeof opts.onClaim === 'function' ? opts.onClaim : () => {};
  const onInvest = typeof opts.onInvest === 'function' ? opts.onInvest : () => {};
  // Your Harbour, threatened (#134): resolve a threat to your home port — pay tribute (coin) or stand
  // firm (a dice beat). main.js owns applying the result (coin/Standing/the harbour) + persisting.
  const onTribute = typeof opts.onTribute === 'function' ? opts.onTribute : () => {};
  const onStandFirm = typeof opts.onStandFirm === 'function' ? opts.onStandFirm : () => {};
  // The Workshop (#135 slice 3): fit/unfit the shot you carry into a fight. main.js owns the
  // loadout (and toggling it via fitAmmo); here we route the tap and paint the board. No-op if unwired.
  const onFitAmmo = typeof opts.onFitAmmo === 'function' ? opts.onFitAmmo : () => {};
  // Buy a cannon (#170): spend coin at the workshop for a PERSISTENT extra cannon (see it on your deck,
  // hear a heavier boom, feel foes sink faster). main.js owns coin + the deck mesh + persistence; here
  // we route the tap and paint the board. No-op if unwired.
  const onBuyCannon = typeof opts.onBuyCannon === 'function' ? opts.onBuyCannon : () => {};
  const root = opts.root ?? (typeof document !== 'undefined' ? document : null);
  // Touch parity (#17/#66): taps drive trades + the Leave plank when there's no keyboard.
  const TOUCH = !!(root && root.body && root.body.classList && root.body.classList.contains('touch'));

  let open = false, built = false;
  let $panel = null;
  let flash = '', flashUntil = 0; // transient "you bought/sold" / refusal banter
  let lastSig = '';
  // The tavern verb (#103): "listen for word" surfaces a few procedural rumours composed
  // deterministically from world-state + reputation. `nonce` rises each listen so the room
  // turns its conversation over (fresh word), while the pure composer stays testable.
  let listening = false, rumourNonce = 0, rumours = [];

  // Compose fresh word from the live ship state — who you are + where the world is.
  function listen() {
    const state = getState() || {};
    if (!state.port) return [];
    rumourNonce += 1;
    rumours = composeRumours({
      port: state.port,
      infamy: state.infamy, standing: state.standing, renown: state.renown,
      deeds: state.voyageLog || [],
    }, { count: 2, nonce: rumourNonce });
    listening = true;
    try { onListen(rumours); } catch { /* the cue is a flourish, never break the listen verb (#116) */ }
    lastSig = ''; // force a repaint
    render();
    return rumours.slice();
  }

  // Chase the rumour at `idx` (#111/#112/#115): a chase-able rumour (one with a typed target)
  // becomes the active sea-objective — a map marker to steer toward + an arrival payoff. Returns
  // the chased target (or null if that rumour has none). Re-renders so the affordance updates.
  function chase(idx) {
    const r = rumours[idx];
    if (!r || !r.target) return null;
    onChase(r.target);
    lastSig = ''; // force a repaint so the "now chasing" state shows
    render();
    return r.target;
  }

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
        if (e.target.closest?.('#town-listen')) { e.preventDefault(); listen(); return; }
        if (e.target.closest?.('#town-claim')) { e.preventDefault(); onClaim(); return; }
        if (e.target.closest?.('#town-invest')) { e.preventDefault(); onInvest(); return; }
        if (e.target.closest?.('#town-tribute')) { e.preventDefault(); onTribute(); return; }
        if (e.target.closest?.('#town-standfirm')) { e.preventDefault(); onStandFirm(); return; }
        if (e.target.closest?.('#town-buy-cannon')) { e.preventDefault(); buyCannonTap(); return; }
        const shotBtn = e.target.closest?.('.town-shot');
        if (shotBtn && shotBtn.dataset.ammo) { e.preventDefault(); fitShot(shotBtn.dataset.ammo); return; }
        const chaseBtn = e.target.closest?.('.town-chase');
        if (chaseBtn) { e.preventDefault(); chase(Number(chaseBtn.dataset.idx)); return; }
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

  // The tavern corner (#103): the reactive verb ashore. Before listening, a single warm prompt;
  // after, the rumours you heard — each a soft heading you may choose to chase — plus a "listen
  // again" pull that turns the room's conversation over.
  function tavernHTML() {
    const TKEY = TOUCH ? '' : ' <span class="town-leave-key">(R)</span>';
    if (!listening) {
      return `<div class="town-tavern">`
        + `<div class="town-tavern-h">🍺 The Tavern</div>`
        + `<div class="town-tavern-sub">A hunched regular in the corner looks like he's heard a thing or two.</div>`
        + `<button id="town-listen" class="town-listen" type="button">🍺 Listen for word${TKEY}</button>`
        + `</div>`;
    }
    // A rumour with a typed target (a trade tip naming a port, #115) gets a "⚑ Chase this" pull:
    // accepting it sets the active sea-objective (marker + arrival payoff). The one already being
    // chased reads back "⚑ Chasing…" so the choice is legible. Flavour-only word has no pin.
    const activeName = (() => { const s = getState(); return (s && s.objective && s.objective.target && s.objective.target.name) || null; })();
    const lines = rumours.length
      ? rumours.map((r, i) => {
          const text = typeof r === 'string' ? r : r.text; // tolerate a legacy string entry
          const target = (r && typeof r === 'object') ? r.target : null;
          let chaseEl = '';
          if (target && target.name) {
            chaseEl = target.name === activeName
              ? `<span class="town-chasing">⚑ Chasing ${esc(target.name)}…</span>`
              : `<button class="town-chase" type="button" data-idx="${i}">⚑ Chase this</button>`;
          }
          return `<p class="town-rumour">“${esc(text)}”${chaseEl}</p>`;
        }).join('')
      : `<p class="town-rumour town-rumour-quiet">The room's gone quiet — no word worth the telling tonight.</p>`;
    return `<div class="town-tavern">`
      + `<div class="town-tavern-h">🍺 What you hear</div>`
      + `<div class="town-rumours">${lines}</div>`
      + `<button id="town-listen" class="town-listen town-listen-again" type="button">🍺 Listen again${TKEY}</button>`
      + `</div>`;
  }

  // Your Harbour (#118) — the governor pole's reactive verb, shown ashore. At your claimed home
  // port: its growth tier, a warming homecoming line, and an "invest" plank that grows it a level
  // (spend coin → Standing). At any other port: a "claim this as your home port" plank, gated on
  // Standing (a clear hint when you're not yet respected enough, or already have a home elsewhere).
  // Your Harbour, threatened (#134) — the home port's STAKE, shown ashore at home when a threat is
  // gathering. The framing blurb, then the two NON-BATTLE resolution planks: pay tribute (certain,
  // costs the demanded coin) or stand firm (a dice beat whose odds rise with how grown the port is).
  // The actual defensive battle sequences around #100 (owner-held) — this is the lightweight beat.
  function threatHTML(state) {
    const threat = state.threat;
    if (!isActiveThreat(threat)) return '';
    const coins = Number.isFinite(state.coins) ? state.coins : 0;
    const tribute = canPayTribute({ threat, coins });
    const odds = Math.round(standFirmOdds(state.harbour) * 100);
    const tributeEl = tribute.ok
      ? `<button id="town-tribute" class="town-tribute" type="button">⛃ Pay tribute — ${tribute.cost}c</button>`
      : `<div class="town-threat-need">Their price is <b>${tribute.cost}c</b> to lift it — you have ${coins}c. Stand firm, or fill your purse and return.</div>`;
    return `<div class="town-harbour-threat">`
      + `<div class="town-threat-h">${esc(threatTitle(threat))}</div>`
      + `<div class="town-threat-blurb">${esc(threatBlurb(threat))}</div>`
      + tributeEl
      + `<button id="town-standfirm" class="town-standfirm" type="button">⚔ Stand firm — roll the dice <span class="town-threat-odds">(~${odds}% to hold)</span></button>`
      + `</div>`;
  }

  // The Workshop (#135 slice 3, ties #96) — the first ASHORE activity beyond the market the owner's
  // town-mode brief left "room to grow" for. Fit the shot you carry into a fight: tap a shot to fit
  // or unfit it, and it joins the locker the battle cycle key (X) walks mid-broadside. Round can
  // never be unfitted (your crew always has a ball at the rack), so you always sail armed.
  function fitShot(id) {
    onFitAmmo(id);
    flashMsg(`Fitted shot updated at the workshop.`);
    lastSig = ''; // force a repaint so the fitted state shows
    render();
  }

  // Buy a cannon (#170): route the tap to main.js (which spends coin, bolts the gun to the deck, and
  // persists), then force a repaint so the new owned-count + cost + purse show at once.
  function buyCannonTap() {
    onBuyCannon();
    lastSig = ''; // force a repaint so the new gun count + next cost + purse update
    render();
  }

  // The cannon plank at the head of the workshop (#170) — the persistent gun upgrade. Shows the guns you
  // own, and a warm "buy a cannon" pull priced by the escalating curve: affordable → a live button; too
  // dear → the price + your purse; maxed → a proud "fully gunned" line. The FEEL/HEAR/SEE land in main.js.
  function cannonHTML(state) {
    const extra = sanitizeExtraCannons(state.extraCannons);
    const coins = Number.isFinite(state.coins) ? state.coins : 0;
    const guns = totalGuns(extra);
    const cost = nextCannonCost(extra);
    let action;
    if (cost === null) {
      action = `<div class="town-cannon-max">⚓ Fully gunned — ${guns} cannons run out along your rail. A terror on the water.</div>`;
    } else {
      const gate = canBuyCannon({ extra, coins });
      action = gate.ok
        ? `<button id="town-buy-cannon" class="town-buy-cannon" type="button">⚙ Buy a cannon — ${cost}c <span class="town-cannon-gain">(→ ${guns + 1} guns, a heavier broadside)</span></button>`
        : `<div class="town-cannon-need">A new cannon runs <b>${cost}c</b> — you have ${coins}c. Take a few more prizes and come back.</div>`;
    }
    return `<div class="town-cannon">`
      + `<div class="town-cannon-h">⚙ Gun Deck <span class="town-cannon-count">${guns} guns${extra > 0 ? ` (+${extra} bought)` : ''}</span></div>`
      + `<div class="town-cannon-sub">Buy a cannon and the gunsmith bolts it to your deck — you'll see it run out, hear a heavier broadside, and feel the next foe fold sooner. It stays with your ship.</div>`
      + action
      + `</div>`;
  }

  function workshopHTML(state) {
    const loadout = Array.isArray(state.loadout) ? state.loadout : [];
    const rows = AMMO_TYPES.map((id) => {
      const a = AMMO[id];
      const fitted = loadout.includes(id);
      const locked = id === 'round'; // round is always fitted
      const btn = locked
        ? `<span class="town-shot-fixed">Always fitted</span>`
        : `<button class="town-shot${fitted ? ' fitted' : ''}" type="button" data-ammo="${id}">${fitted ? '✓ Fitted' : '+ Fit'}</button>`;
      return `<div class="town-shot-row${fitted ? ' on' : ''}">`
        + `<div class="town-shot-name">${a.icon} ${esc(a.name)} <span class="town-shot-tag">${esc(a.tag)}</span></div>`
        + `<div class="town-shot-blurb">${esc(a.blurb)}</div>`
        + btn
        + `</div>`;
    }).join('');
    return `<div class="town-workshop">`
      + `<div class="town-workshop-h">⚒ The Gunner's Workshop</div>`
      + cannonHTML(state)
      + `<div class="town-workshop-sub">Fit the shot you'll carry to sea. In a fight, press <b>X</b> to cycle the loaded shot — round to sink her, chain to cripple her, grape to scare her colours down.</div>`
      + rows
      + `</div>`;
  }

  function harbourHTML(state) {
    const port = state.port;
    if (!port) return '';
    const harbour = state.harbour || null;
    const standing = Number.isFinite(state.standing) ? state.standing : 0;
    const coins = Number.isFinite(state.coins) ? state.coins : 0;
    const TKEY = TOUCH ? '' : '';
    if (isHome(harbour, port)) {
      const lvl = harbour.level;
      const greet = harbourGreeting(harbour, port) || '';
      const cost = investCost(harbour);
      const action = cost === null
        ? `<div class="town-harbour-max">⚓ ${esc(port)} is fully grown — a ${esc(harbourLevelName(MAX_LEVEL))}. The whole Tidewake knows it as yours.</div>`
        : (coins >= cost
            ? `<button id="town-invest" class="town-invest" type="button">⚒ Invest ${cost}c — grow your harbour <span class="town-invest-gain">(+${investStanding(harbour)} standing)</span></button>`
            : `<div class="town-harbour-need">Grow ${esc(port)} for <b>${cost}c</b> (+${investStanding(harbour)} standing) — you have ${coins}c.</div>`);
      // Governorship acknowledgement (#119): once the isle has crowned you its governor, your home
      // quay greets its governor by title every landfall — the lawful arc's NAMED endgame, made felt.
      const gov = state.governorship
        ? `<div class="town-harbour-gov">⚖ ${esc(governorTitle(harbour))} — the council rises when you enter the hall, and the harbour bell rings twice for its governor.</div>`
        : '';
      return `<div class="town-harbour town-harbour-home">`
        + `<div class="town-harbour-h">🏠 Your Harbour — ${esc(harbourLevelName(lvl))} <span class="town-harbour-lvl">lvl ${lvl}/${MAX_LEVEL}</span></div>`
        + `<div class="town-harbour-greet">${esc(greet)}</div>`
        + gov
        + threatHTML(state)
        + action
        + `</div>`;
    }
    // Not your home port: offer the claim (or explain why you can't yet).
    const gate = canClaim({ harbour, port, standing });
    let body;
    if (gate.ok) {
      body = `<div class="town-harbour-sub">A respected captain may put down roots here — make ${esc(port)} your home water.</div>`
        + `<button id="town-claim" class="town-claim" type="button">⚓ Claim ${esc(port)} as your home port${TKEY}</button>`;
    } else if (gate.reason === 'has-home') {
      body = `<div class="town-harbour-sub">Your home port is <b>${esc(harbour.name)}</b> — sail there to grow it. (One home water at a time, captain.)</div>`;
    } else if (gate.reason === 'low-standing') {
      body = `<div class="town-harbour-need">Earn the standing of a respected captain to claim a home port — reach <b>${CLAIM_STANDING}</b> standing (you have ${Math.floor(standing)}). Trade honestly and the lanes will have you.</div>`;
    } else {
      return '';
    }
    return `<div class="town-harbour"><div class="town-harbour-h">🏠 A Home Port</div>${body}</div>`;
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
    // The port remembers you (#104): on a RETURN visit, the harbourmaster's line is the
    // remembered-return greeting main.js banked for THIS port (warmer for a regular, cooler if
    // you've turned pirate since). A first visit / at-sea leaves the static harbourmaster blurb.
    const recall = (state.portRecall && state.portRecall.port === port) ? state.portRecall.line : null;
    const master = recall || info.harbourmaster || 'The harbourmaster nods you ashore.';
    // Cheap cache: only touch the DOM when something the player can see changes.
    const chasing = (state.objective && state.objective.target && state.objective.target.name) || '';
    const sig = port + '|' + state.coins + '|' + JSON.stringify(state.cargo) + '|' + tier.tier + '|' + pole + '|' + flash + '|' + cry + '|' + listening + '|' + rumourNonce + '|' + master + '|' + chasing + '|' + JSON.stringify(state.harbour ?? null) + '|' + (state.standing ?? 0) + '|' + (state.governorship ? 1 : 0) + '|' + JSON.stringify(state.threat ?? null) + '|' + JSON.stringify(state.loadout ?? null) + '|' + (state.extraCannons ?? 0);
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
    // #146 (owner, 2026-06-30): the port view was a flat stack with a fixed max-height and no
    // scroll region, so on small/mobile viewports the quayside content (harbour + threat + tavern +
    // full market) spilled past the panel box and the "Set Sail" plank slid off-screen — unreachable.
    // Fix: the scrollable BODY (.town-scroll) holds everything that can grow, while the "Set Sail"
    // plank + help line stay a PINNED footer outside it, so the one way back to the helm is always
    // on screen no matter how tall the port gets. The richer low-scroll redesign is the #N follow-up.
    $panel.innerHTML =
      `<div class="town-scroll">`
      + `<div class="town-h">🏘 ${esc(port)}</div>`
      + `<div class="town-sub">${esc(info.blurb || 'A port town, alive with trade.')}</div>`
      + `<div class="town-master${recall ? ' town-master-recall' : ''}">${esc(master)}</div>`
      + `<div class="town-barker">${esc(cry)}</div>`
      + tavernHTML()
      + `<div class="town-purse">⛃ <b>${state.coins ?? 0}</b> coins · Hold <b>${used}/${HOLD_CAP}</b>${standingNote}</div>`
      + harbourHTML(state)
      + `<div class="town-market-h">⚖ The Market</div>`
      + `<table class="town-t"><thead><tr><th></th><th>good</th><th>buy</th><th>sell</th><th>hold</th></tr></thead><tbody>${rows}</tbody></table>`
      + workshopHTML(state)
      + `<div class="town-msg">${flash && Date.now() < flashUntil ? esc(flash) : '&nbsp;'}</div>`
      + `<div class="town-trade-help">${TOUCH
          ? 'Tap a row to <b>buy</b> · tap its <b>sell</b> price to sell'
          : 'Press <b>1–5</b> to buy · <b>Shift+1–5</b> to sell'}</div>`
      + `</div>`
      + `<button id="town-leave" class="town-leave" type="button">⚓ Set Sail &nbsp;<span class="town-leave-key">(L)</span></button>`
      + `<div class="town-help">Listen for word in the tavern, trade your hold, then set sail when you're ready.</div>`;
  }

  function setOpen(v) {
    const next = !!v;
    if (next === open) { if (open) render(); return; } // keep the live barker/market fresh
    open = next;
    if (!open) { listening = false; rumours = []; } // a fresh visit listens anew
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
        else if (k === 'r') { e.preventDefault?.(); listen(); } // listen for word (#103)
      });
    } catch { /* headless without a window — fine */ }
    return api;
  }

  const api = {
    init, render, setOpen, listen, chase,
    get isOpen() { return open; },
    get port() { const s = getState(); return (s && s.port) || null; },
    // Your Harbour (#118): whether the docked port is the captain's claimed home (for QA/parity).
    get atHome() { const s = getState() || {}; return isHome(s.harbour, s.port); },
    // Your Harbour, threatened (#134): whether the home port currently shows an active threat panel.
    get threatened() { const s = getState() || {}; return isHome(s.harbour, s.port) && isActiveThreat(s.threat); },
    // Tavern "listen for word" (#103) QA surface: whether word is showing + the live rumours
    // (text only, the #103 contract). Typed entries (#115) are exposed via `rumourTargets`.
    get listening() { return listening; },
    get rumours() { return rumours.map((r) => (typeof r === 'string' ? r : r.text)); },
    // Chase-able targets (#111/#112/#115): the typed target per rumour (null for flavour-only).
    get rumourTargets() { return rumours.map((r) => ((r && typeof r === 'object') ? r.target : null)); },
  };
  return api;
}

// Minimal HTML-escape — port/good names are authored, but stay safe by habit.
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}
