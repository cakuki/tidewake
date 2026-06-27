// HUD — every DOM/heads-up-display update lives here, fed the ship state each frame.
// Heading/speed read-outs, the ship-relative wind compass + point-of-sail label, the
// version stamp, and the non-blocking arrival toast. Keeps the per-label/per-band
// cache so the hot path only touches the DOM when something actually changed.
import { pointOfSail } from './physics.js';
import { VERSION } from './version.js';

const RAD2DEG = 180 / Math.PI;

export function createHud() {
  const $heading = document.getElementById('heading');
  const $speed = document.getElementById('speed');
  const $wind = document.getElementById('wind');
  const $windArrow = document.getElementById('windarrow');
  const $pos = document.getElementById('pos');
  const $toast = document.getElementById('toast');
  document.getElementById('version').textContent = VERSION;

  let lastPosLabel = '', lastPosBand = '';
  let toastTimer = null;

  // One-time wind name stamp (the breeze is fixed for the voyage).
  function setWind(name) { $wind.textContent = name; }

  // Arrival toast — a non-blocking banner that auto-dismisses. Reaching a port shows
  // "⚓ Made port at <Name>" plus a rotating harbourmaster greeting.
  function showArrival(portName, line) {
    $toast.innerHTML = `<div class="toast-title">⚓ Made port at ${portName}</div><div class="toast-line">${line}</div>`;
    $toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $toast.classList.remove('show'), 5000);
  }

  function update(state, maxSpeed) {
    let deg = Math.round((state.heading * 180 / Math.PI) % 360); if (deg < 0) deg += 360;
    $heading.textContent = deg;
    $speed.textContent = (state.speed / maxSpeed * 18).toFixed(1);

    // Wind indicator: arrow swings to the wind's bearing relative to the bow (the
    // dial is ship-relative, bow up). Point-of-sail label + colour follow the angle.
    $windArrow.setAttribute('transform', `rotate(${(state.windDir - state.heading) * RAD2DEG} 24 24)`);
    const sail = pointOfSail(state.heading, state.windDir);
    if (sail.label !== lastPosLabel) { $pos.textContent = sail.label; lastPosLabel = sail.label; }
    if (sail.band !== lastPosBand) { $pos.className = 'pos-' + sail.band; lastPosBand = sail.band; }
  }

  return { update, showArrival, setWind };
}
