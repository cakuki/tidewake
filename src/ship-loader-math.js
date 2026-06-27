// Pure integration math for the CC0 glTF hull (#32) — DOM-free and three.js-free so it
// is node-testable without a browser (same pattern as hull.js). ship-loader.js consumes
// these to scale + centre the Kenney Pirate Kit ship-pirate-small.glb onto the existing
// procedural-ship contract (bow toward +Z, length ~16, keel midpoint at the group origin).

// Measured from the asset's POSITION accessor bounding box (bow toward +Z).
export const GLB_Z_MIN = -4.2;
export const GLB_Z_MAX = 4.6;
export const TARGET_LENGTH = 16; // world units, same as the procedural ship

// Uniform scale that maps the GLB hull length onto the target world length.
export function computeScaleToLength(glbLength, targetLength) {
  return targetLength / glbLength;
}

// Shift along Z so the hull midpoint sits at the group origin (matches the procedural ship,
// keeping wake / follow-camera / collision aligned with the seam).
export function centrePivotOffset(zMin, zMax, scale) {
  const offset = -((zMin + zMax) / 2) * scale;
  return offset === 0 ? 0 : offset; // normalise -0 → 0 for clean equality
}
