// Pure swell math (no three.js) — the SINGLE source of truth for the ocean's waves,
// shared by the GPU vertex shader (whose `swell()` GLSL is generated from WAVES in
// ocean.js) and the CPU `sampleHeight()` (which calls `swellHeight()` here), so the
// ship/wake/NPCs always ride exactly the swell the shader draws (no sampler drift).
// Kept in its own three-free module so the height cap can be unit-tested in node.
//
// Each row: [dirX, dirZ, freq, speed, amp]. Amplitudes are GENTLE (#51): a calmer,
// believable swell whose maximum crest (MAX_SWELL = sum of amplitudes) stays clearly
// below the jetty deck underside (~1.7) and the island beach/shelf (~4.5), so ports,
// docks and coastlines never submerge. Speeds are eased for a slower cadence. The sea
// still has life — crests reach MAX_SWELL — but the shore stays put and dry.
export const WAVES = [
  [ 1.0,  0.6, 0.012, 0.7, 0.8],
  [-0.7,  1.0, 0.020, 1.0, 0.4],
  [ 0.3, -0.9, 0.045, 1.4, 0.2],
];

// Peak displacement of the swell (world units). Critical geometry must sit above this.
export const MAX_SWELL = WAVES.reduce((s, w) => s + w[4], 0); // 1.4

// CPU swell sampler — sums the same WAVES the shader uses (normalised dir · point).
export function swellHeight(x, z, t) {
  let h = 0;
  for (const [dx, dz, freq, speed, amp] of WAVES) {
    const len = Math.hypot(dx, dz);
    h += amp * Math.sin(((x * dx + z * dz) / len) * freq + t * speed);
  }
  return h;
}
