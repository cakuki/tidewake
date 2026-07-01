// Contextual just-in-time key-prompts (#153) — the onboarding for the deep battle system (#135).
// Combat shipped rich (E give battle · SPACE fire · X cycle shot · F board · 1 accept / 2 press) but
// with NO onboarding: a new captain met a wall of un-signified keys. This teaches each battle verb at
// the MOMENT it becomes possible, then falls silent once the verb has been USED — so a newcomer learns
// the fight by playing it and a veteran is never nagged.
//
// A self-contained, self-tested HUD component (#53 house standard): a PURE core (`activePrompts` picks
// which hint(s) the current state warrants; `learnFromTransition` derives what the player has used from
// two snapshots) plus a thin `createKeyPrompts(root)` factory that owns #key-prompts and exposes
// `update(battle, duel)`. It INVENTS NO MECHANICS — it only reads flags already on the battle + duel
// snapshots (active/canBoard/surrenderPending/boarded/loaded/loadout). Save stays v16; adds ~0 draws
// (DOM only). All key glyphs/verbs come from the single keymap source-of-truth (src/keymap.js) so the
// labels can never drift from the #battle panel's own inline help.
//
// CREATIVE SPARK (Game Designer): the sea should teach you to fight by fighting. The hint you need
// glows in the instant the deed becomes possible — "bring her abeam and FIRE", "she's beaten — BOARD",
// "she strikes her colours — 1 take the prize, 2 no quarter" — and quietly bows out the moment your
// hands have learned it. The tutorial IS the battle; it just whispers the next verb, once.
import { KEYS } from '../keymap.js';
import { battleEarcon } from '../systems/loop-cues.js';

/**
 * PURE — the contextual key-prompt(s) the current state warrants, as an ordered, learned-filtered list.
 * Teaches only the IN-BATTLE arc: the at-sea entry verb (E) is owned by the standing #challenge-prompt.
 * Priority is the reactive one — a struck foe's accept/press decision short-circuits everything, then
 * the board finisher, then the maneuvering broadside. A boarded verbal duel shows nothing (the duel
 * panel owns its own 1–4 jabs). Reads flags only; mutates nothing.
 * @param {object|null} battle  the battle snapshot (createBattle().snapshot())
 * @param {object|null} duel    the duel snapshot (createDuel().snapshot())
 * @param {Set<string>} [learned]  verb ids the player has already used (fade-once-learned)
 * @returns {Array<{id:string, glyph:string, verb:string, tone:string}>}
 */
export function activePrompts(battle, duel, learned = new Set()) {
  const b = battle || {};
  const d = duel || {};
  const out = [];
  const add = (id, tone) => { if (KEYS[id] && !learned.has(id)) out.push({ id, glyph: KEYS[id].glyph, verb: KEYS[id].verb, tone }); };

  // A boarded captain's verbal duel is its own teachable surface — stay silent here.
  if (d.active && d.boarded) return out;
  if (!b.active) return out; // the at-sea entry (E) is taught by the persistent #challenge-prompt

  // Reactive short-circuit: she's struck her colours — the accept/press decision claims the moment.
  if (b.surrenderPending) { add('accept', 'surrender'); add('press', 'surrender'); return out; }
  // She's beaten to the boarding window — the finisher.
  if (b.canBoard) { add('board', 'board'); return out; }
  // The maneuvering broadside — bring her abeam and fire; teach the shot-cycle only when it's meaningful.
  if (!b.boarded) {
    add('fire', 'fire');
    if (Array.isArray(b.loadout) && b.loadout.length > 1) add('cycle', 'fire');
  }
  return out;
}

/**
 * PURE — the set of core keymap verbs (src/keymap.js) currently SIGNIFIED to a FRESH captain: taught,
 * at this exact game-state, by an on-screen teacher and/or its #154 earcon. Three teachers, one model:
 *   • the persistent #challenge-prompt — the at-sea entry verb E (`engage`), lit when a ship is hailable;
 *   • the standing #battle panel help — E to break off (`flee`), shown the whole time a fight is live;
 *   • the contextual just-in-time #key-prompts strip — the in-battle arc (fire/cycle/board/accept/press),
 *     which arms the availability EARCON (#154) on the very same illegal→legal edge.
 * Computed with an EMPTY learned-set, so it answers the cold-start question the FTUE gate (#156) asks:
 * "the instant this verb becomes legal, is it signified?" Read-only; invents no mechanics. Because it
 * reads the keymap through activePrompts, a verb added to KEYS that no teacher signifies is caught by
 * the gate (its id never appears here) rather than silently shipping un-taught — the #135/#153 defect.
 * @param {object|null} battle  the battle snapshot (createBattle().snapshot())
 * @param {object|null} duel    the duel snapshot (createDuel().snapshot())
 * @returns {Set<string>} keymap verb ids currently signified
 */
export function signifiedVerbs(battle, duel) {
  const b = battle || {};
  const d = duel || {};
  const out = new Set();
  // A boarded verbal duel owns its own 1–4 jabs — no keymap verb is signified underneath it.
  if (d.active && d.boarded) return out;
  // At-sea entry: a hailable ship lights the standing #challenge-prompt → E give battle.
  if (!b.active && d.inRange) out.add('engage');
  // A live fight: the #battle panel's standing help always teaches E to break off.
  if (b.active) out.add('flee');
  // The in-battle arc: the contextual strip (fresh captain → nothing learned) + its earcon edge.
  for (const p of activePrompts(b, d, new Set())) out.add(p.id);
  return out;
}

/**
 * PURE — the verb ids the player has USED, derived from two successive battle snapshots. An action is
 * "learned" the instant we observe its effect: a spent load (a fired volley), a swapped shot, the crew
 * gone over the rail, an answered surrender. Returns a NEW set (never mutates its input) so the caller
 * can hold it frame-to-frame. Tolerant of a null/first-frame `prev`.
 * @param {object|null} prev   the previous frame's battle snapshot
 * @param {object|null} cur    this frame's battle snapshot
 * @param {Set<string>} learned  the verbs learned so far
 * @returns {Set<string>}
 */
export function learnFromTransition(prev, cur, learned = new Set()) {
  const next = new Set(learned);
  const p = prev || {};
  const c = cur || {};
  if (!c.active) return next; // only in-battle transitions teach a battle verb
  // Fired a volley: the load was spent (loaded true→false) or a round ticked over.
  if ((p.loaded && !c.loaded) || (p.round != null && c.round != null && c.round > p.round)) next.add('fire');
  // Cycled the loaded shot mid-fight: the ammo id changed.
  if (p.ammo != null && c.ammo != null && c.ammo !== p.ammo) next.add('cycle');
  // Sent the crew over the rail.
  if (!p.boarded && c.boarded) next.add('board');
  // Answered a surrender offer (accept OR press) — the whole decision has been met.
  if (p.surrenderPending && !c.surrenderPending) { next.add('accept'); next.add('press'); }
  return next;
}

/**
 * Build the live contextual key-prompt strip. Finds #key-prompts within `root` (defaults to the whole
 * document) and exposes `update(battle, duel)` called each frame. Headless-safe: no-ops if its element
 * is absent (so the unit runner + the QA gate never touch a missing node). Cheap: caches a signature so
 * the hot path only repaints on a real change, and adds ~0 draws (a DOM overlay). `learned` is
 * session-scoped — it resets on reload, which is correct: a fresh voyage re-teaches the verbs.
 * @param {Document|HTMLElement} [root]
 * @returns {{ update(battle:object, duel:object):void }}
 */
export function createKeyPrompts(root = (typeof document !== 'undefined' ? document : null)) {
  if (!root) return { update() {} };
  const $el = root.querySelector && root.querySelector('#key-prompts');
  if (!$el) return { update() {} };

  const learned = { set: new Set() };
  let prev = null;
  let lastSig = '';
  // The battle-verb availability PHASE (#154) — the top prompt's `tone`, or null when nothing's armed.
  // Tracked frame-to-frame so an EARCON rings ONCE as each verb-window opens (the audio half of the
  // visual prompt), on the SAME learn-filtered edge, and never re-nags while the window stays open.
  let prevPhase = null;

  function update(battle, duel) {
    learned.set = learnFromTransition(prev, battle, learned.set);
    // Keep only the fields the transition/model read, so we never retain a heavy snapshot.
    prev = battle
      ? { active: battle.active, loaded: battle.loaded, round: battle.round, ammo: battle.ammo, boarded: battle.boarded, surrenderPending: battle.surrenderPending }
      : null;

    const prompts = activePrompts(battle, duel, learned.set);
    // The earcon rides the SAME learn-filtered prompts the strip paints, so audio + visual can't drift:
    // the phase is the top prompt's tone, and battleEarcon() rings only on the illegal→legal EDGE.
    const phase = prompts.length ? (prompts[0].tone || null) : null;
    const earcon = battleEarcon(prevPhase, phase);
    prevPhase = phase;

    if (!prompts.length) {
      if ($el.classList.contains('show')) { $el.classList.remove('show'); lastSig = ''; }
      return earcon;
    }
    const sig = prompts.map((p) => p.id).join(',');
    if (sig === lastSig && $el.classList.contains('show')) return earcon;
    lastSig = sig;

    $el.innerHTML = prompts
      .map((p) => `<span class="kp ${p.tone}"><kbd class="kp-key">${p.glyph}</kbd> ${p.verb}</span>`)
      .join('');
    $el.classList.add('show');
    return earcon;
  }

  return { update };
}
