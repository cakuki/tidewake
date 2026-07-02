// Persistent status HUD layout model (#21) — the SINGLE SOURCE OF TRUTH for the corner "who you are /
// what you have" cluster: which read-outs it shows, how they GROUP, and the pure geometry predicate
// the QA gate runs the live DOM rects through. THE RISE (#168) piled progression onto this corner —
// coins, rank/title (#169), the reputation ledger, the legend crown (#46) — until it read as one
// scattered run of text. This slice groups it into two legible clusters (SAILING vs CAPTAIN) so a
// glance tells you who you are and what you have.
//
// Pure + DOM-free + three.js-free so the grouping rule unit-tests under `node --test` (the #53
// self-tested-component standard). No state, no save-schema — presentation only (stays v18).

/**
 * The two legibility GROUPS the corner HUD splits into, so navigation and progression read as
 * distinct clusters instead of one undifferentiated list. Each `id` maps to a `.hud-<id>` wrapper in
 * index.html; each field id is a persistent read-out span inside that wrapper. The render and the QA
 * gate agree on the grouping via this one list — they can never silently drift apart.
 * @type {ReadonlyArray<{id: string, caption: string, fields: string[]}>}
 */
export const HUD_GROUPS = [
  { id: 'sail', caption: 'Sailing', fields: ['heading', 'speed', 'wind'] },
  { id: 'status', caption: 'Captain', fields: ['coins', 'cargo', 'infamy', 'standing', 'rank'] },
];

/**
 * Every persistent read-out that MUST survive the consolidation (#21 must-not-break: the RISE fields —
 * coins, the ⚔ Infamy / ⚖ Standing ledger, and the rank/title). Flattened from HUD_GROUPS so adding a
 * field to a group automatically extends the gate's "nothing was dropped" check.
 * @type {string[]}
 */
export const HUD_FIELDS = HUD_GROUPS.flatMap((g) => g.fields);

/**
 * Does a UI box fit fully inside the viewport (no overflow / clipping)? The corner HUD must never spill
 * off a phone-portrait screen (#146). A tolerance absorbs sub-pixel rounding / the panel's own inset so
 * a box flush to an edge still reads as "fits". A zero-area or missing rect is treated as fitting —
 * nothing shown can't overflow.
 * @param {{left:number,top:number,right:number,bottom:number}|null} rect
 * @param {number} vw viewport width in px
 * @param {number} vh viewport height in px
 * @param {number} [tol=0] px tolerance on every edge
 * @returns {boolean} true ⇒ the box is fully on-screen
 */
export function fitsViewport(rect, vw, vh, tol = 0) {
  if (!rect) return true;
  const w = Number(vw) || 0;
  const h = Number(vh) || 0;
  if (rect.right <= rect.left || rect.bottom <= rect.top) return true; // hidden / zero-area
  return rect.left >= -tol && rect.top >= -tol
      && rect.right <= w + tol && rect.bottom <= h + tol;
}

/**
 * The persistent corner HUD's NON-OCCLUSION contract: is it anchored in the TOP-LEFT corner and
 * confined to the upper half of the screen? This is the RIGHT rule for an always-present corner
 * cluster — deliberately different from the battle-MODAL safe-zone (`clearsCentre` in
 * src/ui/safe-zone.js). A transient centre/bottom modal must dodge that generous central band; but a
 * standing corner read-out honours "never cover the framed hull" simply by hugging the top-left corner
 * and never dropping into the mid-screen band where the battle camera frames the ship. No readable
 * corner HUD could clear the wide modal band on a narrow phone, so this — not clearsCentre — is the
 * viewport-proof contract for the corner. #161-s2's centre safe-zone stays enforced for the battle
 * modals by their own gate (main.js battleUICentreClear); this slice does not touch that.
 * @param {{left:number,top:number,right:number,bottom:number}|null} rect
 * @param {number} vw viewport width in px
 * @param {number} vh viewport height in px
 * @param {number} [inset=16] px slack for the corner origin (the panel's own 12px inset + safe-area)
 * @returns {boolean} true ⇒ the cluster stays in the top-left corner, clear of the ship band
 */
export function anchoredTopLeft(rect, vw, vh, inset = 16) {
  if (!rect) return true;
  const w = Number(vw) || 0;
  const h = Number(vh) || 0;
  if (rect.right <= rect.left || rect.bottom <= rect.top) return true; // hidden / zero-area
  return rect.left <= 0.10 * w + inset
      && rect.top <= 0.10 * h + inset
      && rect.bottom <= 0.5 * h;
}
