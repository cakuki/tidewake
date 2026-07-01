// Per-phase raid tracker — a compact HUD strip that makes the Three-Act Raid legible (#135,
// Option-4 polish). The battle system is mechanically rich — Maneuver/broadside → Board/brawl →
// verbal Duel, with hull→boarding and casualties→confidence couplings — but the depth was opaque.
// This names WHICH ACT you're in and surfaces the coupling state you EARNED, read-only.
//
// A self-contained, self-tested HUD component (#53 house standard, see src/ui/README.md): a PURE
// model (`raidPhaseModel`, unit-tested without a browser) plus a thin `createRaidPhases(root)`
// factory that owns #raid-phases and exposes `update(battle, duel)`. It INVENTS NO MECHANICS — it
// only reads flags already on the battle + duel snapshots (canBoard/boarded/boardEdge/
// surrenderPending + the duel's boarded/confidenceDent). Save stays v16; adds ~0 draws (DOM only).
//
// CREATIVE SPARK (Game Designer): a raid should FEEL like a three-beat story — you can see the arc
// you're climbing (⚔ Maneuver › 🪝 Boarding › 🗣 Duel), the acts you've already won lit gold-green
// behind you, and the edge your gunnery bought the coming brawl called out by name. The depth was
// always there; this just lets the player READ the fight they earned.

// The three acts of the raid, in order, with their glyph + label. The single source of truth the
// pure model and the DOM strip both read.
export const RAID_ACTS = [
  { key: 'maneuver', icon: '⚔', label: 'Maneuver' },
  { key: 'boarding', icon: '🪝', label: 'Boarding' },
  { key: 'duel',     icon: '🗣', label: 'Duel' },
];

/**
 * The boarding advantage the battering earned, as a whole percent. PURE. The battle snapshot's
 * `boardEdge` is a 0..MAX_BOARDING_EDGE fraction (how far past the boarding line you pounded her
 * hull); this rounds it for display and never goes negative on junk input.
 * @param {number} edge
 * @returns {number}
 */
export function boardAdvantagePct(edge) {
  const e = Number.isFinite(edge) ? edge : 0;
  return Math.max(0, Math.round(e * 100));
}

// The coupling line for the current act — the state the player EARNED, surfaced by name. Read-only:
// each branch reads a flag already computed on the snapshots; none of it changes the fight.
function couplingFor(actKey, b, d) {
  if (actKey === 'maneuver') {
    // A broken foe has struck her colours mid-maneuver — the reactive short-circuit (accept the
    // quick prize or press the attack). The one maneuver-phase beat worth calling out.
    if (b.surrenderPending) return { text: '🏳 She strikes her colours — accept or press on', tone: 'surrender' };
    return null; // early maneuvering: nothing earned yet, keep the strip clean
  }
  if (actKey === 'boarding') {
    // Act 1 → Act 2 coupling: a hull battered past the boarding line boards like a wreck.
    const pct = boardAdvantagePct(b.boardEdge);
    if (pct > 0) return { text: `Hull battered → boarding advantage +${pct}%`, tone: 'good' };
    return { text: 'Grapple her — send the crew over the rail', tone: 'neutral' };
  }
  // Act 2 → Act 3 coupling: a boarding that cost you crew leaves YOUR captain shaken at the open.
  const dent = Math.max(0, Math.round(d.confidenceDent || 0));
  if (dent > 0) return { text: `Bloodied boarding → shaken footing −${dent}`, tone: 'warn' };
  return { text: 'Clean boarding → steady footing', tone: 'good' };
}

/**
 * PURE — the per-phase raid model from the battle + duel snapshots, or `null` when there is no raid
 * to show (at sea, or a plain hailed duel that was never a boarding). Names the current act, marks
 * the acts done/active/to-come, and picks the earned-coupling line. Reads flags only; mutates nothing.
 * @param {object|null} battle  the battle snapshot (createBattle().snapshot())
 * @param {object|null} duel    the duel snapshot (createDuel().snapshot())
 * @returns {{actKey:string, actIndex:number, acts:Array<{key,icon,label,state}>, coupling:{text,tone}|null}|null}
 */
export function raidPhaseModel(battle, duel) {
  const b = battle || {};
  const d = duel || {};
  // The Duel act only counts as a RAID act when it was reached by BOARDING (d.boarded) — a plain
  // hailed insult-duel is its own thing and shows no raid strip.
  const inDuelAct = !!(d.active && d.boarded);
  const inBattle = !!b.active;
  if (!inDuelAct && !inBattle) return null;

  let index;
  if (inDuelAct) index = 2;                              // Act 3 — the captain's verbal duel
  else if (b.canBoard || b.boarded) index = 1;          // Act 2 — grappled + boardable
  else index = 0;                                        // Act 1 — the maneuvering broadside

  const acts = RAID_ACTS.map((a, i) => ({
    ...a,
    state: i < index ? 'done' : i === index ? 'active' : 'todo',
  }));
  const actKey = RAID_ACTS[index].key;
  return { actKey, actIndex: index, acts, coupling: couplingFor(actKey, b, d) };
}

/**
 * Build the live per-phase raid strip. Finds #raid-phases within `root` (defaults to the whole
 * document) and exposes `update(battle, duel)` called each frame. Headless-safe: no-ops if its
 * element is absent (so tests/tests-runner and the QA gate never touch a missing node). Cheap:
 * caches a signature so the hot path only repaints on a real act/coupling change.
 * @param {Document|HTMLElement} [root]
 * @returns {{ update(battle:object, duel:object):void }}
 */
export function createRaidPhases(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return { update() {} };
  const $el = root.querySelector && root.querySelector('#raid-phases');
  if (!$el) return { update() {} };

  let lastSig = '';
  function update(battle, duel) {
    const model = raidPhaseModel(battle, duel);
    if (!model) {
      if ($el.classList.contains('show')) { $el.classList.remove('show'); lastSig = ''; }
      return;
    }
    const c = model.coupling;
    const sig = model.actKey + '|' + (c ? c.tone + '·' + c.text : '');
    if (sig === lastSig && $el.classList.contains('show')) return;
    lastSig = sig;

    const chips = model.acts
      .map((a, i) => `${i > 0 ? '<span class="rp-sep">›</span>' : ''}<span class="rp-act ${a.state}">${a.icon} ${a.label}</span>`)
      .join('');
    const couple = c
      ? `<div class="rp-couple ${c.tone}">${c.text}</div>`
      : '<div class="rp-couple none"></div>';
    $el.innerHTML = `<div class="rp-acts">${chips}</div>${couple}`;
    $el.classList.add('show');
  }

  return { update };
}
