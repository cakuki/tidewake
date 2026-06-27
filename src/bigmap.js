// Big map (#54) — a toggleable, full-screen route-planning chart. The corner radar
// (minimap.js) only shows ~1200u of sea; this overlay zooms WAY out (a few thousand
// units) so the whole known archipelago — every island and every named port — reads
// at once, letting the player pick a destination to sail to and trade. North-up,
// player-centred, just like the radar: it deliberately REUSES the radar's pure
// projection maths (minimapScale / worldToMinimap) at a larger size + radius, so the
// two charts can never disagree about where things are.
//
// It's purely informational (the game keeps running underneath). Cheap by design:
// the canvas only redraws while the overlay is open.

import { minimapScale, worldToMinimap } from './minimap.js';

// Read a world position whether it's a THREE.Vector3 ({x,z}) or a [x,y,z]/[x,z] array.
function readX(p) { return p && (p.x ?? p[0]) || 0; }
function readZ(p) { return p && (p.z ?? (p.length > 2 ? p[2] : p[1])) || 0; }

/**
 * Build the big route-planning chart. Reads island geometry + the port list once
 * (static) and the NPC snapshot each frame it draws. Toggle with open()/close()/toggle();
 * call update(state) from the render loop — it no-ops unless the overlay is open.
 *
 * @param {{ world:{islands:{children:Array}}, ports:{ports:Array}, npcs?:{snapshot:Function},
 *           canvas?:HTMLCanvasElement, overlay?:HTMLElement, radius?:number }} deps
 */
export function createBigMap({ world, ports, npcs, canvas, overlay, radius = 4000 } = {}) {
  const el = canvas || (typeof document !== 'undefined' && document.getElementById('bigmap'));
  const panel = overlay || (typeof document !== 'undefined' && document.getElementById('bigmap-overlay')) || null;
  let open = false;

  function setOpen(v) {
    open = !!v;
    if (panel) panel.classList.toggle('show', open);
  }
  const api = {
    get open() { return open; },        // QA/hook reads the live open-state here
    show() { setOpen(true); },
    close() { setOpen(false); },
    toggle() { setOpen(!open); },
    update() {},
  };
  if (!el) return api;

  const ctx = el.getContext('2d', { willReadFrequently: true });
  const size = el.width;                 // square canvas; logical px == backing px
  const half = size / 2;
  const scale = minimapScale(size, radius);
  const GRID_STEP = 1000;                // world units between grid lines / the scale bar

  // Static world geometry, distilled once to flat circles {x,z,r}.
  const islands = (world && world.islands ? world.islands.children : []).map((isle) => ({
    x: isle.position.x, z: isle.position.z, r: isle.userData.radius || 70,
  }));
  // Ports are static data ({ name, pos:[x,z] }); read the serialisable list once.
  const portList = (ports && ports.ports) ? ports.ports.map((p) => ({
    name: p.name, x: readX(p.pos), z: readZ(p.pos),
  })) : [];

  // Palette — the cream/blue HUD chart, a touch deeper than the corner radar so the
  // big field reads as parchment-over-sea.
  const FIELD = 'rgba(10, 28, 45, .92)';
  const RIM = 'rgba(255, 217, 138, .8)';
  const GRID = 'rgba(120, 180, 230, .14)';
  const ISLE = 'rgba(210, 188, 130, .95)';
  const PORT = '#ffd98a';
  const LABEL = '#ffe9b8';
  const SHIP = '#ff9a8a';
  const PLAYER = '#9fd2ff';
  const NLABEL = 'rgba(207, 232, 255, .9)';
  const SCALE = 'rgba(207, 232, 255, .75)';

  function update(state) {
    // Cheap: nothing happens unless the chart is actually on screen.
    if (!open || !state || !state.pos) return;
    const px = readX(state.pos);
    const pz = readZ(state.pos);
    const heading = state.heading || 0;

    ctx.clearRect(0, 0, size, size);

    // Parchment-sea field.
    ctx.fillStyle = FIELD;
    ctx.fillRect(0, 0, size, size);

    // World-aligned grid (every GRID_STEP units), so distances read at a glance and
    // the grid drifts as you sail — a tactile sense of scale.
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const span = radius;                 // half the world units shown across the chart
    const startX = Math.ceil((px - span) / GRID_STEP) * GRID_STEP;
    for (let wx = startX; wx <= px + span; wx += GRID_STEP) {
      const sx = half + (wx - px) * scale;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, size);
    }
    const startZ = Math.ceil((pz - span) / GRID_STEP) * GRID_STEP;
    for (let wz = startZ; wz <= pz + span; wz += GRID_STEP) {
      const sy = half + (wz - pz) * scale;
      ctx.moveTo(0, sy); ctx.lineTo(size, sy);
    }
    ctx.stroke();

    // Islands — filled sandy blobs sized by radius.
    ctx.fillStyle = ISLE;
    for (const isle of islands) {
      const p = worldToMinimap(isle.x, isle.z, px, pz, scale, size);
      if (!p.onRadar) continue;
      const rr = Math.max(2, isle.r * scale);
      ctx.beginPath();
      ctx.arc(p.x, p.y, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ports — gold diamonds, each LABELLED with its name. This is the whole point of
    // the chart: the player reads the harbours and plans where to sail to trade.
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.textBaseline = 'middle';
    for (const port of portList) {
      const p = worldToMinimap(port.x, port.z, px, pz, scale, size);
      ctx.fillStyle = PORT;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 5); ctx.lineTo(p.x + 5, p.y);
      ctx.lineTo(p.x, p.y + 5); ctx.lineTo(p.x - 5, p.y);
      ctx.closePath();
      ctx.fill();
      // Label on whichever side keeps it on the chart.
      const rightOk = p.x + 10 + ctx.measureText(port.name).width <= size - 4;
      ctx.fillStyle = LABEL;
      ctx.textAlign = rightOk ? 'left' : 'right';
      ctx.fillText(port.name, p.x + (rightOk ? 9 : -9), p.y);
    }

    // NPC sails — small dots.
    const fleet = (npcs && npcs.snapshot) ? npcs.snapshot() : [];
    ctx.fillStyle = SHIP;
    for (const s of fleet) {
      const p = worldToMinimap(readX(s.pos), readZ(s.pos), px, pz, scale, size);
      if (!p.onRadar) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player — a heading arrow fixed at centre (forward = (sin h, cos h) in x,z;
    // with +x→right, +z→down that's the same on-screen).
    const fx = Math.sin(heading), fy = Math.cos(heading);
    const rx = -fy, ry = fx;
    const tipL = 13, baseL = 8, baseW = 7;
    ctx.fillStyle = PLAYER;
    ctx.beginPath();
    ctx.moveTo(half + fx * tipL, half + fy * tipL);
    ctx.lineTo(half - fx * baseL + rx * baseW, half - fy * baseL + ry * baseW);
    ctx.lineTo(half - fx * baseL - rx * baseW, half - fy * baseL - ry * baseW);
    ctx.closePath();
    ctx.fill();

    // Gold frame + a north tick so the north-up orientation is unmistakable.
    ctx.strokeStyle = RIM;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    ctx.fillStyle = NLABEL;
    ctx.font = '13px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N ↑', half, 6);

    // Scale hint — a bar one GRID_STEP wide, bottom-left, so distances are legible.
    const barPx = GRID_STEP * scale;
    const by = size - 16, bx = 14;
    ctx.strokeStyle = SCALE;
    ctx.fillStyle = SCALE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, by); ctx.lineTo(bx + barPx, by);
    ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4);
    ctx.moveTo(bx + barPx, by - 4); ctx.lineTo(bx + barPx, by + 4);
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.fillText(`${GRID_STEP} u`, bx + barPx + 6, by + 4);

    // QA liveness counter (matches the radar's): a headless play-test can't read pixels
    // back from this canvas reliably, so it watches this tick up to know the chart drew.
    if (typeof window !== 'undefined') window.__bigmapFrames = (window.__bigmapFrames || 0) + 1;
  }

  api.update = update;
  return api;
}
