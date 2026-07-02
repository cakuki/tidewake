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
import { createReputationNeedle } from './ui/reputation-needle.js';
import { createSettings } from './ui/settings.js';
import { createBallad } from './ui/ballad.js';
import { recordEvent } from './voyage-log.js';
import { createDayNight } from './daynight.js';
import { createMinimap } from './minimap.js';
import { createBigMap } from './bigmap.js';
import { createIslandNamer } from './islands.js';
import { createSailing } from './sailing.js';
import { createPersistence } from './persistence.js';
import { createDuel, CHALLENGE_RANGE } from './duel.js';
import { createCannons, resolveBroadside, MAX_HULL } from './cannons.js';
import { shipStats } from './ship-classes.js';
import { createBattle, quarterViewPos, engageLine as battleEngageLine, fleeLine as battleFleeLine } from './systems/battle.js';
import { softenDebutFoe, debutPending, debutPhase, debutCue } from './systems/debut-battle.js';
import { brawlMoraleDent, brawlCasualties, duelConfidenceDent, prizeFork } from './systems/board.js';
import { AMMO, AMMO_TYPES, ammoProfile, defaultLoadout, fitAmmo } from './systems/ammo.js';
import { createJuice, ammoWeight } from './systems/juice.js';
import { createProjectiles, classifyShot, BALL_POOL, FX_POOL, FX_SIZE } from './systems/projectiles.js';
import { createModeManager, SAILING, TOWN, BATTLE } from './mode.js';
import { createTown } from './ui/town.js';
import { shouldEnterTown, harbourAssistActive, nextLeftHarbour, seawardHeading } from './systems/harbour.js';
import { createLandfall, mooredSwellScale } from './systems/landfall.js';
import { createSystemsRegistry } from './systems/registry.js';
import { interactionsSuppressed, ambientInteractionsAllowed } from './systems/battle-isolation.js';
import { centreSafeZone, clearsCentre } from './ui/safe-zone.js';
import { createOverShipBillboard, projectToScreen } from './ui/over-ship-billboard.js';
import { raidPhaseModel } from './ui/raid-phases.js';
import { threatLabelFor, selectLabels, maxLabelsForViewport } from './systems/threat-label.js';
import { createAimIndicator, aimReadout } from './ui/aim-indicator.js';
import { combatOdds, oddsReadout } from './systems/odds.js';
import { pickShipAction, shipIndexFromObject, actionLabel } from './systems/ship-picker.js';
import { reputationLean, leanPole, gradeHaze, gradeSun, gradeSunKey } from './systems/reputation-grade.js';
import { shipAura } from './systems/reputation-aura.js';
import { snapshotAshore, composeAshoreDigest } from './systems/ashore-digest.js';
import { mixHex } from './sea-color.js';
import { initEconomy, syncRenown } from './economy.js';
import { SHIP_RADIUS, NPC_RADIUS } from './physics.js';
import { VERSION } from './version.js';
import { greetPlayer, dominantPole, titleFor, earnedLegend, rankForRenown, legendBeat, renownTier, defeatContext, defeatLedger } from './renown.js';
import { recallLine, rememberArrival, sanitizePortMemory, recordDeed, deedPhrase, homePort } from './systems/port-memory.js';
import {
  sanitizeHarbour, claim as claimHome, invest as investHome, canClaim, canInvest, harbourLevelName,
  earnedGovernorship, governorTitle,
} from './systems/home-port.js';
import { makeObjective, resolvesAt, payoffFor, sanitizeObjective, makeContestedObjective, tickContest, isContested, isClaimed, rivalName, shouldContest } from './objectives.js';
import { payoffCueName, approachCrossed, APPROACH_RADIUS, listenCueName, coinChimes, sightingEdge, RIVAL_SIGHT_RADIUS, RIVAL_SAIL_CUE } from './systems/loop-cues.js';
import { createEncounter, HAIL_LINES, RESCUE_LINES, PLUNDER_LINES } from './systems/encounter.js';
import { signifiedVerbs } from './ui/key-prompts.js';
import { freshMorale, sanitizeMorale, applyMorale, moraleBeat, moraleTier } from './systems/morale.js';
import {
  assessThreat, sanitizeThreat, isActiveThreat, threatTitle, threatWarning,
  payTribute as payThreatTribute, resolveStandFirm, standFirmOdds, canPayTribute,
} from './systems/harbour-threat.js';
import { colourById, nextColours, isDeceptive, npcFlees, DEFAULT_COLOURS, HOIST_LINES, FOOLED_LINES, REVEAL_LINES, pickLine, isSeenThrough, seenThroughChance, LAWFUL_LINES, PIRACY_LINES, SEEN_THROUGH_LINES, isOutlaw } from './colours.js';
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
// Your ship wears your legend (#132 Slice A, DL #5): clone the hero hull's sail + hull materials ONCE
// (the GLB shares one colormap material across its meshes — clone so we can tint each independently
// without touching the founderer or any other instance) and capture each base roughness. The per-frame
// ship-aura system below writes colour / roughness / emissive off the SAME reputation lean #126 uses —
// uniform writes only, ZERO new draws. Name-matched so it works for the GLB ('sail-a' / 'ship-pirate-
// small') and the procedural fallback ('sail' / 'hull'); a vessel with neither stays untinted (no-op).
const shipAuraParts = [];
try {
  const seen = new Set();
  ship.traverse((obj) => {
    if (!obj.isMesh || !obj.material || obj.material.isMeshBasicMaterial) return;
    const n = (obj.name || '').toLowerCase();
    const role = n.includes('sail') ? 'sail' : (n.includes('hull') || n.includes('ship')) ? 'hull' : null;
    if (!role || seen.has(obj.uuid)) return;
    seen.add(obj.uuid);
    obj.material = obj.material.clone(); // independent instance — tinting must not leak to siblings
    shipAuraParts.push({ role, mat: obj.material, baseRough: obj.material.roughness ?? 0.8 });
  });
} catch { /* the aura is a flourish — never block a boot */ }
const clampUnit = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
// Apply the cast for a signed lean to the captured materials. lean 0 → the untouched ship, exactly.
function applyShipAura(lean) {
  if (!shipAuraParts.length) return;
  const aura = shipAura(lean);
  for (const part of shipAuraParts) {
    const cast = part.role === 'sail' ? aura.sail : aura.hull;
    try {
      part.mat.color.setHex(cast.color);
      part.mat.roughness = clampUnit(part.baseRough + cast.roughnessAdd);
      part.mat.emissive.setHex(cast.emissive);
      part.mat.emissiveIntensity = cast.emissiveIntensity;
    } catch { /* a bad cast must never break the frame */ }
  }
  return aura;
}
let shipAuraLive = shipAura(0); // the live cast, for the QA surface (starts neutral)
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
// Target lock (#161 slice 3): a reusable OVER-SHIP BILLBOARD hovers a target ring above the engaged
// foe (DOM/CSS, 0 draws) while npc.js recedes the rest of the traffic — so in a busy sea you always
// know which ship you're fighting. The `target-lock` system (below) projects the foe's world position
// to screen each frame; the same billboard module is #165-ready (a threat LABEL is the second consumer).
const foeMarker = createOverShipBillboard({ className: 'over-ship-marker' });
const foeMarkerVP = new THREE.Matrix4(); // reused view-projection for the world→screen projection
const MARKER_HEIGHT = 26;                // metres above the sea the ring floats (clears the foe's mast)
let lastTargetLock = { active: false, foeIndex: -1, onScreen: false, screen: null };
// Aim-angle feedback (#161 slice 5): the SKILL readout — a world-anchored AIM LINE from your ship to
// the foe that colours + tightens as she comes abeam, so you can SEE your firing solution before SPACE.
// Read-only off broadsideAim (via battle.snapshot); reuses the same VP projection as the target ring,
// 0 draws. #166-coordinate-ready: the chip carries a reserved `.aim-odds` slot for legible-odds text.
const aimMarker = createAimIndicator({ className: 'aim-indicator' });
const DECK_HEIGHT = 6;                    // metres above the sea the aim line springs from your deck
let lastAim = { active: false, onScreen: false, level: '', onTarget: false, quality: 0, spreadDeg: 0, side: 'starboard' };
// Legible odds (#166): the fair-fight READ docked in the aim-indicator's reserved `.aim-odds` slot — a
// plain verdict + the bounded ±20% margin BAND, computed (pure, read-only) from the class matchup + your
// live aim geometry + loaded shot. SKILL sets the odds, LUCK is the shown margin. Mirrored here for the QA hook.
let lastOdds = { active: false, tier: '', verdict: '', edge: 0, stronglyFavoured: false, couldLuckFlip: false, favoured: false };
// Hover-to-interact (#161 slice 6, the FINAL lane slice): point at a ship and it lights up with what you
// can DO to it (hail / board / target), and a CLICK does it — the sea becomes directly manipulable instead
// of a hidden keymap. Reuses the slice-3 OVER-SHIP BILLBOARD (a projected DOM ring + label, 0 draws) as the
// affordance, and a THREE.Raycaster (pure math, no GPU) to find the hull under the cursor. The pure brain
// (which ship / which action / the label) lives in src/systems/ship-picker.js; this is the thin shell. The
// keyboard verbs stay live (additive), and a touch TAP routes through the same click path (#146 guard).
const hoverMarker = createOverShipBillboard({ className: 'hover-affordance' });
const hoverMarkerVP = new THREE.Matrix4(); // reused view-projection for the hover marker's world→screen
const HOVER_MARKER_HEIGHT = 22;            // metres above the sea the affordance ring floats over a hull
const picker = { raycaster: new THREE.Raycaster(), ndc: new THREE.Vector2() }; // reused — no per-move alloc
let hoveredShip = -1;                      // the ship index the cursor is over (raycast on pointermove), or -1
let pointerDown = null;                    // {x,y,t} of the last pointerdown, to tell a CLICK from a camera drag
let lastHover = { index: -1, action: null, onScreen: false, screen: null };
// Over-ship THREAT LABELS (#165, epic #162 slice 3, "pick your fight"): a floating class + threat label
// above EVERY ship — "Merchant Sloop ·" (easy prize) up to "Warship Man-o'-War ☠☠☠☠" (deadly) — so you
// glance across the sea and instantly read who to hunt vs who to flee, and CHOOSE your fight before
// committing. Reuses the SAME over-ship-billboard module as the #161-s3 target ring (one module, two
// consumers) via its setLabel() slot — NO second billboard system. POOLED: one billboard per hull,
// created once + reused every frame (0 DOM churn, 0 draws — DOM/CSS). The pure brain (class→label+glyph,
// the distance/count/mobile declutter) lives in src/systems/threat-label.js. During a fight the traffic's
// labels recede (eligibility) so the engaged foe's label + ring read clean together on the same anchor.
const threatVP = new THREE.Matrix4();               // reused view-projection for the per-ship world→screen
const THREAT_LABEL_HEIGHT = MARKER_HEIGHT;          // share the ring's anchor height so label + ring stack
const THREAT_NEAR = 360, THREAT_FAR = 1650;         // fully legible within NEAR, faded to nothing by FAR
const THREAT_LEVEL_CLASSES = ['lvl-prey', 'lvl-easy', 'lvl-even', 'lvl-hard', 'lvl-deadly'];
const threatPool = npcs.snapshot().map(() => createOverShipBillboard({ className: 'threat-label' }));
let lastThreatLabels = [];
function setThreatLevelClass(el, level) {
  if (!el) return;
  const want = `lvl-${level}`;
  for (const c of THREAT_LEVEL_CLASSES) el.classList.toggle(c, c === want);
}
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
  onRunAground: (quip) => { hud.flashBanner('⚓ Hard aground!', quip); applyMoraleEvent('aground'); }, // a reckless grounding sours the crew (#124)
  // Arcade ship-vs-ship collision (#76 b): shouldering another vessel earns a comic bump quip.
  onBump: (quip) => hud.flashBanner('🛶 Hulls collide!', quip),
});
const state = sailing.state;
const persistence = createPersistence(state);

// Shot locker (#135 slice 3): the ammo you've FIT at a town workshop. Session-scoped on purpose —
// a transient combat loadout, NOT persisted, so the save schema stays v16. A fresh boot and a
// restored voyage both start from the sensible starter locker (round + chain + grape); the town
// workshop toggles membership, and the battle cycle key walks whatever's fitted, mid-fight.
function initLoadout(s) { if (!Array.isArray(s.loadout) || !s.loadout.length) s.loadout = defaultLoadout(); }
initLoadout(state);

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

// Crew morale / loyalty (#124): a single 0..100 meter moved ONLY by the deeds you choose — a rescue or
// a rumour win lifts the crew; cruelty (plunder) or a reckless grounding sours them. funnels every hook
// through the pure model (clamp + edge-triggered threshold beats), rings a low-morale grumble / a very-
// low mutiny-risk WARNING on the downward crossing, then persists. A flourish must never break the loop.
function applyMoraleEvent(event) {
  try {
    const prev = sanitizeMorale(state.morale);
    const next = applyMorale(prev, event);
    if (next === prev) return;
    state.morale = next;
    const beat = moraleBeat(prev, next);
    if (beat) {
      hud.flashBanner(beat.title, pickLine(beat.lines));
      logDeed({ type: 'morale', tier: beat.tier }); // #90/#124: a loyalty crossing the Ballad remembers
    }
    persistence.write(); // lock the morale shift the instant the deed lands (like a legend/onboarding beat)
  } catch { /* crew morale is a reactive flourish, never a dependency — never break the loop */ }
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
      if (duel.state.boarded) {
        // Sink-or-spare (#135, Option 4 slice 1): you've won the boarding duel — now the RAID's climax
        // is YOUR call, not the code's. The base coins+infamy are already banked; we hold the prize
        // OPEN and let the player choose her fate (keys 1/2 or the QA hook). SINK her for the pirate
        // legend, or SPARE/ransom her for the governor's coin. Resolved in `resolvePrize`.
        openPrizeChoice({ enemyName, coins: reward.coins, infamy: reward.renown });
        return;
      }
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

// ── Sink-or-spare — Option 4 slice 1 (#135, "Three-Act Raid" first phase-coupling beat) ───────────
// Winning the boarding duel no longer decides the prize FOR the player. We hold it OPEN: `pendingPrize`
// carries the beaten captain's name + the won-duel base (already banked) while the player chooses her
// fate. SINK (2) → the pirate road (bonus Infamy). SPARE (1) → the governor road (ransom coin +
// Standing). Transient by design — resolved in the moment, so the SAVE stays v16 (nothing persisted
// but the ledger the deed already moves). The key handler claims 1/2 while a prize is pending.
let pendingPrize = null;

function openPrizeChoice({ enemyName, coins, infamy }) {
  pendingPrize = { enemyName, coins, infamy };
  hud.flashBanner('⚔ Her deck is yours — her FATE is your call',
    `You out-duel ${enemyName} across the wreck. Press 1 to SPARE & ransom her (Standing + coin) — or 2 to SINK her to the deep (Infamy).`);
}

// Apply the chosen fork on top of the already-banked base, announce it, and write the deed to the
// Ballad + the nearest port's memory. Unknown/absent choice defaults to SPARE (the ledger-safe road).
function resolvePrize(choice) {
  if (!pendingPrize) return null;
  const { enemyName, coins, infamy } = pendingPrize;
  pendingPrize = null;
  const f = prizeFork(choice, { coins, infamy });
  initEconomy(state);
  state.coins += f.addCoins;
  state.infamy += f.addInfamy;
  if (f.addStanding) state.standing = Math.max(0, (state.standing || 0) + f.addStanding);
  syncRenown(state);
  if (f.captured) {
    hud.flashBanner('⚔ Spared — a prize taken intact!',
      `You let ${enemyName} live; her crew ransoms her back: +${f.addCoins}c and +${f.addStanding} standing for the mercy.`);
  } else {
    hud.flashBanner('🏴 Sent to the deep!',
      `You put ${enemyName} under with all her colours flying: +${f.addInfamy} infamy for the ruthless road.`);
  }
  const prizeDeed = {
    type: 'duel', foe: enemyName,
    infamy: infamy + f.addInfamy, coins: coins + f.addCoins,
    captured: f.captured, sunk: !f.captured, boarded: true, prizeChoice: f.choice,
  };
  logDeed(prizeDeed);            // #78/#135 — the raid's climax sings into the Ballad
  rememberPortDeed(prizeDeed);   // #104b — the nearest port recalls the fate you dealt
  return f;
}

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
    battle.end(); // a cannonade fought inside the deliberate stance resolves it (#135) — back under sail
  },
});

// Battle Mode shell (#135, slice 1): the DELIBERATE fight stance, on the #95 mode-switch infra.
// Until now a fight was only ever reactive ('g' runs out the guns instantly). This adds the
// Sid Meier's Pirates! beat the owner asked for — square up to a sail with E, the camera swings
// to a quarter-view, the bed settles to battle music (#94), the world keeps sailing underneath,
// and FLEE (E again) is always on the table. The cannonade (#59) is the teeth INSIDE the stance;
// later slices (real-time broadside, loadouts, boarding, the expanded duel) layer on this arena.
// The Bosun's First Duel (#157): a cold save's FIRST engagement is a one-shot scaffolded SOFT debut —
// a forgiving, already-battered foe + the bosun calling each phase's verb aloud in-world (theatre, not
// a pop-up). `debutActive` marks the current engagement as the debut; `debutPhaseShown` gates the
// bosun so she speaks once per phase change. The one-shot `state.debut` flag (persisted, save v17)
// retires it: once spent it never fires again, and a returning captain is never re-scaffolded.
let debutActive = false;
let debutPhaseShown = null;

// Pure lifecycle + quarter-view geometry live in src/systems/battle.js; here we only drive it.
const battle = createBattle({
  npcs,
  getShipPos: () => [state.pos.x, state.pos.z],
  getShipHeading: () => state.heading, // slice 2: the broadside arc needs your heading vs the foe
  getLoadout: () => state.loadout,     // slice 3: the shot you fit at the town workshop
  getCrewMorale: () => sanitizeMorale(state.morale), // slice 4: your crew's nerve feeds the boarding brawl (#124)
  // Soften a fresh captain's FIRST fight (#157): if the debut is still unspent, hand this engagement a
  // forgiving, already-battered foe and mark it the debut; a veteran fight passes through full-strength.
  softenFoe: (foe) => {
    if (!debutPending(state.debut)) return foe;
    debutActive = true;
    debutPhaseShown = null;
    return softenDebutFoe(foe, true);
  },
  onCycleAmmo: ({ ammo }) => { const a = ammoProfile(ammo); hud.flashBanner(`${a.icon} Load ${a.name}`, `${a.tag} — ${a.blurb}`); },
  // Boarding → crew brawl → captain's duel (#135 slice 4): at ≤30% hull the crew swarms the rail for a
  // quick comic brawl, then we HAND OFF to the verbal captain's duel (#33, the climax) — softened by the
  // brawl margin. Capture = Standing / sink = Infamy is settled in the duel's onEnd (boarded = a capture).
  onBoard: ({ foeName, brawl }) => {
    const head = brawl.won ? '⚔ Boarders away — you carry the deck!' : '⚔ Boarders away — a brutal scrap!';
    hud.flashBanner(head, `${brawl.lines.join(' ')} Now face ${foeName} across the deck — out-jeer her captain to take her!`);
    consumeDebut(); // boarding a debut foe hands off to the duel — the scaffolded first fight is spent (#157)
    battle.end();                                                                  // the broadside gives way to the boarding…
    duel.tryChallenge({
      openingDent: brawlMoraleDent(brawl.advantage),                 // slice 4: HER captain, shaken by how you swept the deck
      playerDent: duelConfidenceDent(brawlCasualties(brawl)),        // O4 slice 3: YOUR captain, shaken by the crew you spent
      boarded: true,
    });                                                                            // …and the captain's verbal duel is the climax (#33)
  },
  // Early surrender / strike-colours short-circuit (#135, Option 4): when your broadsides break her
  // nerve+hull hard enough she strikes her colours BEFORE you board — hold the offer open and let the
  // player answer. 1 = ACCEPT (a quick capture: ransom + Standing) · 2 = PRESS the attack (no quarter).
  // Accepting routes through onResolve('capture') below (the existing capture banner + deed); pressing
  // just narrates the refusal — the fight simply resumes.
  onSurrender: ({ foeName }) => hud.flashBanner('🏳️ She strikes her colours — quarter?',
    `${foeName} hauls down her flag and offers to yield. Press 1 to ACCEPT her surrender (a ransom + Standing, quick) — or 2 to PRESS the attack (no quarter: sink or board her).`),
  onPressAttack: ({ foeName }) => hud.flashBanner('🏴 No quarter!',
    `You refuse ${foeName}'s surrender — the guns run back out. She fights to the bitter end now: sink her or board her.`),
  sfx: (kind) => audio.playDuelHit(kind),
  // Real-time broadside spoils (#135 slice 2): sinking pays Infamy, a capture pays Standing.
  applyReward: (r) => { initEconomy(state); state.coins += r.coins; state.infamy += r.infamy; if (r.standing) state.standing = Math.max(0, (state.standing || 0) + r.standing); syncRenown(state); },
  // Loss stings (#164): the FIRST fame-DECREMENT path. getLedger reads the captain's already-persisted
  // ledger and getDefeatContext routes the loss (a raiding loss dents Infamy, a governor-road loss
  // dents Standing — the pole she was pursuing). defeatLedger (in renown.js) computes the tier-scaled,
  // floored deduction; applyPenalty ASSIGNS the new floored values (no save bump — stays v17).
  getLedger: () => ({ coins: state.coins ?? 0, infamy: state.infamy ?? 0, standing: state.standing ?? 0 }),
  getDefeatContext: () => defeatContext(state.infamy ?? 0, state.standing ?? 0),
  applyPenalty: (p) => {
    initEconomy(state);
    if (typeof p.coins === 'number') state.coins = Math.max(0, p.coins);
    if (typeof p.infamy === 'number') state.infamy = Math.max(0, p.infamy);
    if (typeof p.standing === 'number') state.standing = Math.max(0, p.standing);
    syncRenown(state);
  },
  onEnter: ({ foeName }) => {
    if (debutActive) {
      // The Bosun's First Duel (#157): a warm, scaffolded opener — the bosun names the first verb aloud
      // and the fight is flagged as the soft one to learn on. Subsequent phases are called by the driver.
      const cue = debutCue('maneuver');
      debutPhaseShown = 'maneuver';
      hud.flashBanner('🎓 The Bosun’s First Duel', `${cue.line} (an easy foe — your first fight to learn the ropes)`);
      return;
    }
    hud.flashBanner(`⚔ BATTLE — ${foeName}`,
      `${battleEngageLine()} (steer abeam · SPACE fires · X cycles shot · E breaks off)`);
  },
  onFlee: () => hud.flashBanner('⛵ You break off the fight', battleFleeLine()),
  // A real-time broadside resolved the fight — announce the prize/setback + log the deed (#78/#104b).
  onResolve: ({ result, reward, penalty, foeName }) => {
    if (result === 'win') {
      hud.flashBanner('🔥 Broadside — she goes down!',
        `${foeName} slips beneath the waves — you haul ${reward.coins}c and your legend gains ${reward.infamy} infamy.`);
      const deed = { type: 'cannon', foe: foeName, infamy: reward.infamy, coins: reward.coins };
      logDeed(deed); rememberPortDeed(deed);
    } else if (result === 'capture') {
      hud.flashBanner('🏳️ She strikes her colours!',
        `${foeName} has had enough — you spare the crew and take a ${reward.coins}c ransom: +${reward.standing} standing for the mercy.`);
      const deed = { type: 'cannon', foe: foeName, infamy: reward.infamy, coins: reward.coins, captured: true };
      logDeed(deed); rememberPortDeed(deed);
    } else {
      // Loss stings (#164): the red "Colours Struck" defeat card NAMES exactly what the loss cost —
      // the tier-scaled, context-based fame + coin just deducted. The player SEES their legend + purse
      // drop and FEELS that reckless fights now carry real risk. `penalty` is the defeatLedger result.
      hud.showDefeat({ foeName, pole: penalty.pole, fameLoss: penalty.fameLoss, coinLoss: penalty.coinLoss });
    }
    consumeDebut(); // a resolved first fight (won/captured/lost) spends the debut — it never repeats (#157)
  },
});

// Mark the scaffolded debut as spent the moment it resolves (a sinking/capture/loss or a boarding), and
// persist it so the soft first fight never repeats — a returning captain is never re-taught. A mid-fight
// FLEE deliberately does NOT spend it (a mis-tapped break-off shouldn't burn the tutorial). Pure guard.
function consumeDebut() {
  if (!debutActive) return;
  debutActive = false;
  debutPhaseShown = null;
  if (!state.debut) {
    state.debut = true;
    try { persistence.write(); } catch { /* the save is best-effort; the flag still holds this session */ }
  }
}

// Reactive-verb JUICE (#155): renderer-only game-feel on the combat verbs the player just learned
// (#153 prompts / #154 earcons) — a fired broadside KICKS the view (recoil scaled by aim quality +
// shot weight), a landed hit FLASHES the hull, a boarding LUNGES the camera forward. It changes
// NOTHING in the sim (pure feel; logic + unit tests untouched, per the #80 doctrine) and costs ~0
// draws: the shake is a camera-position offset, the flash a single DOM overlay's opacity. A
// prefers-reduced-motion preference switches the whole thing off (accessibility instinct: subtle).
// Pure decay curves + trigger edges live in src/systems/juice.js; here we trigger off the live
// volley/board result and loop() applies the offset + flash each frame.
function prefersReducedMotion() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  catch { return false; }
}
const juice = createJuice({ reducedMotion: prefersReducedMotion() });

// RENDERED CANNONBALLS (#161 slice 4): the marquee "see the shot" win — a fired broadside now SPAWNS a
// spread of round-shot that arcs from your guns to the foe, a muzzle PUFF barks at the gunports, and each
// ball CRACKS into a spark on a clean hit or SPLASHES pale in open water on a wide miss, so a good angle
// and a bad one read completely differently. Perf is the risk (#52 draws / #121 mesh-conservation), so the
// whole thing is POOLED + INSTANCED: the trajectory/hit-vs-miss maths is the pure controller
// (src/systems/projectiles.js), and the picture is exactly TWO reused InstancedMeshes created ONCE here —
// the iron balls, and a puff mesh (muzzle/spark/splash, tinted per-instance) — never a mesh allocated per
// shot, never a growth across fights. Both are added to the scene ONCE and just recycle their instances.
const projectiles = createProjectiles({ reducedMotion: prefersReducedMotion() });
const GUN_OFFSET = 14;   // metres out the firing beam the guns sit
const GUN_HEIGHT = 6;    // metres above the waterline the muzzles are
const HULL_HEIGHT = 8;   // metres up the foe's hull a clean shot strikes / a splash plumes
const projBallGeo = new THREE.SphereGeometry(1.35, 8, 6);
const projBallMat = new THREE.MeshStandardMaterial({ color: 0x14140f, roughness: 0.55, metalness: 0.45 });
const projBallMesh = new THREE.InstancedMesh(projBallGeo, projBallMat, BALL_POOL);
projBallMesh.frustumCulled = false; // balls fly fast + wide; never pop out at the frustum edge
projBallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const projFxGeo = new THREE.SphereGeometry(1, 6, 5); // base radius 1 — scaled per instance by FX_SIZE
const projFxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false });
const projFxMesh = new THREE.InstancedMesh(projFxGeo, projFxMat, FX_POOL);
projFxMesh.frustumCulled = false;
projFxMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const FX_TINT = { muzzle: new THREE.Color(1.0, 0.55, 0.16), hit: new THREE.Color(1.0, 0.82, 0.30), splash: new THREE.Color(0.78, 0.9, 1.0) };
scene.add(projBallMesh);
scene.add(projFxMesh);
const projDummy = new THREE.Object3D();
let projWasActive = false;
// Write the pool into the two InstancedMeshes: one matrix per slot (idle slots scale to 0 → invisible,
// still ONE draw call for the batch). Only touched while effects are live (+ one frame after, to zero
// out the last), so a quiet sea costs nothing but the two idle draws.
function writeProjectiles() {
  projectiles.eachBall((i, pos) => {
    if (pos) { projDummy.position.set(pos[0], pos[1], pos[2]); projDummy.scale.setScalar(1); }
    else projDummy.scale.setScalar(0);
    projDummy.updateMatrix();
    projBallMesh.setMatrixAt(i, projDummy.matrix);
  });
  projBallMesh.instanceMatrix.needsUpdate = true;
  projectiles.eachFx((i, pos, scale, kind) => {
    if (pos && scale > 0) {
      projDummy.position.set(pos[0], pos[1], pos[2]);
      projDummy.scale.setScalar((FX_SIZE[kind] || 6) * scale);
      projFxMesh.setColorAt(i, FX_TINT[kind] || FX_TINT.muzzle);
    } else projDummy.scale.setScalar(0);
    projDummy.updateMatrix();
    projFxMesh.setMatrixAt(i, projDummy.matrix);
  });
  projFxMesh.instanceMatrix.needsUpdate = true;
  if (projFxMesh.instanceColor) projFxMesh.instanceColor.needsUpdate = true;
}
writeProjectiles(); // seed every instance to scale 0 so nothing shows before the first shot

// Fire a real-time broadside AND feel it (#155). Wraps battle.fire so the key AND the QA hook share
// one juicing path. Reads the pre-fire snapshot for weight (aim quality × loaded-shot bite) and the
// volley result for the hit-flash: her reply biting your hull flashes RED, a clean hit on her GOLD.
function battleFireJuiced() {
  const before = battle.snapshot();
  const r = battle.fire();
  if (!r) return r; // reloading / not engaged / a held white flag — no volley discharged
  try {
    const weight = ammoWeight(ammoProfile(before.ammo).hullMult);
    juice.fire({ quality: r.quality ?? before.aimQuality ?? 0, weight });
    // #80 game-feel "juice" pass — make the impact LAND. Alongside the existing gold/red hull FLASH, a
    // clean bite on HER now ROCKS the view + hit-stops (scaled by the bite); her reply raking YOU rocks
    // + hit-stops (scaled by what she took out of you); a SINKING punctuates hardest. All feed the SAME
    // camera-shake stack the broadside recoil uses (one effect, generalised — NOT a second camera
    // system), and the freeze is bounded + drains on real time so it can never stall the loop.
    // r.result==='win' is the sink verdict from battle.finish().
    if (r.result === 'win') juice.sink();                                       // she goes down — the kill lands
    if (r.playerHit > 0) {
      juice.hit({ damage: r.playerHit, tint: 'red' });                          // her reply raked your hull…
      juice.impact({ damage: r.playerHit });                                    // …and it ROCKS your view
    } else if (r.enemyHit > 0) {
      juice.hit({ damage: r.enemyHit, tint: 'gold' });                          // you landed a clean one…
      juice.impact({ damage: r.enemyHit });                                     // …and it THUDS home
    }
  } catch { /* game-feel must never break the fight */ }
  // RENDER the shot (#161 slice 4): arc a visible volley from the firing gunport to the foe, driven by
  // the resolved outcome — a clean beam bite sparks ON her, a wide shot splashes past. `before.foePos`
  // is captured pre-fire because a sinking clears foeIndex; the audible cannon report already rings via
  // battle.fire's 'cut' sting, so this adds the picture the owner was missing (the balls in flight).
  try {
    const fp = before.foePos; // [x,z]
    if (fp) {
      const h = state.heading;
      const sgn = before.aimSide === 'port' ? -1 : 1; // guns run out the firing beam
      const rightX = Math.cos(h), rightZ = -Math.sin(h);
      const sx = state.pos.x, sz = state.pos.z;
      const from = [sx + rightX * GUN_OFFSET * sgn, ocean.sampleHeight(sx, sz, simT) + GUN_HEIGHT, sz + rightZ * GUN_OFFSET * sgn];
      const to = [fp[0], ocean.sampleHeight(fp[0], fp[1], simT) + HULL_HEIGHT, fp[1]];
      projectiles.fire({ from, to, hit: classifyShot({ inArc: before.inArc, enemyHit: r.enemyHit }) === 'hit' });
    }
  } catch { /* the picture must never break the fight */ }
  return r;
}
// Board AND feel the leap (#155): a forward camera lunge as the crew swarms the rail.
function boardBattleJuiced() {
  const brawl = battle.board();
  if (brawl) { try { juice.board(); } catch { /* feel must never break the boarding */ } }
  return brawl;
}

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
      applyMoraleEvent('rescue'); // the crew loves a captain who saves souls (#124)
    } else {
      state.coins += coins;
      state.infamy += infamy;                                                 // the pirate pole (#45)
      syncRenown(state);
      hud.flashBanner('🏴 You take the spoils', `${pickLine(PLUNDER_LINES)} (+${coins}c · +${infamy} infamy)`);
      logDeed({ type: 'encounter', choice: 'plunder', ship: name, infamy, coins }); // #78
      applyMoraleEvent('plunder'); // a crew left to a cold row curdles your own crew's loyalty (#124)
    }
    persistence.write(); // lock the deed + reward the instant the choice is made
  },
  // A founderer you sailed past without choosing slips quietly under — a cold thing for the crew to
  // watch, a small morale ding (#124). Guarded; no reward, just the loyalty cost of indifference.
  onDespawn: () => applyMoraleEvent('missedRescue'),
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
      if (to === TOWN) { ashoreSnapshot = snapshotAshore(state); landfall.land(); music.stinger(); hud.flashBanner('🏘️ Making port…', 'The helm goes quiet — the ship glides to her moorings as the light turns gold.'); checkHarbourThreat(); } // a "made port" stinger lands on the next downbeat (#102 ph2); coming home under a hard pole lean draws a threat (#134)
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

// Reputation needle (#132, DL #5): the HUD gauge that makes the Infamy↔Standing pole PERSONAL &
// audible. It swings toward your pole as you commit and, the instant a real shift lands (a kill, a
// rescue, a rumour payoff, an investment — all just move the ledger), strikes a guarded sting and
// murmurs a line about who you're becoming. The pure decision maths lives in
// src/systems/reputation-needle.js; this component owns the gauge DOM and drives the sting via audio.
const repNeedle = createReputationNeedle({
  onCue: ({ pole, tier }) => { try { audio.playRepSting(pole, tier); } catch { /* a sting must never break the loop */ } },
});

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
// Crew morale (#124): a restored voyage keeps the loyalty it earned; a fresh one (or a junk value)
// boards with a willing crew at the START baseline. Sanitised so a corrupt meter fails open, never NaN.
state.morale = sanitizeMorale(state.morale);
// Your Harbour, threatened (#134): a restored voyage keeps a threat that was gathering off its home
// port (so a reload can't make it vanish); a fresh one starts unthreatened. Sanitised so a junk save
// fails open to null (no stake). It's re-assessed on landfall at home anyway.
state.threat = sanitizeThreat(state.threat);
// The Bosun's First Duel (#157): a restored voyage keeps whether it has spent the scaffolded soft debut
// (so a returning captain is never re-scaffolded); a genuinely fresh voyage (no save) starts pending, so
// a brand-new captain's first fight is the forgiving, cued one. Coerced to a plain boolean.
state.debut = !!state.debut;

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

// The home-port threat dice (#134): standing firm against a blockade/raid rolls THIS seeded RNG, so
// the outcome is DETERMINISTIC + reproducible (same voyage, same rolls) and QA-forceable — exactly
// like the false-colours detection above. Reset on a new voyage for a clean, repeatable sequence.
function makeThreatRng() {
  let a = 0x21 ^ 0x9e3779b9;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
let threatRng = makeThreatRng();

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
  battle.end();                        // ...and breaks off any deliberate battle stance (#135)
  encounterRng = makeEncounterRng();   // a fresh voyage re-rolls the encounter cadence from a clean seed (#125)
  threatRng = makeThreatRng();         // ...and a clean home-port-threat dice sequence (#134)
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
  state.threat = null; // ...and no threat gathering off any home port (#134)
  state.governorship = false; // ...and no governorship crowned yet (#119)
  state.debut = false; debutActive = false; debutPhaseShown = null; // ...and re-arm the Bosun's First Duel (#157)
  state.morale = freshMorale(); // ...and a fresh, willing crew at the START baseline (#124)
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

// Combat controls — a fight is a CHOICE (#59/#135):
//   'e' ENGAGES the nearest ship in a deliberate BATTLE — square up to her, the camera swings to a
//       quarter-view, the music settles. Press 'e' again to FLEE (always available). Inside the
//       stance you fight with the verbs below.
//   'f' HAILS the nearest ship for an Insult Broadside (talk them down); 1–4 fling a jab.
//   'g' OPENS FIRE on the nearest ship with cannons (out-gun them); 1–2 pick where to aim.
// Only one engagement runs at a time. (At sea the digit keys are free — the trade panel
// only claims them while docked.)
addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  // Sink-or-spare (#135, Option 4 slice 1): the instant a boarding duel is won, the prize is HELD
  // open — 1 SPARES & ransoms her (Standing + coin), 2 SINKS her (Infamy). The choice claims the keys
  // (ahead of everything) so the raid's climax is never stepped on by a stray hail/fire.
  if (pendingPrize) {
    if (e.key === '1') resolvePrize('spare');
    else if (e.key === '2') resolvePrize('sink');
    return;
  }
  // Early surrender / strike-colours short-circuit (#135, Option 4): the instant a battered foe strikes
  // her colours mid-maneuver, the offer is HELD open — 1 ACCEPTS her surrender (a quick capture: ransom +
  // Standing), 2 PRESSES the attack (no quarter — she fights on to a sinking or a boarding). The offer
  // claims the keys (ahead of fire/board) so the reactive out is never stepped on by a stray volley.
  if (battle.state.surrenderPending) {
    if (e.key === '1') battle.acceptSurrender();
    else if (e.key === '2') battle.pressAttack();
    return;
  }
  // Foundering-ship choice (#125): while a founderer is alongside, 1 RESCUES, 2 PLUNDERS. The
  // encounter claims the keys and blocks hailing/firing so the moral beat isn't stepped on.
  // Hard battle isolation (#161 slice 1): but NOT while squared up — a fight suppresses the rescue
  // choice too, so a founderer that was alongside when you engaged can't hijack 1/2 mid-cannonade
  // (spawns are already deferred; this covers the pre-existing-encounter edge). It resumes on flee.
  if (encounter.state.active && !interactionsSuppressed({ battleActive: battle.state.active })) {
    if (e.key === '1') encounter.choose('rescue');
    else if (e.key === '2') encounter.choose('plunder');
    return;
  }
  // Battle Mode shell (#135): 'e' is the deliberate stance toggle. FLEE is always available while
  // engaged (so the commitment is real, never a trap); you can't break off mid-cannonade (the guns
  // are already speaking — that resolves on its own). Engaging needs the helm free (under sail).
  if (k === 'e') {
    if (battle.state.active) { if (!cannons.state.active) battle.flee(); }
    else if (mode.is(SAILING) && !duel.state.active && !cannons.state.active) battle.engage();
    return;
  }
  // Real-time broadside (#135 slice 2): SPACE discharges the loaded guns while in the deliberate
  // stance. A clean beam shot bites hard; firing wide flies past. No-op while reloading (the HUD
  // shows the reload). Preventing default keeps the spacebar from scrolling the page.
  if (e.key === ' ' || e.code === 'Space') {
    if (battle.state.active && !cannons.state.active && !duel.state.active) { e.preventDefault(); battleFireJuiced(); }
    return;
  }
  // Mid-combat shot cycle (#135 slice 3): X loads the next shot you FIT at a town workshop —
  // round/chain/grape/light/heavy/swivel, each a distinct effect on the broadside. No buying in
  // combat; you only cycle what's already at the rack. No-op outside the deliberate stance.
  if (k === 'x') {
    if (battle.state.active && !cannons.state.active && !duel.state.active) battle.cycleShot();
    return;
  }
  // Boarding (#135 slice 4): in the deliberate stance F = BOARD once she's beaten to ≤30% hull — the
  // crew swarms the rail for a quick brawl, then her captain's verbal duel (#33) is the climax. In the
  // stance F NEVER opens a fresh open-sea hail (you board the foe you're already fighting).
  if (k === 'f' && battle.state.active) {
    if (!cannons.state.active && !duel.state.active && battle.canBoard()) boardBattleJuiced();
    return;
  }
  // Open-sea hail (f) / open-fire (g) on OTHER ships. Hard battle isolation (#161 slice 1): both are
  // no-ops while squared up — you fight the foe you're engaged with, and no stray hull is hailed or
  // fired on mid-battle (the input theft the owner called out). Consult the ONE isolation predicate.
  if (interactionsSuppressed({ battleActive: battle.state.active })) return;
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

// ---- Hover-to-interact picker (#161 slice 6) --------------------------------------------------------
// The diegetic input the owner asked for: raycast the ship under the cursor and route a click to the SAME
// verb handlers the keyboard uses (engage / hail / board) — no new combat mechanics. A modal/menu or an
// ashore helm parks it (no stray picking mid-duel/cannonade/prize).
function canPick() {
  // Suppressed only while a true MODAL owns the screen (town/menu → lastPaused, a reactive duel/cannonade,
  // or a held prize choice). An ambient founderer keeps the helm live, so hover-to-interact stays available
  // (engaging from it just enters battle, which isolates the encounter per slice 1).
  return !lastPaused && !duel.state.active && !cannons.state.active && !pendingPrize;
}
// The interaction reach mirrors the keyboard verbs' CHALLENGE_RANGE, so a hover offers exactly what a
// keypress could reach.
function shipInRange(pos) {
  return Math.hypot(pos[0] - state.pos.x, pos[1] - state.pos.z) <= CHALLENGE_RANGE;
}
// Raycast the hull under a screen point → { index, action, inRange }. Pure-ish shell: the THREE raycast
// finds the hull, ship-picker.js decides the ship + the contextual action off the LIVE world state.
function resolvePick(screenX, screenY) {
  const w = window.innerWidth || 1, h = window.innerHeight || 1;
  picker.ndc.set((screenX / w) * 2 - 1, -(screenY / h) * 2 + 1);
  camera.updateMatrixWorld();
  npcs.group.updateWorldMatrix(false, true); // refresh hull transforms so the ray tests their CURRENT poses
  picker.raycaster.setFromCamera(picker.ndc, camera);
  const hits = picker.raycaster.intersectObjects(npcs.group.children, true);
  const index = hits.length ? shipIndexFromObject(hits[0].object, npcs.group) : -1;
  if (index < 0) return { index: -1, action: null, inRange: false };
  const snap = npcs.snapshot()[index];
  if (!snap) return { index: -1, action: null, inRange: false };
  const inRange = shipInRange(snap.pos);
  const bs = battle.state;
  const action = pickShipAction({
    battleActive: bs.active, foeIndex: bs.foeIndex, index,
    canBoard: battle.canBoard(), outlaw: isOutlaw(snap.kind), inRange,
  });
  return { index, action, inRange };
}
// Perform the routed action for the ship under a screen point — CLICK/TAP does what the affordance says.
// Guards mirror the keyboard verbs so a click can never do something a keypress couldn't.
function actOnPick(screenX, screenY) {
  if (!canPick()) return { index: -1, action: null, acted: false };
  const pick = resolvePick(screenX, screenY);
  if (pick.index < 0 || !pick.action) return { ...pick, acted: false };
  let acted = false;
  if (pick.action === 'target') {
    if (mode.is(SAILING) && !battle.state.active) { acted = battle.engage(pick.index); }
  } else if (pick.action === 'hail') {
    if (mode.is(SAILING) && !battle.state.active) { acted = duel.tryChallenge({ targetIndex: pick.index }); }
  } else if (pick.action === 'board') {
    acted = !!boardBattleJuiced();
  }
  return { ...pick, acted };
}
// Pointer wiring on the canvas. pointerdown records the press so pointerup can tell a tap/click from a
// camera-orbit drag; pointermove updates which hull is under the cursor (a live hover); a short, still
// pointerup ACTS. Camera-drag orbit (input.js) is untouched — a drag just never counts as a click.
const CLICK_MOVE_PX = 6, CLICK_MS = 400;
renderer.domElement.addEventListener('pointerdown', (e) => { pointerDown = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!canPick()) { hoveredShip = -1; return; }
  hoveredShip = resolvePick(e.clientX, e.clientY).index;
});
renderer.domElement.addEventListener('pointerleave', () => { hoveredShip = -1; });
renderer.domElement.addEventListener('pointerup', (e) => {
  const d = pointerDown; pointerDown = null;
  if (!d) return;
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
  const held = performance.now() - d.t;
  if (moved <= CLICK_MOVE_PX && held <= CLICK_MS) actOnPick(e.clientX, e.clientY); // a tap/click, not a drag
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
// Combat feel (#80) — STORED, default ON: the screen-shake, camera kick + hit-stop that make a hit
// LAND. Toggling it OFF (or a prefers-reduced-motion preference) leaves the game fully playable with
// zero screen motion; setEnabled clears any live effect so there's no residual jolt.
settings.register({
  id: 'combatfeel', label: 'Combat feel', hint: 'screen-shake & hit-stop on a solid hit — motion',
  default: true, apply: (on) => juice.setEnabled(on),
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
  onListen: (rumours) => music.loopCue(listenCueName(rumours?.[0]?.kind)), // cup-an-ear, coloured by what the room leaked (#116)
  onClaim: () => claimHarbour(),
  onInvest: () => investHarbour(),
  onTribute: () => payHarbourTribute(),   // resolve a home-port threat by paying it off (#134)
  onStandFirm: () => standHarbourFirm(),  // ...or stand firm and roll the dice (#134)
  // The Workshop (#135 slice 3, ties #96): fit/unfit the shot you carry into a fight. Session-scoped
  // (the loadout isn't persisted → save stays v16); the battle cycle key walks whatever's fitted.
  onFitAmmo: (id) => { state.loadout = fitAmmo(state.loadout, id); },
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
    applyMoraleEvent('harbourGrow');     // wages paid, warm berths kept — a prospering home lifts the crew (#124)
    persistence.write();                 // lock the investment the instant it's made
    hud.flashBanner('⚒ Your harbour grows',
      `You sink ${res.spent}c into ${port} — now ${harbourLevelName(res.level)}, and +${res.standingGain} standing for the prospering.`);
    town.render();
    return res;
  } catch { return { ok: false, reason: 'error' }; }
}

// ---- Your Harbour, threatened (#134, DL #5) — the home port's STAKE -------------------------
// Coming HOME under a hard pole lean draws a threat: high Infamy musters a navy blockade off your own
// quay; high Standing draws pirates to the wealth you raised. The pure trigger/threat/resolution logic
// lives in src/systems/harbour-threat.js; here we ASSESS on landfall at home, and apply the two
// lightweight NON-BATTLE resolutions (pay tribute / stand firm & roll the dice) to the shared state.
// The actual defensive engagement sequences around battle #100 (owner-held) — not implied here.
function atHomePort() {
  const h = state.harbour;
  return !!(h && typeof h === 'object' && h.name && h.name === state.port);
}
// On making landfall at your claimed home port, assess whether your reputation has drawn a threat. A
// threat already in flight is left to stand (you must resolve it); a fresh one is banked + persisted +
// warned by a banner the instant you tie up. Fully guarded — a flourish must never break the loop.
function checkHarbourThreat() {
  try {
    if (!atHomePort()) return null;
    if (isActiveThreat(state.threat)) return state.threat; // one already gathering — resolve it first
    const t = assessThreat({ harbour: state.harbour, infamy: state.infamy ?? 0, standing: state.standing ?? 0 });
    if (!t) return null;
    state.threat = t;
    logDeed({ type: 'threat', kind: t.kind, port: t.port }); // the Ballad remembers the day they came (#78)
    persistence.write();                                     // lock the threat so a reload can't reset it
    hud.flashBanner(threatTitle(t), threatWarning(t));
    town.render();
    return t;
  } catch { return null; } // a flourish must never break the loop
}
// Pay the tribute a threat demands: spend the coin, the threat lifts cleanly. No-op (with the pure
// reason) if there's no threat or the purse is short.
function payHarbourTribute() {
  try {
    initEconomy(state);
    const res = payThreatTribute({ threat: state.threat, coins: state.coins ?? 0 });
    if (!res.ok) return res;
    state.coins = Math.max(0, (state.coins ?? 0) - res.spent);
    const port = state.threat.port;
    state.threat = null;
    syncRenown(state);
    logDeed({ type: 'threat', deed: 'tribute', port });
    persistence.write();
    hud.flashBanner('⚖ Tribute paid — the threat lifts',
      `You buy off the danger to ${port} for ${res.spent}c. The sails on the horizon come about and stand down — for now.`);
    town.render();
    return res;
  } catch { return { ok: false, reason: 'error' }; }
}
// Stand firm against a threat and roll the seeded dice. Win → repel it for Standing + a boast; lose →
// it sacks your harbour a level (or overruns a claimed berth outright) and costs Standing.
function standHarbourFirm() {
  try {
    initEconomy(state);
    const port = state.threat && state.threat.port;
    const res = resolveStandFirm({ threat: state.threat, harbour: state.harbour, roll: threatRng() });
    if (!res.ok) return res;
    state.threat = null;
    state.harbour = res.harbour;            // intact on a win; demoted/lost on a defeat
    if (res.won) {
      state.standing = Math.max(0, (state.standing ?? 0) + (res.standingGain || 0));
      syncRenown(state);
      applyMoraleEvent('harbourGrow');      // the crew swells with pride at a home defended
      logDeed({ type: 'threat', deed: 'repelled', port });
      hud.flashBanner('⚔ You hold the line!',
        `The guns of ${port} speak, and the threat breaks off — driven from your home water. +${res.standingGain} standing for the defence.`);
    } else {
      state.standing = Math.max(0, (state.standing ?? 0) - (res.standingLoss || 0));
      syncRenown(state);
      applyMoraleEvent('aground');          // a home overrun shakes the crew (reuses the sour-deed beat)
      logDeed({ type: 'threat', deed: 'fell', port });
      const fallLine = res.lostPort
        ? `The line breaks. ${port} is overrun and lost to you — your colours hauled down off the quay. A bitter day; -${res.standingLoss} standing.`
        : `The line bends and breaks — ${port} is sacked back a tier (${res.coinLost}c of works lost) and your name takes the blow: -${res.standingLoss} standing.`;
      hud.flashBanner('💥 The line breaks!', fallLine);
    }
    persistence.write();
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
// Contested rumours (#133): SOME chased tips draw a rival captain racing you for the same prize on
// a seeded soft clock — arrive in time to win it as normal (+ a "you beat them to it" beat), dawdle
// and the rival CLAIMS it first (you arrive to find it gone). `opts.contested` forces it on/off (the
// QA spawn hook); left unset, it's a deterministic ~1-in-3 draw seeded off the target + origin port.
const RUMOUR_RACE_LINES = [
  'is racing you for the same word — beat them to it or arrive to a rival\'s wake.',
  'wants that prize as badly as you do. Carry the wind, captain, or carry the grudge.',
  'heard the same whisper. It\'s a race now — chase hard, and don\'t dawdle ashore.',
];
function chaseObjective(target, opts = {}) {
  try {
    if (!target || target.kind !== 'port') return null;
    const info = ports.portInfo(target.name);            // resolve the named port's live coords
    const enriched = info ? { ...target, x: info.x, z: info.z } : { ...target };
    const seed = `${target.name}|${ports.docked || ''}`;
    const contested = opts.contested === true
      || (opts.contested !== false && shouldContest(seed));
    let obj;
    if (contested) {
      obj = makeContestedObjective(enriched, { rival: opts.rival, fromX: state.pos?.x, fromZ: state.pos?.z });
    } else {
      obj = makeObjective(enriched);
    }
    if (!obj) return null;
    state.objective = obj;
    persistence.write();                                 // lock the chase the instant it's taken
    if (isContested(obj)) {
      hud.flashBanner(`⚑ A race for ${target.name}!`, `${rivalName(obj)} ${pickLine(RUMOUR_RACE_LINES)}`);
    } else {
      hud.flashBanner(`⚑ Chasing word to ${target.name}`, pickLine(RUMOUR_CHASE_LINES));
    }
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
  // Your Harbour, threatened (#134): if you cast off from your home port leaving a threat unresolved,
  // the digest warns of it FIRST — leaving town never quietly buries a gathering blockade/raid (#105).
  try {
    if (digest && atHomePort() && isActiveThreat(state.threat)) {
      const warn = threatWarning(state.threat);
      if (warn) digest = { title: digest.title, lines: [warn, ...digest.lines].slice(0, 3) };
    }
  } catch { /* a flourish must never break the loop */ }
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

// ---- Per-frame systems registry (#120 → #130, DL #5) -----------------------------------------
// The self-registering update backbone (src/systems/registry.js) is now the DEFAULT path: the WHOLE
// per-frame loop is registered systems, dispatched in deterministic `order` from update(). #120
// migrated a representative block (wake → fauna → props → hud); #130 finishes the job — every
// remaining hand-wired tick is migrated here, BYTE-FOR-BYTE preserving the old call order + args, so
// main.js no longer hand-wires the loop and a future slice (battle #100, fixed-timestep #36) plugs a
// system in with ONE register() call instead of editing update().
//
// Two mechanisms keep it from re-bloating (DL #5):
//   • the SAME mutable frame `ctx` flows through every system — the `mode` system threads the frame's
//     control-state onto it (fighting/paused/mode/harbourDistance/seenThrough), replacing the old
//     loop-local vars, so a later system reads them off ctx instead of a shared closure local.
//   • `when(ctx)` declares a system's mode/condition gate (e.g. only while NOT paused) — folding the
//     old scattered inline `if (!paused)` / `if (blend > 0)` guards into a declaration on the system.
// Orders are spaced by 10 so a new system slots between two existing ones without renumbering.
const systems = createSystemsRegistry();
let lastPaused = false; // last frame's helm-paused verdict (mode system), surfaced for QA
// — control state: combat drives BATTLE (ending it returns the helm to SAILING); thread the frame's
//   fighting/paused/mode onto ctx for the systems below + the battle seam (#95/#100). No behaviour change.
systems.register({ name: 'mode', order: 10, update: (f) => {
  f.fighting = duel.state.active || cannons.state.active;
  // BATTLE is HELD by either a live cannonade/duel (reactive) OR the deliberate battle stance
  // (#135): squaring up to a sail puts you in battle before a shot is fired, and a Flee returns
  // the helm. A cannonade fought inside the stance ends it (battle.end in cannons.onEnd).
  f.inBattle = f.fighting || battle.state.active;
  if (f.inBattle) { if (!mode.is(BATTLE)) mode.enter(BATTLE); }
  else if (mode.is(BATTLE)) mode.leave();
  // The DELIBERATE battle stance (#135 slice 2) keeps the helm LIVE so you can maneuver for a beam
  // angle and fire a real-time broadside — TOWN and a reactive turn-based exchange still pause it.
  f.deliberateStance = battle.state.active && !duel.state.active && !cannons.state.active;
  f.paused = mode.playerPaused && !f.deliberateStance;
  lastPaused = f.paused; // surfaced on the QA state hook so the playtest can assert a live helm
  f.mode = mode.current;
} });
// — reload the broadside guns on the sim clock while the deliberate stance is held (#135 slice 2).
systems.register({ name: 'battle-reload', order: 12, when: () => battle.state.active, update: (f) => battle.tick(f.dt) });
// — advance the SAILING↔TOWN gesture on the sim's dt (deterministic, headless-safe) (#102)
systems.register({ name: 'landfall-step', order: 20, update: (f) => landfall.step(f.dt) });
// — distance to the nearest port for the harbour coast-in; suspended while leaving (#67). Used by
//   the sailing assist (below) and the mode-aware music bed (#94). Infinity = assist stood down.
systems.register({ name: 'harbour-distance', order: 30, update: (f) => {
  f.harbourDistance = Infinity;
  if (harbourAssistActive(leftHarbour)) {
    for (const p of ports.ports) {
      const d = Math.hypot(f.state.pos.x - p.pos[0], f.state.pos.z - p.pos[1]);
      if (d < f.harbourDistance) f.harbourDistance = d;
    }
  }
} });
// — the ship physics step (#76 c): always runs; a paused helm eases to a near-stop, a harbour
//   approach coasts in. Helm input is ignored while paused.
systems.register({ name: 'sailing', order: 40, update: (f) => sailing.step(f.dt, f.t, { fighting: f.paused, harbourDistance: f.harbourDistance, harbourRadius: DOCK_RADIUS }) });
// — contested-rumour soft clock (#133): advance the rival's race every frame (even ASHORE — that's
//   the whole point: dawdle in town and they close the gap), regardless of mode. When the clock
//   runs out the rival CLAIMS the prize; ring a wry beat once + lock it in. Runs BEFORE `ports`
//   (order 140) so a same-frame expiry is settled before arrival decides win vs lose.
systems.register({ name: 'contest', order: 45, when: (f) => isContested(f.state.objective) && !isClaimed(f.state.objective), update: (f) => {
  const after = tickContest(f.state.objective, f.dt);
  f.state.objective = after;
  if (isClaimed(after)) {
    persistence.write();                                  // lock the claim so a reload can't reset the clock
    try {
      hud.flashBanner('⚑ Beaten to it…',
        `Word reaches you too late — ${rivalName(after)} has claimed the prize at ${after.target.name} first.`);
    } catch { /* a flourish must never break the loop */ }
  }
} });
// — reactive-loop "drawing near" cue (#116): ring a hopeful horizon nod ONCE when the ship crosses
//   inward through the approach radius toward the chased rumour's target. Edge-triggered (pure
//   approachCrossed), so it sings as you close on the pin — never every frame, never twice. Resets
//   when there's no chase/target so the next chase starts cleanly outside the radius.
let prevTargetDist = Infinity;
systems.register({ name: 'loop-cue-approach', order: 46, update: (f) => {
  const t = f.state.objective?.target;
  if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.z)) { prevTargetDist = Infinity; return; }
  const dist = Math.hypot(f.state.pos.x - t.x, f.state.pos.z - t.z);
  if (approachCrossed(prevTargetDist, dist, APPROACH_RADIUS)) music.loopCue('approach');
  prevTargetDist = dist;
} });
// — reactive-loop "rival sail sighted" sting (#116 follow-up): the world's "uh-oh, company" beat.
//   Ring a short, tense LOW sting ONCE when a HOSTILE (outlaw) sail first crosses the sighting
//   horizon — the audible warning that primes an encounter/battle, far ahead of any hail/cannon.
//   A hysteresis latch (pure sightingEdge) fires it once per sighting and re-arms only after the
//   nearest hostile draws back off past the horizon, so a rival loitering near never spams the cue.
//   Drives off live NPC state (snapshot kind + position) — no AudioContext needed, so the headless
//   gate exercises it too. Starts DISARMED so a sail already in view at session load isn't a false sting.
let rivalArmed = false;
systems.register({ name: 'loop-cue-rival', order: 47, update: (f) => {
  let nearest = Infinity;
  for (const n of npcs.snapshot()) {
    if (!isOutlaw(n.kind) || !Array.isArray(n.pos)) continue;
    const d = Math.hypot(f.state.pos.x - n.pos[0], f.state.pos.z - n.pos[1]);
    if (d < nearest) nearest = d;
  }
  const next = sightingEdge(rivalArmed, nearest, RIVAL_SIGHT_RADIUS);
  rivalArmed = next.armed;
  if (next.fire) music.loopCue(RIVAL_SAIL_CUE);
} });
// — landfall camera ease (#102): only while the gesture is in flight (when blend>0), slide the
//   chase cam toward a closer "ashore" framing of the moored ship.
systems.register({ name: 'landfall-camera', order: 50, when: () => landfall.blend > 0, update: (f) => {
  const lfBlend = landfall.blend;
  const hy = ship.position.y;
  const ax = f.state.pos.x - Math.sin(f.state.heading + 0.55) * 40; // pulled in beside the bow, 3/4 on
  const az = f.state.pos.z - Math.cos(f.state.heading + 0.55) * 40;
  camera.position.lerp(new THREE.Vector3(ax, hy + 16, az), lfBlend); // mix(chase, ashore, blend)
  camera.lookAt(f.state.pos.x, hy + 8 - 3 * lfBlend, f.state.pos.z);  // settle the gaze onto the deck
} });
// — battle quarter-view (#135): while the deliberate stance is held (and no town gesture is in
//   flight), swing the helm astern and to the ship's quarter so the player SEES their ship square
//   up to the foe — the Sid Meier's Pirates! framing. Pure geometry in systems/battle.js; here we
//   ease toward it so the swing reads as a crafted "change of stance", not a snap. Runs after the
//   sailing chase-cam write (order 40), so it overrides the follow only while engaged.
systems.register({ name: 'battle-camera', order: 52, when: () => battle.state.active && landfall.blend === 0, update: (f) => {
  const hy = ship.position.y;
  const [qx, qy, qz] = quarterViewPos([f.state.pos.x, f.state.pos.z], f.state.heading);
  camera.position.lerp(new THREE.Vector3(qx, hy + qy, qz), Math.min(1, f.dt * 2.2)); // eased swing
  camera.lookAt(f.state.pos.x, hy + 6, f.state.pos.z); // gaze holds on your own deck, foe off the quarter
} });
// — reactive-verb juice (#155): age the transient combat game-feel on the sim clock (deterministic,
//   headless-safe). loop() reads juice.cameraOffset()/flashLevel() and applies the 0-draw shake +
//   flash AFTER the camera systems have set the base pose, so the kick rides on top of the framing.
systems.register({ name: 'juice', order: 56, update: (f) => juice.update(f.dt) });
// RENDERED CANNONBALLS (#161 slice 4): age the pooled shots + puffs, then write the two InstancedMeshes —
// but only while anything is live (+ the one frame it goes quiet, to zero the last instances), so a calm
// sea pays nothing beyond the two idle batch draws. Runs every frame (transient VFX outlive the volley).
systems.register({ name: 'projectiles', order: 57, update: (f) => {
  projectiles.update(f.dt);
  const live = projectiles.active();
  if (live || projWasActive) writeProjectiles();
  projWasActive = live;
} });
// — disguise disposition beats (#79/#91): only while the helm is free AND flying false colours
//   (the `when` gate replaces the old inline `if (!paused && isDeceptive)`). Latches the seen-through
//   verdict once per approach and fires the matching beat; writes ctx.seenThrough for npcs (below).
systems.register({ name: 'disguise', order: 60, when: (f) => !f.paused && isDeceptive(f.state.colours), update: (f) => {
  if (duel.inRange()) {
    if (fooledArmed) {
      fooledArmed = false;
      seenThroughLatched = isSeenThrough(f.state.infamy ?? 0, f.state.colours, detectRng);
      if (seenThroughLatched) hud.flashBanner('🕵 Rumbled!', pickLine(SEEN_THROUGH_LINES));
      else hud.flashBanner('🏳 They wave you in…', pickLine(FOOLED_LINES));
    }
    f.seenThrough = seenThroughLatched;
  } else {
    fooledArmed = true;       // out of range → the next approach re-rolls the risk
    seenThroughLatched = false;
  }
} });
// — the world keeps living (#95): other vessels sail on every frame, reacting to the colours SHOWN
//   (False Colours #79 / Seen-through #91 read ctx.seenThrough from the disguise system above).
systems.register({ name: 'npcs', order: 70, update: (f) => {
  const flee = npcFlees({ colours: f.state.colours, infamy: f.state.infamy ?? 0, seenThrough: f.seenThrough });
  // Dedicated BATTLE arena-foe (#135, Option-4 final slice): while a deliberate stance is held and she
  // hasn't yet struck her colours or been boarded, hand her index + your pose + her nerve to the foe
  // helm so she actively sails to FIGHT (seek beam / hold range / flee) instead of drifting on her old
  // waypoint. A struck (surrenderPending) or boarded foe heaves to — she stops maneuvering.
  const bs = battle.state;
  const arena = (bs.active && !bs.surrenderPending && !bs.boarded && bs.foeIndex >= 0) ? {
    index: bs.foeIndex,
    playerPos: [f.state.pos.x, f.state.pos.z],
    playerHeading: f.state.heading,
    moraleFrac: bs.maxMorale > 0 ? bs.enemyMorale / bs.maxMorale : 1,
  } : null;
  npcs.update(f.dt, f.t, { playerPos: [f.state.pos.x, f.state.pos.z], flee, arena });
} });
// — emergent at-sea encounter (#125): seeded spawn (only while under sail, helm free); pose the
//   founderer low + heeled when live, hide her otherwise (~1 draw call exactly when on screen).
systems.register({ name: 'encounter', order: 80, update: (f) => {
  // Hard battle isolation (#161 slice 1): the helm stays LIVE in the deliberate stance (f.paused is
  // false), so the old `!f.paused` gate let a founderer heave into view mid-fight — a third hull in
  // the arena + a rescue panel stealing 1/2. `ambientInteractionsAllowed` folds "helm free" together
  // with "not fighting", so a founderer is DEFERRED until the fight ends, never spawned into it.
  encounter.update(f.dt, { canSpawn: ambientInteractionsAllowed({ paused: f.paused, battleActive: battle.state.active }) });
  if (encounter.state.active && encounter.state.ship) {
    const fx = encounter.state.ship.x, fz = encounter.state.ship.z;
    const fy = ocean.sampleHeight(fx, fz, f.t);
    founderMesh.position.set(fx, fy - 0.8, fz);                 // settled low — taking on water
    const heel = 0.34 + Math.sin(f.t * 0.8) * 0.05;            // a sick, heaving list to one side
    founderMesh.rotation.set(Math.sin(f.t * 1.1) * 0.06, encounter.state.bearing, heel);
    if (!founderMesh.visible) founderMesh.visible = true;
  } else if (founderMesh.visible) {
    founderMesh.visible = false;
  }
} });
// — light arcade beats (#76 c) as the ship squares up for a fight or coasts into a berth.
systems.register({ name: 'combat-beats', order: 90, update: (f) => {
  if (f.fighting && !wasFighting) hud.flashBanner('⚔ Battle stations!', FIGHT_REEF_LINES[fightBeat++ % FIGHT_REEF_LINES.length]);
  wasFighting = f.fighting;
  const harbourSettling = !f.paused && f.state.settling;
  if (harbourSettling && !wasHarbourSettling) hud.flashBanner('⚓ Easing into the berth…', BERTH_LINES[berthBeat++ % BERTH_LINES.length]);
  wasHarbourSettling = harbourSettling;
} });
// — the sea: glassy "moored" swell settle over the landfall gesture (#102 ph2), then the ocean tick.
systems.register({ name: 'ocean', order: 100, update: (f) => {
  ocean.setSwellScale(mooredSwellScale(landfall.blend));
  ocean.update(f.t, camera.position);
} });
// — optional day-night cycle (#58): no-op while OFF.
systems.register({ name: 'daynight', order: 110, update: (f) => daynight.update(f.dt) });
// — scene grade composition (CRITICAL ORDER): reputation cast (#126) over day-night (#58), warm
//   "golden harbour" glow (#102) over the top — exactly the old applyReputationGrade→applyLandfallGrade order.
systems.register({ name: 'reputation-grade', order: 120, update: () => applyReputationGrade() });
// — your ship wears your legend (#132 Slice A, DL #5): cast the hero ship's sail + hull off the SAME
//   signed lean reputation-grade just wrote to repLean — Infamy grimes/darkens, Standing cleans/glows.
//   Uniform writes only (colour/roughness/emissive), zero new draws; neutral leaves the ship untouched.
systems.register({ name: 'ship-aura', order: 122, update: () => { shipAuraLive = applyShipAura(repLean) || shipAuraLive; } });
systems.register({ name: 'landfall-grade', order: 130, update: () => applyLandfallGrade() });
// — arrival detection (fires onArrive once → auto-harbour) + buoy bob (#67/#96).
systems.register({ name: 'ports', order: 140, update: (f) => ports.update(f.state, onArrive, f.t) });
// — auto-harbour bookkeeping: drop the leave-latch once we've cleared the harbour mouth (#67/#96).
systems.register({ name: 'left-harbour', order: 150, update: () => { leftHarbour = nextLeftHarbour(leftHarbour, { docked: ports.docked, leaving: false }); } });
// — the town view takes the screen only once the gesture is fully ASHORE (#102), and the <body> class
//   tracks it (cached so we only touch the DOM on a real change).
systems.register({ name: 'town-view', order: 160, update: () => {
  const showTown = mode.is(TOWN) && landfall.townReady;
  town.setOpen(showTown);
  if (showTown !== bodyTown) { bodyTown = showTown; if (document.body) document.body.classList.toggle('town', showTown); }
} });
// — name + flavour the first time you near a named isle (#19).
systems.register({ name: 'islands', order: 170, update: (f) => islandNamer.update(f.state.pos, onApproachIsland) });
// — the #120-migrated block, unchanged: wake (bow foam) → fauna (#97 gulls) → props (#101 dressing) → hud compass.
systems.register({ name: 'wake', order: 180, update: (f) => wake.update(f.dt, f.state, f.t) });
systems.register({ name: 'fauna', order: 190, update: (f) => fauna.update(f.dt, f.t, {
  shipPos: [f.state.pos.x, f.state.pos.z], focus: camera.position,
  heading: f.state.heading, speed: f.state.speed,                 // #110: pod rides the moving ship
  sampleHeight: (x, z) => ocean.sampleHeight(x, z, f.t),          // surface at the waterline
}) });
systems.register({ name: 'props', order: 200, update: (f) => props.update([f.state.pos.x, f.state.pos.z]) });
systems.register({ name: 'hud', order: 210, update: (f) => hud.update(f.state, sailing.MAX_SPEED) });
// Reputation needle (#132): ease the gauge + fire the felt-shift sting/line. Right after the HUD so
// it reads the same per-frame ledger; before legends so the swing lands ahead of any crown overlay.
systems.register({ name: 'reputation-needle', order: 215, update: (f) => repNeedle.update(f.state, f.dt) });
// — endgame legend crowns (#46) + invisible onboarding nudge/beats (#60).
systems.register({ name: 'legends', order: 220, update: () => checkLegends() });
// — endgame governorship (#119): the lawful arc's NAMED capstone, just after the pole legends.
systems.register({ name: 'governorship', order: 221, update: () => checkGovernorship() });
systems.register({ name: 'onboarding', order: 230, update: () => checkOnboarding() });
// — the charts: north-up radar (#16) + route-planning chart (only redraws while open) (#54).
systems.register({ name: 'minimap', order: 240, update: (f) => minimap.update(f.state) });
systems.register({ name: 'bigmap', order: 250, update: (f) => bigmap.update(f.state) });
// — combat/encounter HUD panels (#33/#59/#125).
systems.register({ name: 'hud-duel', order: 260, update: () => hud.renderDuel(duel.snapshot()) });
systems.register({ name: 'hud-cannons', order: 270, update: () => hud.renderCannons(cannons.snapshot()) });
// — real-time broadside panel (#135 slice 2): hull bars + the live ABEAM / reload cue + Fire prompt.
systems.register({ name: 'hud-battle', order: 275, update: () => hud.renderBattle(battle.snapshot()) });
// — per-phase raid tracker (#135, Option-4 polish): names the act (⚔ Maneuver › 🪝 Boarding › 🗣 Duel)
//   and surfaces the coupling earned; read-only, spans the battle + the boarded duel snapshots.
systems.register({ name: 'hud-raid-phases', order: 276, update: () => hud.renderRaidPhases(battle.snapshot(), duel.snapshot()) });
// — TARGET LOCK (#161 slice 3): the fun beat — the instant battle starts the engaged foe is
//   unmistakably marked (a world-anchored target ring above her) and the rest of the sea recedes, so
//   you always know who you're fighting. Runs AFTER the battle-camera swing (order 52) and re-derives
//   the camera's matrices so the ring tracks the foe deterministically under tw.step() too. Zero draws:
//   npc.js dims the traffic via material opacity; the ring is a projected DOM billboard. Clears on flee.
function syncTargetLock(t) {
  const bs = battle.state;
  const active = bs.active && bs.foeIndex >= 0;
  npcs.setBattleFocus(active ? bs.foeIndex : -1); // recede non-combatants; restore all when cleared
  const snap = active ? battle.snapshot() : null;
  const fp = snap ? snap.foePos : null;
  if (!active || !fp) {
    foeMarker.hide();
    foeMarker.setRing(false);
    aimMarker.setOdds(''); // clear the legible-odds read (#166) with the aim line
    aimMarker.hide();
    lastTargetLock = { active: false, foeIndex: -1, onScreen: false, screen: null };
    lastAim = { active: false, onScreen: false, level: '', onTarget: false, quality: 0, spreadDeg: 0, side: 'starboard' };
    lastOdds = { active: false, tier: '', verdict: '', edge: 0, stronglyFavoured: false, couldLuckFlip: false, favoured: false };
    return;
  }
  const [fx, fz] = fp;
  const fy = ocean.sampleHeight(fx, fz, t) + MARKER_HEIGHT;
  camera.updateMatrixWorld();
  foeMarkerVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const p = projectToScreen([fx, fy, fz], foeMarkerVP.elements, window.innerWidth, window.innerHeight);
  foeMarker.setRing(true);
  foeMarker.place({ x: p.x, y: p.y, visible: p.onScreen });
  lastTargetLock = { active: true, foeIndex: bs.foeIndex, onScreen: p.onScreen, screen: [p.x, p.y] };

  // Aim-angle feedback (#161 slice 5): draw the AIM LINE from your deck to the foe, coloured + tightened
  // off the LIVE broadside reading (read-only — the aim maths in broadsideAim is untouched). It springs
  // from the ship's deck (projected with the SAME VP as the ring) toward the foe end at the waterline, so
  // the player SEES their firing solution light up as they come abeam, before pressing SPACE.
  const readout = aimReadout({ quality: snap.aimQuality, inArc: snap.inArc, side: snap.aimSide });
  const sx = state.pos.x, sz = state.pos.z;
  const sy = ocean.sampleHeight(sx, sz, t) + DECK_HEIGHT;
  const shipEnd = projectToScreen([sx, sy, sz], foeMarkerVP.elements, window.innerWidth, window.innerHeight);
  const foeEnd = projectToScreen([fx, ocean.sampleHeight(fx, fz, t) + DECK_HEIGHT, fz], foeMarkerVP.elements, window.innerWidth, window.innerHeight);
  const aimVisible = shipEnd.onScreen && foeEnd.onScreen;
  aimMarker.place({ from: { x: shipEnd.x, y: shipEnd.y }, to: { x: foeEnd.x, y: foeEnd.y }, readout, visible: aimVisible });
  lastAim = { active: true, onScreen: aimVisible, level: readout.level, onTarget: readout.onTarget, quality: readout.quality, spreadDeg: readout.spreadDeg, side: readout.side };

  // Legible odds (#166): the fair-fight READ, docked in the aim indicator's reserved `.aim-odds` slot.
  // PURE + read-only: combatOdds turns the deterministic inputs — the class matchup (her hull + gunnery),
  // your live aim GEOMETRY (skill), your loaded shot (ammo) and both hulls — into a plain verdict + the
  // bounded ±20% margin BAND. Nothing here touches the combat math or the luck bounds; it only READS them.
  // The stake hint reads #164's defeatLedger nominals for THIS foe's tier, so the odds also name what a
  // loss would cost — "reckless, and it stings this much". Only when the aim line itself is on screen.
  const odds = combatOdds({
    playerHull: snap.playerHull, enemyHull: snap.enemyHull, gunnery: snap.foeGunnery,
    ammo: snap.ammoProfile, aimQuality: snap.aimQuality,
  });
  let stake = {};
  if (Number.isFinite(snap.foeTier)) {
    const led = defeatLedger(snap.foeTier, defeatContext(state.infamy ?? 0, state.standing ?? 0));
    stake = { stakeCoin: led.nominalCoin, stakeFame: led.nominalFame };
  }
  aimMarker.setOdds({ ...oddsReadout(odds, stake), bar: odds.bar });
  lastOdds = {
    active: true, tier: odds.tier, verdict: odds.verdict, edge: odds.edge,
    stronglyFavoured: odds.stronglyFavoured, couldLuckFlip: odds.couldLuckFlip, favoured: odds.favoured,
    yourDamage: odds.yourDamage, herDamage: odds.herDamage, marginPct: odds.luck.marginPct,
    barLo: odds.bar.lo, barHi: odds.bar.hi,
  };
}
systems.register({ name: 'target-lock', order: 278, update: (f) => syncTargetLock(f.t) });
// — OVER-SHIP THREAT LABELS (#165): the fun beat — glance across the sea and instantly read a fat
//   merchant prize ("Merchant Sloop ·") from a deadly warship ("Warship Man-o'-War ☠☠☠☠"), so you CHOOSE
//   your fight before committing. Projects each classed hull's world anchor to screen (the SAME 0-draw
//   billboard + VP projection as the target ring), sets its threat LABEL + colour band, and lets the pure
//   declutter rule (nearest-first, fade with distance, cap by viewport) decide what renders. During a
//   fight the traffic's labels recede (ineligible) so the foe's label + ring read clean on one anchor.
function syncThreatLabels(t) {
  if (!threatPool.length) return;
  const snap = npcs.snapshot();
  const bs = battle.state;
  const battleActive = bs.active && bs.foeIndex >= 0;
  camera.updateMatrixWorld();
  threatVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const cam = camera.position;
  const W = window.innerWidth, H = window.innerHeight;
  const entries = [];
  for (let i = 0; i < threatPool.length; i++) {
    const s = snap[i];
    if (!s || !s.shipClass) { entries.push({ index: i, onScreen: false, distance: Infinity, eligible: false, info: null, screen: null }); continue; }
    const [x, z] = s.pos;
    const y = ocean.sampleHeight(x, z, t) + THREAT_LABEL_HEIGHT;
    const p = projectToScreen([x, y, z], threatVP.elements, W, H);
    const distance = Math.hypot(x - cam.x, y - cam.y, z - cam.z);
    // In a fight only the engaged foe keeps her label (the traffic recedes) so the foe's label + ring
    // read clean together; at sea every hull is eligible so you can survey the whole board.
    const eligible = !battleActive || i === bs.foeIndex;
    entries.push({ index: i, onScreen: p.onScreen, distance, eligible, info: threatLabelFor(s.shipClass), screen: [p.x, p.y] });
  }
  const decision = selectLabels(entries, { near: THREAT_NEAR, far: THREAT_FAR, maxLabels: maxLabelsForViewport(W) });
  const shot = [];
  for (let i = 0; i < threatPool.length; i++) {
    const bb = threatPool[i], e = entries[i];
    const opacity = decision[i];
    if (opacity == null || !e || !e.info) {
      bb.hide(); bb.setLabel('');
      shot.push({ index: i, shown: false, text: '', tier: e && e.info ? e.info.tier : 0, level: e && e.info ? e.info.level : '', glyphs: e && e.info ? e.info.glyphs : '', opacity: 0, onScreen: !!(e && e.onScreen), screen: e ? e.screen : null });
      continue;
    }
    bb.setLabel(e.info.text);
    setThreatLevelClass(bb.el, e.info.level);
    if (bb.el) bb.el.style.opacity = opacity.toFixed(3);
    bb.place({ x: e.screen[0], y: e.screen[1], visible: true });
    shot.push({ index: i, shown: true, text: e.info.text, tier: e.info.tier, level: e.info.level, glyphs: e.info.glyphs, opacity, onScreen: e.onScreen, screen: e.screen });
  }
  lastThreatLabels = shot;
}
systems.register({ name: 'threat-labels', order: 277, update: (f) => syncThreatLabels(f.t) });
// — HOVER-TO-INTERACT (#161 slice 6, the FINAL lane slice): the fun beat — point at a ship and it lights
//   up with what you can DO to it (a projected ring + a "Give battle / Hail / Board" label above her mast),
//   so the sea is directly manipulable, not a hidden keymap. The raycast (which hull) happens on
//   pointermove; THIS frame system RE-DERIVES the contextual action from the live world state each frame
//   (so the affordance stays correct as she becomes boardable / the fight ends) and glues the marker to
//   the moving hull by projecting her world position — the SAME 0-draw billboard + VP projection as the
//   target ring. Hidden when nothing is hoverable (out of range, a non-combatant mid-fight, a menu open).
function syncHoverAffordance(t) {
  const idx = hoveredShip;
  const snap = (idx >= 0 && canPick()) ? npcs.snapshot()[idx] : null;
  const bs = battle.state;
  const action = snap ? pickShipAction({
    battleActive: bs.active, foeIndex: bs.foeIndex, index: idx,
    canBoard: battle.canBoard(), outlaw: isOutlaw(snap.kind), inRange: shipInRange(snap.pos),
  }) : null;
  if (!snap || !action) {
    hoverMarker.hide();
    hoverMarker.setRing(false);
    hoverMarker.setLabel('');
    lastHover = { index: -1, action: null, onScreen: false, screen: null };
    return;
  }
  const [hx, hz] = snap.pos;
  const hy = ocean.sampleHeight(hx, hz, t) + HOVER_MARKER_HEIGHT;
  camera.updateMatrixWorld();
  hoverMarkerVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const p = projectToScreen([hx, hy, hz], hoverMarkerVP.elements, window.innerWidth, window.innerHeight);
  hoverMarker.setRing(true);
  hoverMarker.setLabel(actionLabel(action));
  hoverMarker.place({ x: p.x, y: p.y, visible: p.onScreen });
  lastHover = { index: idx, action, onScreen: p.onScreen, screen: [p.x, p.y] };
}
systems.register({ name: 'hover-affordance', order: 279, update: (f) => syncHoverAffordance(f.t) });
// — The Bosun's First Duel (#157): during the scaffolded debut, the bosun CALLS the next verb aloud in
//   the banner as each phase becomes legal (maneuver→board→surrender), once per phase change. It reads
//   the same live battle snapshot the prompts/earcons do, so the voice can never drift from the verbs.
systems.register({ name: 'debut-cues', order: 274, when: () => debutActive && battle.state.active, update: () => {
  const phase = debutPhase(battle.snapshot());
  if (phase && phase !== debutPhaseShown) {
    debutPhaseShown = phase;
    const cue = debutCue(phase);
    if (cue) { try { hud.flashBanner('🎓 The Bosun calls out', cue.line); } catch { /* a flourish must never break the fight */ } }
  }
} });
// — contextual just-in-time key-prompts (#153, onboarding): teaches each battle verb (fire · change
//   shot · board · accept/press) the instant it becomes possible, then fades once used. Read-only.
//   Battle-verb EARCONS (#154, the audio half): when a verb-window opens, the component returns a short
//   distinct earcon name — armed on the music bus (quantised/ducked/mute-covered like every #116 cue) so
//   the captain learns WHICH verb + WHEN by ear. `lastBattleEarcon` is a headless QA surface (below).
let lastBattleEarcon = null;
systems.register({ name: 'hud-key-prompts', order: 277, update: () => {
  const earcon = hud.renderKeyPrompts(battle.snapshot(), duel.snapshot());
  if (earcon) { lastBattleEarcon = earcon; music.loopCue(earcon); }
} });
// Hard battle isolation (#161 slice 1): a fight hides the rescue-vs-plunder choice panel too, so a
// founderer that was alongside when you squared up can't paint her plea over the battle. Feeding an
// inactive snapshot dismisses the panel; the encounter state itself is untouched and resumes on flee.
systems.register({ name: 'hud-encounter', order: 280, update: () => hud.renderEncounter(
  interactionsSuppressed({ battleActive: battle.state.active }) ? { active: false } : encounter.snapshot()) });
// — sea ambience + adaptive sailing theme level (#48).
systems.register({ name: 'audio', order: 290, update: (f) => audio.update({ speed: f.state.speed, maxSpeed: sailing.MAX_SPEED }) });
// — per-town music identity (#69): re-key the tavern drone to the nearest harbour, only on a change.
systems.register({ name: 'town-music', order: 300, update: (f) => {
  const nearPort = ports.nearestPortName(f.state.pos);
  if (nearPort && nearPort !== themePort) {
    themePort = nearPort;
    music.setTownTheme(townMusicIdentity(nearPort));
  }
} });
// — mode-aware music bed (#94): WHERE the player is (mode + nearest-port distance) drives the crossfade.
// — mode-aware music bed (#94) + the harmonic reputation needle (#132 Slice B): WHERE the player is
//   drives the sea/port crossfade, and the SAME signed lean (repLean) reputation-grade wrote this frame
//   recolours the lead's MODE — Infamy → a freygish "bite", Standing → a warm Lydian voicing, neutral →
//   the honest D-major hornpipe. Order 310 (after reputation-grade@120), so repLean is fresh.
// — per-phase battle signatures (#158): the raid ACT (⚔ Maneuver / 🪝 Boarding / 🗣 Duel, from the
//   shipped #135 raidPhaseModel, or null at sea) arms a distinct battle music LAYER that cross-fades
//   in on the phase transition (bar-quantised) — so you HEAR which act of the fight you're in.
systems.register({ name: 'music', order: 310, update: (f) => {
  const raid = raidPhaseModel(battle.snapshot(), duel.snapshot());
  music.update({ speed: f.state.speed, maxSpeed: sailing.MAX_SPEED, rudder: f.state.rudder, wave: ocean.swellScale, mode: mode.current, portDistance: f.harbourDistance, dockRadius: DOCK_RADIUS, lean: repLean, raidAct: raid ? raid.actKey : null });
} });

function update(dt, t) {
  // The WHOLE per-frame loop is the systems registry now (#130, DL #5). Every system registered
  // above ticks here in deterministic `order`, each handed the SAME mutable frame ctx: dt/t/state
  // plus the control-state the `mode` system threads onto it (fighting/paused/mode/harbourDistance)
  // and the disguise system's seenThrough (seeded false each frame so a skipped disguise tick reads
  // exactly as the old `let seenThrough = false`). main.js no longer hand-wires the loop — battle
  // (#100) registers its ordered sub-loop with one register() + a when(ctx) gate, not by editing this.
  systems.run({ dt, t, state, seenThrough: false });
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

// Endgame governorship (#119): the lawful arc's NAMED capstone — the mirror of the legend-crown
// (#46). The first frame your home port stands at its top tier AND your Standing crosses the
// governor threshold, the isle proclaims you its Governor: a one-time crown overlay, a Ballad
// verse, the title locked into the save, and an acknowledgement waiting at your home quay. The
// sandbox sails on after — a milestone, not a game-over.
function checkGovernorship() {
  if (state.governorship) return;
  if (!earnedGovernorship({ harbour: state.harbour, standing: state.standing ?? 0 })) return;
  state.governorship = true;
  const title = governorTitle(state.harbour);
  logDeed({ type: 'governorship', port: state.harbour.name, title }); // crown the Ballad (#78)
  hud.showGovernorship(state.harbour, {
    infamy: state.infamy ?? 0,
    standing: state.standing ?? 0,
    renown: state.renown ?? ((state.infamy ?? 0) + (state.standing ?? 0)),
    coins: state.coins ?? 0,
    title,
  });
  persistence.write(); // lock the governorship the moment it's earned
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
      const obj = state.objective;
      const contested = isContested(obj);
      const claimed = isClaimed(obj);                      // the rival beat you to it (#133)
      const rival = rivalName(obj);
      const { coins } = payoffFor(obj);                    // 0 when the rival has already claimed it
      initEconomy(state);
      state.coins += coins;
      // Both the win-race and lose-race paths sing into the Ballad (#133 DoD): a contested deed
      // carries the rival + whether you `won` (arrived in time); an ordinary tip just the payoff.
      const rumourDeed = contested
        ? { type: 'rumour', name: portName, coins, rival, won: !claimed }
        : { type: 'rumour', name: portName, coins };
      // The tip resolves: bright PAYOFF (or sour LOSS to a rival's wake), with a coin-chime layered
      // under the flourish when it actually pays coin — the "ka-ching" the ear waits for (#116).
      music.loopCue(payoffCueName({ claimed }), coinChimes({ claimed, coins }) ? { under: 'coin' } : undefined);
      logDeed(rumourDeed);                                 // sing it into the Ballad (#78)
      if (coins > 0) applyMoraleEvent('rumourWin');        // a tip that paid off, coin shared round — a good day (#124)
      state.portMemory = recordDeed(state.portMemory, portName, deedPhrase(rumourDeed)); // #104b — this port remembers the chase
      state.objective = null;                              // the chase is done — clear the pin
      persistence.write();
      if (contested && claimed) {
        hud.flashBanner('⚑ Beaten to it…',
          `${rival} reached ${portName} ahead of you and made off with the prize — nothing left but the tale and a grudge.`);
      } else if (contested) {
        hud.flashBanner('⚑ You beat them to it!',
          `You outran ${rival} to ${portName} — the prize is yours: ${coins} coins, and a rival arriving to your wake.`);
      } else {
        hud.flashBanner('⚑ The rumour paid off!',
          `Word ran true at ${portName} — a grateful contact slips you ${coins} coins for chasing the tip.`);
      }
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
// Reactive-verb juice (#155) render glue: the single full-screen flash overlay + the CSS gradients
// for its two tints (a red hull-hit vignette / a gold clean-hit flare). Grabbed once; a missing
// element (or a headless quirk) just means the flash silently no-ops.
const juiceFlashEl = document.getElementById('juice-flash');
const JUICE_FLASH_RED = 'radial-gradient(ellipse at center, rgba(0,0,0,0) 42%, rgba(196,26,26,0.95) 100%)';
const JUICE_FLASH_GOLD = 'radial-gradient(ellipse at center, rgba(255,240,205,0.9) 0%, rgba(255,224,150,0) 68%)';
function loop() {
  const rawDt = Math.min(clock.getDelta(), 0.05);
  simT = clock.elapsedTime;
  // #80 HIT-STOP: on a solid strike juice owes a few frames of freeze — zero the sim step for the real
  // frames it lasts so the world (ship/projectiles/battle timers) HOLDS on impact, then snaps back. The
  // freeze DRAINS on real wall-clock dt inside consumeHitStop (bounded ~5 frames), so it always
  // auto-resumes and can NEVER stall the loop; the procedural clock (simT) keeps ticking so the ocean
  // never freezes oddly and the world clock never desyncs. The deterministic tw.step() path does NOT
  // call this, so the fixed sim / mesh-conservation gate (#121) stays pristine.
  const dt = rawDt * juice.consumeHitStop(rawDt);
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
  // Reactive-verb juice (#155): apply the transient camera KICK (0-draw) just before the render, in
  // the camera's LOCAL axes so it reads as screen-shake/lunge regardless of the framing — then restore
  // the base pose so the effect never accumulates into the camera smoothing. Skipped in the QA cam.
  let juiceRestore = null;
  if (!qa) {
    const off = juice.cameraOffset();
    if (off.x || off.y || off.z) {
      juiceRestore = camera.position.clone();
      camera.translateX(off.x);       // screen-right
      camera.translateY(off.y);       // screen-up
      camera.translateZ(off.z);       // toward the foe on a boarding lunge (negative)
    }
  }
  // The hull hit-flash (#155): one DOM overlay's opacity + tint. ~0 GPU cost, reduce-motion aware.
  if (juiceFlashEl) {
    const jf = juice.flashLevel();
    if (jf.level > 0) {
      juiceFlashEl.style.background = jf.tint === 'red' ? JUICE_FLASH_RED : JUICE_FLASH_GOLD;
      juiceFlashEl.style.opacity = jf.level.toFixed(3);
    } else if (juiceFlashEl.style.opacity !== '0' && juiceFlashEl.style.opacity !== '') {
      juiceFlashEl.style.opacity = '0';
    }
  }
  renderer.render(scene, renderCam);
  if (juiceRestore) camera.position.copy(juiceRestore); // un-shake: keep the kick purely visual
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
      // Helm-paused verdict (#95/#135): true in TOWN and a reactive exchange; FALSE in the
      // deliberate battle stance (slice 2) where you maneuver for a broadside.
      paused: lastPaused,
      coins: state.coins ?? 0,
      // Two poles (#45) + their derived total, plus the current pole-aware title.
      infamy, standing, renown: state.renown ?? (infamy + standing),
      title: titleFor(infamy, standing).title,
      pole: dominantPole(infamy, standing),
      // Endgame crowns (#46): which legends this voyage has earned.
      legends: { pirate: !!state.legends?.pirate, governor: !!state.legends?.governor },
      // Home-isle governorship (#119): whether the named lawful crown is earned + its title.
      governorship: !!state.governorship,
      governorTitle: state.governorship ? governorTitle(state.harbour) : null,
      // Crew morale / loyalty (#124): the live 0..100 meter + its categorical tier — so a headless
      // playtest can drive a deed (driveMorale) and assert the crew warms/sours and the thresholds fire.
      morale: sanitizeMorale(state.morale),
      moraleTier: moraleTier(state.morale),
    };
  },
  // Deterministic perf snapshot (#52): draw calls / triangles / geometries / textures /
  // programs from renderer.info, plus fps + rolling ms/frame. The counters gate CI; the
  // budget ceilings travel with it so tooling can self-check without re-deriving them.
  get perf() { return { ...perf }; },
  get perfBudget() { return { ...BUDGET }; },
  get ports() { return ports.ports; },
  // Systems registry (#120, DL #4) QA surface: the migrated per-frame systems in their deterministic
  // dispatch order — so a headless playtest can assert the registry is wired and ordered as expected.
  get systems() { return systems.names; },
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
  // Your ship wears your legend (#132 Slice A, DL #5) QA surface: the live cast off the SAME signed
  // lean — the pole + commitment, and the ACTUAL applied sail/hull material (colour hex, roughness,
  // emissive glow) read straight off the cloned materials. So a headless playtest can drive the ledger
  // (setInfamy/setStanding) and assert the ship grimes/darkens toward Infamy, cleans/glows toward
  // Standing, and restores to the untouched ship at neutral. `applied` is false on a vessel with no
  // matched sail/hull mesh (the rare procedural-fallback edge) — the mapping is still proven by `lean`.
  get aura() {
    const live = shipAuraLive || shipAura(repLean);
    const read = (role) => {
      const p = shipAuraParts.find((q) => q.role === role);
      return p ? { color: p.mat.color.getHex(), roughness: p.mat.roughness, emissiveIntensity: p.mat.emissiveIntensity } : null;
    };
    return { lean: repLean, pole: live.pole, mag: live.mag, applied: shipAuraParts.length > 0, sail: read('sail'), hull: read('hull') };
  },
  // Reputation needle (#132, DL #5) QA surface: the live eased pointer position, its target, the
  // categorical pole + commitment tier, and the last FELT shift ({pole, delta, tier, cue, line}) —
  // so a headless playtest can drive the ledger (setInfamy/setStanding) and assert the needle swings
  // toward the pole and a shift registers a cue + a personal line. Deterministic; audio is guarded.
  get needle() { return repNeedle.snapshot(); },
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
  get town() { return { open: town.isOpen, port: town.port, leftHarbour, atHome: town.atHome, threatened: town.threatened }; },
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
  // Your Harbour, threatened (#134, DL #5) QA surface: the live persisted threat (or null), the
  // point-in-time eligibility off the live ledger, and the three drivers — so a headless playtest can
  // claim a home port, lean a pole hard, make landfall there to draw a threat, then resolve it both
  // ways and assert the coin/Standing/harbour move and survive a save round-trip. `forceThreat` lets a
  // test inject one without the landfall edge; `standHarbourFirm` rolls the seeded threat dice.
  get harbourThreat() { return sanitizeThreat(state.threat); },
  get harbourThreatEarnable() { return assessThreat({ harbour: state.harbour, infamy: state.infamy ?? 0, standing: state.standing ?? 0 }); },
  get harbourThreatOdds() { return standFirmOdds(state.harbour); },
  get harbourCanPayTribute() { return canPayTribute({ threat: state.threat, coins: state.coins ?? 0 }); },
  checkHarbourThreat() { return checkHarbourThreat(); },
  forceHarbourThreat() {
    const t = assessThreat({ harbour: state.harbour, infamy: state.infamy ?? 0, standing: state.standing ?? 0 });
    if (t) { state.threat = t; persistence.write(); town.render(); }
    return sanitizeThreat(state.threat);
  },
  payHarbourTribute() { return payHarbourTribute(); },
  standHarbourFirm() { return standHarbourFirm(); },
  // Governorship endgame (#119, DL #4) QA surface: the earned named crown ("Governor of [home isle]"
  // or null) + the point-in-time eligibility — so a headless playtest can grow a home port to its top
  // tier, climb Standing past the gate, and assert the isle crowns the captain its governor (and that
  // the crown survives a save round-trip). The per-frame crowning runs on the #130 systems registry.
  get governorship() { return state.governorship ? governorTitle(state.harbour) : null; },
  get governorshipEarnable() { return earnedGovernorship({ harbour: state.harbour, standing: state.standing ?? 0 }); },
  // Crew morale (#124, DL #4/#5) QA surface: the live 0..100 meter, and the deliberate deed driver —
  // so a headless playtest can apply a real morale event (rescue/plunder/rumourWin/harbourGrow/aground/
  // missedRescue) and assert the meter rises/falls, the grumble/mutiny beats fire, and it survives a
  // save round-trip. driveMorale funnels through the SAME pure model + persistence the live deeds use.
  get morale() { return sanitizeMorale(state.morale); },
  driveMorale(event) { applyMoraleEvent(event); return sanitizeMorale(state.morale); },
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
  // Reactive-loop diegetic cue (#116) QA surface: the NAME of the most recently armed loop cue
  // (listen/approach/payoff/loss, or null). Lets a headless playtest listen / approach a chased pin /
  // arrive and assert the right beat sang — without ever opening an AudioContext.
  get loopCue() { return music.lastCue(); },
  // The LAYERED cue armed under the last loop cue (the coin chime under a paying payoff, or null) —
  // so a headless playtest can assert the "ka-ching" rang when a tip paid coin, AudioContext-free (#116).
  get loopUnderCue() { return music.lastUnder(); },
  // Battle-verb EARCON (#154) QA surface: the NAME of the most recently armed availability earcon
  // (fireReady / boardable / surrenderOffer, or null) — so a headless playtest can open each verb-window
  // and assert the right earcon rang on its illegal→legal EDGE, without ever opening an AudioContext.
  get battleEarcon() { return lastBattleEarcon; },
  // Cold-start FTUE discoverability (#156) QA surface: the core keymap verbs (src/keymap.js) currently
  // SIGNIFIED to a fresh captain at THIS game-state — the union of the persistent #challenge-prompt (E
  // give battle), the standing #battle help (E break off), and the contextual #key-prompts strip (which
  // also arms the #154 earcon). Read-only; derived from the SAME pure model the strip paints, with an
  // empty learned-set. Lets the headless FTUE gate drive a fresh captain into each verb's legal edge and
  // assert it is discoverable — so a reachable verb can never silently ship un-taught again.
  get signifiers() { return [...signifiedVerbs(battle.snapshot(), duel.snapshot())]; },
  // Continuous WAKE/HELM water-bed (#150) QA surface: the wash layer's live drive [0,1], set each
  // frame from ship speed + helm — so a headless playtest can make way / swing the helm and assert
  // the sea sounds like moving water (fuller at speed, a gentle lap becalmed), AudioContext-free.
  get wake() { return music.wakeLevel(); },
  // Procedural HULL-CREAK voice (#81) QA surface: the live creak RATE (creaks/sec), recomputed each
  // frame from ship speed + helm + the swell she's riding — so a headless playtest can make way /
  // swing the helm and assert the timbers quicken from their idle settle, AudioContext-free.
  get creak() { return music.creakLevel(); },
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
  // Contested rumour (#133) QA surface: a deterministic SPAWN hook (force a contested chase of a
  // typed target → a named rival + soft clock on state.objective.contest) and a RESOLVE hook (run
  // the rival's clock out so they CLAIM the prize) — so a headless playtest can assert BOTH the
  // win-race (arrive in time → full reward + "beat them" verse) and lose-race (claimed → no reward
  // + "beaten to it" verse) paths, deterministically and headless-safe.
  chaseContested(target, opts) { return chaseObjective(target, { ...(opts || {}), contested: true }); },
  rivalClaim() {
    if (!isContested(state.objective) || isClaimed(state.objective)) return false;
    state.objective = tickContest(state.objective, (state.objective.contest.budget || 0) + 1);
    if (isClaimed(state.objective)) persistence.write();
    return isClaimed(state.objective);
  },
  get npcs() { return npcs.snapshot(); },
  // Ship classes (#163) QA surface. qaClassCombat() PROVES the class table scales the fight: it runs
  // the SAME clean beam broadside against the SAME target, once with a sloop-warship's gunnery and once
  // with a frigate-warship's, and returns the foe's return-fire (playerHit) for each — the frigate must
  // bite harder. Deterministic (fixed rng → jitter 1). qaPlaceShip(i,x,z) poses a hull for a gallery frame.
  qaClassCombat() {
    const rng = () => 0.5; // jitter multiplier == 1 → deterministic
    const target = { quality: 1, enemyHull: 100, playerHull: 100 };
    const sloop = shipStats('sloop', 'warship');
    const frigate = shipStats('frigate', 'warship');
    const manowar = shipStats('manowar', 'warship');
    return {
      sloopReply: resolveBroadside({ ...target, gunnery: sloop.gunnery }, rng).playerHit,
      frigateReply: resolveBroadside({ ...target, gunnery: frigate.gunnery }, rng).playerHit,
      manowarReply: resolveBroadside({ ...target, gunnery: manowar.gunnery }, rng).playerHit,
      sloopHull: sloop.hull, frigateHull: frigate.hull, manowarHull: manowar.hull,
    };
  },
  qaPlaceShip(i, x, z) { npcs.place(i, x, z); return npcs.snapshot()[i] || null; },
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
  // Seeded per-pass sea-theme variation (#117) QA surface: the live { seed, pass, displaced } so a
  // playtest can assert it's deterministic (same seed → same sequence) and that each loop glints in
  // key. `seaVariationFor(pass)` is a pure lookup for ANY pass (headless-safe; no AudioContext).
  get seaVariation() { return music.variation(); },
  seaVariationFor(pass) { return music.variation(pass); },
  // The harmonic reputation needle (#132 Slice B, DL #5) QA surface: the live modal recolour the lead
  // is wearing off the SAME signed lean as Slice A's hull — { pole, blend, scale }. Headless-safe (the
  // music system sets it from repLean every frame with no AudioContext), so a playtest can swing the
  // ledger and assert the SCORE recolours: freygish "bite" toward Infamy, warm Lydian toward Standing,
  // the untouched D-major Ionian at neutral. The crossfade through musicGain means mute still covers it.
  get harmony() { return music.mood(); },
  // Per-phase battle signatures (#158) QA surface: the live battle-layer cast — the raid ACT the fight
  // is in (⚔ maneuver / 🪝 boarding / 🗣 duel, or null at sea) + its distinct { scale, drive, octave },
  // set from the raid act every frame with NO AudioContext — so a playtest can drive a fight and assert
  // each act maps to a distinct musical layer (a different mode/register, not merely louder).
  get battleScore() { return music.battleScore(); },
  // Invisible onboarding (#60) QA surface: the live progress flags, the next step, and
  // whether the seeded goal card is currently on screen.
  get onboarding() {
    const flags = normalizeFlags(state.onboarding);
    return { flags, step: currentStep(flags), goalVisible: shouldShowGoal(flags) };
  },
  // The Bosun's First Duel (#157) QA surface: whether the one-shot debut has been spent, and — while the
  // scaffolded debut is live — the bosun's current call ({verb, line}) for the phase in play (else null).
  get debutDone() { return !!state.debut; },
  get debutCue() {
    return (debutActive && battle.state.active) ? debutCue(debutPhase(battle.snapshot())) : null;
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
  // Battle Mode (#135) QA surface: read the deliberate stance + drive it headlessly.
  // engageBattle() squares up to the nearest ship (sets mode=BATTLE before a shot); fleeBattle()
  // always breaks off. Slice 2 (real-time broadside): battleFire() discharges the loaded guns
  // (no-op while reloading); the snapshot exposes hull / reload / aim quality for assertions.
  get battle() { return battle.snapshot(); },
  // Reactive-verb juice (#155): the live game-feel state — so a headless test can assert a fired
  // volley produced a nonzero camera kick and a hit raised the flash (renderer-only; save-free).
  get juice() { return juice.snapshot(); },
  // #80 juice-pass QA surface: flip the runtime "Combat feel" toggle, and drain the hit-stop the way
  // loop() does (on real dt) so a headless test can prove the freeze decays to zero (no residual) and
  // that the toggle/reduced-motion fully suppresses it — without needing a real camera or a live frame.
  juiceSetEnabled(on) { juice.setEnabled(on); return juice.snapshot(); },
  juiceConsumeHitStop(dt = 1 / 60) { return juice.consumeHitStop(dt); },
  engageBattle() { return battle.engage(); },
  fleeBattle() { return battle.flee(); },
  battleFire() { return battleFireJuiced(); },
  battleAim() { return battle.aim(); },
  // Rendered cannonballs (#161 slice 4): the pooled projectile/VFX snapshot — live ball/puff counts +
  // monotone spawn tallies (balls/muzzles/hits/splashes) so the playtest can assert a broadside spawns
  // iron and that a clean hit sparks while a wide miss splashes (hit ≠ miss), off the resolved shot.
  battleProjectiles() { return projectiles.snapshot(); },
  // Workshop loadouts + mid-combat shot cycle (#135 slice 3): battleCycleShot() loads the next
  // fitted shot mid-fight; the battle snapshot carries `ammo`/`ammoProfile`/`loadout`. The fitted
  // locker (what you fit at the town workshop) is `loadout`; fitAmmoType(id) toggles a shot in it.
  battleCycleShot() { return battle.cycleShot(); },
  // Boarding (#135 slice 4): boardBattle() sends the crew over the rail once she's beaten to ≤30% hull
  // (battle.snapshot().canBoard) — it resolves the comic crew brawl, then hands off to the verbal
  // captain's duel (#33). After it, tw.battle.active is false and tw.duel.active is true (boarded=true).
  boardBattle() { return boardBattleJuiced(); },
  // Sink-or-spare (#135, Option 4 slice 1) QA surface: after a boarding duel is WON the prize is held
  // open — `prizeChoice` reads the pending prize (the beaten captain + the won-duel base, or null once
  // resolved), and choosePrize('sink'|'spare') settles it headlessly. SINK → +Infamy; SPARE → +coin
  // ransom + Standing. Mirrors encounterChoose()'s force-a-choice hook.
  get prizeChoice() { return pendingPrize ? { ...pendingPrize } : null; },
  choosePrize(choice) { return resolvePrize(choice); },
  // Early surrender / strike-colours short-circuit (#135, Option 4) QA surface: when your gunnery
  // breaks a foe hard enough she strikes her colours mid-maneuver — `surrenderOffer` reads the pending
  // offer (the beaten foe, or null once answered); acceptSurrender() takes the quick capture (ransom +
  // Standing), pressAttack() refuses quarter (she fights on). Mirrors prizeChoice/choosePrize.
  get surrenderOffer() { return battle.state.surrenderPending ? { foeName: battle.state.foeName } : null; },
  acceptSurrender() { return battle.acceptSurrender(); },
  pressAttack() { return battle.pressAttack(); },
  // QA-only (#135 Option 4): break the engaged foe's NERVE and wound her hull straight to the
  // strike-colours threshold, so a headless test can reach the surrender offer deterministically. Sets
  // her morale into the break band and her hull into the yield window (but well clear of sinking); the
  // NEXT battleFire() then opens the white flag. No-op un-engaged. Mirrors battleWeaken()'s force-a-state.
  battleBreakFoe() {
    if (battle.state.active) {
      battle.state.enemyMorale = 8;
      // Sit her hull in the yield window (≤ the 50 strike ceiling) but WELL clear of sinking — an
      // ABSOLUTE value, so it's sink-safe across ship classes (#163): a small sloop's maxHull is low,
      // and 0.45×maxHull could let the confirming volley (~40 max) drown her before she can strike.
      battle.state.enemyHull = Math.min(47, battle.state.maxHull - 1);
      battle.state.reload = 0;
    }
    return battle.snapshot();
  },
  // QA-only (#135 slice 4 + Option-4 slice 2): beat the engaged foe's hull straight down to the boardable
  // window, so a headless test can reach the Board! prompt deterministically without grinding live volleys
  // (which can sink or capture her first). Pass a hull fraction (0..1) to set exactly how battered she is —
  // the snapshot's `boardEdge` then reads the hull-damage→boarding-odds coupling. Defaults to 0.25 (mid
  // window). Mirrors encounterSpawn()'s force-a-state hook. No-op un-engaged.
  battleWeaken(frac = 0.25) { if (battle.state.active) battle.state.enemyHull = Math.round(battle.state.maxHull * Math.max(0, Math.min(1, frac))); return battle.snapshot(); },
  // QA-only (#164 loss stings): stage a killing blow so a headless test can reach a real DEFEAT
  // deterministically. Your hull is dropped to 1 while the foe is set HALE (full hull + nerve) — she
  // survives your next volley and her reply sinks you, driving the genuine finish('lose') + defeatLedger
  // path (not a shortcut). The NEXT battleFire() then resolves to a loss. No-op un-engaged. Mirrors
  // battleBreakFoe()'s force-a-state hook.
  battleForceDefeat() {
    if (battle.state.active) {
      battle.state.maxHull = MAX_HULL;
      battle.state.enemyHull = MAX_HULL;   // hale — she survives your volley and fires back
      battle.state.enemyMorale = battle.state.maxMorale; // full nerve — she won't strike her colours instead
      battle.state.playerHull = 1;         // one more hit from her breaks your hull
      battle.state.reload = 0;
    }
    return battle.snapshot();
  },
  // QA-only (#164): set the captain's ledger directly so a headless test can pin the defeat CONTEXT
  // (Infamy-dominant → a raiding loss dents Infamy; Standing-dominant → a governor-road loss dents
  // Standing) and assert the exact deduction. Floors at 0. Persists via syncRenown. Not used in play.
  qaSetLedger({ coins, infamy, standing } = {}) {
    initEconomy(state);
    if (typeof coins === 'number') state.coins = Math.max(0, coins);
    if (typeof infamy === 'number') state.infamy = Math.max(0, infamy);
    if (typeof standing === 'number') state.standing = Math.max(0, standing);
    syncRenown(state);
    return { coins: state.coins, infamy: state.infamy, standing: state.standing };
  },
  // The last "Colours Struck" defeat card's named cost (or null) — so the headless gate can assert a
  // lost fight surfaced a card that NAMES the fame + coin it deducted (#164).
  get defeatCard() { return hud.defeatCard(); },
  get loadout() { return (state.loadout || []).slice(); },
  get ammoCatalogue() { return AMMO_TYPES.map((id) => ({ id, ...AMMO[id] })); },
  fitAmmoType(id) { state.loadout = fitAmmo(state.loadout, id); town.render(); return state.loadout.slice(); },
  // Foundering-ship encounter (#125) QA surface: read the live encounter (the founderer + the
  // choice/reward, or inactive), force a deterministic spawn (the spawn hook the contract asks
  // for), and make the choice headlessly. encounterChoose('rescue'|'plunder') resolves it.
  get encounter() { return encounter.snapshot(); },
  encounterSpawn() { return encounter.forceSpawn(); },
  encounterChoose(choice) { return encounter.choose(choice); },
  // Hard battle isolation (#161 slice 1) QA surface: prove the fight is cleanly isolated. In the
  // deliberate BATTLE stance every non-battle world interaction is a no-op — `interactionsSuppressed`
  // flips TRUE, and `canAmbientSpawn` (the gate the #125 founderer consults each frame) reads FALSE,
  // so no rescue offer or open-sea hail can heave into the arena. Both flip back the instant you flee.
  get interactionsSuppressed() { return interactionsSuppressed({ battleActive: battle.state.active }); },
  get canAmbientSpawn() { return ambientInteractionsAllowed({ paused: lastPaused, battleActive: battle.state.active }); },
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
  // QA hero-framing hook: swing the camera to a fixed quarter view of the player ship, for a
  // deterministic gallery shot (e.g. the #132 ship-aura pole extremes). Render with qaRender() after.
  // Purely a capture affordance — the live chase cam overwrites it on the next real frame.
  qaFrameShip({ dist = 20, height = 9, az = 0.85, look = 5 } = {}) {
    const sx = ship.position.x, sy = ship.position.y, sz = ship.position.z;
    camera.position.set(sx + Math.sin(az) * dist, sy + height, sz + Math.cos(az) * dist);
    camera.lookAt(sx, sy + look, sz);
    return [camera.position.x, camera.position.y, camera.position.z];
  },
  // Non-occluding battle UI gate (#161 slice 2): are the shown fight prompts clear of the central
  // safe-zone, so the camera-framed ship + the action stay VISIBLE? Reads the live DOM rects of the
  // battle panels and runs them through the pure src/ui/safe-zone.js predicate — one source of truth
  // for "does this UI cover the ship?", used by the playtest so occlusion can never silently regress.
  battleUICentreClear() {
    const w = window.innerWidth, h = window.innerHeight;
    const ids = ['battle', 'cannons', 'duel', 'raid-phases', 'key-prompts'];
    const panels = ids.map((id) => {
      const el = document.getElementById(id);
      const shown = !!el && el.classList.contains('show');
      const r = shown ? el.getBoundingClientRect() : null;
      const rect = r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null;
      return { id, shown, rect, clear: !shown || clearsCentre(rect, w, h) };
    });
    return { clear: panels.every((p) => p.clear), zone: centreSafeZone(w, h), panels, viewport: { w, h } };
  },
  // Re-project the foe's target marker against the CURRENT camera without stepping the sim — so a
  // gallery capture can swing to a wide framing (qaFrameShip) and still have the ring aligned (#161 s3).
  qaSyncTargetMarker() { syncTargetLock(simT); return this.targetLock(); },
  // Re-project the over-ship threat labels against the CURRENT camera without stepping the sim — so a
  // gallery capture (or the deterministic playtest) can pose ships + swing the framing and read the
  // labels aligned. Returns the same shape as threatLabels() (#165).
  qaSyncThreatLabels() { syncThreatLabels(simT); return this.threatLabels(); },
  // OVER-SHIP THREAT LABELS gate (#165): prove you can read danger at a glance — each visible ship shows
  // a floating label whose text + threat glyph MATCH its class/tier, a man-o'-war reads deadlier than a
  // merchant sloop, distant/over-cap hulls declutter (fade/cull), and the mobile guard caps the count.
  // Reads the live billboard truth latched by the last threat-labels frame + the current mobile cap.
  threatLabels() { return { labels: lastThreatLabels.slice(), maxLabels: maxLabelsForViewport(window.innerWidth) }; },
  // TARGET LOCK gate (#161 slice 3): prove the engaged foe is unmistakably marked and the traffic
  // recedes. Reads the live over-ship billboard DOM (is the ring shown?) + npc.js's material-opacity
  // emphasis snapshot (foe full, non-combatants dimmed). The playtest asserts markerShown + the foe is
  // the only un-dimmed hull while engaged, and that it all clears the instant you flee.
  targetLock() {
    const el = foeMarker.el;
    const markerShown = !!el && el.style.display !== 'none' && el.classList.contains('has-ring');
    const emphasis = npcs.emphasisSnapshot();
    const foe = emphasis.find((s) => s.index === lastTargetLock.foeIndex) || null;
    const dimmed = emphasis.filter((s) => s.dimmed).map((s) => s.index);
    return {
      active: lastTargetLock.active,
      foeIndex: lastTargetLock.foeIndex,
      onScreen: lastTargetLock.onScreen,
      screen: lastTargetLock.screen,
      markerShown,
      foeOpacity: foe ? foe.opacity : 1,
      dimmed,
      emphasis,
    };
  },
  // AIM-ANGLE FEEDBACK gate (#161 slice 5): prove the player can SEE their firing solution — the aim
  // line reflects an ABEAM (on-target) vs a BOW-ON (off-target) geometry, read-only off broadsideAim.
  // `level`/`onTarget`/`spreadDeg` come from the LIVE aim reading (deterministic per ship position);
  // `beamShown` is the DOM truth (is the coloured line actually drawn on screen right now?).
  aimIndicator() {
    const el = aimMarker.el;
    const a = battle.aim();
    const readout = aimReadout({ quality: a.quality, inArc: a.inArc, side: a.side });
    return {
      active: battle.state.active,
      level: readout.level,
      onTarget: readout.onTarget,
      quality: readout.quality,
      spreadDeg: readout.spreadDeg,
      side: readout.side,
      beamShown: !!el && el.style.display !== 'none',
      onScreen: lastAim.onScreen,
    };
  },
  // LEGIBLE ODDS gate (#166): prove the player can READ whether they're favoured — the odds verdict
  // reflects the DETERMINISTIC class matchup (outclass a merchant sloop ⇒ favoured; a man-o'-war vs a
  // sloop ⇒ dire), the shown margin band == the ±20% luck bounds, and luck can't flip a strong verdict.
  // `live` is the last docked read (mirrors the DOM); the pure fns are re-exported so the gate can probe
  // canonical matchups head-on without steering the sim into one.
  odds(inputs) {
    const o = combatOdds(inputs || {});
    return {
      tier: o.tier, verdict: o.verdict, edge: o.edge, favoured: o.favoured,
      stronglyFavoured: o.stronglyFavoured, hopeless: o.hopeless, couldLuckFlip: o.couldLuckFlip,
      yourDamage: o.yourDamage, herDamage: o.herDamage, marginPct: o.luck.marginPct,
      luckLo: o.luck.lo, luckHi: o.luck.hi, bar: o.bar,
      live: { ...lastOdds, shown: !!aimMarker.el && aimMarker.el.style.display !== 'none' },
    };
  },
  // HOVER-TO-INTERACT gate (#161 slice 6): prove the sea is directly manipulable — a raycast against a
  // ship under a SCREEN POINT resolves to that ship + the correct contextual action, and a CLICK routes
  // to the existing verb handler. qaShipScreen(i) projects hull i to screen px (the point to aim at);
  // qaLookAtShip(i) points the real camera at her so a headless open-sea pick lands; qaPickAt(x,y) is the
  // read-only raycast+classify; qaHoverAt(x,y) drives the live affordance (for the gallery frame);
  // qaClickAt(x,y) performs the routed action. hoverAffordance() reads the live DOM marker truth.
  qaShipScreen(index) {
    const mesh = npcs.group.children[index];
    if (!mesh) return { onScreen: false, x: 0, y: 0 };
    // Aim at the hull's ACTUAL world centre (read off the live mesh, not a re-sampled wave height — which
    // drifts out of phase over a long run) + a touch, so a synthetic screen point lands on solid geometry.
    camera.updateMatrixWorld();
    npcs.group.updateWorldMatrix(false, true);
    const wp = new THREE.Vector3(); mesh.getWorldPosition(wp);
    hoverMarkerVP.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const p = projectToScreen([wp.x, wp.y + 0.5, wp.z], hoverMarkerVP.elements, window.innerWidth, window.innerHeight);
    return { onScreen: p.onScreen, x: p.x, y: p.y };
  },
  qaLookAtShip(index, { back = 150, height = 60 } = {}) {
    const snap = npcs.snapshot()[index];
    if (!snap) return null;
    const [x, z] = snap.pos;
    const y = ocean.sampleHeight(x, z, simT);
    const dx = x - state.pos.x, dz = z - state.pos.z, len = Math.hypot(dx, dz) || 1;
    camera.position.set(x - (dx / len) * back, y + height, z - (dz / len) * back);
    camera.lookAt(x, y + 4, z);
    camera.updateMatrixWorld();
    return [camera.position.x, camera.position.y, camera.position.z];
  },
  qaPickAt(x, y) { return resolvePick(x, y); },
  qaHoverAt(x, y) { hoveredShip = resolvePick(x, y).index; syncHoverAffordance(simT); return this.hoverAffordance(); },
  qaClickAt(x, y) { return actOnPick(x, y); },
  hoverAffordance() {
    const el = hoverMarker.el;
    const shown = !!el && el.style.display !== 'none' && el.classList.contains('has-ring');
    const labelEl = el ? el.querySelector('.osm-label') : null;
    return { ...lastHover, shown, label: labelEl ? labelEl.textContent : '' };
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
