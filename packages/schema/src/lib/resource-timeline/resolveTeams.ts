// Team resolution for the Resource Timeline view.
//
// Pulled out as a pure function for the same reason deriveSegments is: it is
// the part of the query most likely to be wrong, and the only part that can
// be tested without a database. queries/resourceTimeline.ts maps raw
// resource_team_assignments rows onto TeamAssignmentInput and hands them
// here.

import type { TeamAssignmentInput, TeamOutput } from './types'

/**
 * Resolves each resource's current team set from period-scoped assignment
 * rows that the caller has already filtered to `deleted_at IS NULL`.
 *
 * A resource's team can genuinely differ between the coarse and granular
 * period — a team move recorded by soft-deleting the old
 * resource_team_assignments row and inserting a new one, the same pattern
 * used everywhere else in the schema (Schedule's equivalent query filters
 * the same way). That soft-delete/insert pair is *within* one period, so
 * `deleted_at IS NULL` alone resolves it — but it does not resolve rows from
 * *two different* periods that are both genuinely active: a person who moved
 * from Orion (recorded, still-current Q2 row) to Nebula (recorded, current
 * Q3 row) legitimately has one live row in each period, and naively
 * collecting "every team name seen across both periods" shows them under
 * both instead of their current one.
 *
 * The fix: when a resource has any granular-period row, that fully replaces
 * whatever the coarse period says for them — not a per-team-name merge,
 * which only de-dupes when the team name happens to be unchanged. A resource
 * with no granular-period row at all (their assignment hasn't been rolled
 * forward yet) still falls back to their coarse-period team rather than
 * showing "Unassigned".
 */
export function resolveTeamsByResource(
  rows: readonly TeamAssignmentInput[],
  granularPeriodId: string,
): Map<string, TeamOutput[]> {
  const byResource = new Map<string, TeamAssignmentInput[]>()
  for (const row of rows) {
    const existing = byResource.get(row.resourceId) ?? []
    existing.push(row)
    byResource.set(row.resourceId, existing)
  }

  const result = new Map<string, TeamOutput[]>()
  for (const [resourceId, resourceRows] of byResource) {
    const granularRows = resourceRows.filter((r) => r.periodId === granularPeriodId)
    const chosen = granularRows.length > 0 ? granularRows : resourceRows

    // A resource can legitimately hold two different teams at once (a
    // capacity split, e.g. "Pulsar · 50%") — kept as separate entries. This
    // only collapses rows that share a team name *within the one chosen
    // period*, which should already be impossible once deleted_at is
    // filtered, but costs nothing to keep as a safety net.
    const byTeamName = new Map<string, TeamOutput>()
    for (const row of chosen) {
      byTeamName.set(row.teamName, { teamName: row.teamName, capacitySplit: row.capacitySplit })
    }
    result.set(resourceId, [...byTeamName.values()])
  }
  return result
}
