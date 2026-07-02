import * as THREE from 'three';
import {
  wrapAngle, steerToward, headingTo, pickWaypoint, hasArrived, avoidObstacles, arenaHelm,
} from './npc-ai.js';
import { windFactor } from './physics.js';
import { vesselKind, isOutlaw } from './colours.js';
import { shipEmphasis, DIM_OPACITY } from './ui/over-ship-billboard.js';
import { shipStats } from './ship-classes.js';
import { regionalSpec, regionDanger, DEEP_R } from './systems/danger.js';
import { fleesOnSight } from './systems/dread.js';

// Letters of Marque (#91): outlaw/pirate hulls fly a sullen blood-dark flag so a lawful
// privateer can pick a fair target on the horizon — honest colours vs THIS one earns Standing.
const OUTLAW_FLAG = 0x2a0d0d;

// The first other sails on the sea. A handful of AI vessels wander believable
// routes between waypoints scattered across the play area, bobbing on the same
// swell the player rides (ocean.sampleHeight), steering smoothly toward each mark
// and crudely curving around islands rather than beaching. Cheap by design: a
// little CPU steering per ship, no pathfinding, a tiny billowed sail per hull.
//
// These are deliberately varied (hull tint, flag colour, size, speed) so they
// already read as a living crew of merchants/rivals — the seed for trade & combat.

// Small seeded RNG (mulberry32) so a fixed `count` gives a repeatable little fleet.
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A compact NPC vessel — same primitive vocabulary as the player's sloop, scaled
// down and tinted so it stays distinct on the horizon while staying very cheap.
function makeVessel(hullColor, sailColor, flagColor, scale) {
  const group = new THREE.Group();
  const woodDark = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.85 });
  const woodLight = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.7 });
  woodLight.color.offsetHSL(0, 0, 0.12);
  const sailMat = new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.95, side: THREE.DoubleSide });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.4, 12), woodDark);
  hull.position.y = 0.4;
  group.add(hull);

  const bow = new THREE.Mesh(new THREE.ConeGeometry(2.3, 4.6, 4), woodDark);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.4, 7.6);
  bow.scale.set(1, 1, 0.6);
  group.add(bow);

  const deck = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.4, 11), woodLight);
  deck.position.y = 1.7;
  group.add(deck);

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 17, 6), woodLight);
  mast.position.set(0, 9, -0.5);
  group.add(mast);

  // One billowed square sail (face fore/aft so it catches light side-on at range).
  const sailW = 9, sailH = 10;
  const sailGeo = new THREE.PlaneGeometry(sailW, sailH, 8, 8);
  const pos = sailGeo.attributes.position;
  const halfW = sailW / 2, halfH = sailH / 2;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const across = Math.cos((x / halfW) * (Math.PI / 2));
    const down = Math.cos(((y - halfH) / sailH) * Math.PI);
    pos.setZ(i, 2.4 * across * Math.max(0, down));
  }
  sailGeo.computeVertexNormals();
  const sail = new THREE.Mesh(sailGeo, sailMat);
  sail.position.set(0, 10, -0.5);
  group.add(sail);

  const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, sailW + 1.5, 6), woodLight);
  yard.rotation.z = Math.PI / 2;
  yard.position.set(0, 10 + halfH, -0.5);
  group.add(yard);

  // A little flag for personality / future faction colours.
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 1.2),
    new THREE.MeshStandardMaterial({ color: flagColor, side: THREE.DoubleSide, roughness: 1 })
  );
  flag.position.set(1.1, 16.4, -0.5);
  group.add(flag);
  group.userData.flag = flag;

  group.scale.setScalar(scale);
  return group;
}

// createNpcs({ ocean, world, count }) -> { group, update(dt,t), snapshot() }
export function createNpcs({ ocean, world, count = 3 } = {}) {
  const group = new THREE.Group();
  const rng = makeRng(0x7ea51de);

  // Play area to wander within (a touch inside the islands' spread).
  const bounds = { minX: -900, maxX: 900, minZ: -900, maxZ: 900 };

  // Distil islands to flat {x,z,r} circles for cheap avoidance.
  const islands = [];
  if (world && world.islands) {
    for (const isle of world.islands.children) {
      islands.push({ x: isle.position.x, z: isle.position.z, r: isle.userData.radius || 80 });
    }
  }

  // A few characterful palettes — weathered merchants, a rakish privateer, etc.
  const palettes = [
    { hull: 0x6a4a28, sail: 0xe9dec2, flag: 0x9a2b2b, speed: 22, scale: 1.0 },   // ochre trader
    { hull: 0x4a4f5a, sail: 0xd7dde2, flag: 0x214a8c, speed: 28, scale: 0.92 },  // grey privateer
    { hull: 0x3f5a3a, sail: 0xe2e6cf, flag: 0x2f7d4f, speed: 19, scale: 1.08 },  // green hauler
    { hull: 0x5a3550, sail: 0xe7d9e2, flag: 0x7a2f6a, speed: 25, scale: 0.96 },  // plum runner
  ];

  // Ship classes (#163) + regional danger (#167): the open sea has a visible + mechanical pecking order
  // that is FIXED BY REGION — danger is a property of WHERE a hull sails. The safe home coast breeds
  // gentle prey; the deep breeds frigates and, out past the points, the withheld WARSHIP man-o'-war.
  // A player who WANTS a hard fight points the bow at deadly water and finds one worth real fame (reward
  // scales by tier, cannons.js spoils). These are TRANSIENT spawn properties (never persisted — save
  // stays v17). A DEDICATED seed so class selection never perturbs the shared `rng` position stream.
  const dangerRng = makeRng(0x5c1a55e5);
  // The DEEP HUNTER: one slot is guaranteed to spawn out in the tier-5 deep as the apex man-o'-war, so a
  // hard fight is ALWAYS reachable if you sail out to meet her (#167 acceptance). It's the LAST slot, so
  // its extra spawn draws never perturb the earlier ships' positions (determinism preserved).
  const deepSlot = count - 1;

  const ships = [];
  const specs = [];
  for (let i = 0; i < count; i++) {
    const p = palettes[i % palettes.length];
    // Letters of Marque (#91): a deterministic disposition per slot — an outlaw flies a
    // blood-dark flag so it reads as fair game for a lawful privateer.
    const kind = vesselKind(i);
    const flagColor = isOutlaw(kind) ? OUTLAW_FLAG : p.flag;

    // Spread spawns out, well clear of the player's origin and of land. The deep hunter ALSO demands
    // deadly water (r ≥ DEEP_R) so a man-o'-war genuinely roams the deep — sail out and she's there.
    const wantDeep = (i === deepSlot);
    let spawn, tries = 0;
    do {
      spawn = pickWaypoint(rng, bounds);
      tries++;
    } while (tries < 24 && (
      (spawn.x * spawn.x + spawn.z * spawn.z) < 300 * 300 ||
      islands.some(s => Math.hypot(s.x - spawn.x, s.z - spawn.z) < s.r + 90) ||
      (wantDeep && Math.hypot(spawn.x, spawn.z) < DEEP_R)
    ));
    // Guarantee the deep hunter is truly in the deep even if the sampler never satisfied it: push her
    // out along her bearing so she reads tier-5 (the man-o'-war reachability the epic promises).
    if (wantDeep && Math.hypot(spawn.x, spawn.z) < DEEP_R) {
      const r = Math.hypot(spawn.x, spawn.z) || 1;
      const k = (DEEP_R + 40) / r;
      spawn = { x: spawn.x * k, z: spawn.z * k };
    }

    // Her CLASS is FIXED BY REGION (#167): the deeper the water she wanders, the deadlier she is. The
    // deep hunter takes the region's APEX (the warship man-o'-war). Deterministic; no rubber-band.
    const spec = regionalSpec(spawn.x, spawn.z, dangerRng, { apex: wantDeep });
    specs.push(spec);
    const stats = shipStats(spec.cls, spec.role);
    // The palette keeps her colours (identity); the CLASS sets her size — a bigger class is a visibly
    // bigger hull. Same reused mesh, just scaled (0 extra draws / tris).
    const mesh = makeVessel(p.hull, p.sail, flagColor, stats.sizeScale);
    group.add(mesh);

    const heading = rng() * Math.PI * 2 - Math.PI;
    const s = {
      mesh,
      kind, // pirate/merchant disposition for the lawful Standing path (#91)
      // Her class (#163) — a plain, JSON-safe stat block carried onto the snapshot so combat + future
      // labels/odds read exactly what she IS. Transient; never persisted.
      shipClass: {
        cls: stats.cls, role: stats.role, label: stats.label, tier: stats.tier,
        hull: stats.hull, maxHull: stats.maxHull, gunnery: stats.gunnery,
        guns: stats.guns, crew: stats.crew, sizeScale: stats.sizeScale,
      },
      x: spawn.x,
      z: spawn.z,
      heading,
      // Per-ship speed variation around the palette base — kept as-is (movement identical to before) so
      // class VARIETY rides on size + combat, not on perturbing the wander every frame. (The class's own
      // `speed` lives on shipClass for later slices — #167 challenge placement — but doesn't drive the
      // ambient wander here, which keeps the deterministic battle-camera playtest steps rock-steady.)
      speed: p.speed * (0.85 + rng() * 0.3),
      turnRate: 0.5 + rng() * 0.3,   // rad/s
      bobPhase: rng() * Math.PI * 2,
      wp: pickWaypoint(rng, bounds),
      // The deep hunter haunts the DEEP (#167): her waypoints stay in deadly water so she doesn't drift
      // inshore — the coasts stay gentle, and the man-o'-war is where the fixed rule says she'll be.
      deep: wantDeep,
    };
    ships.push(s);
  }

  // Variety guard (mirrors the retired spawnMix net): the sea must never read UNIFORM. If every hull
  // drew the same class, nudge slot 0 to a contrasting gentle coastal class so "the sea VARIES" holds.
  if (count >= 2 && specs.every((sp) => sp.cls === specs[0].cls)) {
    const alt = specs[0].cls === 'sloop' ? shipStats('brig', 'warship') : shipStats('sloop', 'merchant');
    const s0 = ships[0];
    s0.mesh.scale.setScalar(alt.sizeScale);
    s0.shipClass = {
      cls: alt.cls, role: alt.role, label: alt.label, tier: alt.tier,
      hull: alt.hull, maxHull: alt.maxHull, gunnery: alt.gunnery,
      guns: alt.guns, crew: alt.crew, sizeScale: alt.sizeScale,
    };
  }

  const ARRIVE_R = 80;
  // False Colours (#79): when the player flies their TRUE black flag while feared, nearby
  // vessels react to the colours shown — they break off and FLEE the dread captain. Under
  // false merchant colours they stay calm and let you approach (the disguise works). The
  // pure disposition math lives in colours.js; main.js passes the verdict in via `ctx`.
  const FLEE_RADIUS = 360; // how close the dread captain must be to scatter a vessel
  // The world FEARS you (#172): a much-outclassed, notorious captain scatters WEAK prey on SIGHT — read
  // from a bit further than the colours-flee so you SEE the sea part as your notorious sails crest. Per
  // ship (each hull's own class tier vs yours), so a peer/apex holds while a merchant sloop bolts.
  const DREAD_SIGHT_RADIUS = 460;

  // Battle-foe agility (#135, Option-4 final slice): the DUEL foe answers the helm quicker and pushes
  // harder than a wandering merchant, so the maneuver phase feels like a real contest of positioning.
  const ARENA_TURN_RATE = 0.9;  // rad/s — she comes about smartly when squaring up
  const ARENA_SPEED = 26;       // base sail speed in the arena (throttle scales it per the helm stance)

  // ctx (optional): { playerPos:[x,z]|null, flee:boolean,
  //   dread:{ infamy, tier }|null,
  //   arena:{ index, playerPos:[x,z], playerHeading, moraleFrac }|null } — colours reaction (#79),
  //   the world-fears-you dread (#172, per-ship by her class vs yours), + the dedicated BATTLE foe.
  //   When `arena` names a ship index, THAT ship drops her waypoint wander and sails to fight via the
  //   pure arenaHelm brain (seek beam / hold range / flee), zero extra draws.
  function update(dt, t, ctx = {}) {
    if (dt <= 0) return;
    // The weather gage (#178): the SAME point-of-sail rule the player obeys (physics.windFactor)
    // now scales every NPC's speed by her heading vs the wind — downwind faster, upwind slower.
    // main.js passes the live wind through ctx; when absent (a headless unit step) the gage is a
    // no-op (multiplier 1) so nothing changes off-wind. FAIR by construction: one shared function,
    // both hulls, so a chase is a fight for the wind, not an asymmetry.
    const windDir = (ctx && typeof ctx.windDir === 'number') ? ctx.windDir : null;
    const gage = (heading) => (windDir != null ? windFactor(heading, windDir) : 1);
    const playerPos = ctx && ctx.playerPos;
    const fleeOn = !!(ctx && ctx.flee) && Array.isArray(playerPos);
    // The world fears you (#172): a per-ship dread flee-on-sight, only when NOT hidden by a disguise
    // (main.js withholds this ctx under false colours, so the #79 bluff still works). Weak prey bolts;
    // a peer/apex holds (fleesOnSight reads each hull's class tier vs yours).
    const dread = (ctx && ctx.dread && Array.isArray(playerPos)) ? ctx.dread : null;
    const arena = ctx && ctx.arena;
    const arenaIdx = (arena && Number.isInteger(arena.index)) ? arena.index : -1;
    for (let si = 0; si < ships.length; si++) {
      const s = ships[si];

      // The dedicated BATTLE foe (#135) — she actively maneuvers to fight instead of wandering inertly.
      if (si === arenaIdx && Array.isArray(arena.playerPos)) {
        const helm = arenaHelm({
          foeX: s.x, foeZ: s.z, foeHeading: s.heading,
          playerX: arena.playerPos[0], playerZ: arena.playerPos[1],
          playerHeading: arena.playerHeading || 0,
          moraleFrac: (typeof arena.moraleFrac === 'number') ? arena.moraleFrac : 1,
        });
        s.arenaState = helm.state;
        s.fleeing = helm.state === 'flee';
        s.dreadFleeing = false; // an arena foe maneuvers by helm, not dread — never a fearful-hail flee (#175)
        const target = avoidObstacles(s.x, s.z, helm.desiredHeading, islands, 220);
        s.heading = steerToward(s.heading, target, ARENA_TURN_RATE, dt);
        // The weather gage (#178): the duel foe obeys the wind exactly as the player does, so
        // battle positioning is about the wind — claim the gage and you dictate the range.
        s.windMult = gage(s.heading);
        const sp = ARENA_SPEED * helm.throttle * s.windMult;
        s.x += Math.sin(s.heading) * sp * dt;
        s.z += Math.cos(s.heading) * sp * dt;
        const y = ocean.sampleHeight(s.x, s.z, t);
        const roll = Math.sin(t * 0.9 + s.bobPhase) * 0.05;
        const pitch = Math.sin(t * 1.3 + s.bobPhase) * 0.04;
        s.mesh.position.set(s.x, y, s.z);
        s.mesh.rotation.set(pitch, s.heading, roll);
        if (s.mesh.userData.flag) s.mesh.userData.flag.rotation.z = Math.sin(t * 3 + s.bobPhase) * 0.18;
        continue;
      }
      s.arenaState = null;

      // Are these colours making this vessel run? (player near + flee verdict on, #79)
      let fleeing = false;
      if (fleeOn) {
        const dpx = s.x - playerPos[0], dpz = s.z - playerPos[1];
        fleeing = (dpx * dpx + dpz * dpz) < FLEE_RADIUS * FLEE_RADIUS;
      }
      // The world fears you (#172): a much-outclassed, notorious captain scatters WEAK prey on sight —
      // per ship (her class tier vs yours), so a merchant sloop bolts while a peer/apex holds and fights.
      // `dreadFleeing` flags THIS bolt as a DREAD flee (not the #79 colours-flee), so main.js can cry the
      // fearful hail (#175, the HEAR half) only when the sea runs from your NAME — never on a bluff.
      let dreadFleeing = false;
      if (!fleeing && dread && s.shipClass) {
        const dpx = s.x - playerPos[0], dpz = s.z - playerPos[1];
        if (dpx * dpx + dpz * dpz < DREAD_SIGHT_RADIUS * DREAD_SIGHT_RADIUS &&
            fleesOnSight({ playerInfamy: dread.infamy, playerTier: dread.tier, foeTier: s.shipClass.tier, foeRole: s.shipClass.role })) {
          fleeing = true;
          dreadFleeing = true;
        }
      }
      s.fleeing = fleeing;
      s.dreadFleeing = dreadFleeing;

      let want;
      if (fleeing) {
        // Bolt directly away from the player — heading FROM the player TO this hull.
        want = headingTo(playerPos[0], playerPos[1], s.x, s.z);
      } else {
        // New mark once we reach the current one (avoid re-picking onto the origin/land).
        if (hasArrived(s.x, s.z, s.wp.x, s.wp.z, ARRIVE_R)) {
          let wp, tries = 0;
          do {
            wp = pickWaypoint(rng, bounds);
            tries++;
          } while (tries < 16 && (
            islands.some(o => Math.hypot(o.x - wp.x, o.z - wp.z) < o.r + 90) ||
            // The deep hunter (#167) keeps her marks in deadly water — she patrols the deep, not the coast.
            (s.deep && Math.hypot(wp.x, wp.z) < DEEP_R)
          ));
          s.wp = wp;
        }
        // Desired heading = toward the mark, deflected around any island ahead.
        want = headingTo(s.x, s.z, s.wp.x, s.wp.z);
      }
      const target = avoidObstacles(s.x, s.z, want, islands, 220);
      s.heading = steerToward(s.heading, target, s.turnRate, dt);

      // Advance along the (smoothly turning) heading — a panicked vessel claps on more sail.
      // The weather gage (#178): the SAME wind rule the player + arena foe obey scales the wander
      // too, so a merchant running downwind is genuinely fleet while one clawing upwind lags.
      s.windMult = gage(s.heading);
      const sp = (fleeing ? s.speed * 1.35 : s.speed) * s.windMult;
      const fx = Math.sin(s.heading), fz = Math.cos(s.heading);
      s.x += fx * sp * dt;
      s.z += fz * sp * dt;

      // Sit + bob on the live swell, with a gentle roll for life.
      const y = ocean.sampleHeight(s.x, s.z, t);
      const roll = Math.sin(t * 0.9 + s.bobPhase) * 0.05;
      const pitch = Math.sin(t * 1.3 + s.bobPhase) * 0.04;
      s.mesh.position.set(s.x, y, s.z);
      s.mesh.rotation.set(pitch, s.heading, roll);

      // Flag flutters a touch.
      if (s.mesh.userData.flag) {
        s.mesh.userData.flag.rotation.z = Math.sin(t * 3 + s.bobPhase) * 0.18;
      }
    }
  }

  function snapshot() {
    return ships.map(s => ({ pos: [s.x, s.z], heading: s.heading, fleeing: !!s.fleeing, dreadFleeing: !!s.dreadFleeing, kind: s.kind, helm: s.arenaState || null, shipClass: s.shipClass || null, windMult: (typeof s.windMult === 'number') ? s.windMult : 1 }));
  }

  // QA/gallery hook (#163): drop ship `i` at a world XZ so a headless gallery frame can pose a big
  // warship and a little sloop on the same sea. Sim otherwise untouched (mirrors qaTeleport for the player).
  function place(i, x, z) {
    const s = ships[i];
    if (!s) return;
    s.x = x; s.z = z; s.wp = { x, z };
  }

  // QA/gallery hook (#172): force ship `i`'s CLASS so a headless test / gallery frame can pose a weak
  // merchant sloop beside an apex man-o'-war deterministically and prove the dread flee reads per-hull.
  // Rescales the mesh (mirrors spawn) so the fleeing prey reads visibly small. Sim otherwise untouched.
  function setClass(i, classKey, role = 'warship') {
    const s = ships[i];
    if (!s) return null;
    const st = shipStats(classKey, role);
    s.shipClass = {
      cls: st.cls, role: st.role, label: st.label, tier: st.tier,
      hull: st.hull, maxHull: st.maxHull, gunnery: st.gunnery,
      guns: st.guns, crew: st.crew, sizeScale: st.sizeScale,
    };
    s.mesh.scale.setScalar(st.sizeScale);
    return snapshot()[i] || null;
  }

  // Target lock (#161 slice 3) — set each hull's opacity so the engaged foe reads instantly amid the
  // traffic: the foe stays full, non-combatants recede to DIM_OPACITY, and everyone returns to full
  // the moment the fight ends. Pure per-mesh material opacity (0 extra draws — same meshes) driven off
  // the shared `shipEmphasis` predicate so "dimmed" means exactly what the QA hook + unit tests say.
  let focusFoe = -1;
  function setMeshOpacity(mesh, opacity) {
    mesh.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        m.opacity = opacity;
        m.transparent = opacity < 1;
        m.needsUpdate = true;
      }
    });
  }
  function setBattleFocus(foeIndex) {
    const idx = Number.isInteger(foeIndex) ? foeIndex : -1;
    if (idx === focusFoe) return; // idempotent — only re-touch materials when the lock changes
    focusFoe = idx;
    const battleActive = idx >= 0;
    for (let i = 0; i < ships.length; i++) {
      const mode = shipEmphasis({ battleActive, foeIndex: idx, index: i });
      const opacity = mode === 'dim' ? DIM_OPACITY : 1;
      ships[i].opacity = opacity;
      setMeshOpacity(ships[i].mesh, opacity);
    }
  }
  // QA surface for the target-lock gate: which hulls are receded and which is the locked foe.
  function emphasisSnapshot() {
    return ships.map((s, i) => ({
      index: i,
      opacity: (typeof s.opacity === 'number') ? s.opacity : 1,
      dimmed: ((typeof s.opacity === 'number') ? s.opacity : 1) < 1,
      foe: i === focusFoe,
    }));
  }

  // Relocate ship `i` far away — a beaten foe slinking off over the horizon (#33).
  // Re-uses the spawn rules: clear of the origin and of land, then a fresh waypoint. A DEEP HUNTER
  // (#167) sails back in from the deadly deep, so the man-o'-war stays where the fixed rule says — a
  // beaten one is replaced by another out past the points (the coasts stay gentle).
  function respawn(i) {
    const s = ships[i];
    if (!s) return;
    let spawn, tries = 0;
    do {
      spawn = pickWaypoint(rng, bounds);
      tries++;
    } while (tries < 24 && (
      (spawn.x * spawn.x + spawn.z * spawn.z) < 300 * 300 ||
      islands.some(o => Math.hypot(o.x - spawn.x, o.z - spawn.z) < o.r + 90) ||
      (s.deep && Math.hypot(spawn.x, spawn.z) < DEEP_R)
    ));
    if (s.deep && Math.hypot(spawn.x, spawn.z) < DEEP_R) {
      const r = Math.hypot(spawn.x, spawn.z) || 1;
      const k = (DEEP_R + 40) / r;
      spawn = { x: spawn.x * k, z: spawn.z * k };
    }
    s.x = spawn.x;
    s.z = spawn.z;
    s.wp = pickWaypoint(rng, bounds);
  }

  return { group, update, snapshot, respawn, place, setClass, setBattleFocus, emphasisSnapshot };
}

export { wrapAngle, steerToward, pickWaypoint, headingTo, hasArrived, avoidObstacles, arenaHelm };
