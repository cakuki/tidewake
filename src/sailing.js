// Sailing — the ship state + per-frame sailing step. Reads input, applies the pure
// physics model (throttle/steer/wind via physics.js), integrates position, places
// the hull on the live swell with bob/roll, and follows with the camera. This is the
// arcade-sailing heart that used to live inline in main.js's update().
import * as THREE from 'three';
import { targetSpeed, approach, steerRate } from './physics.js';

export const MAX_SPEED = 55;

export function createSailing({ ship, ocean, camera, input }) {
  // ---- Ship state (simple arcade sailing) ----
  const state = {
    heading: 0,        // radians, 0 = +Z
    speed: 0,          // world units / sec
    throttle: 0,       // 0..1 target
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
  }

  // Respawn at the origin, dead in the water. Clear economy so initEconomy re-seeds defaults.
  function reset() {
    state.heading = 0; state.speed = 0; state.throttle = 0;
    state.pos.set(0, 0, 0);
    delete state.coins; delete state.cargo;
    delete state.infamy; delete state.standing; delete state.renown;
    delete state.legends; // a new voyage starts legend-less; the crowns are yet to earn
  }

  function step(dt, t) {
    const keys = input.keys;
    // throttle / steer
    if (keys.has('w') || keys.has('arrowup')) state.throttle = Math.min(1, state.throttle + dt * 0.8);
    if (keys.has('s') || keys.has('arrowdown')) state.throttle = Math.max(0, state.throttle - dt * 1.2);
    const steer = (keys.has('a') || keys.has('arrowleft') ? 1 : 0) - (keys.has('d') || keys.has('arrowright') ? 1 : 0);

    // wind modifies achievable speed: sailing with the wind is faster
    const target = targetSpeed(state.throttle, MAX_SPEED, state.heading, state.windDir);
    state.speed = approach(state.speed, target, dt, 1.5);

    // steering scales with speed
    state.heading += steer * dt * steerRate(state.speed);

    // integrate position
    state.pos.x += Math.sin(state.heading) * state.speed * dt;
    state.pos.z += Math.cos(state.heading) * state.speed * dt;

    // place ship on the swell with bob + roll
    const h = ocean.sampleHeight(state.pos.x, state.pos.z, t);
    ship.position.set(state.pos.x, h, state.pos.z);
    ship.rotation.y = state.heading;
    const hF = ocean.sampleHeight(state.pos.x + Math.sin(state.heading) * 8, state.pos.z + Math.cos(state.heading) * 8, t);
    ship.rotation.x = (hF - h) * 0.03;
    ship.rotation.z = Math.sin(t * 1.3) * 0.04 + steer * 0.05;
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
