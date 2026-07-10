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

/** The minimum shape needed to rank periods for default selection. */
export interface DefaultPeriodCandidate {
  period_id: string
  period_start_date: string
  period_end_date: string
}

/**
 * Picks the period that should load by default on the Schedule page: the one
 * whose coverage extends furthest, i.e. the latest `period_end_date`.
 *
 * This is deliberately NOT based on `period_status` — status flags ('active',
 * 'draft', 'historic') are curated separately and lag reality (e.g. the newest
 * quarter is still a 'draft' while an older quarter stays flagged 'active'),
 * so selecting by status defaulted the page to the wrong (earlier) period.
 * Sorting purely by end date always lands on the most recent quarter, and a
 * freshly-created next-quarter draft becomes the default only once its dates
 * genuinely make it the latest — never speculatively.
 *
 * Periods are non-overlapping so end date and start date rank identically;
 * end date is used because "furthest-reaching coverage" is the intent. Ties
 * (which shouldn't occur) break by later start date, then by period_id, so the
 * result is fully deterministic. Returns null for an empty list.
 */
export function selectDefaultPeriod<T extends DefaultPeriodCandidate>(periods: T[]): T | null {
  if (periods.length === 0) return null
  return periods.reduce((best, p) => {
    if (p.period_end_date !== best.period_end_date) {
      return p.period_end_date > best.period_end_date ? p : best
    }
    if (p.period_start_date !== best.period_start_date) {
      return p.period_start_date > best.period_start_date ? p : best
    }
    return p.period_id > best.period_id ? p : best
  })
}
