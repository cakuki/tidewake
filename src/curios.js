import * as THREE from 'three';
import {
  CURIO_TYPES, CURIO_SURFACE, CURIO_LINES, CURIO_SPIN_RATE,
  nextCurioDelay, pickCurioType, curioSpawnOrigin, sailedOver, shouldCull,
  curioDespawned, curioBob, pickLine, MIN_SAIL_SPEED,
} from './curio-math.js';

// Ocean sail-over curios (#70, slice 1) — the three.js factory that dresses the PURE model in
// curio-math.js into a living sea-delight beat. Every so often, while you're under way on the
// open sea, ONE small curio drifts into view ahead of the bow — a corked BOTTLE bobbing in the
// swell or a sea TURTLE breaking the surface. Sail over it and a soft cue plays and a wry line
// raises a smile (never the same one twice in a row). Between appearances (and when off-stage, or
// during a battle) the meshes are hidden wholesale → 0 draw calls. Only ONE curio is ever live at
// a time, drawn with a single REUSED mesh per kind (geometry allocated once at init — never per
// spawn, so it honours the #121 mesh-conservation gate), so a charming sea costs ≤1 extra draw.
//
// Same cheapness discipline + reactive-verb spirit as the #110 dolphin pod: deterministic, seeded
// spawn cadence; distance-culled; only appears while you're genuinely making way; never clutters a
// fight (ambient open-sea only). Pure delight, no mechanics, no save change.

// A corked BOTTLE lying on the swell: a gently tapered little cask (neck → shoulder) laid on its
// side so it reads as flotsam from the deck. Tiny + low-poly on purpose — a fleck of story bobbing by.
function makeBottleGeometry() {
  const geo = new THREE.CylinderGeometry(0.32, 0.85, 3.4, 7, 1);
  geo.rotateZ(Math.PI / 2); // lay it flat on the water, neck to one side
  return geo;
}

// A sea TURTLE's shell breaking the surface: a low, slightly-elongated dome (a flattened, forward-
// stretched hemisphere) — the smooth barnacled back you glimpse before it sinks again. One cheap mesh.
function makeTurtleGeometry() {
  const geo = new THREE.SphereGeometry(1.6, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2); // top dome only
  geo.scale(1.05, 0.5, 1.35); // flatten it into a shell, stretched a touch fore/aft
  return geo;
}

// createCurios({ seed, onEncounter }) -> { group, update(dt, t, ctx), snapshot(), qaProbe() }
//   ctx: { shipPos:{x,z}|[x,..,z], focus:{x,z}|Vector3|null, heading?, speed?, inBattle?, sampleHeight? }
//   onEncounter(type, line): fired ONCE when the ship sails over a curio (main wires SFX + banner).
export function createCurios({ seed = 0x5EA1FE, onEncounter = null } = {}) {
  const group = new THREE.Group();

  // Weathered-glass green bottle + a mossy turtle shell. Lit so they catch the sun on the swell;
  // fog fades a distant curio into the haze. One material + one geometry each → one draw call each,
  // and only ever one is visible at a time.
  const bottleMat = new THREE.MeshStandardMaterial({ color: 0x3f6b52, roughness: 0.5, metalness: 0.05 });
  const turtleMat = new THREE.MeshStandardMaterial({ color: 0x3b5a3a, roughness: 0.8, metalness: 0.0 });
  const meshes = {
    bottle: new THREE.Mesh(makeBottleGeometry(), bottleMat),
    turtle: new THREE.Mesh(makeTurtleGeometry(), turtleMat),
  };
  for (const t of CURIO_TYPES) {
    const m = meshes[t];
    m.frustumCulled = false; // we cull by distance ourselves (hide wholesale → 0 draws)
    m.castShadow = false;
    m.receiveShadow = false;
    m.visible = false;        // hidden until a curio drifts in
    group.add(m);
  }

  // Deterministic, reproducible spawn cadence (mulberry32) — a seeded controller drifts a curio in
  // at the same stepped times every headless run, so the playtest can assert one appears + is culled.
  let rngState = seed >>> 0;
  function rng() {
    rngState = (rngState + 0x6d2b79f5) | 0;
    let x = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  }

  const curio = {
    active: false,
    type: null,
    origin: { x: 0, y: 0, z: 0 },
    phase: 0,
    encountered: false,
    timer: nextCurioDelay(rng()),
  };
  let spawns = 0, encounters = 0, lastCue = null, lastLine = null, lastType = null;
  const lastLineIndex = { bottle: -1, turtle: -1 };
  let forcedType = null; // QA only: pin the next kind so the anti-repeat test can hammer one pool

  function readXZ(p) {
    if (!p) return { x: 0, z: 0 };
    if (Array.isArray(p)) return { x: p[0], z: p[p.length - 1] }; // [x,z] or [x,y,z]
    return { x: p.x, z: p.z };
  }
  function activeMesh() { return curio.type ? meshes[curio.type] : null; }
  function hideAll() { for (const t of CURIO_TYPES) meshes[t].visible = false; }

  function spawn(ship, heading, seaY) {
    const side = rng() < 0.5 ? 1 : -1;
    curio.type = forcedType || pickCurioType(rng());
    const o = curioSpawnOrigin(ship, heading, side, seaY);
    curio.origin.x = o.x; curio.origin.y = o.y; curio.origin.z = o.z;
    curio.phase = rng() * Math.PI * 2;
    curio.active = true;
    curio.encountered = false;
    spawns++;
  }

  function encounter() {
    curio.encountered = true;
    encounters++;
    const pool = CURIO_LINES[curio.type] || [];
    const idx = pickLine(pool.length, lastLineIndex[curio.type], rng());
    lastLineIndex[curio.type] = idx;
    lastLine = idx >= 0 ? pool[idx] : '';
    lastCue = curio.type;
    lastType = curio.type;
    if (onEncounter) { try { onEncounter(curio.type, lastLine); } catch { /* a charm beat must never break the frame */ } }
  }

  function update(dt, t, ctx = {}) {
    // Ambient OPEN-SEA only: never clutter a fight. During a battle we hide the meshes and freeze the
    // schedule (a live curio simply waits, invisible, and resumes / retires once the fight is over).
    if (ctx.inBattle) { hideAll(); return; }

    const ship = readXZ(ctx.shipPos);
    const focus = ctx.focus ? readXZ(ctx.focus) : ship;
    const speed = ctx.speed || 0;
    const heading = ctx.heading || 0;
    const seaY = (x, z) => (ctx.sampleHeight ? ctx.sampleHeight(x, z) : 0);

    if (!curio.active) {
      hideAll();
      curio.timer -= dt;
      if (curio.timer <= 0) {
        if (speed >= MIN_SAIL_SPEED) spawn(ship, heading, seaY(ship.x, ship.z));
        else curio.timer = 1.5; // only drift in while under way — re-check again shortly
      }
      return;
    }

    // Keep the curio riding the live waterline as the swell moves under it.
    curio.origin.y = seaY(curio.origin.x, curio.origin.z);

    // Retire it once we've sailed well past → schedule the next.
    if (curioDespawned(curio.origin, ship)) {
      curio.active = false;
      curio.timer = nextCurioDelay(rng());
      hideAll();
      return;
    }

    // Sail-over trigger — a soft cue + a wry line, fired ONCE on entry.
    if (!curio.encountered && sailedOver(curio.origin, ship)) encounter();

    // Distance-cull the curio → 0 draw calls when off-stage.
    const m = activeMesh();
    for (const type of CURIO_TYPES) if (meshes[type] !== m) meshes[type].visible = false;
    if (!m || shouldCull(curio.origin, focus)) { if (m) m.visible = false; return; }
    m.visible = true;

    const surf = CURIO_SURFACE[curio.type] || { lift: 0.2, bob: 0.3 };
    m.position.set(curio.origin.x, curio.origin.y + surf.lift + curioBob(t, curio.phase, surf.bob), curio.origin.z);
    m.rotation.y = curio.phase + t * CURIO_SPIN_RATE; // a slow idle turn — a touch of life
  }

  function snapshot() {
    const m = activeMesh();
    return {
      active: curio.active,
      type: curio.type,
      drawn: !!(m && m.visible),
      encountered: curio.encountered,
      spawns, encounters,
      lastType, lastCue, lastLine,
      center: [curio.origin.x, curio.origin.z],
    };
  }

  // ── QA (#70): a self-contained, deterministic probe the headless playtest calls to PROVE the beat
  // without waiting on the random cadence or coupling to the live camera. It drives the REAL update()
  // with synthetic contexts and reports: (1) the spawn is deterministic (same seed → same curio);
  // (2) the curio DRAWS when near (≤1 extra draw) and is CULLED to 0 draws when the focus is beyond
  // the cull radius while still live; (3) sailing over it FIRES a cue; (4) repeated encounters of the
  // SAME kind never draw the same witty line twice in a row (anti-repeat) yet vary over time.
  function reset(s) {
    rngState = s >>> 0;
    curio.active = false; curio.type = null; curio.encountered = false; curio.timer = 0;
    spawns = 0; encounters = 0; lastCue = null; lastLine = null; lastType = null;
    lastLineIndex.bottle = -1; lastLineIndex.turtle = -1;
    forcedType = null;
    hideAll();
  }

  function qaProbe() {
    const SEED = 0xC0FFEE;
    const flat = () => 0;
    const at = (x, z, focus) => ({ shipPos: [x, z], focus: focus || { x, z }, heading: 0, speed: 5, sampleHeight: flat });

    // (1) DETERMINISTIC SPAWN: same seed → identical first curio (kind + origin).
    reset(SEED); update(0.016, 0, at(0, 0));
    const a = { type: curio.type, ox: curio.origin.x, oz: curio.origin.z, active: curio.active };
    reset(SEED); update(0.016, 0, at(0, 0));
    const b = { type: curio.type, ox: curio.origin.x, oz: curio.origin.z, active: curio.active };
    const spawnDeterministic = a.active && b.active && a.type === b.type && a.ox === b.ox && a.oz === b.oz;

    // (2a) DRAWN WHEN NEAR: with the ship right beside the curio, its (single) mesh draws.
    update(0.016, 0.1, at(b.ox, b.oz - 12));
    const nearDraw = activeMesh();
    const drawnWhenNear = !!(nearDraw && nearDraw.visible);
    const drawnCount = CURIO_TYPES.filter((tp) => meshes[tp].visible).length; // ≤1 extra draw

    // (2b) DISTANCE-CULLED: push the FOCUS beyond the cull radius (ship still within despawn) → 0 draws,
    // but the curio is still LIVE (not retired).
    update(0.016, 0.2, { shipPos: [b.ox, b.oz], focus: { x: b.ox + 100000, z: b.oz }, heading: 0, speed: 5, sampleHeight: flat });
    const culledWhenFar = curio.active && !CURIO_TYPES.some((tp) => meshes[tp].visible);

    // (3+4) CUE + WITTY-LINE ANTI-REPEAT: hammer the SAME kind (turtle) over many encounters and
    // collect the line each time; the picker must never repeat back-to-back, yet vary.
    reset(SEED);
    forcedType = 'turtle';
    const lines = []; const cues = [];
    for (let k = 0; k < 12; k++) {
      curio.active = false; curio.timer = 0;            // arm the next spawn immediately
      update(0.016, 0, at(0, 0));                       // drift a turtle in ahead of the bow
      const ox = curio.origin.x, oz = curio.origin.z;
      update(0.016, 0, at(ox, oz));                     // sail over it → encounter fires once
      lines.push(lastLine); cues.push(lastCue);
    }
    forcedType = null;
    let antiRepeat = true;
    for (let i = 1; i < lines.length; i++) if (lines[i] === lines[i - 1]) antiRepeat = false;
    const cueFired = cues.length > 0 && cues.every((c) => c === 'turtle');
    const distinct = new Set(lines).size;

    reset(nextCurioDelay(0)); // leave the live schedule in a sane state after probing (no leftover forced state)
    return { spawnDeterministic, drawnWhenNear, drawnCount, culledWhenFar, cueFired, antiRepeat, distinct, lines, types: CURIO_TYPES };
  }

  return { group, update, snapshot, qaProbe };
}
