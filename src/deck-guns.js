import * as THREE from 'three';
import { DECK_GUN_SLOTS, MAX_EXTRA_CANNONS, sanitizeExtraCannons } from './systems/gun-upgrade.js';

// Deck guns — the VISIBLE payoff of buying a cannon at the Gunner's Workshop (#170). When you spend
// coin on a cannon, a new gun is bolted to your deck and you SEE it the instant you buy it. Mounts a
// small pool of extra cannon meshes onto the player ship group (works for both the glTF hull and the
// procedural fallback, which share the ~16-unit group space), and reveals as many as you own.
//
// Mesh conservation (#121): the whole pool REUSES exactly ONE barrel geometry, ONE carriage geometry
// and shared materials — no per-cannon geometry, no unique high-poly mesh. Unbought guns are simply
// hidden (invisible → not drawn), so the deck stays cheap on draws and the perf budget is untouched.

/**
 * Build the extra-cannon pool and add it to `shipGroup`. Returns a handle whose `setCount(n)` reveals
 * the first `n` bought cannons (0..MAX_EXTRA_CANNONS). Idempotent to call setCount repeatedly.
 * @param {THREE.Group} shipGroup  the player ship group (loadShip()/createShip())
 */
export function mountDeckGuns(shipGroup) {
  const group = new THREE.Group();
  group.name = 'deck-guns';

  // ONE shared geometry + material set for the whole battery — bolted on, matching the sloop's own
  // stubby iron cannons (see src/ship.js): a short barrel on a small wooden carriage.
  const barrelGeo = new THREE.CylinderGeometry(0.18, 0.24, 1.8, 8);
  const carriageGeo = new THREE.BoxGeometry(0.55, 0.34, 0.75);
  // A newly-cast BRONZE barrel — deliberately brighter than the ship's own dark-iron guns so a bought
  // cannon visibly STANDS OUT the instant it's bolted on (the SEE beat), and catches the light gleaming.
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0xb5772a, roughness: 0.35, metalness: 0.8 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.75 });

  const guns = [];
  for (let i = 0; i < MAX_EXTRA_CANNONS; i++) {
    const slot = DECK_GUN_SLOTS[i] || DECK_GUN_SLOTS[DECK_GUN_SLOTS.length - 1];
    const gun = new THREE.Group();
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.z = Math.PI / 2;            // lie the barrel athwartships, muzzle outboard
    barrel.position.set(slot.side * 0.55, 0.28, 0); // nudge the muzzle over the rail, up off the carriage
    barrel.castShadow = true;
    const carriage = new THREE.Mesh(carriageGeo, woodMat);
    carriage.castShadow = true;
    gun.add(carriage);
    gun.add(barrel);
    gun.position.set(slot.x, slot.y, slot.z);
    gun.visible = false; // revealed by setCount as you buy
    group.add(gun);
    guns.push(gun);
  }

  shipGroup.add(group);

  /** Reveal the first `n` bought cannons (the rest stay hidden → not drawn). */
  function setCount(n) {
    const count = sanitizeExtraCannons(n);
    for (let i = 0; i < guns.length; i++) guns[i].visible = i < count;
    return count;
  }

  /** How many extra guns are currently SHOWN — the SEE assertion the playtest reads. */
  function shownCount() {
    let c = 0;
    for (const g of guns) if (g.visible) c++;
    return c;
  }

  return { group, setCount, shownCount };
}
