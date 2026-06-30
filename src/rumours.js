// Rumours — the tavern "listen for word" core (#103). PURE, DOM-free and three.js-free, so the
// whole rumour-composition can be unit-tested under `node --test`. The owner wanted ashore to be
// a DESTINATION, not a vending machine: a town is a menu until it has a *function you return for*.
// So the tavern gets a verb — *listen for word* — and what you hear is composed DETERMINISTICALLY
// from real game state: the ports around you, who you've become (Infamy↔Standing, your tier), and
// the deeds already on your voyage log. Same world → same word (vital for the save-free QA hook
// and the tests); re-listening (a rising `nonce`) turns the conversation over so a long stay hears
// the quayside change its tune.
//
// CREATIVE SPARK (Game Designer): a hunched regular in the corner who "heard a thing" — a rumour
// that points the bow somewhere worth going. Every line names a real target (a thirsty port, a
// raised isle, a foe whose tale outran you), so it reads as a SOFT sea objective you may choose to
// chase with the verbs you already have — no quest log, just a nudge. Voice is the Ballad's (#78):
// warm, in-character, a wink of comedy, original to Tidewake.
//
// FOLLOW-UPS (filed, not built here): a map MARKER for the rumour's target heading, and economy/
// bounty hooks that make a chased rumour pay off mechanically. This slice ships the *word* only.

import { PORTS, PORT_NAMES, resolveGood } from './economy.js';
import { dominantPole, renownTier } from './renown.js';

function num(n) { return Number.isFinite(n) && n > 0 ? n : 0; }
function goodName(id) { const g = resolveGood(id); return g ? g.name : String(id || 'cargo'); }
function clampInt(v, dflt, lo, hi) {
  const n = Number.isFinite(v) ? Math.trunc(v) : dflt;
  return Math.max(lo, Math.min(hi, n));
}

// ---- The rumour pools, by kind. Each is built from live world-state; the composer then picks a
// few across kinds for variety. Every line is authored to name a real, chase-able target. -------

// Reputation rumours: who you've become changes what the room says about you. Diverges by tier
// (unknown / known / renowned) and, at the top, by dominant pole (feared pirate vs respected
// governor). Always returns at least one line so a captain is never met with silence.
function repPool(pole, tier) {
  if (tier.key === 'renowned') {
    if (pole === 'pirate') return [
      'Hush falls as you cross the room — "that\'s the one the navy posted coin for." Best keep your false colours pressed and ready.',
      'A regular crosses himself and counts his spoons twice. Word of your black flag carries faster than any wind.',
      'The shutters down the lane go quiet as you pass. Feared has its comforts, captain, and its bounties.',
    ];
    if (pole === 'governor') return [
      'The council\'s been singing your praises over the good grog — there\'s clean, well-paid work for a name they trust.',
      'A merchant lifts his cup to you unbidden: "honest standing on these waters, and rare as a calm Tuesday."',
      'Folk here speak of you almost fondly — a captain the harbourmaster would lend his own boat.',
    ];
    return [
      'Both the magistrates and the cutthroats claim you for nearly their own, captain. You\'ve left the whole room guessing.',
      'A legend with no settled side: half the tavern toasts you, the other half eyes the door. Splendidly undecided.',
    ];
  }
  if (tier.key === 'known') {
    if (pole === 'pirate') return [
      'Two old salts mutter that a captain of your growing infamy was seen hereabouts. The honest folk count their spoons.',
      'Your name\'s started travelling with a hard edge on it — the kind that empties a doorway when you fill it.',
    ];
    if (pole === 'governor') return [
      'Word is a trader of fair standing has been working these waters; the harbourmaster says your name almost fondly.',
      'A clerk in the corner notes you down approvingly. Respectable money knows respectable money.',
    ];
    return [
      'Your name\'s started to travel, captain — though nobody here can yet agree whether to toast it or bolt the door.',
      'They half-know your face now. Lean one way or the other and they\'ll know the rest soon enough.',
    ];
  }
  // unknown
  return [
    'Nobody in here knows your name, captain — a clean slate, that. Go carve it into something worth whispering.',
    'A regular squints at you over his mug: "fresh face. The sea\'ll fix that, one way or t\'other."',
  ];
}

// Trade rumours: every other port becomes a soft heading — what it craves (sell dear) and what it
// makes cheap (buy low). Each line names the port AND carries a TYPED target (#115), so chasing it
// becomes a real objective (a map marker + an arrival payoff) rather than a re-parse of the prose.
function tradePool(port) {
  const out = [];
  for (const p of PORT_NAMES) {
    if (p === port || !PORTS[p]) continue;
    const info = PORTS[p];
    const target = { kind: 'port', name: p };
    if (info.craving) out.push({ text: `A skipper in from ${p} swears the place would trade its boots for ${goodName(info.craving)} — run a hold over and name your price.`, target });
    if (info.speciality) out.push({ text: `They say ${p} is fair drowning in ${goodName(info.speciality)}, cheap as bilgewater. Buy low there and sell it dear on a thirstier shore.`, target });
  }
  return out;
}

// Vessel-disposition rumours: what's afoot on the water, flavoured by your lean — a pirate hears
// of fat prizes; a respectable captain hears of patrols; the undecided, an unread sail.
function seaPool(pole, port) {
  const elsewhere = PORT_NAMES.find((p) => p !== port && PORTS[p]) || 'the headland';
  if (pole === 'pirate') return [
    `A fat merchantman's been running the lanes off ${elsewhere} unescorted, holds low in the water. Easy pickings for a bold captain.`,
    'A drunk swears a treasure-heavy hull limped past at dawn, barely answering her helm. Make of that what you will.',
  ];
  if (pole === 'governor') return [
    `Naval cutters have been thick off ${elsewhere} of late, hunting anything flying the black. Honest sails have nothing to fear.`,
    'The harbourmaster\'s offering fair coin for word of pirates on the lanes — a tidy errand for a lawful captain.',
  ];
  return [
    `Out past ${elsewhere} a lone sail's been spotted, her flag too far to read. Could be cargo, could be a fight — only one way to learn.`,
  ];
}

// Deed rumours: your own voyage echoing back to you. Pulls the most recent fight + landfall from
// the live voyage log, so the room remembers what you've actually done.
function deedPool(deeds) {
  const out = [];
  const list = Array.isArray(deeds) ? deeds : [];
  let fight = null, land = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (!e) continue;
    if (!fight && (e.type === 'duel' || e.type === 'cannon') && e.foe) fight = e;
    if (!land && e.type === 'landfall' && e.name) land = e;
    if (fight && land) break;
  }
  if (fight) out.push(`Word of your run-in with ${fight.foe} has carried even to this tavern — some folk buy you a drink for it, some buy you trouble.`);
  if (land) out.push(`A sot in the corner swears there's another uncharted rock out past ${land.name}, if a captain's bold enough to go looking.`);
  return out;
}

// Wrap a bare prose line as a typed rumour entry with no chase-able target (rep/sea/deed kinds);
// trade entries already arrive as { text, target } from tradePool (#115).
function textOnly(text) { return { text, target: null }; }

/**
 * PURE — compose a handful of in-character rumours from live world-state + reputation. Returns an
 * array of TYPED rumour entries `{ text, target, kind }` (length up to `count`, at least 1 while a
 * real port is docked; [] at sea). `target` is `{ kind:'port', name }` for a chase-able trade tip
 * (#111/#112/#115) or `null` for flavour-only word; `kind` is the rumour's pool — `rep` | `trade` |
 * `sea` | `deed` — driving the LISTEN cue colour (#116). Deterministic in (world, opts): the same
 * inputs always yield the same word. `nonce` turns the conversation over for a "listen again"
 * without breaking determinism.
 *
 * @param {object} world
 * @param {string} world.port      the docked port name (must be a real port, else [])
 * @param {number} [world.infamy]  pirate-pole score
 * @param {number} [world.standing] governor-pole score
 * @param {number} [world.renown]  total renown (defaults to infamy + standing)
 * @param {Array<object>} [world.deeds]  the voyage log (sanitised events from voyage-log.js)
 * @param {object} [opts]
 * @param {number} [opts.count=2]  how many rumours to surface (clamped 1..4)
 * @param {number} [opts.nonce=0]  re-listen counter — rotates the selection for fresh word
 * @returns {Array<{text:string, target:({kind:string,name:string}|null)}>}
 */
export function composeRumours(world = {}, opts = {}) {
  const w = world || {};
  const port = w.port;
  if (!port || !PORTS[port]) return [];

  const count = clampInt(opts.count, 2, 1, 4);
  const nonce = Number.isFinite(opts.nonce) ? Math.abs(Math.trunc(opts.nonce)) : 0;

  const infamy = num(w.infamy), standing = num(w.standing);
  const renown = Number.isFinite(w.renown) ? w.renown : infamy + standing;
  const pole = dominantPole(infamy, standing);
  const tier = renownTier(renown);

  const pools = {
    rep: repPool(pole, tier).map(textOnly),
    trade: tradePool(port),                 // already { text, target } entries (#115)
    sea: seaPool(pole, port).map(textOnly),
    deed: deedPool(w.deeds).map(textOnly),
  };
  // Kind priority — rep + trade lead so a 2-rumour listen always pairs "who you are" with a
  // "where to sail". The rotation (by nonce) keeps re-listening fresh.
  const kinds = ['rep', 'trade', 'sea', 'deed'].filter((k) => pools[k] && pools[k].length);
  if (!kinds.length) return [];

  const out = [];
  const seen = new Set();
  const usedPerKind = {};
  const start = nonce % kinds.length;
  const maxGuard = count * kinds.length + kinds.length;
  for (let guard = 0; out.length < count && guard < maxGuard; guard++) {
    const k = kinds[(start + guard) % kinds.length];
    const pool = pools[k];
    const used = usedPerKind[k] || 0;
    if (used >= pool.length) continue;
    usedPerKind[k] = used + 1;
    const entry = pool[(nonce + used) % pool.length];
    // Tag the surfaced entry with its KIND (rep/trade/sea/deed) so the LISTEN cue can take a colour
    // from what the room actually leaked you (#116 follow-up). Additive to { text, target }.
    if (entry && entry.text && !seen.has(entry.text)) { seen.add(entry.text); out.push({ ...entry, kind: k }); }
  }
  return out;
}
