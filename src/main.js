import * as THREE from 'three';
import { createOcean } from './ocean.js';
import { loadShip } from './ship-loader.js';
import { createWorld } from './world.js';
import { createWake } from './wake.js';
import { createNpcs } from './npc.js';
import { createFauna } from './fauna.js';
import { createPorts, DOCK_RADIUS } from './ports.js';
import { loadProps } from './props.js';
import { createAudio } from './audio.js';
import { createMusic } from './music.js';
import { townMusicIdentity } from './town-theme.js';
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
import { createModeManager, SAILING, TOWN, BATTLE } from './mode.js';
import { createTown } from './ui/town.js';
import { shouldEnterTown, harbourAssistActive, nextLeftHarbour, seawardHeading } from './systems/harbour.js';
import { createLandfall, mooredSwellScale } from './systems/landfall.js';
import { reputationLean, leanPole, gradeHaze, gradeSun, gradeSunKey } from './systems/reputation-grade.js';
import { snapshotAshore, composeAshoreDigest } from './systems/ashore-digest.js';
import { mixHex } from './sea-color.js';
import { initEconomy, syncRenown } from './economy.js';
import { SHIP_RADIUS, NPC_RADIUS } from './physics.js';
import { VERSION } from './version.js';
import { greetPlayer, dominantPole, titleFor, earnedLegend, rankForRenown, legendBeat, renownTier } from './renown.js';
import { recallLine, rememberArrival, sanitizePortMemory, recordDeed, deedPhrase, homePort } from './systems/port-memory.js';
import {
  sanitizeHarbour, claim as claimHome, invest as investHome, canClaim, canInvest, harbourLevelName,
} from './systems/home-port.js';
import { makeObjective, resolvesAt, payoffFor, sanitizeObjective } from './objectives.js';
import { createEncounter, HAIL_LINES, RESCUE_LINES, PLUNDER_LINES } from './systems/encounter.js';
import { colourById, nextColours, isDeceptive, npcFlees, DEFAULT_COLOURS, HOIST_LINES, FOOLED_LINES, REVEAL_LINES, pickLine, isSeenThrough, seenThroughChance, LAWFUL_LINES, PIRACY_LINES, SEEN_THROUGH_LINES } from './colours.js';
import { BUDGET, formatPerf, pixelRatioCap, isMeasuredFrame } from './perf.js';
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
// Foundering-ship encounter (#125): reuse the hero hull for the stricken vessel — its OWN GLB
// instance (independent materials, so the player's False-Colours pennant tint never leaks onto it).
// Hidden until an encounter is live; heeled over + settled low each frame so she reads foundering.
// Only one at a time and only shown when near, so she costs ~1 draw call exactly when on screen.
const founderMesh = await loadShip();
try { if (founderMesh.userData && founderMesh.userData.flag) founderMesh.userData.flag.visible = false; } catch { /* flag is optional dressing */ }
founderMesh.visible = false;
scene.add(founderMesh);
const wake = createWake(ocean);
scene.add(wake.points);
const ports = createPorts(world);
scene.add(ports.group);
// CC0 Pirate Kit world dressing (#101): dress each port as a working harbour — barrels & crates
// as dock cargo, palms framing the jetty foot — loaded like the #32 hull (GLTFLoader, graceful
// fallback). Repeated props are InstancedMesh'd (one draw per type per port) and each cluster is
// distance-culled wholesale, so a furnished world stays nearly free. Updated in update() so the
// dressing pops in as you raise a port and vanishes again out at sea.
const props = await loadProps({ ports: ports.portPlacements });
scene.add(props.group);
// Characterful island names + a one-time comedic landfall line (#19). Pure naming/approach
// logic lives in src/islands.js; here we just fire the beat through the shared HUD toast.
const islandNamer = createIslandNamer({ world });
const npcs = createNpcs({ ocean, world, count: 3 });
scene.add(npcs.group);
// Living sea fauna (#97): a small instanced flock of gulls that keeps the ship company —
// wheeling overhead at sea, drifting to hang over the shore as you raise an island. One
// InstancedMesh (one draw call), hidden wholesale beyond the cull radius, so the sky lives
// for almost nothing. Ticked every frame in update() so it carries on while the helm pauses.
const fauna = createFauna({ world });
scene.add(fauna.group);

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

// The port remembers your DEEDS (#104b): a notable thing done at/near a port is banked into that
// port's memory as a SPECIFIC phrase, recalled BY NAME next time you make landfall there ("they've
// not forgotten the day you sent the Black Gull to the seabed in these waters"). Combat happens at
// sea, so the deed is attributed to the NEAREST port — its waters, its memory. Fully guarded: a
// flourish must never break the loop.
function rememberPortDeed(event) {
  try {
    const phrase = deedPhrase(event);
    if (!phrase) return;
    const port = ports.nearestPortName(state.pos);
    if (!port) return;
    state.portMemory = recordDeed(state.portMemory, port, phrase);
    persistence.write(); // lock the memory the instant the deed is done (like a legend beat)
  } catch { /* the port's memory is a flourish, never a dependency */ }
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
      const duelDeed = { type: 'duel', foe: enemyName, infamy: reward.renown, coins: reward.coins, treachery: !!reward.treachery, lawful: !!reward.lawful };
      logDeed(duelDeed);            // #78/#79/#91
      rememberPortDeed(duelDeed);   // #104b — the nearest port recalls it by name on your return
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
      const cannonDeed = { type: 'cannon', foe: foeName, infamy: reward.infamy, coins: reward.coins, treachery: !!reward.treachery, lawful: !!reward.lawful };
      logDeed(cannonDeed);            // #78/#79/#91
      rememberPortDeed(cannonDeed);   // #104b — the nearest port's waters remember the sinking
    } else if (result === 'capture') {
      // She struck her colours (#72): the merciful road — a ransom + lawful Standing, less Infamy.
      hud.flashBanner('🏳️ She strikes her colours!',
        `${foeName} has had enough — you spare the crew and take a ${reward.coins}c ransom: +${reward.standing} standing for the mercy, and ${reward.infamy} infamy for the swagger.`);
      const captureDeed = { type: 'cannon', foe: foeName, infamy: reward.infamy, coins: reward.coins, captured: true };
      logDeed(captureDeed); // #72
      rememberPortDeed(captureDeed); // #104b — the nearest port remembers the mercy you showed
    } else {
      hud.flashBanner('💥 Hull breached!',
        `${foeName} rakes you stem to stern — you break off and limp away, ${penalty.coins} coins lighter for the repairs.`);
    }
  },
});

// Emergent at-sea encounter (#125, DL#4): while sailing the open sea you occasionally come upon a
// foundering ship and face a real CHOICE — RESCUE her crew (the lawful road → Standing, a grateful
// line) or PLUNDER the wreck (the dark road → Infamy + coin, a colder line). One systemic moral beat
// turns SAILING — our most-used but least-reactive mode — into a story generator (the #79/#72 DNA).
// The pure cadence + choice→pole resolution live in src/systems/encounter.js; here we seed the RNG
// (deterministic per voyage), apply the reward on the shared ledger, and sing it into the Ballad (#78).
function makeEncounterRng() {
  let a = 0x125 ^ 0x9e3779b9;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let encounterRng = makeEncounterRng();
const encounter = createEncounter({
  getShipPos: () => [state.pos.x, state.pos.z],
  getShipHeading: () => state.heading,
  rng: () => encounterRng(),                // a fresh voyage re-seeds this for a repeatable sequence
  onSpawn: ({ name }) => {
    try { hud.flashBanner('🆘 A ship in distress!', `${pickLine(HAIL_LINES)} (${name})`); }
    catch { /* a flourish must never break the loop */ }
  },
  // The CHOICE resolves to the right pole + reward + a Ballad verse, then the wreck despawns cleanly.
  onResolve: ({ choice, name, standing, infamy, coins }) => {
    initEconomy(state);
    if (choice === 'rescue') {
      state.standing = Math.max(0, (state.standing || 0) + standing); // the governor pole (#45)
      syncRenown(state);
      hud.flashBanner('🕊 A mercy at sea', `${pickLine(RESCUE_LINES)} (+${standing} standing)`);
      logDeed({ type: 'encounter', choice: 'rescue', ship: name, standing }); // #78
    } else {
      state.coins += coins;
      state.infamy += infamy;                                                 // the pirate pole (#45)
      syncRenown(state);
      hud.flashBanner('🏴 You take the spoils', `${pickLine(PLUNDER_LINES)} (+${coins}c · +${infamy} infamy)`);
      logDeed({ type: 'encounter', choice: 'plunder', ship: name, infamy, coins }); // #78
    }
    persistence.write(); // lock the deed + reward the instant the choice is made
  },
});

// Mode system (#95): the explicit world-state machine — SAILING (helm yours, world sails) ↔
// TOWN / BATTLE (helm paused, world keeps living). The pure machine lives in src/mode.js; here
// we only drive it (BATTLE from combat, below in update()) and surface it. It is the shared
// seam town mode (#67/#96), battle mode (#100) and mode-aware sound (#94) all plug into — the
// current mode becomes their `context.mode`. A mode change rings the ship's bell beat once.
// "While you were ashore…" digest (#105): snapshot the delta-able world-state the instant town
// takes the screen, so Set Sail can read back what your time ashore amounted to. `lastAshoreDigest`
// keeps the most recent composed digest for the QA hook.
let ashoreSnapshot = null;
let lastAshoreDigest = null;
const mode = createModeManager({
  onChange: (to, from) => {
    try {
      // Landfall gesture (#102): a mode change isn't a snap — it's a crafted, eased moment. Entering
      // TOWN begins the "making port" gesture (camera eases to a moored framing, the light warms,
      // the town view takes the screen only once we're truly ashore); leaving it runs the mirror.
      if (to === TOWN) { ashoreSnapshot = snapshotAshore(state); landfall.land(); music.stinger(); hud.flashBanner('🏘️ Making port…', 'The helm goes quiet — the ship glides to her moorings as the light turns gold.'); } // a "made port" stinger lands on the next downbeat (#102 ph2)
      else if (from === TOWN) landfall.leave(); // Set Sail: the town falls astern, the open light returns
      // BATTLE keeps its own "Battle stations!" beat below; SAILING's return is signalled by control resuming.
    } catch { /* a flourish must never break the loop */ }
  },
});
// The crafted SAILING↔TOWN transition (#102). Pure controller in src/systems/landfall.js; the
// camera ease + warm "golden harbour" grade are applied off its `blend` in update(), and the town
// view opens only once `townReady`. Deterministic + headless-safe (advanced on the sim's dt).
const landfall = createLandfall();

// Warm "golden harbour" grade (#102): as the gesture eases in, the sea-haze warms and the sun lifts
// toward a low golden glow — the light of arriving in port. The pre-gesture look is captured on the
// first warmed frame and restored EXACTLY the instant we're fully back under sail, so it never
// fights the day-night cycle (#58) and leaves no residue. Colour/uniform writes only — no new draws.
let gradeBase = null;
const WARM_HAZE = 0xf2d6a8, WARM_SUN = 0xffd89a;
function applyLandfallGrade() {
  const b = landfall.blend;
  const oceanHaze = ocean?.uniforms?.uHaze?.value;       // sea-haze toward the horizon (#58 mutates it too)
  const oceanGraded = oceanHaze && !ocean.fellBack;       // flat-fallback sea has no uniforms
  const skyBottom = world?.sky?.bottom?.value;            // the sky dome's horizon band
  if (b > 0) {
    if (!gradeBase) gradeBase = {
      haze: scene.background.getHex(),
      fog: scene.fog ? scene.fog.color.getHex() : null,
      sunColor: sun.color.getHex(),
      sunIntensity: sun.intensity,
      oceanHaze: oceanGraded ? oceanHaze.getHex() : null,
      skyBottom: skyBottom ? skyBottom.getHex() : null,
    };
    scene.background.setHex(mixHex(gradeBase.haze, WARM_HAZE, b));
    if (scene.fog && gradeBase.fog != null) scene.fog.color.setHex(mixHex(gradeBase.fog, WARM_HAZE, b));
    sun.color.setHex(mixHex(gradeBase.sunColor, WARM_SUN, b));
    sun.intensity = gradeBase.sunIntensity * (1 + 0.18 * b); // a gentle exposure lift toward the gold
    if (oceanGraded && gradeBase.oceanHaze != null) oceanHaze.setHex(mixHex(gradeBase.oceanHaze, WARM_HAZE, b * 0.85));
    if (skyBottom && gradeBase.skyBottom != null) skyBottom.setHex(mixHex(gradeBase.skyBottom, WARM_HAZE, b * 0.8));
  } else if (gradeBase) {
    scene.background.setHex(gradeBase.haze);
    if (scene.fog && gradeBase.fog != null) scene.fog.color.setHex(gradeBase.fog);
    sun.color.setHex(gradeBase.sunColor);
    sun.intensity = gradeBase.sunIntensity;
    if (oceanGraded && gradeBase.oceanHaze != null) oceanHaze.setHex(gradeBase.oceanHaze);
    if (skyBottom && gradeBase.skyBottom != null) skyBottom.setHex(gradeBase.skyBottom);
    gradeBase = null; // forget it: fully back under sail
  }
}

// Reputation-reactive world grade (#126, DL #4): the look reflects WHO YOU ARE BECOMING. The whole
// spine is the Infamy↔Standing pole — this eases the live scene grade (sea-haze / fog / sun / sky
// horizon) toward your dominant pole: infamous → colder, stormier, lower-key; lawful → warmer,
// golden; balanced → today's sunny default, untouched. PURE mapping in src/systems/reputation-grade.js.
//
// COMPOSITION (the contract's CRITICAL note): this runs AFTER daynight.update (which rewrites the
// base palette each frame) and BEFORE applyLandfallGrade (which warms over the top). So it eases
// FROM the live day-night base when the cycle owns the look, else from the captured sunny default —
// never compounding (it re-sources its base every frame), never leaking (neutral restores the
// default), and never fighting #58 or #102. Colour/uniform writes only — no new draws.
let repGradeDefaults = null; // the un-graded sunny base, captured once (mirrors daynight's own capture)
let repTinted = false;       // is a reputation tint currently laid on the live scene?
let repLean = 0;             // the live signed lean (QA surface)
function applyReputationGrade() {
  const lean = reputationLean(state.infamy ?? 0, state.standing ?? 0);
  repLean = lean;
  const oceanHaze = ocean?.uniforms?.uHaze?.value;       // sea-haze toward the horizon (#58 mutates it too)
  const oceanGraded = oceanHaze && !ocean.fellBack;       // flat-fallback sea has no uniforms
  const skyBottom = world?.sky?.bottom?.value;            // the sky dome's horizon band
  if (!repGradeDefaults) repGradeDefaults = {
    haze: scene.background.getHex(),
    fog: scene.fog ? scene.fog.color.getHex() : null,
    sunColor: sun.color.getHex(),
    sunIntensity: sun.intensity,
    oceanHaze: oceanGraded ? oceanHaze.getHex() : null,
    skyBottom: skyBottom ? skyBottom.getHex() : null,
  };
  if (lean === 0) {
    // Neutral = the sunny default. If a tint lingers and day-night isn't the one owning the base,
    // restore the default exactly so nothing leaks; under day-night the cycle already rewrote it.
    if (repTinted && !daynight.enabled) {
      scene.background.setHex(repGradeDefaults.haze);
      if (scene.fog && repGradeDefaults.fog != null) scene.fog.color.setHex(repGradeDefaults.fog);
      sun.color.setHex(repGradeDefaults.sunColor);
      sun.intensity = repGradeDefaults.sunIntensity;
      if (oceanGraded && repGradeDefaults.oceanHaze != null) oceanHaze.setHex(repGradeDefaults.oceanHaze);
      if (skyBottom && repGradeDefaults.skyBottom != null) skyBottom.setHex(repGradeDefaults.skyBottom);
    }
    repTinted = false;
    return;
  }
  // Ease FROM the clean base: day-night's live palette when the cycle owns the look (it just wrote
  // it this frame), else the captured sunny default (re-sourced each frame, so it never compounds).
  const base = daynight.enabled
    ? {
        haze: scene.background.getHex(),
        fog: scene.fog ? scene.fog.color.getHex() : null,
        sunColor: sun.color.getHex(),
        sunIntensity: sun.intensity,
        oceanHaze: oceanGraded ? oceanHaze.getHex() : null,
        skyBottom: skyBottom ? skyBottom.getHex() : null,
      }
    : repGradeDefaults;
  scene.background.setHex(gradeHaze(base.haze, lean));
  if (scene.fog && base.fog != null) scene.fog.color.setHex(gradeHaze(base.fog, lean));
  sun.color.setHex(gradeSun(base.sunColor, lean));
  sun.intensity = base.sunIntensity * gradeSunKey(lean);
  if (oceanGraded && base.oceanHaze != null) oceanHaze.setHex(gradeHaze(base.oceanHaze, lean * 0.85));
  if (skyBottom && base.skyBottom != null) skyBottom.setHex(gradeHaze(base.skyBottom, lean * 0.8));
  repTinted = true;
}

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
// Per-port memory (#104): a restored voyage keeps what each town remembers of it; a fresh one
// starts with a clean slate (no port knows your face yet). Sanitised so a junk save fails open.
state.portMemory = sanitizePortMemory(state.portMemory);
// Chased-rumour objective (#111/#112/#115): a restored voyage keeps the pin it was steering
// toward; a fresh one starts unpinned. Sanitised so a junk/stale objective fails open to null.
state.objective = sanitizeObjective(state.objective);
// Claimed home harbour (#118): a restored voyage keeps the home port it claimed + its growth tier;
// a fresh one starts with none. Sanitised so a junk save fails open to null (no home claimed).
state.harbour = sanitizeHarbour(state.harbour);

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
  encounterRng = makeEncounterRng();   // a fresh voyage re-rolls the encounter cadence from a clean seed (#125)
  encounter.reset();                   // ...and meets no founderer mid-flight
  founderMesh.visible = false;
  mode.reset(); // a fresh voyage always starts under sail — deterministic (#95/#106)
  landfall.reset(); // ...and with no landfall gesture mid-flight (#102)
  leftHarbour = false; // a fresh voyage re-arms auto-harbour from a clean slate (#67)
  themePort = null;    // re-key the tavern drone to wherever the fresh voyage starts (#69)
  persistence.clear();
  sailing.reset();
  islandNamer.reset(); // a fresh voyage re-arms the island landfall greetings (#19)
  state.onboarding = normalizeFlags(state.onboarding); // reset() cleared it → fresh set
  state.voyageLog = []; // a new voyage = a blank page; the Ballad starts unwritten (#78)
  state.portMemory = {}; // a clean slate — no port remembers your face yet (#104)
  state.portRecall = null; // ...and no remembered-return greeting in flight
  state.harbour = null; // ...and no home port claimed yet (#118 "Your Harbour")
  state.objective = null; // a fresh voyage chases nothing yet — the chart starts unpinned (#111/#112)
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
  // Foundering-ship choice (#125): while a founderer is alongside, 1 RESCUES, 2 PLUNDERS. The
  // encounter claims the keys and blocks hailing/firing so the moral beat isn't stepped on.
  if (encounter.state.active) {
    if (e.key === '1') encounter.choose('rescue');
    else if (e.key === '2') encounter.choose('plunder');
    return;
  }
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

// Town / market mode (#96): the new TOWN view you auto-harbour into (#67). A self-contained
// src/ui component (the #53 standard) that paints the docked port's market and the single
// "⚓ Set Sail" plank. It reads the live ship state for the market board and the purse; its
// Leave control routes back through leaveHarbour() below — the one obvious, reversible way out.
const town = createTown({
  getState: () => state,
  onLeave: () => leaveHarbour(),
  onChase: (target) => chaseObjective(target),
  onClaim: () => claimHarbour(),
  onInvest: () => investHarbour(),
});
town.init();

// ---- Your Harbour (#118, DL #4) — the governor pole's first reactive verb -------------------
// At your docked port: CLAIM it as your home harbour (at sufficient Standing), then SPEND coin to
// GROW it a level at a time. The pure gate/grow logic lives in src/systems/home-port.js; here we
// just apply the result to the shared state (Standing + coin + the harbour record), sing it into
// the Ballad (#78), and persist. Fully guarded — a flourish must never break the loop.
function claimHarbour() {
  try {
    initEconomy(state);
    const port = state.port;
    const res = claimHome({ harbour: state.harbour, port, standing: state.standing ?? 0 });
    if (!res.ok) return res;
    state.harbour = res.harbour;
    state.standing = Math.max(0, (state.standing ?? 0) + (res.standingGain || 0));
    syncRenown(state);
    logDeed({ type: 'harbour', deed: 'claim', port, level: res.harbour.level }); // crown the Ballad (#78)
    persistence.write();                 // lock the claim the instant it's made
    hud.flashBanner('⚓ A home port claimed',
      `${port} is yours now, captain — your colours over the quay, and +${res.standingGain} standing for putting down roots.`);
    town.render();
    return res;
  } catch { return { ok: false, reason: 'error' }; }
}
function investHarbour() {
  try {
    initEconomy(state);
    const port = state.port;
    const res = investHome({ harbour: state.harbour, port, coins: state.coins ?? 0 });
    if (!res.ok) return res;
    state.coins = Math.max(0, (state.coins ?? 0) - res.spent);
    state.harbour = res.harbour;
    state.standing = Math.max(0, (state.standing ?? 0) + (res.standingGain || 0));
    syncRenown(state);
    logDeed({ type: 'harbour', deed: 'grow', port, level: res.level }); // sing the growth (#78)
    persistence.write();                 // lock the investment the instant it's made
    hud.flashBanner('⚒ Your harbour grows',
      `You sink ${res.spent}c into ${port} — now ${harbourLevelName(res.level)}, and +${res.standingGain} standing for the prospering.`);
    town.render();
    return res;
  } catch { return { ok: false, reason: 'error' }; }
}

// ---- Chased-rumour objectives (#111/#112/#115) --------------------------------------------
// A tavern rumour you choose to chase becomes a tracked sea-objective: a marker on the chart
// (minimap/bigmap read state.objective) you steer toward, and an arrival PAYOFF when you make
// the named port. The typed model + lifecycle is pure (src/objectives.js); here we just enrich
// the target with the port's live coords (for the marker heading), bank it on the shared state,
// and persist so a reload keeps the pin. logic + payoff stay deterministic + QA-exposed.
const RUMOUR_CHASE_LINES = [
  'You note the heading and steer for it — the chart now carries a pin to chase.',
  'Word taken to heart: the bow swings toward the tip, and a marker marks the spot.',
  'A wink to the old soak in the corner — you set a course for the rumour and pin the chart.',
];
function chaseObjective(target) {
  try {
    if (!target || target.kind !== 'port') return null;
    const info = ports.portInfo(target.name);            // resolve the named port's live coords
    const enriched = info ? { ...target, x: info.x, z: info.z } : { ...target };
    const obj = makeObjective(enriched);
    if (!obj) return null;
    state.objective = obj;
    persistence.write();                                 // lock the chase the instant it's taken
    hud.flashBanner(`⚑ Chasing word to ${target.name}`, pickLine(RUMOUR_CHASE_LINES));
    return obj;
  } catch { return null; } // a flourish must never break the loop
}

// ---- Auto-harbour / Leave Harbour (#67 + #96) ----------------------------------------------
// Making landfall is EDGE-triggered off arrival (onArrive, below): sail into a port's dock
// radius under sail and the world settles into TOWN mode — the helm pauses, the town takes the
// screen, other vessels sail on (the #95 seam). Leaving is the deliberate mirror, and it must
// never strand you: the owner-flagged trap is that docking re-arms on proximity, so we raise the
// `leftHarbour` latch on the way out — it suspends the harbour slow-to-stop assist (so the
// seaward nudge can actually carry the hull out) and drops once we've cleared the harbour mouth.
let leftHarbour = false;
// Per-town music identity (#69): the nearest port whose musical identity the tavern drone is
// currently keyed to. We re-key only when this CHANGES (debounce) so re-tuning is a rare, smooth
// crossfade, not a per-frame thrash — a town always sounds like itself, the instant you near it.
let themePort = null;
let bodyTown = false; // cached so we only touch the <body> class on a real change
function leaveHarbour() {
  if (!mode.is(TOWN)) return false;
  const docked = ports.docked;
  // "While you were ashore…" digest (#105): compose the in-character recap from the landfall→now
  // deltas BEFORE we cast off, so leaving town reads back what the visit amounted to (a fuller
  // purse, a name that travels, a heading to chase) — making the living-world promise legible.
  let digest = null;
  try { if (ashoreSnapshot) digest = composeAshoreDigest(ashoreSnapshot, snapshotAshore(state), { port: docked || 'the port' }); }
  catch { digest = null; } // a flourish must never break the loop
  lastAshoreDigest = digest;
  ashoreSnapshot = null;
  mode.leave();                       // back under sail — the helm is yours again
  leftHarbour = true;                 // suspend the harbour assist until we clear the mouth
  state.throttle = Math.max(state.throttle, 0.7); // re-enable way: a firm push off the berth
  const info = ports.portInfo(docked);
  state.heading = seawardHeading(info && info.angle, state.heading); // point the bow at open water
  try {
    if (digest) hud.flashBanner(digest.title, digest.lines.join(' · '));
    else hud.flashBanner('⛵ Making sail…', 'You cast off — the town falls astern and the open sea opens up ahead.');
  } catch { /* a flourish must never break the loop */ }
  return true;
}

// The landfall gesture is SKIPPABLE (#102): an impatient captain can press Enter/Space — or tap —
// during the ease to jump straight ashore (or straight out). Never steals input when nothing's
// in flight, so it can't swallow a keystroke at sea. Pointer skip ignores the town panel's own
// controls (Set Sail etc.) so a tap there still does its job.
function skipLandfall() { return landfall.active ? landfall.skip() : false; }
addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && landfall.active) skipLandfall(); });
addEventListener('pointerdown', (e) => { if (landfall.active && !(e.target && e.target.closest && e.target.closest('#town'))) skipLandfall(); });

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
  // Latch the scene-cost counters only from a REAL measured frame (#107 perf-flake guard): a
  // throttled/empty headless paint reports 0 draws, which is not a measurement — keep the last
  // good reading so a stray 0-frame can never clobber it down and flake the gate. Always keep
  // memory/program counts fresh (they're valid even on an empty frame).
  if (isMeasuredFrame(info.render)) {
    perf.drawCalls = info.render.calls;
    perf.triangles = info.render.triangles;
  }
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
  // Mode system (#95): drive the explicit world-state machine from combat — a live duel or
  // cannonade IS the BATTLE mode; ending it returns the helm to SAILING. (TOWN is entered
  // deliberately via its own seam — tw.enterMode — pending the town-scene slice #67/#96.) The
  // mode is the single source of truth for "is the player's helm paused?", replacing the old
  // implicit `duel.active || cannons.active` gate with zero behaviour change for a fight.
  const fighting = duel.state.active || cannons.state.active;
  if (fighting) { if (!mode.is(BATTLE)) mode.enter(BATTLE); }
  else if (mode.is(BATTLE)) mode.leave();
  const paused = mode.playerPaused; // true in TOWN/BATTLE: helm pauses, world keeps living
  landfall.step(dt); // advance the SAILING↔TOWN gesture on the sim's dt (deterministic, headless-safe) (#102)

  // Slow-to-stop for harbour & combat (#76 c): the ship is no longer teleport-frozen for a
  // fight or a berth — it EASES to a near-stop. sailing.step always runs; a paused helm (fight
  // or town) eases the target speed smoothly toward ~0, or it coasts down as the hull nears a
  // port (harbouring), all via approach(). Helm input is ignored while paused (crew's elsewhere).
  let harbourDistance = Infinity;              // distance to the nearest port point (for the coast-in)
  // The slow-to-stop assist coasts you IN — but stands down while leaving (the leftHarbour
  // latch), so the seaward nudge can carry the hull out instead of being braked at the berth (#67).
  if (harbourAssistActive(leftHarbour)) {
    for (const p of ports.ports) {
      const d = Math.hypot(state.pos.x - p.pos[0], state.pos.z - p.pos[1]);
      if (d < harbourDistance) harbourDistance = d;
    }
  }
  sailing.step(dt, t, { fighting: paused, harbourDistance, harbourRadius: DOCK_RADIUS });

  // Landfall camera ease (#102): sailing.step just set the open-water chase framing; as the gesture
  // eases in, slide the camera toward a closer, lower, 3/4 "ashore" framing of the moored ship — so
  // making port FEELS like coasting to your berth, not a teleport. blend 0 = untouched chase cam.
  const lfBlend = landfall.blend;
  if (lfBlend > 0) {
    const hy = ship.position.y;
    const ax = state.pos.x - Math.sin(state.heading + 0.55) * 40; // pulled in beside the bow, 3/4 on
    const az = state.pos.z - Math.cos(state.heading + 0.55) * 40;
    camera.position.lerp(new THREE.Vector3(ax, hy + 16, az), lfBlend); // mix(chase, ashore, blend)
    camera.lookAt(state.pos.x, hy + 8 - 3 * lfBlend, state.pos.z);      // settle the gaze onto the deck
  }

  // The world keeps living (#95): other vessels sail on EVERY frame — even while the player is
  // paused for a fight or making port — so the world never snap-freezes around you. Only the
  // disguise-disposition beats (which assume you're free to creep up on a mark) stay gated to a
  // free helm. False Colours (#79) + Seen-through (#91): NPCs react to the colours SHOWN — fly
  // your true black while feared and they scatter; fly false merchant colours and they stay calm
  // unless, at high Infamy, the bluff is rumbled on approach. The risk math is pure (colours.js).
  let seenThrough = false;
  if (!paused && isDeceptive(state.colours)) {
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

  // Emergent at-sea encounter (#125): drive the seeded spawn cadence off distance SAILED — only
  // while the helm is yours and under sail (no spawning mid-fight or in town). When a founderer is
  // live, settle her low in the water and heel her over so she reads stricken; hide her otherwise
  // (one mesh, shown only when near → ~1 draw call exactly when on screen).
  encounter.update(dt, { canSpawn: !paused });
  if (encounter.state.active && encounter.state.ship) {
    const fx = encounter.state.ship.x, fz = encounter.state.ship.z;
    const fy = ocean.sampleHeight(fx, fz, t);
    founderMesh.position.set(fx, fy - 0.8, fz);                 // settled low — taking on water
    const heel = 0.34 + Math.sin(t * 0.8) * 0.05;              // a sick, heaving list to one side
    founderMesh.rotation.set(Math.sin(t * 1.1) * 0.06, encounter.state.bearing, heel);
    if (!founderMesh.visible) founderMesh.visible = true;
  } else if (founderMesh.visible) {
    founderMesh.visible = false;
  }

  // CREATIVE SPARK (#76 c): one light arcade beat as the ship squares up for a fight or coasts
  // into a berth — transition-guarded so it never spams, rotated so it never gets stale.
  if (fighting && !wasFighting) hud.flashBanner('⚔ Battle stations!', FIGHT_REEF_LINES[fightBeat++ % FIGHT_REEF_LINES.length]);
  wasFighting = fighting;
  const harbourSettling = !paused && state.settling;
  if (harbourSettling && !wasHarbourSettling) hud.flashBanner('⚓ Easing into the berth…', BERTH_LINES[berthBeat++ % BERTH_LINES.length]);
  wasHarbourSettling = harbourSettling;

  // Glassy "moored" swell settle (#102 ph2): as the landfall gesture eases in, the whole sea's
  // swell amplitude lerps toward a calm, glassy "moored" value (and back to full life on Set Sail)
  // — the paused helm = still water, a reactive verb. Drives the GPU shader + CPU sampler together
  // so the moored ship rides exactly the swell it draws. blend 0 = untouched open-water swell.
  ocean.setSwellScale(mooredSwellScale(landfall.blend));
  ocean.update(t, camera.position);
  daynight.update(dt);                          // optional day-night cycle (#58): no-op while OFF
  applyReputationGrade();                        // reputation-reactive world cast (#126): over #58, under #102
  applyLandfallGrade();                         // warm "golden harbour" glow over the gesture (#102)
  ports.update(state, onArrive, t);            // arrival detection (fires once → auto-harbour) + buoy bob
  // Auto-harbour bookkeeping (#67/#96): drop the leave-latch once we've cleared the harbour mouth
  // (so a later approach harbours cleanly again), and keep the TOWN view + the at-sea-control
  // hiding (#66) in lock-step with the mode. town.js caches its own renders, so this is cheap.
  leftHarbour = nextLeftHarbour(leftHarbour, { docked: ports.docked, leaving: false });
  // The town view takes the screen only once the landfall gesture is fully ASHORE (#102) — so the
  // eased camera/grade play out in the open first, then the town opens; on Set Sail it closes at
  // once (townReady drops the instant we leave) and the reverse gesture eases us back to sea.
  const showTown = mode.is(TOWN) && landfall.townReady;
  town.setOpen(showTown);
  if (showTown !== bodyTown) { bodyTown = showTown; if (document.body) document.body.classList.toggle('town', showTown); }
  islandNamer.update(state.pos, onApproachIsland); // name + flavour the first time you near an isle (#19)
  wake.update(dt, state, t);                   // bow wake + trailing foam
  fauna.update(dt, t, { shipPos: [state.pos.x, state.pos.z], focus: camera.position }); // gull flock (#97): wheels with you, hugs the coast, culled off-stage
  props.update([state.pos.x, state.pos.z]);    // port dressing (#101): show the nearest dressed harbour, cull the rest
  hud.update(state, sailing.MAX_SPEED);        // heading/speed/wind compass/point-of-sail
  checkLegends();                              // endgame payoff: crown a new legend once (#46)
  checkOnboarding();                           // invisible onboarding: goal nudge + first-win beats (#60)
  minimap.update(state);                       // north-up radar: isles/ports/ships (#16)
  bigmap.update(state);                         // route-planning chart (only redraws while open) (#54)
  hud.renderDuel(duel.snapshot());             // insult-duel panel + "hail/fire" prompt (#33)
  hud.renderCannons(cannons.snapshot());       // cannon-broadside panel (#59)
  hud.renderEncounter(encounter.snapshot());   // foundering-ship rescue/plunder choice panel (#125)
  audio.update({ speed: state.speed, maxSpeed: sailing.MAX_SPEED });
  // Per-town music identity (#69): re-key the tavern drone to the nearest harbour, only on a change
  // (debounced) so the port layer already sounds like that town as it swells in on approach — and
  // making landfall somewhere new FEELS new. Deterministic per port name; headless-safe (no-op
  // until the audio engine is up). TEMPO stays fixed this slice (transposition-first, TL call).
  const nearPort = ports.nearestPortName(state.pos);
  if (nearPort && nearPort !== themePort) {
    themePort = nearPort;
    music.setTownTheme(townMusicIdentity(nearPort));
  }
  // Mode-aware sound (#94): hand the music director WHERE the player is — the mode (#95) plus the
  // nearest-port distance from the harbour loop above — so the bed crossfades into a port's tavern
  // layer on approach (the #67 audible cue), settles for BATTLE, and is the open-sea bed at sail.
  music.update({
    speed: state.speed,
    maxSpeed: sailing.MAX_SPEED,
    mode: mode.current,
    portDistance: harbourDistance,
    dockRadius: DOCK_RADIUS,
  });
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
  // The port remembers you (#104): RECALL the port's prior memory of you FIRST (so it reflects who
  // you were last time, not this arrival), then BANK this visit into the persistent store. A return
  // leads with the remembered-return greeting — warmer for a regular, cooler if you've turned pirate
  // since — over the generic tier greeting; a true first visit keeps the stranger's welcome.
  let recall = null;
  try {
    const current = { tier: renownTier(state.renown ?? 0).tier, pole: dominantPole(state.infamy, state.standing) };
    const prior = state.portMemory?.[portName]; // who this port knew you as LAST time (deed + tone)
    state.portMemory = rememberArrival(state.portMemory, portName, current); // bank this visit first…
    // …then read the home flag off the up-to-date store (this visit may have just made it home).
    const home = homePort(state.portMemory) === portName; // #104b "Your Harbour" seed
    recall = recallLine(prior, current, portName, { home }); // null on a true first visit
    state.portRecall = recall ? { port: portName, line: recall } : null; // surfaced in the town greeting
    persistence.write(); // lock the visit the instant it's made (like a legend/onboarding beat)
  } catch { /* the port's memory is a flourish, never a dependency — never break landfall */ }
  hud.showArrival(portName, recall || line);
  // Chased-rumour payoff (#112): if this is the port you were chasing, the tip pays off — a
  // modest deterministic coin bounty, a warm acknowledgement, and a Ballad verse — then the pin
  // clears. Guarded so a flourish never breaks landfall; resolvesAt prevents a double-pay.
  try {
    if (resolvesAt(state.objective, portName)) {
      const { coins } = payoffFor(state.objective);
      initEconomy(state);
      state.coins += coins;
      const rumourDeed = { type: 'rumour', name: portName, coins };
      logDeed(rumourDeed);                                 // sing it into the Ballad (#78)
      state.portMemory = recordDeed(state.portMemory, portName, deedPhrase(rumourDeed)); // #104b — this port remembers the tip paying off
      state.objective = null;                              // the chase is done — clear the pin
      persistence.write();
      hud.flashBanner('⚑ The rumour paid off!',
        `Word ran true at ${portName} — a grateful contact slips you ${coins} coins for chasing the tip.`);
    }
  } catch { /* the payoff is a garnish, never a dependency */ }
  fireOnboarding('dock');
  // Auto-harbour (#67/#96): the fresh arrival edge makes landfall into TOWN mode — once per
  // visit, only while under sail (the pure guard lives in src/systems/harbour.js). The mode's
  // onChange rings the "Making port…" beat; town.js takes the screen on the next render.
  if (shouldEnterTown({ mode: mode.current, arrived: true })) mode.enter(TOWN);
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
  // Reputation-reactive world grade (#126, DL #4) QA surface: the live signed lean off the
  // Infamy↔Standing pole (>0 pirate / <0 governor / 0 neutral), its categorical pole, whether a
  // tint is currently laid on the scene, and the live graded haze — so a headless playtest can
  // drive the ledger (setInfamy/setStanding) and assert the world's cast shifts cold vs warm and
  // restores to the sunny default at neutral. Deterministic; reads the same uniforms #58/#102 touch.
  get grade() {
    return {
      lean: repLean,
      pole: leanPole(repLean),
      tinted: repTinted,
      haze: scene.background.getHex(),
      sunIntensity: sun.intensity,
    };
  },
  // Route-planning chart (#54) QA surface: read its open-state + drive the toggle headlessly.
  get bigmap() { return { open: bigmap.open }; },
  mapToggle() { bigmap.toggle(); syncMapToggle(); return bigmap.open; },
  // Mode system (#95) QA surface: the current world-state, and the deliberate enter/leave seam
  // (drives town/battle plumbing). BATTLE is normally driven by combat; TOWN is entered here
  // until the town-scene slice (#67/#96) owns it. enter/leave return true if the mode changed.
  get mode() { return mode.current; },
  enterMode(m) { return mode.enter(m); },
  leaveMode() { return mode.leave(); },
  // Town / market mode (#67/#96) QA surface: whether the town view is open + which port it's
  // showing, and the deliberate Leave Harbour seam (re-enables the helm + nudges the bow
  // seaward). Auto-harbour itself is driven by sailing into a port's dock radius (onArrive).
  get town() { return { open: town.isOpen, port: town.port, leftHarbour, atHome: town.atHome }; },
  leaveHarbour() { return leaveHarbour(); },
  // The port remembers you (#104) QA surface: the persistent per-port memory store (visit count +
  // your standing snapshot as seen locally) and the live remembered-return greeting (null on a
  // first visit) — so a headless playtest can land, sail off, return, and assert the town reacts.
  get portMemory() { return sanitizePortMemory(state.portMemory); },
  get portRecall() { return state.portRecall || null; },
  // #104b "Your Harbour" seed: the captain's most-visited port, once it's recognisably theirs (null
  // until one clears the home threshold) — so a playtest can assert a frequented port becomes home.
  get homePort() { return homePort(state.portMemory); },
  // Your Harbour (#118, DL #4) QA surface: the CLAIMED home harbour record ({name, level, invested}
  // or null), plus the deliberate claim/invest seams — so a headless playtest can dock at a port,
  // claim it (at sufficient Standing), invest coin to grow a level, and assert Standing/level/coin
  // move and survive a save round-trip. The verbs return the pure result {ok, reason?, ...}.
  get harbour() { return sanitizeHarbour(state.harbour); },
  get harbourCanClaim() { return canClaim({ harbour: state.harbour, port: state.port, standing: state.standing ?? 0 }); },
  get harbourCanInvest() { return canInvest({ harbour: state.harbour, port: state.port, coins: state.coins ?? 0 }); },
  claimHarbour() { return claimHarbour(); },
  investHarbour() { return investHarbour(); },
  // Landfall gesture (#102) QA surface: the crafted SAILING↔TOWN transition's live phase + eased
  // blend (0=at sea, 1=ashore) + whether it's in flight, plus the headless skip driver — so a
  // playtest can assert the moment EASES (not snaps), is deterministic, and is skippable.
  get landfall() { return { phase: landfall.phase, blend: landfall.blend, active: landfall.active, townReady: landfall.townReady, swellScale: ocean.swellScale }; },
  // "While you were ashore…" digest (#105) QA surface: the live landfall snapshot (the delta-able
  // world-state captured when town took the screen, or null at sea) + the last digest composed on
  // Set Sail (title + lines, or null) — so a headless playtest can land, trade, sail off, and assert
  // the digest reads back the REAL deltas deterministically. Compose stays pure in ashore-digest.js.
  get ashore() { return { snapshot: ashoreSnapshot, digest: lastAshoreDigest }; },
  // Drifting whitecaps (#70) QA surface: the foam tuning + the live crest-foam factor sampled
  // at the ship on the SAME swell it rides (lock-step with #102). A headless playtest sails a
  // few seconds and asserts the sunny sea grows foam on its crests somewhere along the way.
  get sea() {
    return {
      swellScale: ocean.swellScale,
      foam: ocean.foam,
      whitecapHere: ocean.whitecapAt ? ocean.whitecapAt(state.pos.x, state.pos.z, simT) : 0,
    };
  },
  whitecapAt(x, z, t) { return ocean.whitecapAt ? ocean.whitecapAt(x, z, t ?? simT) : 0; },
  skipLandfall() { return skipLandfall(); },
  // Tavern "listen for word" (#103) QA surface: whether word is showing + the live rumours,
  // and a deterministic driver so a headless playtest can listen and assert the room speaks.
  get tavern() { return { open: town.isOpen, listening: town.listening, rumours: town.rumours, targets: town.rumourTargets }; },
  tavernListen() { return town.listen(); },
  // Chased-rumour objective (#111/#112/#115) QA surface: the live active objective (typed target +
  // payoff, or null), plus drivers so a headless playtest can take a rumour to chase and assert
  // the marker pins, the save round-trips, and arriving pays off. chaseRumour(i) chases the i-th
  // listed rumour (the first chase-able one if i is omitted); chaseTarget sets one directly.
  get objective() { return state.objective || null; },
  chaseRumour(i) {
    if (Number.isFinite(i)) return town.chase(i);
    const targets = town.rumourTargets;
    const idx = targets.findIndex((t) => t && t.kind === 'port');
    return idx >= 0 ? town.chase(idx) : null;
  },
  chaseTarget(target) { return chaseObjective(target); },
  get npcs() { return npcs.snapshot(); },
  // Living sea fauna (#97) QA surface: the gull flock's count, whether it's drawn (distance
  // cull), whether it's roosting over a coast, and the live flock centre — so a headless
  // playtest can assert the sky is alive and tracks the player.
  get fauna() { return fauna.snapshot(); },
  // CC0 Pirate Kit port dressing (#101) QA surface: how many props were placed, how many are
  // currently drawn (distance cull), and how many port clusters exist — so a headless playtest
  // can assert the harbours are furnished and that far clusters are culled to nothing.
  get props() { return props.snapshot(); },
  // QA teleport: drop the hull at a world XZ (e.g. just off a port) so a gallery shot can frame
  // a dressed harbour without sailing there. Sim/state otherwise untouched.
  qaTeleport(x, z) { state.pos.x = x; state.pos.z = z; return [state.pos.x, state.pos.z]; },
  // Ship-vs-ship collision (#76 b) QA surface: the forgiving hull radii so a headless playtest
  // can drive the player into an NPC and assert the hulls don't interpenetrate (bound = sum).
  get collisionRadii() { return { ship: SHIP_RADIUS, npc: NPC_RADIUS, bound: SHIP_RADIUS + NPC_RADIUS }; },
  // Island collision (#76 a1) QA surface: the flat {x,z,r} circles the hull collides against,
  // so a headless playtest can drive the ship at the coast and assert it doesn't pass through.
  // Now also carries each isle's characterful name + flavour (#19).
  get islands() { return islandNamer.list; },
  // Islands TLC (#71) QA surface: the per-isle deterministic LOOK — squash, tall/peak, sand-tone
  // offset and the instanced dressing counts (rocks/palms/driftwood/tufts) — so a headless
  // playtest can assert each isle is varied + dressed and that the look is stable across reloads.
  get islandStyles() { return Array.isArray(world.styles) ? world.styles : []; },
  // Island naming (#19) QA surface: which isles have already greeted you this session, and the
  // nearest isle (with its name + distance) — so a playtest can sail in and assert the beat fired.
  get islandsIntroduced() { return islandNamer.introduced; },
  get nearestIsland() { return islandNamer.nearestIsland(state.pos); },
  get docked() { return ports.docked; },
  // Per-town music identity (#69) QA surface: which port the tavern drone is currently keyed to and
  // its full deterministic identity (key/mode/tint/tremolo/chord), plus a pure lookup for ANY port —
  // so a headless playtest can sail between harbours and assert each town sounds like itself, that
  // the identity is stable across reloads, and that distinct towns get distinct musical characters.
  get townMusic() {
    const port = themePort || ports.docked || null;
    return { port, identity: port ? townMusicIdentity(port) : null };
  },
  townMusicFor(name) { return townMusicIdentity(name); },
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
  // Foundering-ship encounter (#125) QA surface: read the live encounter (the founderer + the
  // choice/reward, or inactive), force a deterministic spawn (the spawn hook the contract asks
  // for), and make the choice headlessly. encounterChoose('rescue'|'plunder') resolves it.
  get encounter() { return encounter.snapshot(); },
  encounterSpawn() { return encounter.forceSpawn(); },
  encounterChoose(choice) { return encounter.choose(choice); },
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
  // Ship's-wheel touch steering (#93) QA surface: the analog steer axis the on-screen helm
  // feeds, its visual rotation (radians), and whether it's being dragged — plus a headless
  // driver that rotates the wheel to an angle and returns the resulting steer, so the playtest
  // can prove a rotated wheel turns the ship without a real touch device. centreWheel() springs
  // the helm back amidships (the self-centring release).
  get wheel() {
    const w = input.wheel;
    return { steer: input.steerAxis ?? 0, angle: w ? w.angle : 0, active: !!(w && w.active) };
  },
  steerWheel(rad) { return input.wheel ? input.wheel.setAngle(rad) : 0; },
  centreWheel() { if (input.wheel) input.wheel.reset(); return input.steerAxis ?? 0; },
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
  // QA purse setter (#118): set the coin purse directly so a playtest can fund a harbour investment.
  setCoins(n) { initEconomy(state); state.coins = Math.max(0, Number(n) || 0); return state.coins; },
  greet(renown = state.renown ?? 0, pole = dominantPole(state.infamy, state.standing)) {
    return greetPlayer(renown, ports.docked || ports.ports[0]?.name || 'the port', () => 0, pole);
  },
  step(seconds) {
    const fixed = 1 / 60;
    let acc = seconds;
    while (acc > 0) { const dt = Math.min(fixed, acc); simT += dt; update(dt, simT); acc -= dt; }
    return this.state;
  },
  // Deterministic perf measurement (#107 flake fix). The perf counters are otherwise refreshed
  // ONLY by the rAF render loop, which headless Chrome throttles so hard (fps≈0) that a play-test
  // can read tw.perf before any real frame has latched — the intermittent "perf counters
  // unpopulated (drawCalls=0)" flake. This renders one frame synchronously on the main thread and
  // refreshes the snapshot, so the gate measures a real frame deterministically instead of racing
  // the throttled loop. Same scene/camera as loop(); sim/state untouched.
  qaRender() { renderer.render(scene, camera); updatePerf(0); return { ...perf }; },
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
