import * as THREE from 'three';
import { createOcean } from './ocean.js';
import { createShip } from './ship.js';
import { createWorld } from './world.js';
import { createWake } from './wake.js';
import { createPorts } from './ports.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createSailing } from './sailing.js';
import { createPersistence } from './persistence.js';
import { VERSION } from './version.js';

// main.js is a thin bootstrap: it builds the renderer/scene/camera/lights, spins up
// the world + game systems (input, sailing, hud, ports, wake, audio, persistence),
// wires the update() + render loop, and exposes the window.__tidewake test hook.
// The per-system logic lives in its own module so future slices touch small files.

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

// World + scene objects
const world = createWorld(scene);
const ocean = createOcean();
scene.add(ocean.mesh);
const ship = createShip();
scene.add(ship);
const wake = createWake(ocean);
scene.add(wake.points);
const ports = createPorts(world);
scene.add(ports.group);

// Game systems
const input = createInput(renderer.domElement);
const hud = createHud();
const sailing = createSailing({ ship, ocean, camera, input });
const state = sailing.state;
const persistence = createPersistence(state);

// Audio: procedural sea ambience + adaptive sailing theme (start on first user gesture).
// The music shares the audio engine's one context + master bus + mute toggle.
const audio = createAudio();
const music = createMusic();
audio.attachMusic(music);
audio.init();

hud.setWind(state.windName);

// Restore a prior voyage before the loop starts. Corrupt/old/missing → fresh start.
const saved = persistence.load();
if (saved) sailing.restore(saved);

// Quiet auto-save: periodically and whenever the tab is hidden or closed.
setInterval(persistence.write, 2000);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistence.write(); });
addEventListener('pagehide', persistence.write);

// 'n' — new voyage: wipe the save and respawn at the origin, dead in the water.
function newVoyage() { persistence.clear(); sailing.reset(); }
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'n') newVoyage(); });

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let booted = false;

function update(dt, t) {
  sailing.step(dt, t);                         // throttle/steer/wind, integrate, place ship, follow camera
  ocean.update(t, camera.position);
  ports.update(state, hud.showArrival, t);     // arrival detection (fires once) + buoy bob
  wake.update(dt, state, t);                   // bow wake + trailing foam
  hud.update(state, sailing.MAX_SPEED);        // heading/speed/wind compass/point-of-sail
  audio.update({ speed: state.speed, maxSpeed: sailing.MAX_SPEED });
  music.update({ speed: state.speed, maxSpeed: sailing.MAX_SPEED });
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
  get ports() { return ports.ports; },
  get docked() { return ports.docked; },
  press(k) { input.keys.add(k); },
  release(k) { input.keys.delete(k); },
  save() { persistence.write(); },
  newVoyage() { newVoyage(); },
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
