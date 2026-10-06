// The exact arguments for assign_resource_to_vacant_allocation_with_teams
// (migration 041). Kept apart from the 'use server' action so the mapping —
// null vs [] vs a selection — can be unit-tested without a database.

import type { ResourceLocation } from '@plato/schema'
import type { AssignTeamPayloadRow } from './assignTeams'

export interface AssignResourceWithTeamsArgs {
  p_allocation_id: string
  p_resource_id: string
  p_period_id: string
  p_resource_location: ResourceLocation | null
  /** null → the role's teams become the person's; [] → no team; else exactly these. */
  p_assignments: Array<{ team_id: string; capacity_split: number }> | null
}

export function assignResourceWithTeamsArgs(
  allocationId: string,
  resourceId: string,
  periodId: string,
  resourceLocation: ResourceLocation | null,
  assignments: readonly AssignTeamPayloadRow[] | null,
): AssignResourceWithTeamsArgs {
  return {
    p_allocation_id: allocationId,
    p_resource_id: resourceId,
    p_period_id: periodId,
    p_resource_location: resourceLocation,
    p_assignments:
      assignments === null
        ? null
        : assignments.map((a) => ({ team_id: a.teamId, capacity_split: a.capacitySplit })),
  }
}
