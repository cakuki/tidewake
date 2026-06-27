// Unit: the interior "sole/bilge" cap closes the open hull so the ocean plane never
// shows *inside* the boat (#65 — "ship looks like it has water inside"). The hull is an
// open-topped bowl whose interior floor dips below the waterline; one opaque cap at
// SOLE_Y occludes the sea through the open gunwale ring. The decisive check is a
// top-down screenshot (the headless gate can't see colour), but these pin the geometry
// invariants that make the fix correct and keep it correct under future swell/geometry
// edits. Pure (three-free) hull math, so it runs in node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SWELL, swellHeight } from '../../src/swell.js';
import {
  SOLE_Y, topY, halfLen, maxBeam, nStations, DECK_INSET,
  beamAt, sheerAt, keelAt, hullHalfWidthAt, soleOutline,
} from '../../src/hull.js';

test('the sole cap exists and sits above the waterline + swell margin', () => {
  // The ship rides the swell (ship.position.y = ocean.sampleHeight at its centre), so the
  // ocean plane only deviates across the hull footprint by a fraction of a wave. Measure
  // that worst-case local deviation directly and require the cap to clear it with margin.
  let maxDev = 0;
  for (let t = 0; t < 40; t += 0.37) {
    for (let cx = -500; cx <= 500; cx += 53) {
      for (let cz = -500; cz <= 500; cz += 53) {
        const centre = swellHeight(cx, cz, t);
        for (let dx = -maxBeam; dx <= maxBeam; dx += 1) {
          for (let dz = -halfLen; dz <= halfLen; dz += 2) {
            maxDev = Math.max(maxDev, Math.abs(swellHeight(cx + dx, cz + dz, t) - centre));
          }
        }
      }
    }
  }
  assert.ok(SOLE_Y > maxDev + 0.5,
    `sole ${SOLE_Y} must clear the local sea (deviation ${maxDev.toFixed(3)}) with margin`);
  // And it clears even the absolute MAX_SWELL crest, so the sea can never peek over it.
  assert.ok(SOLE_Y > MAX_SWELL,
    `sole ${SOLE_Y} must sit above the absolute swell crest MAX_SWELL ${MAX_SWELL}`);
});

test('the sole cap stays below the deck/gunwale (nothing pokes past the hull, #65 crit 2)', () => {
  assert.ok(SOLE_Y < topY, `sole ${SOLE_Y} must sit below the deck/gunwale base ${topY}`);
  for (let i = 0; i < nStations; i++) {
    const t = i / (nStations - 1);
    // The cap must sit below the sheer (gunwale top) and never reach wider than the hull
    // wall at every station — so no part of it pokes out past the gunwale.
    assert.ok(SOLE_Y < sheerAt(t), `sole must sit below the sheer at t=${t.toFixed(2)}`);
    assert.ok(hullHalfWidthAt(t, SOLE_Y) <= beamAt(t) + 1e-9,
      `cap half-width must not exceed the gunwale beam at t=${t.toFixed(2)}`);
  }
});

test('the sole cap occludes the open ring wherever the sea would be visible (#65 crit 1)', () => {
  // Sea is visible through the ring at a station only where the interior is open below the
  // sea (keel low enough). There, the cap must reach at least the inset deck edge so no
  // gap shows ocean. Where the solid hull bottom already sits above the waterline, it
  // occludes on its own and no cap is needed.
  const seaPeek = 0.5; // conservative cap on the local sea level relative to the float
  let coveredWetStations = 0;
  for (let i = 0; i < nStations; i++) {
    const t = i / (nStations - 1);
    const cap = hullHalfWidthAt(t, SOLE_Y);
    const deckEdge = DECK_INSET * beamAt(t);
    const wet = keelAt(t) < seaPeek;           // interior open below the sea here
    const solidAbove = keelAt(t) >= SOLE_Y;    // solid hull bottom above the cap level
    if (wet && !solidAbove) {
      assert.ok(cap >= deckEdge - 1e-9,
        `open ring at t=${t.toFixed(2)} not covered: cap ${cap.toFixed(2)} < deck edge ${deckEdge.toFixed(2)}`);
      coveredWetStations++;
    }
  }
  assert.ok(coveredWetStations >= 6,
    `expected a covered amidships wet band; only ${coveredWetStations} stations`);
});

test('soleOutline is a closed ring inside the hull wall', () => {
  const pts = soleOutline();
  assert.equal(pts.length, nStations * 2, 'outline has a point per station, both sides');
  // Every outline point sits within the hull wall at its station (flush, just inside).
  for (let i = 0; i < nStations; i++) {
    const t = i / (nStations - 1);
    const wall = hullHalfWidthAt(t, SOLE_Y);
    assert.ok(Math.abs(pts[i][0]) <= wall + 1e-9,
      `outline point ${i} (${pts[i][0].toFixed(2)}) must be within the hull wall ${wall.toFixed(2)}`);
  }
});
