/**
 * Maps backend violation count to Spike Orb / enforcement UI intensity.
 * First attempt → warning, second → strict, third+ → blocking.
 */
export type SpikeOrbState = 'calm' | 'warning' | 'strict' | 'blocking';

/**
 * 0/1: warning, 2: strict, 3+: blocking. Unknown → warning (safe default in enforcement).
 */
export function violationsCountToOrbState(violations: number | null | undefined): SpikeOrbState {
  if (violations == null || Number.isNaN(violations)) {
    return 'warning';
  }
  const n = Math.max(0, Math.floor(Number(violations)));
  if (n <= 1) return 'warning';
  if (n === 2) return 'strict';
  return 'blocking';
}
