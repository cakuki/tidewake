// Input — keyboard state + drag-to-look camera orbit offset. Owns the raw browser
// event wiring so the rest of the game reads a tiny state surface: a Set of the
// keys currently held and the camera yaw/pitch offsets. No three.js, no game logic
// here — just turns DOM events into queryable state the sailing step samples.

// Pure helper: the KeyboardEvent.code a given key would carry. Lets the on-screen
// touch buttons synthesise events the existing keydown handlers recognise (hud.js
// keys off e.code for digits). Kept tiny + side-effect-free so it's unit-testable.
export function codeForKey(key) {
  const k = String(key);
  if (/^[0-9]$/.test(k)) return 'Digit' + k;
  if (/^[a-z]$/i.test(k)) return 'Key' + k.toUpperCase();
  return k;
}

// Is this a touch / coarse-pointer device (or forced via ?touch for testing)?
export function isTouchDevice() {
  try {
    return (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
      || 'ontouchstart' in globalThis
      || (navigator && navigator.maxTouchPoints > 0)
      || /[?&]touch\b/.test(location.search);
  } catch { return false; }
}

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

  // ---- Touch controls (#17) -------------------------------------------------
  // Phones/tablets have no keyboard, so on-screen buttons feed the SAME `keys` Set the
  // keyboard fills — there is no parallel physics path. Hold buttons (throttle/steer)
  // add their key on touchstart and drop it on touchend/cancel; tap buttons fire a
  // one-shot synthetic keydown so the existing F/M/N/digit handlers run unchanged. The
  // buttons sit in their own DOM layer above the canvas and preventDefault, so a touch
  // on a control never doubles as a camera drag (the drag listener lives on the canvas).
  const touch = isTouchDevice();
  if (touch && typeof document !== 'undefined') {
    document.body.classList.add('touch');
    wireTouchControls(keys);
  }

  return {
    keys,
    touch,
    get camYaw() { return camYaw; },
    get camPitch() { return camPitch; },
  };
}

function wireTouchControls(keys) {
  // Hold buttons → a held key (W/A/S/D). Multi-touch friendly: each button is its own
  // element, so steering + throttle held at once just add two keys to the shared Set.
  for (const el of document.querySelectorAll('#touch-controls [data-hold]')) {
    const key = String(el.dataset.hold).toLowerCase();
    const press = (e) => { e.preventDefault(); keys.add(key); el.classList.add('on'); };
    const release = (e) => { if (e) e.preventDefault(); keys.delete(key); el.classList.remove('on'); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    // Mouse fallback so ?touch works for desktop testing too.
    el.addEventListener('mousedown', press);
    el.addEventListener('mouseup', release);
    el.addEventListener('mouseleave', () => { if (keys.has(key)) release(); });
  }
  // Tap buttons → one-shot action keys (F hail/duel, M mute, …) via a synthetic keydown
  // so every existing handler fires exactly as if the key were pressed.
  const tap = (key) => dispatchEvent(new KeyboardEvent('keydown',
    { key, code: codeForKey(key), bubbles: true }));
  for (const el of document.querySelectorAll('#touch-controls [data-tap]')) {
    const key = String(el.dataset.tap).toLowerCase();
    el.addEventListener('touchstart', (e) => { e.preventDefault(); el.classList.add('on'); tap(key); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); el.classList.remove('on'); }, { passive: false });
    el.addEventListener('touchcancel', () => el.classList.remove('on'));
    el.addEventListener('click', (e) => { e.preventDefault(); tap(key); }); // mouse fallback (?touch)
  }
}
