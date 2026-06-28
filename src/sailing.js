// Sailing — the ship state + per-frame sailing step. Reads input, applies the pure
// physics model (throttle/steer/wind via physics.js), integrates position, places
// the hull on the live swell with bob/roll, and follows with the camera. This is the
// arcade-sailing heart that used to live inline in main.js's update().
import * as THREE from 'three';
import { targetSpeed, approach, steerRate, easeRudder, sweepIslandCollision, sweepShipCollision, shipCircles, slideVelocity, settledTargetSpeed, SETTLE_RATE } from './physics.js';

export const MAX_SPEED = 55;

// CREATIVE SPARK (#76 a1): a hard run-aground earns a comic complaint from the hull/crew —
// the coast has consequence, but the tone stays light and arcade. Rotated so it never gets stale.
const SCRAPES = [
  'Scraaape… the hull complains, and so does the bosun.',
  'You kiss the sand at speed — the crew lurches, the parrot swears.',
  'Run aground! Somewhere below, a barrel of rum tips over. Tragedy.',
  'The keel grinds the shallows. "That\'ll buff right out," lies the carpenter.',
  'A crunch of coral. The cook drops the stew. Morale: damp.',
];

// CREATIVE SPARK (#76 a2): a GLANCING graze along the coast is no groan — the hull skims the
// shallows and slips on past, keeping its way. A lighter beat than the head-on SCRAPES, so the
// tone tracks the feel: angled contact glides, it doesn't stop you dead. Throttled + rotated.
const SLIPS = [
  'Scrape… and you slip past — the coast lets you off with a warning.',
  'The keel grazes the shallows; you skim on by, barely losing way.',
  'A whisper of sand along the hull, then open water again. Smooth, captain.',
  'You shave the shoreline and slide clear — the lookout exhales.',
];

// CREATIVE SPARK (#76 b): graze another captain's hull and the crew hollers across the water —
// the sea is suddenly crowded. A bump, not a brick wall; throttled so it never spams, rotated so
// it never gets stale.
const BUMPS = [
  'Timbers groan — mind the other captain!',
  'You shoulder her hull. "Oi! Watch the paintwork!" drifts back over the swell.',
  'A scrape of gunwales — both crews glare, neither yields the lane.',
  '"Right of way, ye barnacle!" the other bosun bellows as you bump past.',
  'Hull kisses hull. Someone aboard the other ship spills their grog. Rude.',
];

export function createSailing({ ship, ocean, camera, input, world, npcs, onRunAground, onBump }) {
  // Distil islands to flat {x,z,r} circles once — the arcade collision hitboxes (#76 a1).
  // Same reduction npc.js uses; islands never move, so we snapshot them at construction.
  const islands = [];
  if (world && world.islands) {
    for (const isle of world.islands.children) {
      islands.push({
        x: isle.position.x, z: isle.position.z, r: isle.userData.radius || 80,
        sx: isle.userData.sx ?? 1, sz: isle.userData.sz ?? 1, // squashed-shoreline ellipse (#76 beach fix)
      });
    }
  }
  let lastScrapeT = -10; // throttle the run-aground quip so a long scrape doesn't spam
  let lastBumpT = -10;   // throttle the ship-vs-ship bump quip the same way (#76 b)

  // ---- Ship state (simple arcade sailing) ----
  const state = {
    heading: 0,        // radians, 0 = +Z
    speed: 0,          // world units / sec
    throttle: 0,       // 0..1 target
    rudder: 0,         // -1..1 eased helm (#20): swings toward steer input, never snaps
    pos: new THREE.Vector3(0, 0, 0),
    windDir: Math.PI * 0.25,
    windName: 'NE breeze',
  };

  // Restore a prior voyage (validated save) into the live state.
  function restore(saved) {
    state.heading = saved.heading;
    state.speed = saved.speed;
    state.throttle = saved.throttle;
    state.pos.set(saved.pos[0], saved.pos[1], saved.pos[2]);
    // Economy (persisted since save v2) — apply if present; initEconomy fills any gaps.
    if (typeof saved.coins === 'number') state.coins = saved.coins;
    if (saved.cargo && typeof saved.cargo === 'object') state.cargo = { ...saved.cargo };
    // Two poles of the Captain's Ledger (persisted since save v4): infamy + standing.
    // Renown is the derived total, recomputed from whatever poles loaded.
    if (typeof saved.infamy === 'number') state.infamy = saved.infamy;
    if (typeof saved.standing === 'number') state.standing = saved.standing;
    state.renown = (state.infamy || 0) + (state.standing || 0);
    // Endgame legends (persisted since save v5): the earned crowns, so a restored voyage
    // keeps its badge and never re-fires a celebration it already had (#46).
    if (saved.legends && typeof saved.legends === 'object') {
      state.legends = { pirate: !!saved.legends.pirate, governor: !!saved.legends.governor };
    }
    // Onboarding progress (persisted since save v6): a returning captain keeps the flags
    // they earned, so the seeded goal + first-win beats never re-fire for them (#60).
    if (saved.onboarding && typeof saved.onboarding === 'object') {
      state.onboarding = { ...saved.onboarding };
    }
    // Voyage log (persisted since save v7): a returning captain keeps the deeds already sung,
    // so reloading mid-voyage never loses the Ballad of Your Voyage (#78).
    if (Array.isArray(saved.voyageLog)) state.voyageLog = saved.voyageLog.slice();
  }

  // Respawn at the origin, dead in the water. Clear economy so initEconomy re-seeds defaults.
  function reset() {
    state.heading = 0; state.speed = 0; state.throttle = 0; state.rudder = 0;
    state.pos.set(0, 0, 0);
    delete state.coins; delete state.cargo;
    delete state.infamy; delete state.standing; delete state.renown;
    delete state.legends; // a new voyage starts legend-less; the crowns are yet to earn
    delete state.onboarding; // a fresh voyage re-teaches: the goal + first-win beats arm again (#60)
    delete state.voyageLog; // a new voyage is a blank page — the Ballad starts unwritten (#78)
    if (input && typeof input.resetView === 'function') input.resetView(); // reopen astern (#49)
  }

  function step(dt, t, settle = {}) {
    const fighting = !!settle.fighting;
    const keys = input.keys;
    // throttle / steer — SUSPENDED while squaring up for a fight (#76 c): the crew's at the
    // guns (or trading barbs), not the helm, so helm input is ignored and the ship eases to a
    // near-stop on its own. The player taking the helm (W) at a berth still overrides the
    // harbour assist below, so it coasts you IN but never traps you at the dock.
    const wantsToGo = keys.has('w') || keys.has('arrowup');
    if (!fighting) {
      if (wantsToGo) state.throttle = Math.min(1, state.throttle + dt * 0.8);
      if (keys.has('s') || keys.has('arrowdown')) state.throttle = Math.max(0, state.throttle - dt * 1.2);
    }
    // Steer command: keyboard A/D (±1) stays authoritative and unchanged; when it's idle, the
    // analog ship's-wheel axis (#93, input.steerAxis from the on-screen helm) takes over, so a
    // half-turn of the wheel gives a half rudder. Both feed the SAME eased rudder below (#20).
    const kbSteer = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);
    const wheelAxis = (input && typeof input.steerAxis === 'number') ? input.steerAxis : 0;
    const steer = fighting ? 0 : (kbSteer !== 0 ? kbSteer : wheelAxis);

    // wind modifies achievable speed: sailing with the wind is faster. Then EASE that target
    // DOWN to settle for a fight / harbour approach (#76 c) — a fight forces a near-stop, a
    // berth coasts the hull in (harbourSlowFactor). The berth assist yields the instant the
    // player takes the helm to leave (wantsToGo), so it never strands you at the dock.
    const desired = targetSpeed(state.throttle, MAX_SPEED, state.heading, state.windDir);
    const harbourDistance = (!fighting && !wantsToGo) ? (settle.harbourDistance ?? Infinity) : Infinity;
    const target = settledTargetSpeed(desired, { fighting, harbourDistance, harbourRadius: settle.harbourRadius ?? 0 });
    // Ease toward the target: a firmer SETTLE_RATE while actively settling (a deliberate
    // glide), the normal rate otherwise. Either way it's approach() — eased, never a snap.
    const settling = fighting || target < desired - 1e-6;
    state.settling = settling;
    state.speed = approach(state.speed, target, dt, settling ? SETTLE_RATE : 1.5);

    // steering (#20): ease the RUDDER toward the steer input instead of yawing at a constant
    // rate the instant a key is held — the turn accelerates in as you hold and settles smoothly
    // on release (a weighty wheel, not a switch). The applied yaw is the eased rudder times the
    // speed-scaled steerRate, so turn authority still firms up with speed. While fighting/settling
    // steer is 0, so the rudder eases back amidships on its own — the helm goes quiet for the guns.
    state.rudder = easeRudder(state.rudder, steer, dt);
    state.heading += state.rudder * dt * steerRate(state.speed);

    // integrate position
    const px0 = state.pos.x, pz0 = state.pos.z; // pre-collision, for the swept resolve
    state.pos.x += Math.sin(state.heading) * state.speed * dt;
    state.pos.z += Math.cos(state.heading) * state.speed * dt;

    // Arcade island collision (#76 a1): the coast stops you — soft. Resolve AFTER integration
    // (and inside tw.step's fixed sub-steps, so it's deterministic) by pushing the hull out of
    // any island circle it entered and sliding it along the shoreline. The swept resolver also
    // forbids tunnelling through a small isle at speed.
    if (islands.length) {
      const r = sweepIslandCollision({ x: px0, z: pz0 }, { x: state.pos.x, z: state.pos.z }, islands);
      if (r.hit) {
        state.pos.x = r.x; state.pos.z = r.z;
        // #76 a2 — tangential slide: keep the velocity skimming ALONG the coast, lose only the
        // part pressing INTO it. A head-on charge (velocity straight into the surface) bleeds to a
        // stop; a glancing graze keeps its way on and glides. One shared rule (slideVelocity +
        // the resolver's contact normal) drives both the coast and the ship-vs-ship slide.
        const prevSpeed = state.speed;
        const slid = slideVelocity(Math.sin(state.heading) * prevSpeed, Math.cos(state.heading) * prevSpeed, r.nx, r.nz);
        const newSpeed = Math.hypot(slid.vx, slid.vz);
        // Tone tracks feel: a HARD run-aground groans (SCRAPES); a glancing graze that keeps most
        // of its way slips past with a lighter line (SLIPS). Throttled so neither ever spams.
        if (typeof onRunAground === 'function' && prevSpeed > 12 && (t - lastScrapeT) > 5) {
          const kept = newSpeed / prevSpeed; // 0 = dead-stop, 1 = clean glide
          if (kept < 0.35) {
            lastScrapeT = t;
            onRunAground(SCRAPES[Math.floor((Math.abs(t * 7.3)) % SCRAPES.length)]);
          } else if (kept < 0.85 && newSpeed > 6) {
            lastScrapeT = t;
            onRunAground(SLIPS[Math.floor((Math.abs(t * 6.1)) % SLIPS.length)]);
          }
        }
        state.speed = newSpeed;
      }
    }

    // Arcade ship-vs-ship collision (#76 b): the player BUMPS other vessels instead of phasing
    // through them. Resolve the swept hull motion (this step's start → its island-resolved
    // position) against the live NPC circles — player-only, so the wander AI stays deterministic.
    // A head-on shoulder bleeds speed to the ground speed actually made (a soft pile-up); a
    // glancing bump slides along and keeps its way on, just like the coast.
    if (npcs && typeof npcs.snapshot === 'function') {
      const ships = shipCircles(npcs.snapshot());
      if (ships.length) {
        const sx = state.pos.x, sz = state.pos.z; // post-island start of the ship-vs-ship sweep
        const rs = sweepShipCollision({ x: px0, z: pz0 }, { x: sx, z: sz }, ships);
        if (rs.hit) {
          state.pos.x = rs.x; state.pos.z = rs.z;
          // #76 a2 — the SAME tangential slide the coast uses: a head-on shoulder bleeds speed (a
          // soft pile-up), a glancing bump slides along the other hull and keeps its way on.
          const prevSpeed = state.speed;
          const slid = slideVelocity(Math.sin(state.heading) * prevSpeed, Math.cos(state.heading) * prevSpeed, rs.nx, rs.nz);
          const newSpeed = Math.hypot(slid.vx, slid.vz);
          if (typeof onBump === 'function' && prevSpeed > 12 && newSpeed < prevSpeed * 0.5 && (t - lastBumpT) > 5) {
            lastBumpT = t;
            onBump(BUMPS[Math.floor((Math.abs(t * 5.1)) % BUMPS.length)]);
          }
          state.speed = newSpeed;
        }
      }
    }

    // place ship on the swell with bob + roll
    const h = ocean.sampleHeight(state.pos.x, state.pos.z, t);
    ship.position.set(state.pos.x, h, state.pos.z);
    ship.rotation.y = state.heading;
    const hF = ocean.sampleHeight(state.pos.x + Math.sin(state.heading) * 8, state.pos.z + Math.cos(state.heading) * 8, t);
    ship.rotation.x = (hF - h) * 0.03;
    // bank/lean into the turn (#20, visual only): heel with the EASED rudder so the hull rolls
    // into a turn and rights itself smoothly as the helm centres — and lean harder the faster you
    // go (a standing-still pivot barely heels). Cheap (one rotation), no collision/perf impact.
    ship.rotation.z = Math.sin(t * 1.3) * 0.04 + state.rudder * 0.09 * Math.min(1, state.speed / 22);
    if (ship.userData.flag) ship.userData.flag.rotation.z = Math.sin(t * 4) * 0.3;

    // camera follow with orbit offset
    const dist = 95, height = 42;
    const cx = state.pos.x - Math.sin(state.heading + input.camYaw) * dist;
    const cz = state.pos.z - Math.cos(state.heading + input.camYaw) * dist;
    camera.position.lerp(new THREE.Vector3(cx, h + height * (0.4 + input.camPitch), cz), Math.min(1, dt * 3));
    camera.lookAt(state.pos.x, h + 8, state.pos.z);

    // expose maxSpeed on state for downstream systems (wake)
    state.maxSpeed = MAX_SPEED;
  }

  return { state, MAX_SPEED, step, restore, reset };
}
