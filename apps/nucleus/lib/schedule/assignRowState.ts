// What a Schedule row looks like after a person is assigned to it, or taken
// off it, without waiting for a re-fetch.
//
// The page renders these changes optimistically. It used to set only
// resource_name, so an assigned row kept resource_id = null and its old (often
// empty) teams. That stale resource_id then sent Edit Teams into vacant-seat
// mode, which wrote a seat-keyed team row onto a seat that already had a
// person. These functions keep the row's identity and teams in step with what
// the database now holds.

import { computeUnallocatedPct, type TeamAssignment } from '@plato/schema'

/** The fields an assign or unassign changes on a Schedule row. */
export interface SeatRowState {
  resource_id: string | null
  resource_name: string | null
  teams: TeamAssignment[]
  unallocatedPct?: number | null
}

export interface AssignedPerson {
  resourceId: string
  resourceName: string | null
  /**
   * The team assignments just saved for the person. `undefined` when they are
   * not known — the team save failed — in which case the row keeps its teams
   * and the caller re-fetches to learn the truth.
   */
  teams: TeamAssignment[] | undefined
}

/** The row once `person` holds the seat: their id, their name, their teams. */
export function applyAssignToRow<T extends SeatRowState>(row: T, person: AssignedPerson): T {
  const teams = person.teams ?? row.teams
  return {
    ...row,
    resource_id: person.resourceId,
    resource_name: person.resourceName,
    teams,
    unallocatedPct: computeUnallocatedPct(teams),
  }
}

/**
 * The row once the seat is vacant again.
 *
 * @param teams the seat's team assignments now. Omit when the caller wrote
 *   none of its own: unassigning re-keys the person's team rows onto the seat
 *   (unassignResourceFromAllocation), so the seat keeps the teams it showed.
 */
export function applyUnassignToRow<T extends SeatRowState>(row: T, teams?: TeamAssignment[]): T {
  const seatTeams = teams ?? row.teams
  return {
    ...row,
    resource_id: null,
    resource_name: null,
    teams: seatTeams,
    unallocatedPct: computeUnallocatedPct(seatTeams),
  }
}

/**
 * The team assignments a wizard save wrote, in the shape the page holds —
 * splits as fractions (0.5), names resolved from the team list. Rows with no
 * team chosen are dropped, exactly as updateTeamAssignments drops them.
 */
export function savedTeamAssignments(
  assignments: ReadonlyArray<{ teamId: string; capacitySplit: number }>,
  teamOptions: ReadonlyArray<{ team_id: string; team_name: string }>,
): TeamAssignment[] {
  return assignments
    .filter((a) => a.teamId !== '')
    .map((a) => ({
      teamId: a.teamId,
      teamName: teamOptions.find((t) => t.team_id === a.teamId)?.team_name ?? '',
      capacitySplit: a.capacitySplit / 100,
    }))
}

/**
 * `rows` with only the row for `allocationId` replaced by `update(row)` —
 * every other row is returned as the same object, so nothing else on the
 * page re-renders or moves.
 */
export function patchRow<T extends { allocation_id: string }>(
  rows: readonly T[],
  allocationId: string,
  update: (row: T) => T,
): T[] {
  return rows.map((row) => (row.allocation_id === allocationId ? update(row) : row))
}

/**
 * The seat id Edit Teams reads and writes by — or `undefined` in person mode.
 * A row with a person is always edited by resource_id; only a genuinely
 * vacant seat is edited by its allocation id.
 */
export function teamEditSeatId(target: {
  allocationId: string
  resourceId: string | null
}): string | undefined {
  return target.resourceId ? undefined : target.allocationId
}
