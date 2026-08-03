// People Directory types — Nucleus Organisation / Resources.

import type { ResourceLocation } from './schedule'

export type ResourceFunction =
  | 'FACTORY'
  | 'SERVICE'
  | 'PROGRAMME'
  | 'COMMERCIAL'
  | 'MIGRATION'
  | 'CLOUD_OPS'

export interface DirectoryResource {
  resource_id: string
  resource_name: string
  resource_function: ResourceFunction | null
  resource_location: ResourceLocation | null
  resource_job_title: string | null
  resource_years_experience: number | null
  resource_primary_tech_stack: string | null
  resource_secondary_tech_stack: string | null
  supplier_id: string
  supplier_name: string | null
  supplier_colour: string | null
  supplier_abbreviation: string | null
  supplier_sort_order: number | null
  /** Resolved current team names (see resolveResourceTeams). Empty = "Not on a team". */
  teams: string[]
}

export interface PeopleDirectoryData {
  resources: DirectoryResource[]
}

/** One row of packages/schema/migrations' resource_allocation_history view —
 *  deliberately excludes day_rate / utilisation_percent / cost_configurations. */
export interface AllocationHistoryRow {
  allocation_id: string
  period_id: string
  period_name: string
  period_start_date: string
  resource_location: ResourceLocation | null
  role_title: string | null
  capacity_days: number | null
  team_name: string | null
}

export interface CommercialAllocation {
  allocation_id: string
  role_title: string | null
  day_rate: number
  resource_location: ResourceLocation | null
}

export interface CommercialSnapshot {
  /** False when the viewing user is not a superuser — the caller must omit
   *  the Commercial section entirely in that case, not render it blurred. */
  authorized: boolean
  period_name: string | null
  allocations: CommercialAllocation[]
}
