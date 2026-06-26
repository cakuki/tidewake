import * as THREE from 'three';
import { createOcean } from './ocean.js';
import { createShip } from './ship.js';
import { createWorld } from './world.js';
import { createWake } from './wake.js';
import { targetSpeed, approach, steerRate } from './physics.js';
import { VERSION } from './version.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9ec6d8); // horizon haze — never show void black
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 6000);
camera.position.set(0, 40, -70);

// Lights
const sun = new THREE.DirectionalLight(0xfff2d6, 2.0);
sun.position.set(300, 500, 120);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfe0ee, 0x2e4a40, 0.8));

const world = createWorld(scene);
const ocean = createOcean();
scene.add(ocean.mesh);
const ship = createShip();
scene.add(ship);
const wake = createWake(ocean);
scene.add(wake.points);

// ---- Ship state (simple arcade sailing) ----
const state = {
  heading: 0,        // radians, 0 = +Z
  speed: 0,          // world units / sec
  throttle: 0,       // 0..1 target
  pos: new THREE.Vector3(0, 0, 0),
  windDir: Math.PI * 0.25,
  windName: 'NE breeze',
};
const MAX_SPEED = 55;

// ---- Input ----
const keys = new Set();
addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); });
addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); });

// drag-to-look camera orbit offset
let camYaw = Math.PI, camPitch = 0.32, dragging = false, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  camYaw -= (e.clientX - lastX) * 0.005;
  camPitch = Math.max(0.05, Math.min(0.9, camPitch + (e.clientY - lastY) * 0.003));
  lastX = e.clientX; lastY = e.clientY;
});

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// HUD
const $heading = document.getElementById('heading');
const $speed = document.getElementById('speed');
const $wind = document.getElementById('wind');
document.getElementById('version').textContent = VERSION;
$wind.textContent = state.windName;

const clock = new THREE.Clock();
let booted = false;

function update(dt, t) {
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
  const cx = state.pos.x - Math.sin(state.heading + camYaw) * dist;
  const cz = state.pos.z - Math.cos(state.heading + camYaw) * dist;
  camera.position.lerp(new THREE.Vector3(cx, h + height * (0.4 + camPitch), cz), Math.min(1, dt * 3));
  camera.lookAt(state.pos.x, h + 8, state.pos.z);

  ocean.update(t, camera.position);

  // bow wake + trailing foam (rides the swell, scales with speed)
  state.maxSpeed = MAX_SPEED;
  wake.update(dt, state, t);

  // HUD
  let deg = Math.round((state.heading * 180 / Math.PI) % 360); if (deg < 0) deg += 360;
  $heading.textContent = deg;
  $speed.textContent = (state.speed / MAX_SPEED * 18).toFixed(1);
}

let simT = 0;
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  simT = clock.elapsedTime;
  update(dt, simT);
  renderer.render(scene, camera);
  if (!booted) {
    booted = true;
    const b = document.getElementById('boot');
    b.classList.add('hidden');
    setTimeout(() => b.remove(), 700);
    window.__tidewake.ready = true;
  }
  requestAnimationFrame(loop);
}

// Test/QA hook for headless/browser self-checks. `step` advances the simulation
// deterministically in fixed sub-steps so automated play-tests don't depend on the
// (often throttled) headless frame rate.
window.__tidewake = {
  version: VERSION,
  ready: false,
  get state() { return { heading: state.heading, speed: state.speed, throttle: state.throttle, pos: state.pos.toArray() }; },
  press(k) { keys.add(k); },
  release(k) { keys.delete(k); },
  step(seconds) {
    const fixed = 1 / 60;
    let acc = seconds;
    while (acc > 0) { const dt = Math.min(fixed, acc); simT += dt; update(dt, simT); acc -= dt; }
    return this.state;
  },
  fps: 0,
};

let frames = 0, fpsT = performance.now();
(function fpsMeter() {
  frames++;
  const now = performance.now();
  if (now - fpsT >= 1000) { window.__tidewake.fps = frames; frames = 0; fpsT = now; }
  requestAnimationFrame(fpsMeter);
})();

loop();
