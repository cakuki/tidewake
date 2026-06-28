import * as THREE from 'three';
import { createOcean } from './ocean.js';
import { loadShip } from './ship-loader.js';
import { createWorld } from './world.js';
import { createWake } from './wake.js';
import { createNpcs } from './npc.js';
import { createPorts, DOCK_RADIUS } from './ports.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createSettings } from './ui/settings.js';
import { createBallad } from './ui/ballad.js';
import { recordEvent } from './voyage-log.js';
import { createDayNight } from './daynight.js';
import { createMinimap } from './minimap.js';
import { createBigMap } from './bigmap.js';
import { createIslandNamer } from './islands.js';
import { createSailing } from './sailing.js';
import { createPersistence } from './persistence.js';
import { createDuel } from './duel.js';
import { createCannons } from './cannons.js';
import { initEconomy, syncRenown } from './economy.js';
import { SHIP_RADIUS, NPC_RADIUS } from './physics.js';
import { VERSION } from './version.js';
import { greetPlayer, dominantPole, titleFor, earnedLegend, rankForRenown, legendBeat } from './renown.js';
import { colourById, nextColours, isDeceptive, npcFlees, DEFAULT_COLOURS, HOIST_LINES, FOOLED_LINES, REVEAL_LINES, pickLine, isSeenThrough, seenThroughChance, LAWFUL_LINES, PIRACY_LINES, SEEN_THROUGH_LINES } from './colours.js';
import { BUDGET, formatPerf, pixelRatioCap } from './perf.js';
import { isTouchDevice } from './input.js';
import { GOAL, applyEvent, shouldShowGoal, normalizeFlags, currentStep } from './onboarding.js';

// main.js is a thin bootstrap: it builds the renderer/scene/camera/lights, spins up
// the world + game systems (input, sailing, hud, ports, wake, audio, persistence),
// wires the update() + render loop, and exposes the window.__tidewake test hook.
// The per-system logic lives in its own module so future slices touch small files.

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
// Heat-aware DPR cap (#63): full 3x retina cooks a phone rendering the per-vertex ocean, so
// coarse-pointer devices get a lower ceiling (#62 spike). Desktop is unchanged at 2x.
const coarsePointer = isTouchDevice();
renderer.setPixelRatio(pixelRatioCap(window.devicePixelRatio, coarsePointer));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbfe8e6); // bright sunny sea-haze — never show void black
const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.5, 6000);
camera.position.set(0, 40, -70);

// Lights — bright tropical day: a warm sun + a brighter sky-blue hemisphere fill so
// the whole scene reads sunlit (pairs with the sunny ocean/sky in world.js + ocean.js).
const sun = new THREE.DirectionalLight(0xfff4de, 2.2);
sun.position.set(300, 500, 120);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xd2effb, 0x3a5a4c, 0.95);
scene.add(hemi);

// World + scene objects
const world = createWorld(scene);
const ocean = createOcean();
scene.add(ocean.mesh);

// Optional day & night cycle (#58) — OFF by default so the permanent sunny Caribbean look
// (#61) stays the default and is restored byte-for-byte when toggled off. When ON, a slow,
// pretty time-of-day arc plays (dawn → noon → golden afternoon → dusk → a soft moonlit
// night). It modulates the sun light, hemisphere fill, scene haze/fog, the sky dome and the
// ocean's sun/sea-tint uniforms — uniform/colour writes only, no new draw calls.
// CREATIVE SPARK: the first time the cycle dips into dusk, the watch sings out a quiet line.
const daynight = createDayNight({
  scene, sun, hemi, ocean, sky: world.sky,
  onDusk: () => { try { hud.flashBanner('🌅 The sun dips toward the yardarm…', 'Golden light spills across the swell — the watch lights the stern lantern.'); } catch { /* a flourish must never break the loop */ } },
});
const ship = await loadShip(); // CC0 glTF sloop (#32); falls back to procedural hull on error
scene.add(ship);
const wake = createWake(ocean);
scene.add(wake.points);
const ports = createPorts(world);
scene.add(ports.group);
// Characterful island names + a one-time comedic landfall line (#19). Pure naming/approach
// logic lives in src/islands.js; here we just fire the beat through the shared HUD toast.
const islandNamer = createIslandNamer({ world });
const npcs = createNpcs({ ocean, world, count: 3 });
scene.add(npcs.group);

// Game systems
// `audio` is declared below; the thunk only runs on a real user gesture (long after module
// init), so the binding is resolved by then — lets a touch-control tap unlock audio directly.
const input = createInput(renderer.domElement, { onGesture: () => audio.unlock() });
const hud = createHud();
const minimap = createMinimap({ world, ports, npcs });
// Bigger route-planning chart (#54): same world data, zoomed way out + ports labelled.
const bigmap = createBigMap({ world, ports, npcs });
const sailing = createSailing({
  ship, ocean, camera, input, world, npcs,
  // Arcade island collision (#76 a1): a hard run-aground earns a comic harbour-banner quip.
  onRunAground: (quip) => hud.flashBanner('⚓ Hard aground!', quip),
  // Arcade ship-vs-ship collision (#76 b): shouldering another vessel earns a comic bump quip.
  onBump: (quip) => hud.flashBanner('🛶 Hulls collide!', quip),
});
const state = sailing.state;
const persistence = createPersistence(state);

// Voyage log (#78): the anecdote factory. Notable systemic deeds — isles raised, rivals
// out-jeered or sunk, crowns earned — are recorded into a small PURE log on the shared
// state; the Ballad panel composes them into a witty, shareable story. logDeed funnels every
// hook through the same pure recorder (dedupe + order + cap), then quietly persists so a
// reload never loses a verse. A flourish must never break the loop, so it's fully guarded.
function logDeed(event) {
  try {
    if (!Array.isArray(state.voyageLog)) state.voyageLog = [];
    const next = recordEvent(state.voyageLog, event);
    if (next !== state.voyageLog) { state.voyageLog = next; persistence.write(); }
  } catch { /* the ballad is a garnish, never a dependency */ }
}

// Insult Broadside (#33): hail a nearby NPC and duel it with wit. Coins + INFAMY on
// a win (#45 — combat is the pirate pole); a small coin setback on a loss. Reward/penalty
// land on the shared state, and renown (the spine) is kept in step.
const duel = createDuel({
  npcs,
  getShipPos: () => [state.pos.x, state.pos.z],
  getColours: () => state.colours, // False Colours (#79): hailing under a disguise = treachery
  // #45/#79/#91: combat is the pirate pole (Infamy); a LAWFUL win (honest colours vs a pirate)
  // also pays the governor pole (Standing) — or fines it for picking on an innocent. Clamped ≥ 0.
  applyReward: (r) => { initEconomy(state); state.coins += r.coins; state.infamy += r.renown; if (r.standing) state.standing = Math.max(0, (state.standing || 0) + r.standing); syncRenown(state); },
  applyPenalty: (p) => { initEconomy(state); state.coins = Math.max(0, state.coins - p.coins); },
  // Procedural audio juice (#48): challenge horn, cut/backfire/glance stings, win/lose
  // flourishes — all routed through the one shared audio bus + mute (declared below).
  sfx: (kind) => audio.playDuelHit(kind),
  onEnd: ({ result, reward, penalty, enemyName }) => {
    if (result === 'win') {
      if (reward.treachery) {
        // The smug last-second reveal — the foe's betrayed splutter (#79 CREATIVE SPARK).
        hud.flashBanner('🏴 The black flag snaps up!',
          `“${pickLine(REVEAL_LINES)}” You out-jeer ${enemyName} for ${reward.coins}c and ${reward.renown} infamy — ${reward.treacheryBonus} of it pure treachery.`);
      } else if (reward.lawful) {
        // Letters of Marque (#91 CREATIVE SPARK): the grateful port nod for a lawful pirate-hunt.
        hud.flashBanner('⚖ A lawful prize!',
          `${pickLine(LAWFUL_LINES)} You out-jeer the outlaw ${enemyName} for ${reward.coins}c and +${reward.standing} standing.`);
      } else if (reward.standing < 0) {
        // Honest colours, innocent target — that's piracy. The wince (#91 CREATIVE SPARK).
        hud.flashBanner('⚖ The ports will tut…',
          `${pickLine(PIRACY_LINES)} You best ${enemyName} for ${reward.coins}c, but lose ${-reward.standing} standing for the bullying.`);
      } else {
        hud.flashBanner('⚔ They strike their colours!',
          `${enemyName} sails off jeering — but you pocket ${reward.coins}c and ${reward.renown} infamy for the sharper tongue.`);
      }
      logDeed({ type: 'duel', foe: enemyName, infamy: reward.renown, coins: reward.coins, treachery: !!reward.treachery, lawful: !!reward.lawful }); // #78/#79/#91
    } else {
      hud.flashBanner('🏴 Out-jeered!',
        `${enemyName}'s crew howls with laughter. You fumble ${penalty.coins} coins overboard and slink away.`);
    }
  },
});

// Cannon Broadside (#59): the duel's teeth-y twin. Run out the guns on a nearby ship
// instead of out-jeering it — so a fight is a genuine CHOICE (talk them down OR open
// fire). Sinking a foe pays the bigger INFAMY (the pirate pole, #45); losing the
// gun-duel costs a few coins for repairs. Reuses the same audio bus as the insult duel.
const cannons = createCannons({
  npcs,
  getShipPos: () => [state.pos.x, state.pos.z],
  getColours: () => state.colours, // False Colours (#79): opening fire under a disguise = ambush
  // #45/#79/#91: sinking pays Infamy; a LAWFUL kill (honest colours vs a pirate) also pays
  // Standing (the governor pole) — or fines it for sinking an innocent merchant. Clamped ≥ 0.
  applyReward: (r) => { initEconomy(state); state.coins += r.coins; state.infamy += r.infamy; if (r.standing) state.standing = Math.max(0, (state.standing || 0) + r.standing); syncRenown(state); },
  applyPenalty: (p) => { initEconomy(state); state.coins = Math.max(0, state.coins - p.coins); },
  sfx: (kind) => audio.playDuelHit(kind),
  onEnd: ({ result, reward, penalty, foeName }) => {
    if (result === 'win') {
      if (reward.treachery) {
        hud.flashBanner('🏴 You strike your true colours!',
          `“${pickLine(REVEAL_LINES)}” ${foeName} goes down betrayed — ${reward.coins}c and ${reward.infamy} infamy, ${reward.treacheryBonus} of it for the perfidy.`);
      } else if (reward.lawful) {
        // Letters of Marque (#91 CREATIVE SPARK): the lawful privateer's prize — ports cheer.
        hud.flashBanner('⚖ Pirate sunk, lawfully!',
          `${pickLine(LAWFUL_LINES)} You haul ${reward.coins}c from the wreck and earn +${reward.standing} standing.`);
      } else if (reward.standing < 0) {
        // Honest colours, innocent target — piracy. The wince (#91 CREATIVE SPARK).
        hud.flashBanner('⚖ That was no pirate…',
          `${pickLine(PIRACY_LINES)} You haul ${reward.coins}c, but lose ${-reward.standing} standing for the deed.`);
      } else {
        hud.flashBanner('🔥 You sink her!',
          `${foeName} slips beneath the waves — you haul ${reward.coins}c from the wreckage and your legend gains ${reward.infamy} infamy.`);
      }
      logDeed({ type: 'cannon', foe: foeName, infamy: reward.infamy, coins: reward.coins, treachery: !!reward.treachery, lawful: !!reward.lawful }); // #78/#79/#91
    } else if (result === 'capture') {
      // She struck her colours (#72): the merciful road — a ransom + lawful Standing, less Infamy.
      hud.flashBanner('🏳️ She strikes her colours!',
        `${foeName} has had enough — you spare the crew and take a ${reward.coins}c ransom: +${reward.standing} standing for the mercy, and ${reward.infamy} infamy for the swagger.`);
      logDeed({ type: 'cannon', foe: foeName, infamy: reward.infamy, coins: reward.coins, captured: true }); // #72
    } else {
      hud.flashBanner('💥 Hull breached!',
        `${foeName} rakes you stem to stern — you break off and limp away, ${penalty.coins} coins lighter for the repairs.`);
    }
  },
});

// Audio: procedural sea ambience + adaptive sailing theme (start on first user gesture).
// The music shares the audio engine's one context + master bus + mute toggle.
// CREATIVE SPARK (#76 follow-up): the very first time the audio unlocks (the first tap — the
// moment iOS finally lets the sea be heard), the shanty band "tunes up" with a one-time quip.
const audio = createAudio({
  onUnlock: () => {
    try {
      if (!audio.isMuted()) hud.flashBanner('🎶 The shanty band tunes up…', 'A scrape of the fiddle, a tap of the boot — and we’re away!');
    } catch { /* a flourish must never break the boot */ }
  },
});
const music = createMusic();
audio.attachMusic(music);
audio.init();

hud.setWind(state.windName);

// Restore a prior voyage before the loop starts. Corrupt/old/missing → fresh start.
const saved = persistence.load();
if (saved) sailing.restore(saved);
// Invisible onboarding (#60): make sure the progress flags always exist. A fresh voyage
// (no save) gets an all-to-do set so the seeded goal greets a brand-new captain; a restored
// voyage keeps whatever it earned (so a returning captain is never re-taught or re-applauded).
state.onboarding = normalizeFlags(state.onboarding);
// Voyage log (#78): a restored voyage keeps its deeds; a fresh one starts with a blank page.
if (!Array.isArray(state.voyageLog)) state.voyageLog = [];

// ---- False Colours (#79) -------------------------------------------------------------
// The displayed flag: true black (honest pirate) vs false merchant (a disguise). A restored
// voyage keeps its choice; a fresh one flies honest black. NPCs react to the colours SHOWN
// (npc.js flee reaction below), and striking under false colours pays a treachery Infamy
// bonus (duel.js/cannons.js). Cycle with the C key or the HUD chip.
if (!colourById(state.colours) || state.colours !== colourById(state.colours).id) state.colours = DEFAULT_COLOURS;

// Tint the player's own pennant to match the colours flown — and hide the cheeky skull
// while disguised. The flag mesh is a Group (ship.js userData.flag) of [pennant, skull].
function applyColoursToShip() {
  try {
    const flag = ship.userData && ship.userData.flag;
    if (!flag || !flag.children) return;
    const def = colourById(state.colours);
    const pennant = flag.children[0], skull = flag.children[1];
    if (pennant && pennant.material) pennant.material.color.setHex(def.flagColor);
    if (skull) skull.visible = !!def.showSkull;
  } catch { /* a flag tint must never break the loop */ }
}

// Track when a fooled NPC has been crept up on under false colours, so the smug "they
// bought it" beat fires once per approach (re-arms when you leave range or drop the disguise).
let fooledArmed = true;
// Seen-through (#91): the disguise gets riskier the more notorious you are. We roll the
// detection ONCE per approach and latch the verdict; if pierced, the vessel reacts to your
// true renown (flees) and the smug "they bought it" beat becomes a "rumbled!" reveal.
let seenThroughLatched = false;
// A small seeded RNG (mulberry32) so the bluff's risk is DETERMINISTIC + reproducible — same
// voyage, same rolls. Reset on a new voyage so a fresh run gets a clean, repeatable sequence.
function makeDetectRng() {
  let a = 0x10 ^ 0x9e3779b9;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let detectRng = makeDetectRng();

// Hoist a new set of colours: cycle, tint the ship, applaud the bluff, and persist the choice.
function cycleColours() {
  state.colours = nextColours(state.colours);
  applyColoursToShip();
  hud.renderColours(state.colours);
  fooledArmed = true; // a fresh disguise can fool the next ship anew
  const def = colourById(state.colours);
  hud.flashBanner(`${def.icon} Colours: ${def.short}`, pickLine(HOIST_LINES[def.id] || HOIST_LINES[DEFAULT_COLOURS]));
  persistence.write();
}
applyColoursToShip();
hud.renderColours(state.colours);
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'c') cycleColours(); });
const $coloursToggle = document.getElementById('colours-toggle');
if ($coloursToggle) $coloursToggle.addEventListener('click', cycleColours);

// Quiet auto-save: periodically and whenever the tab is hidden or closed.
setInterval(persistence.write, 2000);
addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') persistence.write(); });
addEventListener('pagehide', persistence.write);

// 'n' — new voyage: wipe the save and respawn at the origin, dead in the water. A fresh
// voyage also re-arms onboarding — the seeded goal + first-win beats greet the new captain
// again — and drops the ledger baselines so the first deed isn't mistaken for an old one.
function newVoyage() {
  duel.cancel();
  cannons.cancel();
  persistence.clear();
  sailing.reset();
  islandNamer.reset(); // a fresh voyage re-arms the island landfall greetings (#19)
  state.onboarding = normalizeFlags(state.onboarding); // reset() cleared it → fresh set
  state.voyageLog = []; // a new voyage = a blank page; the Ballad starts unwritten (#78)
  state.colours = DEFAULT_COLOURS; // a fresh voyage flies honest black again (#79)
  applyColoursToShip();
  hud.renderColours(state.colours);
  fooledArmed = true;
  seenThroughLatched = false;
  detectRng = makeDetectRng(); // a fresh voyage rolls the bluff's risk from a clean, repeatable seed (#91)
  obsStanding = undefined;
  obsRankIndex = undefined;
}
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'n') newVoyage(); });

// Combat controls — a fight is a CHOICE (#59):
//   'f' HAILS the nearest ship for an Insult Broadside (talk them down); 1–4 fling a jab.
//   'g' OPENS FIRE on the nearest ship with cannons (out-gun them); 1–2 pick where to aim.
// Only one engagement runs at a time. (At sea the digit keys are free — the trade panel
// only claims them while docked.)
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'f') { if (!cannons.state.active) duel.tryChallenge(); return; }
  if (k === 'g') { if (!duel.state.active) cannons.openFire(); return; }
  if (duel.state.active) {
    const m = /^[1-9]$/.exec(e.key);
    if (m) duel.choose(Number(e.key) - 1);
  } else if (cannons.state.active) {
    const m = /^[1-9]$/.exec(e.key);
    if (m) cannons.fire(Number(e.key) - 1);
  }
});

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let booted = false;

// Perf snapshot (#52, measurement-first): deterministic renderer counters (draw calls /
// triangles / geometries / textures / programs) plus fps + ms/frame, refreshed each frame
// and exposed on window.__tidewake.perf. The counters are GPU-independent (identical on
// swiftshader and a real GPU), so they make the reliable CI budget gate; fps/ms are for
// on-device measurement. Cheap: a few field reads, no allocation in the hot path.
const perf = { fps: 0, ms: 0, drawCalls: 0, triangles: 0, geometries: 0, textures: 0, programs: 0 };
const $perf = document.getElementById('perf');
const urlPerf = new URLSearchParams(location.search).has('perf');
let perfOn = urlPerf;
let perfMs = 0; // rolling ms/frame (EMA) so the read-out doesn't jitter
function syncPerfOverlay() { if ($perf) $perf.classList.toggle('show', perfOn); }

// Settings / options panel (#73): the early-phase home for FEATURE TOGGLES. A self-contained
// src/ui/ component (the #53 standard) that owns the ⚙ button + the brass control plate and
// persists stored toggles to localStorage. Two real toggles ship here, each wired to existing
// behaviour so the panel is useful from day one:
//   • Sound — LIVE-backed by audio.js's own mute (its source of truth, already persisted); we
//     read & drive it through here so the mute has ONE home, no double storage.
//   • Spyglass readout (perf overlay) — STORED here (the panel persists it), driving the perf
//     read-out. The overlay's existing P key + tap-to-dismiss now route THROUGH the toggle, so
//     the switch, the key, and the saved choice all stay in lock-step.
// A new toggle registers with ONE line (e.g. weather/day-night #58 next — default OFF so the
// sunny look stays the default). See src/ui/README.md → "Registering a new toggle".
const settings = createSettings();
settings.register({
  id: 'sound', label: 'Sound the shanties', hint: 'sea ambience, gulls & music',
  read: () => !audio.isMuted(), apply: (on) => audio.setMute(!on),
});
settings.register({
  id: 'perf', label: 'Spyglass readout', hint: 'fps · draw calls · triangles', default: urlPerf,
  apply: (on) => { perfOn = on; syncPerfOverlay(); },
});
// Day & night cycle (#58) — STORED, default OFF so the sunny Caribbean look stays the default.
// `apply` flips the cycle on/off; OFF restores the sunny default immediately and exactly.
settings.register({
  id: 'daynight', label: 'Day & night', hint: 'a gentle dawn-to-dusk cycle — sunny by default',
  default: false, apply: (on) => daynight.setEnabled(on),
});
settings.init(); // builds the panel, wires the O / Esc keys, applies the saved/default toggles

// The Ballad of Your Voyage (#78): a self-contained src/ui/ component (the #53 standard) that
// owns the 📜 button + the parchment scroll. It reads the live voyage log and composes it into
// a witty, shareable ballad, with a copy-to-clipboard share. Opens with 📜 or the B key.
const ballad = createBallad({ getEvents: () => state.voyageLog || [] });
ballad.init();

function setPerf(on) { settings.setOption('perf', on); } // one source of truth for the overlay
// Toggle the overlay: 'P' on desktop; tap the read-out to dismiss; ?perf boots it shown. All
// route through the toggle so the panel switch + persistence track the overlay.
addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'p') setPerf(!perfOn); });
if ($perf) $perf.addEventListener('click', () => setPerf(false));

// Route-planning map (#54): Tab toggles the big chart, Esc closes it; the 🗺 button does
// the same for touch / mouse. Tab is otherwise unused at sea, so we preventDefault to stop
// it shuffling focus. A liveness reflect on the button keeps its pressed-state in sync.
const $mapToggle = document.getElementById('map-toggle');
function syncMapToggle() {
  if ($mapToggle) { $mapToggle.classList.toggle('on', bigmap.open); $mapToggle.setAttribute('aria-pressed', String(bigmap.open)); }
}
addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); bigmap.toggle(); syncMapToggle(); }
  else if (e.key === 'Escape' && bigmap.open) { bigmap.close(); syncMapToggle(); }
});
if ($mapToggle) $mapToggle.addEventListener('click', () => { bigmap.toggle(); syncMapToggle(); });
// Click the dimmed backdrop (not the chart itself) to dismiss.
const $mapOverlay = document.getElementById('bigmap-overlay');
if ($mapOverlay) $mapOverlay.addEventListener('click', (e) => {
  if (e.target === $mapOverlay) { bigmap.close(); syncMapToggle(); }
});

function updatePerf(frameMs) {
  const info = renderer.info;
  perfMs = perfMs ? perfMs * 0.9 + frameMs * 0.1 : frameMs;
  perf.fps = window.__tidewake?.fps ?? 0;
  perf.ms = perfMs;
  perf.drawCalls = info.render.calls;
  perf.triangles = info.render.triangles;
  perf.geometries = info.memory.geometries;
  perf.textures = info.memory.textures;
  perf.programs = info.programs ? info.programs.length : 0;
  if (perfOn && $perf) $perf.textContent = formatPerf(perf);
}

// CREATIVE SPARK (#76 c) charm pools — short, daft, on-tone. Rotated by the beat counters so a
// long session never hears the same line twice in a row.
const FIGHT_REEF_LINES = [
  'Sails reefed, the ship squares up — the crew cracks their knuckles.',
  'Way comes off her; the helm goes quiet. Time to settle this.',
  'The Tidewake heaves to and glares across the waves. En garde.',
];
const BERTH_LINES = [
  'Way off, fenders out — she glides the last few yards to the planks.',
  'The bosun calls the slow-down; the hull coasts gently toward the berth.',
  'Easing in — the dock creaks a welcome as the ship drifts alongside.',
];
let wasFighting = false, wasHarbourSettling = false, fightBeat = 0, berthBeat = 0;

function update(dt, t) {
  // Slow-to-stop for harbour & combat (#76 c): the ship is no longer teleport-frozen for a
  // fight or a berth — it EASES to a near-stop. sailing.step always runs; a settle reason eases
  // the target speed smoothly toward ~0 (combat) or coasts it down as the hull nears a port
  // (harbouring), all via approach(). Helm input is ignored during a fight (crew's at the guns).
  const fighting = duel.state.active || cannons.state.active;
  let harbourDistance = Infinity;              // distance to the nearest port point (for the coast-in)
  for (const p of ports.ports) {
    const d = Math.hypot(state.pos.x - p.pos[0], state.pos.z - p.pos[1]);
    if (d < harbourDistance) harbourDistance = d;
  }
  sailing.step(dt, t, { fighting, harbourDistance, harbourRadius: DOCK_RADIUS });
  if (!fighting) {
    // False Colours (#79) + Seen-through (#91): NPCs react to the colours SHOWN. Fly your true
    // black flag while feared and nearby vessels scatter; fly false merchant colours and they
    // stay calm — UNLESS, at high Infamy, the disguise is rumbled on approach (then they read
    // your true renown and flee anyway). The disposition + risk math is pure (colours.js).
    let seenThrough = false;
    if (isDeceptive(state.colours)) {
      if (duel.inRange()) {
        // First frame in range this approach: roll the bluff's risk ONCE and latch it, then fire
        // the matching beat — the smug "they bought it" (#79), or the "rumbled!" reveal (#91).
        if (fooledArmed) {
          fooledArmed = false;
          seenThroughLatched = isSeenThrough(state.infamy ?? 0, state.colours, detectRng);
          if (seenThroughLatched) hud.flashBanner('🕵 Rumbled!', pickLine(SEEN_THROUGH_LINES));
          else hud.flashBanner('🏳 They wave you in…', pickLine(FOOLED_LINES));
        }
        seenThrough = seenThroughLatched;
      } else {
        fooledArmed = true;       // out of range → the next approach re-rolls the risk
        seenThroughLatched = false;
      }
    }
    const flee = npcFlees({ colours: state.colours, infamy: state.infamy ?? 0, seenThrough });
    npcs.update(dt, t, { playerPos: [state.pos.x, state.pos.z], flee });
  }

  // CREATIVE SPARK (#76 c): one light arcade beat as the ship squares up for a fight or coasts
  // into a berth — transition-guarded so it never spams, rotated so it never gets stale.
  if (fighting && !wasFighting) hud.flashBanner('⚔ Battle stations!', FIGHT_REEF_LINES[fightBeat++ % FIGHT_REEF_LINES.length]);
  wasFighting = fighting;
  const harbourSettling = !fighting && state.settling;
  if (harbourSettling && !wasHarbourSettling) hud.flashBanner('⚓ Easing into the berth…', BERTH_LINES[berthBeat++ % BERTH_LINES.length]);
  wasHarbourSettling = harbourSettling;

  ocean.update(t, camera.position);
  daynight.update(dt);                          // optional day-night cycle (#58): no-op while OFF
  ports.update(state, onArrive, t);            // arrival detection (fires once) + buoy bob
  islandNamer.update(state.pos, onApproachIsland); // name + flavour the first time you near an isle (#19)
  wake.update(dt, state, t);                   // bow wake + trailing foam
  hud.update(state, sailing.MAX_SPEED);        // heading/speed/wind compass/point-of-sail
  checkLegends();                              // endgame payoff: crown a new legend once (#46)
  checkOnboarding();                           // invisible onboarding: goal nudge + first-win beats (#60)
  minimap.update(state);                       // north-up radar: isles/ports/ships (#16)
  bigmap.update(state);                         // route-planning chart (only redraws while open) (#54)
  hud.renderDuel(duel.snapshot());             // insult-duel panel + "hail/fire" prompt (#33)
  hud.renderCannons(cannons.snapshot());       // cannon-broadside panel (#59)
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
      logDeed({ type: 'legend', pole, title: legendBeat(pole)?.title }); // crown the Ballad (#78)
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

// ---- Invisible onboarding (#60) -------------------------------------------------------
// A light-touch first-session teacher: a seeded goal nudge for a brand-new captain, plus a
// few first-win beats that fire ONCE EVER. The decision logic is pure (onboarding.js); this
// is just the wiring that watches the world for the events and routes applause to the HUD.
// The flags live on the shared state and persist in the save, so a returning captain — or a
// captain who reloads mid-session — never sees the nudge or a beat twice.
// Arrival handler: the harbourmaster's greeting toast, plus the first-dock onboarding beat.
// On a captain's very first port the celebratory beat lands last (overwrites the greeting),
// turning "you arrived" into a taught first-win; every later arrival is the normal greeting.
function onArrive(portName, line) {
  hud.showArrival(portName, line);
  fireOnboarding('dock');
}

// Island landfall (#19): the first time you sail close to a named isle this session, the
// lookout sings out its name + a daft flavour line on the shared toast. Once-only per isle
// (the namer owns the "already introduced" guard), so it never spams.
function onApproachIsland(name, flavour) {
  try { hud.flashBanner(`🏝️ Landfall: ${name}`, flavour); }
  catch { /* a flourish must never break the loop */ }
  logDeed({ type: 'landfall', name }); // record the discovery for the Ballad (#78)
}

function fireOnboarding(event) {
  const { beat, flags, changed } = applyEvent(state.onboarding, event);
  if (!changed) return;
  state.onboarding = flags;
  if (beat) hud.flashBanner(beat.title, beat.line);
  persistence.write(); // lock the milestone the instant it's reached
}

// Detect the first profitable trade and the first rank climbed by watching the ledger move.
// Selling is the only thing that grows STANDING, so a standing bump == a sale (coin earned);
// any rise in rung == a rank-up. Baselines adopt silently on the first observed frame so a
// restored voyage never mistakes its starting numbers for a fresh achievement.
let obsStanding, obsRankIndex;
function checkOnboarding() {
  const standing = state.standing ?? 0;
  if (obsStanding !== undefined && standing > obsStanding) fireOnboarding('profit');
  obsStanding = standing;

  const rankIndex = rankForRenown(state.renown ?? 0).index;
  if (obsRankIndex !== undefined && rankIndex > obsRankIndex) fireOnboarding('rank');
  obsRankIndex = rankIndex;

  // The seeded goal card: shown until the captain acts (their first dock clears it).
  if (shouldShowGoal(state.onboarding)) hud.showGoal(GOAL); else hud.hideGoal();
}

let simT = 0;
let qaCamera = null; // lazily-built top-down inspection camera (#65 visual DoD)
function loop() {
  const dt = Math.min(clock.getDelta(), 0.05);
  simT = clock.elapsedTime;
  update(dt, simT);
  // QA visual-DoD override (#65): when a top-down inspection camera is requested, render
  // the live scene straight down on the ship so a screenshot can verify no sea shows
  // inside the hull and nothing pokes past the gunwale. Sim/state are untouched.
  let renderCam = camera;
  const qa = window.__tidewake?._qaCam;
  if (qa) {
    if (!qaCamera) qaCamera = new THREE.PerspectiveCamera(45, camera.aspect, 0.5, 6000);
    qaCamera.aspect = camera.aspect;
    // `back` (default 0 = straight down) pulls the camera astern for a high-oblique deck
    // view that clears the mainsail; height is the elevation above the ship.
    const back = qa.back ?? 0;
    qaCamera.position.set(ship.position.x, ship.position.y + qa.height, ship.position.z - back);
    qaCamera.lookAt(ship.position.x, ship.position.y + 2, ship.position.z);
    qaCamera.updateProjectionMatrix();
    renderCam = qaCamera;
  }
  renderer.render(scene, renderCam);
  updatePerf(dt * 1000);       // refresh the deterministic perf snapshot (#52)
  if (!booted) {
    booted = true;
    // The custom ocean ShaderMaterial only compiles when first drawn. Now that one frame
    // has rendered, check it linked (strict mobile GPUs can fail it) and, if not, drop to a
    // flat-but-coloured fallback sea so the player never sees an empty teal void (iOS bug).
    ocean.verifyShader(renderer);
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
      rudder: state.rudder ?? 0, // eased helm (#20): observable for QA / future input polish
      pos: state.pos.toArray(), port: state.port ?? null,
      // Slow-to-stop (#76 c): true while the ship is easing to a near-stop for a fight or a
      // harbour approach — the playtest asserts speed drops near a port / at fight start.
      settling: !!state.settling,
      coins: state.coins ?? 0,
      // Two poles (#45) + their derived total, plus the current pole-aware title.
      infamy, standing, renown: state.renown ?? (infamy + standing),
      title: titleFor(infamy, standing).title,
      pole: dominantPole(infamy, standing),
      // Endgame crowns (#46): which legends this voyage has earned.
      legends: { pirate: !!state.legends?.pirate, governor: !!state.legends?.governor },
    };
  },
  // Deterministic perf snapshot (#52): draw calls / triangles / geometries / textures /
  // programs from renderer.info, plus fps + rolling ms/frame. The counters gate CI; the
  // budget ceilings travel with it so tooling can self-check without re-deriving them.
  get perf() { return { ...perf }; },
  get perfBudget() { return { ...BUDGET }; },
  get ports() { return ports.ports; },
  // Settings/options panel (#73) QA surface: read every toggle's effective value, flip one by
  // id (drives the wired behaviour + persists stored toggles), and open/close the panel.
  get options() { return settings.options; },
  setOption(id, on) { return settings.setOption(id, on); },
  get settingsOpen() { return settings.isOpen; },
  openSettings() { settings.open(); return settings.isOpen; },
  closeSettings() { settings.close(); return settings.isOpen; },
  // The Ballad of Your Voyage (#78) QA surface: read the live deed log + the composed ballad
  // text, drive the panel open/closed, and exercise the copy-to-clipboard share headlessly.
  get voyageLog() { return Array.isArray(state.voyageLog) ? state.voyageLog.slice() : []; },
  get ballad() { return ballad.ballad().text; },
  get balladOpen() { return ballad.isOpen; },
  openBallad() { ballad.open(); return ballad.isOpen; },
  closeBallad() { ballad.close(); return ballad.isOpen; },
  copyBallad() { return ballad.copy(); },
  // Day-night cycle (#58) QA surface: whether it's running, the current phase, and the live
  // sun direction — so the headless playtest can flip the toggle and assert the sun/colour
  // state changes, then flip OFF and assert the sunny default restores. setDayPhase jumps the
  // clock (e.g. to golden hour) for a deterministic shot.
  get daynight() {
    return {
      enabled: daynight.enabled,
      phase: daynight.phase,
      sun: [sun.position.x, sun.position.y, sun.position.z],
      sunIntensity: sun.intensity,
      haze: scene.background.getHex(),
    };
  },
  setDayPhase(t) { daynight.phase = t; return daynight.phase; },
  // Route-planning chart (#54) QA surface: read its open-state + drive the toggle headlessly.
  get bigmap() { return { open: bigmap.open }; },
  mapToggle() { bigmap.toggle(); syncMapToggle(); return bigmap.open; },
  get npcs() { return npcs.snapshot(); },
  // Ship-vs-ship collision (#76 b) QA surface: the forgiving hull radii so a headless playtest
  // can drive the player into an NPC and assert the hulls don't interpenetrate (bound = sum).
  get collisionRadii() { return { ship: SHIP_RADIUS, npc: NPC_RADIUS, bound: SHIP_RADIUS + NPC_RADIUS }; },
  // Island collision (#76 a1) QA surface: the flat {x,z,r} circles the hull collides against,
  // so a headless playtest can drive the ship at the coast and assert it doesn't pass through.
  // Now also carries each isle's characterful name + flavour (#19).
  get islands() { return islandNamer.list; },
  // Island naming (#19) QA surface: which isles have already greeted you this session, and the
  // nearest isle (with its name + distance) — so a playtest can sail in and assert the beat fired.
  get islandsIntroduced() { return islandNamer.introduced; },
  get nearestIsland() { return islandNamer.nearestIsland(state.pos); },
  get docked() { return ports.docked; },
  // Invisible onboarding (#60) QA surface: the live progress flags, the next step, and
  // whether the seeded goal card is currently on screen.
  get onboarding() {
    const flags = normalizeFlags(state.onboarding);
    return { flags, step: currentStep(flags), goalVisible: shouldShowGoal(flags) };
  },
  // Insult Broadside (#33) QA surface: read the live duel + drive it headlessly.
  get duel() { return duel.snapshot(); },
  challenge() { return duel.tryChallenge(); },
  duelChoose(i) { return duel.choose(i); },
  // Cannon Broadside (#59) QA surface: read the live cannonade + drive it headlessly.
  // openFire() runs out the guns on the nearest ship; cannonFire(aim) fires one volley
  // (aim = 0 broadside / 1 chain, or the aim name).
  get cannons() { return cannons.snapshot(); },
  openFire() { return cannons.openFire(); },
  cannonFire(aim) { return cannons.fire(aim); },
  // False Colours (#79) QA surface: read the colours flown, whether they're a disguise, the
  // pure NPC flee verdict for the current colours+infamy, plus drive the flag headlessly.
  get colours() {
    return {
      id: state.colours,
      short: colourById(state.colours).short,
      deceptive: isDeceptive(state.colours),
      flee: npcFlees({ colours: state.colours, infamy: state.infamy ?? 0 }),
      // Seen-through (#91): the latched detection verdict for the current approach + the pure
      // probability the disguise is pierced at the current infamy (0 honest / low, rises, capped).
      seenThrough: seenThroughLatched,
      seenThroughChance: seenThroughChance(state.infamy ?? 0, state.colours),
    };
  },
  cycleColours() { cycleColours(); return state.colours; },
  setColours(id) { if (colourById(id).id === id) { state.colours = id; applyColoursToShip(); hud.renderColours(state.colours); fooledArmed = true; persistence.write(); } return state.colours; },
  press(k) { input.keys.add(k); },
  release(k) { input.keys.delete(k); },
  // QA visual-DoD camera (#65): force a top-down inspection view over the ship (and back).
  _qaCam: null,
  qaTopDown(height = 70, back = 0) { this._qaCam = { height, back }; return true; },
  qaFollow() { this._qaCam = null; return true; },
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
