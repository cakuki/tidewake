// Minimap (radar) — a small, always-on north-up chart in a HUD corner so the open
// sea stays legible and ports/ships are discoverable (#16). The player sits fixed at
// the centre as a heading arrow; islands, ports and NPC sails plot around them within
// a fixed world radius. North-up keeps it simple + consistent with the 3D scene: it
// reads the SAME world data (island positions/radii, port list, NPC snapshot).
//
// The pure plotting maths (worldToMinimap / minimapScale) live here free of any DOM so
// they unit-test (tests/unit/minimap.test.mjs). createMinimap() owns the cheap 2D-canvas
// draw, reusing cached island/port geometry and allocating nothing on the hot path.

// Pixels per world unit for a radar that shows `radius` world units from centre to rim.
export function minimapScale(size, radius) {
  return (size / 2) / radius;
}

/**
 * Plot a world point onto the radar, player-centred and north-up.
 * @returns {{x:number,y:number,onRadar:boolean,dist:number}} canvas px (top-left origin).
 *   World +x → right, world +z → down. Points beyond the rim are culled
 *   (onRadar=false) but clamped onto the rim so they can be drawn as edge ticks.
 */
export function worldToMinimap(px, pz, playerX, playerZ, scale, size) {
  const half = size / 2;
  let dx = (px - playerX) * scale;
  let dy = (pz - playerZ) * scale;
  const dist = Math.hypot(dx, dy);
  const onRadar = dist <= half;
  if (!onRadar && dist > 0) {
    const k = half / dist;
    dx *= k; dy *= k;
  }
  return { x: half + dx, y: half + dy, onRadar, dist };
}

// Read a world position whether it's a THREE.Vector3 ({x,z}) or a [x,y,z]/[x,z] array.
function readX(p) { return p && (p.x ?? p[0]) || 0; }
function readZ(p) { return p && (p.z ?? (p.length > 2 ? p[2] : p[1])) || 0; }

/**
 * Build the live minimap. Reads island geometry + the port list once (static), and the
 * NPC snapshot each frame. Call update(state) from the render loop with the ship state
 * ({ pos, heading }). Cheap by design: one canvas, no per-frame allocation beyond the
 * NPC snapshot the game already produces.
 *
 * @param {{ world:{islands:{children:Array}}, ports:{ports:Array}, npcs?:{snapshot:Function},
 *           canvas?:HTMLCanvasElement, radius?:number }} deps
 */
export function createMinimap({ world, ports, npcs, canvas, radius = 1200 } = {}) {
  const el = canvas || (typeof document !== 'undefined' && document.getElementById('minimap'));
  if (!el) return { update() {} };
  // Redrawn every frame -> keep it CPU-backed (also lets QA read pixels back cheaply).
  const ctx = el.getContext('2d', { willReadFrequently: true });
  const size = el.width;                 // square canvas; logical px == backing px here
  const half = size / 2;
  const scale = minimapScale(size, radius);

  // Static world geometry, distilled once to flat circles {x,z,r}.
  const islands = (world && world.islands ? world.islands.children : []).map((isle) => ({
    x: isle.position.x, z: isle.position.z, r: isle.userData.radius || 70,
  }));
  // Ports are static data ({ name, pos:[x,z] }); read the serialisable list once.
  const portList = (ports && ports.ports) ? ports.ports.map((p) => ({
    name: p.name, x: readX(p.pos), z: readZ(p.pos),
  })) : [];

  // Palette — matches the cream/blue HUD: an ink-wash sea field, gold rim, sandy isles,
  // gold ports. The field sits a touch lighter than the panel so the disc reads clearly.
  const FIELD = 'rgba(18, 44, 66, .85)';
  const RIM = 'rgba(255, 217, 138, .85)';
  const GRID = 'rgba(120, 180, 230, .22)';
  const ISLE = 'rgba(210, 188, 130, .95)';
  const PORT = '#ffd98a';
  const SHIP = '#ff9a8a';
  const PLAYER = '#9fd2ff';
  const NLABEL = 'rgba(207, 232, 255, .9)';

  function update(state) {
    if (!state || !state.pos) return;
    const px = readX(state.pos);
    const pz = readZ(state.pos);
    const heading = state.heading || 0;

    ctx.clearRect(0, 0, size, size);

    // Field + clip to the radar disc.
    ctx.save();
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, Math.PI * 2);
    ctx.fillStyle = FIELD;
    ctx.fill();
    ctx.clip();

    // Faint cross-hair so bearings read at a glance.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(half, 4); ctx.lineTo(half, size - 4);
    ctx.moveTo(4, half); ctx.lineTo(size - 4, half);
    ctx.stroke();

    // Islands — filled sandy blobs sized by radius (culled when wholly off-radar).
    ctx.fillStyle = ISLE;
    for (const isle of islands) {
      const p = worldToMinimap(isle.x, isle.z, px, pz, scale, size);
      if (!p.onRadar) continue;
      const rr = Math.max(2, isle.r * scale);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ports — small gold diamonds (clamped to the rim when out of range so you can
    // still tell which way a harbour lies).
    for (const port of portList) {
      const p = worldToMinimap(port.x, port.z, px, pz, scale, size);
      ctx.fillStyle = PORT;
      ctx.globalAlpha = p.onRadar ? 1 : 0.6;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 3); ctx.lineTo(p.x + 3, p.y);
      ctx.lineTo(p.x, p.y + 3); ctx.lineTo(p.x - 3, p.y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // NPC sails — small dots (culled when off-radar).
    const fleet = (npcs && npcs.snapshot) ? npcs.snapshot() : [];
    ctx.fillStyle = SHIP;
    for (const s of fleet) {
      const p = worldToMinimap(readX(s.pos), readZ(s.pos), px, pz, scale, size);
      if (!p.onRadar) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore(); // drop the disc clip before the player marker + rim

    // Player — a heading arrow fixed at centre. Forward in the 3D world is
    // (sin h, cos h) in (x,z); with +x→right and +z→down that's the same on-screen.
    const fx = Math.sin(heading), fy = Math.cos(heading);
    const rx = -fy, ry = fx;            // right-hand perpendicular for the arrow base
    const tipL = 7, baseL = 4, baseW = 4;
    ctx.fillStyle = PLAYER;
    ctx.beginPath();
    ctx.moveTo(half + fx * tipL, half + fy * tipL);
    ctx.lineTo(half - fx * baseL + rx * baseW, half - fy * baseL + ry * baseW);
    ctx.lineTo(half - fx * baseL - rx * baseW, half - fy * baseL - ry * baseW);
    ctx.closePath();
    ctx.fill();

    // Gold rim + a north tick so the north-up orientation is unmistakable.
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(half, half, half - 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = NLABEL;
    ctx.font = '9px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', half, 1.5);
    // QA liveness counter: a headless play-test can't reliably read pixels back from a
    // GPU-backed 2D canvas (swiftshader returns garbage), so it asserts the radar is
    // alive by watching this tick up each rendered frame.
    if (typeof window !== 'undefined') window.__minimapFrames = (window.__minimapFrames || 0) + 1;
  }

  return { update };
}
