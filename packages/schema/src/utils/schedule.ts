import type { TeamAssignment } from '../types/schedule'

/**
 * Returns the missing capacity as a whole percentage (e.g. 50 for a 50%
 * split with no second team), or null when fully allocated or when there
 * are no team assignments at all (zero is a valid, intentional state —
 * only sums strictly between 0 and ~100% are flagged).
 */
export function computeUnallocatedPct(teams: TeamAssignment[]): number | null {
  const total = teams.reduce((s, t) => s + t.capacitySplit, 0)
  return total > 0 && total <= 0.999 ? Math.round((1 - total) * 100) : null
}
