import * as THREE from 'three';
import { createOcean } from './ocean.js';
import { createShip } from './ship.js';
import { createWorld } from './world.js';
import { createWake } from './wake.js';
import { createNpcs } from './npc.js';
import { createPorts } from './ports.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createMinimap } from './minimap.js';
import { createSailing } from './sailing.js';
import { createPersistence } from './persistence.js';
import { createDuel } from './duel.js';
import { initEconomy, syncRenown } from './economy.js';
import { VERSION } from './version.js';
import { greetPlayer, dominantPole, titleFor, earnedLegend } from './renown.js';

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
const npcs = createNpcs({ ocean, world, count: 3 });
scene.add(npcs.group);

// Game systems
const input = createInput(renderer.domElement);
const hud = createHud();
const minimap = createMinimap({ world, ports, npcs });
const sailing = createSailing({ ship, ocean, camera, input });
const state = sailing.state;
const persistence = createPersistence(state);

// Insult Broadside (#33): hail a nearby NPC and duel it with wit. Coins + INFAMY on
// a win (#45 — combat is the pirate pole); a small coin setback on a loss. Reward/penalty
// land on the shared state, and renown (the spine) is kept in step.
const duel = createDuel({
  npcs,
  getShipPos: () => [state.pos.x, state.pos.z],
  applyReward: (r) => { initEconomy(state); state.coins += r.coins; state.infamy += r.renown; syncRenown(state); },
  applyPenalty: (p) => { initEconomy(state); state.coins = Math.max(0, state.coins - p.coins); },
  // Procedural audio juice (#48): challenge horn, cut/backfire/glance stings, win/lose
  // flourishes — all routed through the one shared audio bus + mute (declared below).
  sfx: (kind) => audio.playDuelHit(kind),
  onEnd: ({ result, reward, penalty, enemyName }) => {
    if (result === 'win') {
      hud.flashBanner('⚔ They strike their colours!',
        `${enemyName} sails off jeering — but you pocket ${reward.coins}c and ${reward.renown} infamy for the sharper tongue.`);
    } else {
      hud.flashBanner('🏴 Out-jeered!',
        `${enemyName}'s crew howls with laughter. You fumble ${penalty.coins} coins overboard and slink away.`);
    }
  },
});

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
function newVoyage() { duel.cancel(); persistence.clear(); sailing.reset(); }
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'n') newVoyage(); });

// Duel controls: 'f' hails the nearest ship; while dueling, 1–4 fling a jab. (At sea
// the digit keys are free — the trade panel only claims them while docked.)
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'f') { duel.tryChallenge(); return; }
  if (duel.state.active) {
    const m = /^[1-9]$/.exec(e.key);
    if (m) duel.choose(Number(e.key) - 1);
  }
});

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let booted = false;

function update(dt, t) {
  // During an insult duel the ship holds station and sailing input is ignored —
  // the captains are too busy trading barbs to mind the helm.
  if (!duel.state.active) {
    sailing.step(dt, t);                       // throttle/steer/wind, integrate, place ship, follow camera
    npcs.update(dt, t);                        // wandering AI vessels (advances under step())
  }
  ocean.update(t, camera.position);
  ports.update(state, hud.showArrival, t);     // arrival detection (fires once) + buoy bob
  wake.update(dt, state, t);                   // bow wake + trailing foam
  hud.update(state, sailing.MAX_SPEED);        // heading/speed/wind compass/point-of-sail
  checkLegends();                              // endgame payoff: crown a new legend once (#46)
  minimap.update(state);                       // north-up radar: isles/ports/ships (#16)
  hud.renderDuel(duel.snapshot());             // insult-duel panel + "hail" prompt (#33)
  audio.update({ speed: state.speed, maxSpeed: sailing.MAX_SPEED });
  music.update({ speed: state.speed, maxSpeed: sailing.MAX_SPEED });
}

// Endgame legends (#46): each frame, see if the ledger has just crossed the top of a
// committed pole. The first time it does, crown the player THE Terror / THE Governor with
// a one-time celebratory overlay, lock the crown into the save, and sail on (sandbox
// continues — this is a milestone, not a game-over). Earn both, over a voyage, for a true
// Legend of the Tidewake.
function checkLegends() {
  const legends = state.legends || (state.legends = { pirate: false, governor: false });
  const earned = earnedLegend(state.infamy ?? 0, state.standing ?? 0);
  for (const pole of ['pirate', 'governor']) {
    if (earned[pole] && !legends[pole]) {
      legends[pole] = true;
      hud.showLegend(pole, {
        infamy: state.infamy ?? 0,
        standing: state.standing ?? 0,
        renown: state.renown ?? ((state.infamy ?? 0) + (state.standing ?? 0)),
        coins: state.coins ?? 0,
        title: titleFor(state.infamy ?? 0, state.standing ?? 0).title,
        both: legends.pirate && legends.governor,
      });
      persistence.write(); // lock the legend in the moment it's earned
    }
  }
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
  get state() {
    const infamy = state.infamy ?? 0, standing = state.standing ?? 0;
    return {
      heading: state.heading, speed: state.speed, throttle: state.throttle,
      pos: state.pos.toArray(), port: state.port ?? null,
      coins: state.coins ?? 0,
      // Two poles (#45) + their derived total, plus the current pole-aware title.
      infamy, standing, renown: state.renown ?? (infamy + standing),
      title: titleFor(infamy, standing).title,
      pole: dominantPole(infamy, standing),
      // Endgame crowns (#46): which legends this voyage has earned.
      legends: { pirate: !!state.legends?.pirate, governor: !!state.legends?.governor },
    };
  },
  get ports() { return ports.ports; },
  get npcs() { return npcs.snapshot(); },
  get docked() { return ports.docked; },
  // Insult Broadside (#33) QA surface: read the live duel + drive it headlessly.
  get duel() { return duel.snapshot(); },
  challenge() { return duel.tryChallenge(); },
  duelChoose(i) { return duel.choose(i); },
  press(k) { input.keys.add(k); },
  release(k) { input.keys.delete(k); },
  save() { persistence.write(); },
  newVoyage() { newVoyage(); },
  // QA affordances (#43/#45): nudge a pole directly and read the deterministic
  // (first-line) harbourmaster greeting for the captain's current legend + lean.
  setRenown(n) { initEconomy(state); state.standing = Math.max(0, Number(n) || 0); syncRenown(state); return state.renown; },
  setInfamy(n) { initEconomy(state); state.infamy = Math.max(0, Number(n) || 0); syncRenown(state); return state.infamy; },
  setStanding(n) { initEconomy(state); state.standing = Math.max(0, Number(n) || 0); syncRenown(state); return state.standing; },
  greet(renown = state.renown ?? 0, pole = dominantPole(state.infamy, state.standing)) {
    return greetPlayer(renown, ports.docked || ports.ports[0]?.name || 'the port', () => 0, pole);
  },
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
