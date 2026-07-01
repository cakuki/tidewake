// Ship picker — the diegetic hover-to-interact resolver (#161 slice 6, the FINAL slice of the lane).
//
// Owner's words on the marquee fight (#135/#161): "interacting with other ships should be hovering on
// the ship in the view, not like a HUD element." Until now every verb was proximity + a keypress guess
// ('e' engage / 'f' hail / 'g' fire on "whatever's nearest") — you never pointed at THAT ship. This
// module is the PURE brain of pointing: given the ship the cursor is over and the live world state,
// which single contextual action is offered, how a raw raycast hit maps back to a ship index, and the
// tiny in-world label a click will perform. main.js owns the THREE.Raycaster shell + the DOM affordance
// billboard; these cores are pure + DOM-free + three.js-free so they unit-test under `node --test`
// (the #53 self-tested-component standard). Additive input only — every keyboard verb stays live.

/**
 * Map a raycast hit object back to its NPC ship index (PURE). Walk the hit's parent chain until we reach
 * a DIRECT child of the npc container `group`, then return that child's index. -1 when the hit belongs
 * to no tracked ship (or a bad arg). Works on any {parent, children} graph (three.Object3D-shaped), so
 * it tests without three.js — the raycaster shell in main.js just hands us `intersect.object` + the group.
 * @param {{parent?:object}} hit          the intersected object (three Object3D or a shaped stub)
 * @param {{children:object[]}} group      the npcs container whose children are the per-ship groups
 * @returns {number} the ship index, or -1
 */
export function shipIndexFromObject(hit, group) {
  if (!hit || !group || !Array.isArray(group.children)) return -1;
  let node = hit;
  let guard = 0;
  while (node && guard++ < 64) {
    if (node.parent === group) return group.children.indexOf(node);
    node = node.parent;
  }
  return -1;
}

/**
 * The single contextual action offered for the ship under the cursor (PURE). One of
 * 'board' | 'target' | 'hail' | null. Respects hard battle isolation (#161 slice 1): while a fight is
 * live ONLY the engaged foe is interactable — and only to BOARD her once she's battered — so you can
 * never hail a non-combatant mid-fight. At sea the offer is disposition-appropriate: square up to an
 * OUTLAW (a fair mark → 'target'/engage) or HAIL a peaceable hull (insult broadside → 'hail'). Out of
 * interaction range ⇒ null (she's not yet in reach). The keyboard verbs stay live regardless — this is
 * an ALTERNATIVE input, never the only path (the #146 touch guard taps the same routes).
 * @param {{battleActive?:boolean, foeIndex?:number, index?:number, canBoard?:boolean,
 *          outlaw?:boolean, inRange?:boolean}} args
 * @returns {'board'|'target'|'hail'|null}
 */
export function pickShipAction({
  battleActive = false, foeIndex = -1, index = -1, canBoard = false, outlaw = false, inRange = false,
} = {}) {
  if (!Number.isInteger(index) || index < 0) return null;
  if (battleActive) {
    if (index !== foeIndex) return null;   // isolation: non-combatants are untouchable mid-fight
    return canBoard ? 'board' : null;      // your foe: board when battered; else fire via SPACE (no click verb)
  }
  if (!inRange) return null;               // open sea, but she's out of reach
  return outlaw ? 'target' : 'hail';
}

/**
 * The in-world prompt text for an action (PURE) — the tiny label that floats over the pointed-at ship so
 * the player SEES what a click will do (the visible fun beat). '' for a null/unknown action (the marker
 * stays hidden). Original, on-tone wording.
 * @param {'board'|'target'|'hail'|null} action
 * @returns {string}
 */
export function actionLabel(action) {
  switch (action) {
    case 'target': return '⚔ Give battle';
    case 'hail': return '💬 Hail';
    case 'board': return '🪝 Board';
    default: return '';
  }
}
