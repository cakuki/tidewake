// Unit: the swell never rises high enough to submerge ports/docks/coastlines (#51).
// The owner's bug was a ±10.9-unit swell washing over jetties and beaches. The fix
// caps the crest (MAX_SWELL) well below the critical geometry, and keeps the CPU
// sampleHeight() in lock-step with the GPU shader so the ship still rides the swell.
import test from 'node:test';
import assert from 'node:assert/strict';
// Import the pure swell module (no three.js) so this runs in node. ocean.js feeds the
// very same WAVES into both the GPU shader and the CPU sampler, so this gates both.
import { MAX_SWELL, swellHeight } from '../../src/swell.js';
// Pure colour helpers behind the iOS shader-fallback sea (no three.js / GPU needed).
import { mixHex, oceanFallbackColor, DEEP, SHALLOW } from '../../src/sea-color.js';

// Critical world Ys the swell must never reach (kept in sync with the geometry):
const JETTY_DECK_UNDERSIDE_Y = 1.7; // deck centre 2.4 − half-height 0.7  (src/ports.js)
const BEACH_SHELF_TOP_Y = 4.5;      // sand shelf top                      (src/world.js)

test('max swell crest stays below the jetty deck and the beach (#51)', () => {
  assert.ok(MAX_SWELL < JETTY_DECK_UNDERSIDE_Y,
    `swell crest ${MAX_SWELL} must clear the jetty deck underside ${JETTY_DECK_UNDERSIDE_Y}`);
  assert.ok(MAX_SWELL < BEACH_SHELF_TOP_Y,
    `swell crest ${MAX_SWELL} must clear the beach shelf ${BEACH_SHELF_TOP_Y}`);
});

test('swellHeight never exceeds MAX_SWELL, yet the sea still has life', () => {
  let peak = 0;
  for (let t = 0; t < 30; t += 0.31) {
    for (let x = -800; x <= 800; x += 47) {
      for (let z = -800; z <= 800; z += 47) {
        peak = Math.max(peak, Math.abs(swellHeight(x, z, t)));
      }
    }
  }
  assert.ok(peak <= MAX_SWELL + 1e-6, `peak ${peak} exceeded MAX_SWELL ${MAX_SWELL}`);
  assert.ok(peak > MAX_SWELL * 0.85, `sea looks dead — peak only reached ${peak} of ${MAX_SWELL}`);
});

// The iOS shader-fallback sea (flat-but-coloured water) must never be a void. These pin
// the pure colour maths behind it so a strict mobile GPU still gets a plausible blue sea.
test('mixHex blends packed colours and clamps the factor', () => {
  assert.equal(mixHex(0x000000, 0xffffff, 0), 0x000000);
  assert.equal(mixHex(0x000000, 0xffffff, 1), 0xffffff);
  assert.equal(mixHex(0x123456, 0x123456, 0.5), 0x123456, 'blending a colour with itself is identity');
  assert.equal(mixHex(0x000000, 0xffffff, 0.5), 0x808080, 'halfway grey');
  assert.equal(mixHex(0x000000, 0xffffff, -3), 0x000000, 'clamps below 0');
  assert.equal(mixHex(0x000000, 0xffffff, 9), 0xffffff, 'clamps above 1');
});

test('oceanFallbackColor is a plausible sea-blue between deep and shallow', () => {
  const c = oceanFallbackColor();
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  // It must sit between the two palette anchors on every channel — never black/void.
  const lo = (ch) => Math.min((DEEP >> ch) & 0xff, (SHALLOW >> ch) & 0xff);
  const hi = (ch) => Math.max((DEEP >> ch) & 0xff, (SHALLOW >> ch) & 0xff);
  assert.ok(r >= lo(16) && r <= hi(16), 'red within palette');
  assert.ok(g >= lo(8) && g <= hi(8), 'green within palette');
  assert.ok(b >= lo(0) && b <= hi(0), 'blue within palette');
  assert.ok(b > 120 && g > 120, 'reads as a bright sea, not a dark void');
});
