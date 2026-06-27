import * as THREE from 'three';
import { dockingUpdate } from './physics.js';
import { initEconomy, market, buy, sell, cargoUsed, HOLD_CAP } from './economy.js';

// Ports give the horizon a destination — the first rung of the "one boat → pirate
// or governor" climb. Each port is *data* ({ name, x, z }) plus a small procedural
// marker (a jetty + a bobbing buoy with a pennant) you can aim for. Sail within the
// docking radius and the harbourmaster greets you. All geometry is three.js
// primitives; the pure proximity/arrival logic lives in physics.js so it unit-tests.

// Docking radius (world units). Generous so sailing "up to" a port reliably arrives.
export const DOCK_RADIUS = 90;

// Original, charming, slightly comedic age-of-sail port names (not from any game).
const PORT_NAMES = ['Saltpurse Quay', 'Barnacle Bottom', "Gullet's Rest"];

// Rotating harbourmaster greetings — warm, witty, adventure-game flavour, original.
// The signature is `{port}` so future reputation/flavour can swap the pool wholesale.
export const HARBOURMASTER_LINES = [
  'Welcome to {port}. Mind the gulls — they file complaints.',
  "Tie her up snug. Last captain who didn't is still chasing his ship downwind.",
  "A sail on the horizon turned into a guest. The grog's watered, the welcome isn't.",
  "Made port at last! The dockhands wagered you'd sink. Pay them no mind, and no coin.",
  "Easy on the jetty — it's older than my jokes and twice as wobbly.",
  "Harbourmaster's the name, paperwork's the game. Sign here, here, and regrettably here.",
];

function harbourmasterLine(portName) {
  const line = HARBOURMASTER_LINES[Math.floor(Math.random() * HARBOURMASTER_LINES.length)];
  return line.replace('{port}', portName);
}

// Build one port marker: a stubby plank jetty reaching out to sea and a buoy with
// a little triangular pennant that bobs. `angle` faces the jetty toward open water
// (the direction the player approaches from).
function buildMarker(angle) {
  const g = new THREE.Group();
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
  const pileMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 1 });
  const buoyMat = new THREE.MeshStandardMaterial({ color: 0xd23b2e, roughness: 0.7 });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xffd98a, roughness: 0.9, side: THREE.DoubleSide });

  // Jetty deck: a low plank reaching seaward.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 1.4, 38), plankMat);
  deck.position.set(0, 1.5, 19);
  g.add(deck);
  // A couple of pilings under it.
  for (const z of [6, 20, 32]) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 8, 6), pileMat);
    pile.position.set(0, -1, z);
    g.add(pile);
  }

  // Buoy at the seaward end + flagpole + pennant — the thing you aim for.
  const buoy = new THREE.Group();
  const float = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), buoyMat);
  float.scale.y = 1.3; float.position.y = 2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 16, 6), pileMat);
  pole.position.y = 10;
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), flagMat);
  pennant.position.set(3.4, 15, 0);
  buoy.add(float, pole, pennant);
  buoy.position.set(0, 0, 44);
  buoy.userData.pennant = pennant;
  g.add(buoy);
  g.userData.buoy = buoy;

  g.rotation.y = angle;
  return g;
}

/**
 * Create ports anchored to existing islands. Picks a few isles and places a port
 * marker at each island's seaward edge (the side facing spawn), with arrival logic.
 * @param {{islands: THREE.Group}} world  the world from createWorld()
 * @returns {{ group: THREE.Group, ports: Array, docked: string|null, update: Function }}
 */
export function createPorts(world) {
  const isles = world.islands.children;
  const group = new THREE.Group();
  const ports = [];

  // Spread ports across a few islands (deterministic pick).
  const picks = [0, 2, 4].filter((i) => i < isles.length).slice(0, PORT_NAMES.length);
  picks.forEach((idx, n) => {
    const isle = isles[idx];
    const r = isle.userData.radius || 70;
    const ip = isle.position;
    // Direction from the island toward spawn/origin: the seaward face.
    const len = Math.hypot(ip.x, ip.z) || 1;
    const dx = -ip.x / len, dz = -ip.z / len;
    // Port point sits just off the island's edge.
    const px = ip.x + dx * (r + 6);
    const pz = ip.z + dz * (r + 6);
    const angle = Math.atan2(dx, dz); // face the jetty out to sea (toward spawn)

    const marker = buildMarker(angle);
    marker.position.set(px, 0, pz);
    group.add(marker);

    ports.push({ name: PORT_NAMES[n], x: px, z: pz, marker });
  });

  let prevDocked = null;
  let exposed = false;

  // A live, QA-friendly snapshot of the trade state — plus deterministic buy/sell
  // helpers the headless playtest can drive (tw.economy.buy('rum', 2), etc.). The
  // helpers operate on the docked port; pass an explicit port to override.
  function economyView(state) {
    initEconomy(state);
    return {
      coins: state.coins,
      cargo: { ...state.cargo },
      used: cargoUsed(state.cargo),
      capacity: HOLD_CAP,
      port: prevDocked,
      market: prevDocked ? market(prevDocked) : null,
      buy: (good, qty = 1, port = prevDocked) => buy(state, good, qty, port),
      sell: (good, qty = 1, port = prevDocked) => sell(state, good, qty, port),
    };
  }

  return {
    group,
    // Public, serialisable list for QA/tests.
    get ports() { return ports.map((p) => ({ name: p.name, pos: [p.x, p.z] })); },
    get docked() { return prevDocked; },
    // The docked port's price board (or null at sea) — fed to the HUD trade panel.
    market() { return prevDocked ? market(prevDocked) : null; },
    /**
     * Advance arrival detection. Calls onArrive(portName, harbourmasterLine) exactly
     * once when the ship first sails into a port's docking radius. Re-arms on leaving.
     * @param {{pos:{x:number,z:number}}} state  ship state (uses state.pos)
     * @param {(name:string, line:string)=>void} onArrive
     * @param {number} t  elapsed seconds (for buoy bob)
     */
    update(state, onArrive, t = 0) {
      initEconomy(state);
      const { dockedName, arrived } = dockingUpdate(prevDocked, state.pos, ports, DOCK_RADIUS);
      prevDocked = dockedName;
      // Trading is only legal while docked: the live `state.port` is the trade target
      // that hud.js reads to render the panel and route key-driven buys/sells.
      state.port = dockedName;
      if (arrived && typeof onArrive === 'function') {
        onArrive(dockedName, harbourmasterLine(dockedName));
      }
      // Expose the economy for QA/playtest once window.__tidewake exists (main.js
      // assigns it after createPorts, so we attach lazily from inside the loop).
      if (!exposed && typeof window !== 'undefined' && window.__tidewake) {
        Object.defineProperty(window.__tidewake, 'economy', {
          configurable: true,
          get() { return economyView(state); },
        });
        exposed = true;
      }
      // gentle buoy bob + pennant flutter
      for (const p of ports) {
        const buoy = p.marker.userData.buoy;
        if (buoy) {
          buoy.position.y = Math.sin(t * 1.6 + p.x) * 0.8;
          if (buoy.userData.pennant) buoy.userData.pennant.rotation.y = Math.sin(t * 5) * 0.4;
        }
      }
    },
  };
}
