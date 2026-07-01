import * as THREE from 'three';
import {
  wrapAngle, steerToward, headingTo, pickWaypoint, hasArrived, avoidObstacles, arenaHelm,
} from './npc-ai.js';
import { vesselKind, isOutlaw } from './colours.js';

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

  const ships = [];
  for (let i = 0; i < count; i++) {
    const p = palettes[i % palettes.length];
    // Letters of Marque (#91): a deterministic disposition per slot — an outlaw flies a
    // blood-dark flag so it reads as fair game for a lawful privateer.
    const kind = vesselKind(i);
    const flagColor = isOutlaw(kind) ? OUTLAW_FLAG : p.flag;
    const mesh = makeVessel(p.hull, p.sail, flagColor, p.scale);
    group.add(mesh);

    // Spread spawns out, well clear of the player's origin and of land.
    let spawn, tries = 0;
    do {
      spawn = pickWaypoint(rng, bounds);
      tries++;
    } while (tries < 24 && (
      (spawn.x * spawn.x + spawn.z * spawn.z) < 300 * 300 ||
      islands.some(s => Math.hypot(s.x - spawn.x, s.z - spawn.z) < s.r + 90)
    ));

    const heading = rng() * Math.PI * 2 - Math.PI;
    const s = {
      mesh,
      kind, // pirate/merchant disposition for the lawful Standing path (#91)
      x: spawn.x,
      z: spawn.z,
      heading,
      // gentle per-ship variation around the palette's base speed
      speed: p.speed * (0.85 + rng() * 0.3),
      turnRate: 0.5 + rng() * 0.3,   // rad/s
      bobPhase: rng() * Math.PI * 2,
      wp: pickWaypoint(rng, bounds),
    };
    ships.push(s);
  }

  const ARRIVE_R = 80;
  // False Colours (#79): when the player flies their TRUE black flag while feared, nearby
  // vessels react to the colours shown — they break off and FLEE the dread captain. Under
  // false merchant colours they stay calm and let you approach (the disguise works). The
  // pure disposition math lives in colours.js; main.js passes the verdict in via `ctx`.
  const FLEE_RADIUS = 360; // how close the dread captain must be to scatter a vessel

  // Battle-foe agility (#135, Option-4 final slice): the DUEL foe answers the helm quicker and pushes
  // harder than a wandering merchant, so the maneuver phase feels like a real contest of positioning.
  const ARENA_TURN_RATE = 0.9;  // rad/s — she comes about smartly when squaring up
  const ARENA_SPEED = 26;       // base sail speed in the arena (throttle scales it per the helm stance)

  // ctx (optional): { playerPos:[x,z]|null, flee:boolean,
  //   arena:{ index, playerPos:[x,z], playerHeading, moraleFrac }|null } — colours reaction + the
  //   dedicated BATTLE foe. When `arena` names a ship index, THAT ship drops her waypoint wander and
  //   sails to fight via the pure arenaHelm brain (seek beam / hold range / flee), zero extra draws.
  function update(dt, t, ctx = {}) {
    if (dt <= 0) return;
    const playerPos = ctx && ctx.playerPos;
    const fleeOn = !!(ctx && ctx.flee) && Array.isArray(playerPos);
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
        const target = avoidObstacles(s.x, s.z, helm.desiredHeading, islands, 220);
        s.heading = steerToward(s.heading, target, ARENA_TURN_RATE, dt);
        const sp = ARENA_SPEED * helm.throttle;
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

      // Are these colours making this vessel run? (player near + flee verdict on)
      let fleeing = false;
      if (fleeOn) {
        const dpx = s.x - playerPos[0], dpz = s.z - playerPos[1];
        fleeing = (dpx * dpx + dpz * dpz) < FLEE_RADIUS * FLEE_RADIUS;
      }
      s.fleeing = fleeing;

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
          } while (tries < 16 && islands.some(o => Math.hypot(o.x - wp.x, o.z - wp.z) < o.r + 90));
          s.wp = wp;
        }
        // Desired heading = toward the mark, deflected around any island ahead.
        want = headingTo(s.x, s.z, s.wp.x, s.wp.z);
      }
      const target = avoidObstacles(s.x, s.z, want, islands, 220);
      s.heading = steerToward(s.heading, target, s.turnRate, dt);

      // Advance along the (smoothly turning) heading — a panicked vessel claps on more sail.
      const sp = fleeing ? s.speed * 1.35 : s.speed;
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
    return ships.map(s => ({ pos: [s.x, s.z], heading: s.heading, fleeing: !!s.fleeing, kind: s.kind, helm: s.arenaState || null }));
  }

  // Relocate ship `i` far away — a beaten foe slinking off over the horizon (#33).
  // Re-uses the spawn rules: clear of the origin and of land, then a fresh waypoint.
  function respawn(i) {
    const s = ships[i];
    if (!s) return;
    let spawn, tries = 0;
    do {
      spawn = pickWaypoint(rng, bounds);
      tries++;
    } while (tries < 24 && (
      (spawn.x * spawn.x + spawn.z * spawn.z) < 300 * 300 ||
      islands.some(o => Math.hypot(o.x - spawn.x, o.z - spawn.z) < o.r + 90)
    ));
    s.x = spawn.x;
    s.z = spawn.z;
    s.wp = pickWaypoint(rng, bounds);
  }

  return { group, update, snapshot, respawn };
}

export { wrapAngle, steerToward, pickWaypoint, headingTo, hasArrived, avoidObstacles, arenaHelm };
