// Economy — the coin-and-cargo trade core that finally makes "arrive at a port" pay.
//
// Everything here is PURE, DOM-free and three.js-free so the whole economy can be
// unit-tested under `node --test`. The renderer (ports.js/hud.js) leans on these
// functions for prices and trades, mutating a shared `state` object's two new
// additive fields — `state.coins` (a number) and `state.cargo` (a {goodId: qty} map).
//
// The fantasy: buy a good cheap where it's plentiful, sail it to a port that's
// gasping for it, and watch your purse climb. Realism in the prices; comedy in the
// people who quote them. All names + banter original to Tidewake.

// ---- Goods: a small, readable hold of five trade goods. Order = number-key order. ----
export const GOODS = [
  { id: 'rum',       name: 'Rum',       base: 20, icon: '🍺' },
  { id: 'spice',     name: 'Spice',     base: 35, icon: '🌶️' },
  { id: 'silk',      name: 'Silk',      base: 50, icon: '🧵' },
  { id: 'salt-cod',  name: 'Salt-cod',  base: 12, icon: '🐟' },
  { id: 'gunpowder', name: 'Gunpowder', base: 40, icon: '🛢️' },
];

const GOOD_BY_ID = Object.fromEntries(GOODS.map((g) => [g.id, g]));

// Hold capacity (total units across all goods) and starting purse. Tuned so a first
// profitable round-trip is discoverable in well under two minutes.
export const HOLD_CAP = 12;
export const START_COINS = 100;

// The harbour's cut: you always sell a touch under the local buy price, so you can
// never churn a profit standing still — the profit lives in the *voyage between* ports.
export const SELL_SPREAD = 0.9;

// ---- Per-port markets: personality, a speciality (cheap to buy) and a craving
// (dear to sell into). Multipliers scale each good's base price at that port. A low
// number = "they make it here, buy cheap"; a high number = "they're desperate, sell high".
export const PORTS = {
  'Saltpurse Quay': {
    blurb: 'A buttoned-up customs town that taxes the seagulls.',
    speciality: 'salt-cod', craving: 'silk',
    harbourmaster: 'Welcome to Saltpurse Quay. Everything is for sale, including the welcome.',
    cryers: [
      '"Fresh salt-cod, barely arguing with the brine!"',
      '"Silk! Our magistrates wear it to nap in!"',
    ],
    mult: { rum: 1.10, spice: 1.05, silk: 1.40, 'salt-cod': 0.70, gunpowder: 1.00 },
  },
  'Barnacle Bottom': {
    blurb: 'A cheerful, grimy port that distils rum and few opinions.',
    speciality: 'rum', craving: 'spice',
    harbourmaster: "Barnacle Bottom! Mind the floor, it's mostly spilled rum and ambition.",
    cryers: [
      '"Rum by the barrel — we make more than we can drink, and we try hard!"',
      '"Spice! For pity\'s sake, our stew tastes of fog."',
    ],
    mult: { rum: 0.70, spice: 1.35, silk: 0.95, 'salt-cod': 1.10, gunpowder: 1.30 },
  },
  "Gullet's Rest": {
    blurb: "A foggy waystation where thirsty crews wash ashore and pay anything.",
    speciality: 'spice', craving: 'rum',
    harbourmaster: "Gullet's Rest, traveller. We've spice to spare and a powerful thirst.",
    cryers: [
      '"Spice cheap! We grow it in the window boxes!"',
      '"RUM! Name your price, then double it, you angel."',
    ],
    mult: { rum: 1.40, spice: 0.70, silk: 1.00, 'salt-cod': 1.35, gunpowder: 0.85 },
  },
};

export const PORT_NAMES = Object.keys(PORTS);

function requirePort(portName) {
  const p = PORTS[portName];
  if (!p) throw new Error(`unknown port: ${portName}`);
  return p;
}
function requireGood(goodId) {
  const g = GOOD_BY_ID[goodId];
  if (!g) throw new Error(`unknown good: ${goodId}`);
  return g;
}

/**
 * The buy/sell price of one good at one port. Buy is what you pay; sell is what the
 * harbour pays you (always a touch lower, the spread). Integer coins, no fractions.
 * @param {string} portName
 * @param {string} goodId
 * @returns {{ buy: number, sell: number }}
 */
export function priceAt(portName, goodId) {
  const port = requirePort(portName);
  const good = requireGood(goodId);
  const m = port.mult[goodId] ?? 1;
  const buy = Math.max(1, Math.round(good.base * m));
  const sell = Math.max(1, Math.round(buy * SELL_SPREAD));
  return { buy, sell };
}

/**
 * The full price board for a port — one row per good, ready for the HUD panel.
 * @param {string} portName
 * @returns {Array<{ id:string, name:string, icon:string, buy:number, sell:number }>}
 */
export function market(portName) {
  requirePort(portName);
  return GOODS.map((g) => {
    const { buy, sell } = priceAt(portName, g.id);
    return { id: g.id, name: g.name, icon: g.icon, buy, sell };
  });
}

/** Total units currently in the hold (across all goods). */
export function cargoUsed(cargo) {
  let n = 0;
  if (cargo) for (const k of Object.keys(cargo)) n += cargo[k] || 0;
  return n;
}

/**
 * Ensure a state object carries the economy fields, without clobbering existing
 * values (so a restored voyage keeps its purse). Additive + idempotent.
 * @param {object} state
 * @returns {object} the same state
 */
export function initEconomy(state) {
  if (!state) return state;
  if (typeof state.coins !== 'number' || !Number.isFinite(state.coins)) state.coins = START_COINS;
  if (!state.cargo || typeof state.cargo !== 'object') state.cargo = {};
  return state;
}

// A trade result. `ok:false` always leaves `state` untouched and gives a `reason`.
function result(ok, state, reason) {
  return { ok, reason: reason || null, coins: state.coins, cargo: { ...state.cargo } };
}

/**
 * Buy `qty` of `goodId` at `portName` (defaults to the docked port on state.port).
 * Validates quantity, good, port, purse and hold capacity. Mutates state on success.
 * @returns {{ ok:boolean, reason:string|null, coins:number, cargo:object }}
 */
export function buy(state, goodId, qty, portName = state && state.port) {
  initEconomy(state);
  qty = Math.trunc(qty);
  if (!(qty > 0)) return result(false, state, 'bad-qty');
  if (!GOOD_BY_ID[goodId]) return result(false, state, 'unknown-good');
  if (!PORTS[portName]) return result(false, state, 'unknown-port');

  const unit = priceAt(portName, goodId).buy;
  const cost = unit * qty;
  if (cost > state.coins) return result(false, state, 'no-coins');
  if (cargoUsed(state.cargo) + qty > HOLD_CAP) return result(false, state, 'no-room');

  state.coins -= cost;
  state.cargo[goodId] = (state.cargo[goodId] || 0) + qty;
  return result(true, state);
}

/**
 * Sell `qty` of `goodId` at `portName` (defaults to the docked port on state.port).
 * Validates quantity, good, port and that you actually hold the cargo. Mutates on success.
 * @returns {{ ok:boolean, reason:string|null, coins:number, cargo:object }}
 */
export function sell(state, goodId, qty, portName = state && state.port) {
  initEconomy(state);
  qty = Math.trunc(qty);
  if (!(qty > 0)) return result(false, state, 'bad-qty');
  if (!GOOD_BY_ID[goodId]) return result(false, state, 'unknown-good');
  if (!PORTS[portName]) return result(false, state, 'unknown-port');

  const held = state.cargo[goodId] || 0;
  if (qty > held) return result(false, state, 'no-cargo');

  const unit = priceAt(portName, goodId).sell;
  state.coins += unit * qty;
  state.cargo[goodId] = held - qty;
  if (state.cargo[goodId] === 0) delete state.cargo[goodId];
  return result(true, state);
}
