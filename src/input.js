// Input — keyboard state + drag-to-look camera orbit offset. Owns the raw browser
// event wiring so the rest of the game reads a tiny state surface: a Set of the
// keys currently held and the camera yaw/pitch offsets. No three.js, no game logic
// here — just turns DOM events into queryable state the sailing step samples.
export function createInput(domElement) {
  const keys = new Set();
  addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); });
  addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); });

  // drag-to-look camera orbit offset
  let camYaw = Math.PI, camPitch = 0.32, dragging = false, lastX = 0, lastY = 0;
  domElement.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointermove', (e) => {
    if (!dragging) return;
    camYaw -= (e.clientX - lastX) * 0.005;
    camPitch = Math.max(0.05, Math.min(0.9, camPitch + (e.clientY - lastY) * 0.003));
    lastX = e.clientX; lastY = e.clientY;
  });

  return {
    keys,
    get camYaw() { return camYaw; },
    get camPitch() { return camPitch; },
  };
}
