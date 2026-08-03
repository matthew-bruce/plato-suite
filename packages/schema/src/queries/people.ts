// Server-side data fetching for the Nucleus People Directory page.
// All Supabase access goes through the @plato/schema server client (ADR-027)
// — the cookie-aware SSR client, so reads run as the logged-in user and RLS
// is enforced for real (see resource_period_allocations_superuser_rls_and_history_view).

import { getSupabaseServerComponentClient } from '../serverComponent'
import { resolveResourceTeams, sortAllocationHistory, checkIsSuperuser, type TeamAssignmentRow } from '../utils/people'
import { selectDefaultPeriod } from '../utils/schedule'
import type {
  DirectoryResource,
  PeopleDirectoryData,
  AllocationHistoryRow,
  CommercialSnapshot,
  ResourceFunction,
} from '../types/people'
import type { Period, ResourceLocation } from '../types/schedule'

type SupplierEmbed = {
  supplier_name: string
  supplier_colour: string | null
  supplier_abbreviation: string | null
}

type TeamEmbed = { team_name: string }
type PeriodEmbed = { period_start_date: string }

type RawResourceRow = {
  resource_id: string
  resource_name: string
  resource_function: ResourceFunction | null
  resource_location: ResourceLocation | null
  resource_job_title: string | null
  resource_years_experience: number | null
  resource_primary_tech_stack: string | null
  resource_secondary_tech_stack: string | null
  supplier_id: string
  suppliers: SupplierEmbed | SupplierEmbed[] | null
}

type RawAssignmentRow = {
  resource_id: string
  team_id: string
  period_id: string | null
  teams: TeamEmbed | TeamEmbed[] | null
  periods: PeriodEmbed | PeriodEmbed[] | null
}

function pickEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

/**
 * Full resource list for the People Directory — ALL resources, not just
 * those on an active team assignment (that's the whole point of this page
 * vs. the Schedule page). Each resource's current team(s) are resolved via
 * resolveResourceTeams so resources with zero assignments still appear with
 * teams: [] ("Not on a team" in the UI).
 */
export async function getPeopleDirectoryData(): Promise<PeopleDirectoryData> {
  const supabase = await getSupabaseServerComponentClient()

  const [resourcesRes, assignmentsRes] = await Promise.all([
    supabase
      .from('resources')
      .select(
        'resource_id, resource_name, resource_function, resource_location, resource_job_title, ' +
          'resource_years_experience, resource_primary_tech_stack, resource_secondary_tech_stack, ' +
          'supplier_id, suppliers(supplier_name, supplier_colour, supplier_abbreviation)',
      )
      .is('deleted_at', null)
      .order('resource_name'),
    supabase
      .from('resource_team_assignments')
      .select('resource_id, team_id, period_id, teams(team_name), periods(period_start_date)')
      .is('deleted_at', null),
  ])

  if (resourcesRes.error || !resourcesRes.data) {
    throw new Error(`Failed to load resources: ${resourcesRes.error?.message ?? 'unknown error'}`)
  }
  if (assignmentsRes.error) {
    throw new Error(`Failed to load team assignments: ${assignmentsRes.error.message}`)
  }

  const assignmentsByResource = new Map<string, TeamAssignmentRow[]>()
  for (const raw of (assignmentsRes.data ?? []) as unknown as RawAssignmentRow[]) {
    const team = pickEmbed(raw.teams)
    if (!team) continue
    const period = pickEmbed(raw.periods)
    const list = assignmentsByResource.get(raw.resource_id) ?? []
    list.push({
      team_id: raw.team_id,
      team_name: team.team_name,
      period_id: raw.period_id,
      period_start_date: period?.period_start_date ?? null,
    })
    assignmentsByResource.set(raw.resource_id, list)
  }

  const resources: DirectoryResource[] = (resourcesRes.data as unknown as RawResourceRow[]).map((r) => {
    const supplier = pickEmbed(r.suppliers)
    return {
      resource_id: r.resource_id,
      resource_name: r.resource_name,
      resource_function: r.resource_function,
      resource_location: r.resource_location,
      resource_job_title: r.resource_job_title,
      resource_years_experience: r.resource_years_experience,
      resource_primary_tech_stack: r.resource_primary_tech_stack,
      resource_secondary_tech_stack: r.resource_secondary_tech_stack,
      supplier_id: r.supplier_id,
      supplier_name: supplier?.supplier_name ?? null,
      supplier_colour: supplier?.supplier_colour ?? null,
      supplier_abbreviation: supplier?.supplier_abbreviation ?? null,
      teams: resolveResourceTeams(assignmentsByResource.get(r.resource_id) ?? []),
    }
  })

  return { resources }
}

/**
 * Allocation history for one resource, from the non-sensitive
 * resource_allocation_history view (excludes day_rate / utilisation_percent /
 * cost_configurations by construction). Ordered period_start_date desc, then
 * resource_location — split allocations (two rows, same period) both survive.
 */
export async function getResourceAllocationHistory(resourceId: string): Promise<AllocationHistoryRow[]> {
  const supabase = await getSupabaseServerComponentClient()

  const { data, error } = await supabase
    .from('resource_allocation_history')
    .select('allocation_id, period_id, period_name, period_start_date, resource_location, role_title, capacity_days, team_name')
    .eq('resource_id', resourceId)

  if (error || !data) return []
  return sortAllocationHistory(data as AllocationHistoryRow[])
}

/**
 * Commercial snapshot (role_title + day_rate, current active period only)
 * for one resource. Gated by an explicit server-side plato_is_superuser()
 * RPC check — not a client-side conditional — so a non-superuser's client
 * never receives day_rate at all. Queries resource_period_allocations
 * directly (superuser-only RLS); all rows for the resolved period are
 * returned rather than a single row, so a split allocation (e.g. onshore +
 * offshore in the same period) is never collapsed here either.
 */
export async function getResourceCommercialSnapshot(resourceId: string): Promise<CommercialSnapshot> {
  const supabase = await getSupabaseServerComponentClient()

  const authorized = await checkIsSuperuser(supabase)
  if (!authorized) {
    return { authorized: false, period_name: null, allocations: [] }
  }

  const { data: periodsData } = await supabase
    .from('periods')
    .select('period_id, period_name, period_status, period_start_date, period_end_date, locked')
    .is('deleted_at', null)
    .order('period_start_date', { ascending: false })

  const period = selectDefaultPeriod((periodsData ?? []) as Period[])
  if (!period) {
    return { authorized: true, period_name: null, allocations: [] }
  }

  const { data: allocData, error } = await supabase
    .from('resource_period_allocations')
    .select('allocation_id, role_title, day_rate, resource_location')
    .eq('resource_id', resourceId)
    .eq('period_id', period.period_id)
    .is('deleted_at', null)

  if (error || !allocData) {
    return { authorized: true, period_name: period.period_name, allocations: [] }
  }

  return {
    authorized: true,
    period_name: period.period_name,
    allocations: allocData.map((a) => ({
      allocation_id: a.allocation_id as string,
      role_title: a.role_title as string | null,
      day_rate: a.day_rate as number,
      resource_location: a.resource_location as ResourceLocation | null,
    })),
  }
}
