// Pure logic for the People Directory (Nucleus). No Supabase imports here —
// keeps this unit-testable from apps/nucleus's vitest suite without a DB.

export interface TeamAssignmentRow {
  team_id: string
  team_name: string
  /** null = a "live" assignment not pinned to a specific period. */
  period_id: string | null
  /** null when period_id is null; otherwise the joined period's start date. */
  period_start_date: string | null
}

/**
 * Resolve the current team(s) for a resource from its (unfiltered,
 * not-deleted) resource_team_assignments rows.
 *
 * Preference order: a period_id IS NULL "live" row, if any exist — else the
 * row(s) for the most recent period_start_date. Multiple rows surviving that
 * selection (capacity_split across teams) all count — their team names are
 * returned de-duplicated and alphabetised, ready to join with ", ".
 *
 * Empty return = no assignment at all = "Not on a team".
 */
export function resolveResourceTeams(rows: TeamAssignmentRow[]): string[] {
  if (rows.length === 0) return []

  const liveRows = rows.filter((r) => r.period_id === null)
  const candidateRows = liveRows.length > 0 ? liveRows : latestPeriodRows(rows)

  const names = Array.from(new Set(candidateRows.map((r) => r.team_name)))
  return names.sort((a, b) => a.localeCompare(b))
}

function latestPeriodRows(rows: TeamAssignmentRow[]): TeamAssignmentRow[] {
  const dated = rows.filter((r): r is TeamAssignmentRow & { period_start_date: string } => r.period_start_date !== null)
  if (dated.length === 0) return []
  const latestDate = dated.reduce(
    (max, r) => (r.period_start_date > max ? r.period_start_date : max),
    dated[0].period_start_date,
  )
  return dated.filter((r) => r.period_start_date === latestDate)
}

/** Reserved value for the Team group's "No team" pill — selects resources
 *  with zero team assignments (teams: []), OR'd together with any other
 *  selected real team names within the same group. */
export const NO_TEAM_SENTINEL = '__no_team__'

export interface DirectoryFilterCriteria {
  search: string
  /** resource_function values. Empty = no function filter applied. */
  functions: string[]
  /** team names, plus optionally NO_TEAM_SENTINEL. Empty = no team filter applied. */
  teams: string[]
  /** supplier_abbreviation values. Empty = no supplier filter applied. */
  suppliers: string[]
  /** resource_location values. Empty = no location filter applied. */
  locations: string[]
}

export interface FilterableResource {
  resource_name: string
  resource_function: string | null
  resource_location: string | null
  resource_job_title: string | null
  supplier_abbreviation: string | null
  teams: string[]
}

/** True if `query` (already trimmed/lower-cased) appears in the resource's
 *  name, role/job title, any current team name, or location. */
function resourceMatchesSearch(r: FilterableResource, query: string): boolean {
  if (r.resource_name.toLowerCase().includes(query)) return true
  if (r.resource_job_title && r.resource_job_title.toLowerCase().includes(query)) return true
  if (r.resource_location && r.resource_location.toLowerCase().includes(query)) return true
  if (r.teams.some((t) => t.toLowerCase().includes(query))) return true
  return false
}

/**
 * Combine the People Directory's search box with the Supplier, Location,
 * Function and Team pill groups. Every group is independent of the others
 * being present — all four groups combine with AND; multiple selections
 * within a single group OR together. A resource with no team assignment
 * (teams: []) is excluded when a Team filter is applied UNLESS the
 * NO_TEAM_SENTINEL pill is itself one of the selected teams, in which case
 * it's exactly what that selection matches.
 */
export function filterDirectoryResources<T extends FilterableResource>(
  resources: T[],
  criteria: DirectoryFilterCriteria,
): T[] {
  const search = criteria.search.trim().toLowerCase()

  return resources.filter((r) => {
    if (search && !resourceMatchesSearch(r, search)) return false

    if (criteria.functions.length > 0) {
      if (!r.resource_function || !criteria.functions.includes(r.resource_function)) return false
    }

    if (criteria.teams.length > 0) {
      const matchesTeam = r.teams.some((t) => criteria.teams.includes(t))
      const matchesNoTeam = r.teams.length === 0 && criteria.teams.includes(NO_TEAM_SENTINEL)
      if (!matchesTeam && !matchesNoTeam) return false
    }

    if (criteria.suppliers.length > 0) {
      if (!r.supplier_abbreviation || !criteria.suppliers.includes(r.supplier_abbreviation)) return false
    }

    if (criteria.locations.length > 0) {
      if (!r.resource_location || !criteria.locations.includes(r.resource_location)) return false
    }

    return true
  })
}

export interface SortableHistoryRow {
  period_start_date: string
  resource_location: string | null
}

/**
 * Order history rows by period_start_date desc, then resource_location.
 * Deliberately does not group, average, or deduplicate — a split allocation
 * (two rows sharing a period_id, e.g. onshore + offshore) must survive as
 * two separate rows here.
 */
export function sortAllocationHistory<T extends SortableHistoryRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.period_start_date !== b.period_start_date) {
      return a.period_start_date > b.period_start_date ? -1 : 1
    }
    const locA = a.resource_location ?? ''
    const locB = b.resource_location ?? ''
    return locA.localeCompare(locB)
  })
}

export interface SuperuserRpcClient {
  // PromiseLike (not Promise) so this structurally accepts Supabase's
  // PostgrestFilterBuilder, which is thenable but not a real Promise.
  rpc: (fn: 'plato_is_superuser') => PromiseLike<{ data: unknown; error: { message: string } | null }>
}

/**
 * Server-side superuser check for the Commercial section gate. Calls the
 * same plato_is_superuser() function the RLS policies use, via RPC, rather
 * than a client-side role conditional — so a non-superuser never has the
 * data shipped to their client in the first place.
 */
export async function checkIsSuperuser(client: SuperuserRpcClient): Promise<boolean> {
  const { data, error } = await client.rpc('plato_is_superuser')
  if (error) return false
  return data === true
}
