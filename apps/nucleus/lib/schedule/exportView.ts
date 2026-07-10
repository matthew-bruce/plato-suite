// Pure logic for the "Export current view" modal: in-memory sorting of the
// currently-filtered rows, and team-assignment de-emphasis when a specific
// team filter is active. None of this touches the Schedule page's own state,
// persisted display_order, or financial calculations — it only reorders /
// restyles a read-only snapshot already computed by the page.

import type { TeamAssignment } from '@plato/schema'

export interface ExportRow {
  allocation_id: string
  resource_name: string | null
  role_title: string | null
  resource_location: string | null
  capacity_days: number | null
  /** Base cost for the period, integer pence — this view's "Run rate cost". */
  base_total_pence?: number
  teams: TeamAssignment[]
}

// Team(s) is deliberately excluded — a composite field has no meaningful
// single sort order — so it can never be reached via this type.
export type ExportSortableCol = 'resource' | 'role' | 'location' | 'days' | 'total'
export type SortDir = 'asc' | 'desc'

export interface ExportSortState {
  col: ExportSortableCol | null
  dir: SortDir
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, 'en', { sensitivity: 'base' })
}

/** Sorts a copy of `rows`; a null column returns `rows` as-is (the current filtered view order). */
export function sortExportRows(rows: ExportRow[], col: ExportSortableCol | null, dir: SortDir): ExportRow[] {
  if (!col) return rows
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (col) {
      case 'resource':
        return mul * compareStrings(a.resource_name ?? '', b.resource_name ?? '')
      case 'role':
        return mul * compareStrings(a.role_title ?? '', b.role_title ?? '')
      case 'location':
        return mul * compareStrings(a.resource_location ?? '', b.resource_location ?? '')
      case 'days':
        return mul * ((a.capacity_days ?? 0) - (b.capacity_days ?? 0))
      case 'total':
        return mul * ((a.base_total_pence ?? 0) - (b.base_total_pence ?? 0))
      default:
        return 0
    }
  })
}

/**
 * Click-to-sort transition: clicking the currently-sorted column reverses
 * direction; clicking a different column resets to ascending.
 */
export function nextExportSortState(
  col: ExportSortableCol,
  current: ExportSortState,
): ExportSortState {
  if (current.col === col) {
    return { col, dir: current.dir === 'asc' ? 'desc' : 'asc' }
  }
  return { col, dir: 'asc' }
}

/** ↕ unsorted · ↑ ascending · ↓ descending, for the given header's own column. */
export function sortIndicator(col: ExportSortableCol, state: ExportSortState): '↕' | '↑' | '↓' {
  if (state.col !== col) return '↕'
  return state.dir === 'asc' ? '↑' : '↓'
}

export type TeamEmphasis = 'primary' | 'secondary' | 'equal'

export interface TeamAssignmentDisplay extends TeamAssignment {
  emphasis: TeamEmphasis
}

/**
 * When no team filter is active, every assignment renders at equal weight
 * (`equal`). When one is active, the assignment(s) matching it (by name or
 * id — the Team filter's value can be either) render `primary`; every other
 * assignment on the same resource renders `secondary`.
 */
export function splitTeamAssignments(
  teams: TeamAssignment[],
  activeTeamFilter: string | null,
): TeamAssignmentDisplay[] {
  if (!activeTeamFilter) {
    return teams.map((t) => ({ ...t, emphasis: 'equal' as const }))
  }
  return teams.map((t) => ({
    ...t,
    emphasis:
      t.teamName === activeTeamFilter || t.teamId === activeTeamFilter
        ? ('primary' as const)
        : ('secondary' as const),
  }))
}

export interface TeamCellStyle {
  fontWeight: number
  fontSize: number
  color: string
  prefix: string
}

const PRIMARY_STYLE: TeamCellStyle = { fontWeight: 700, fontSize: 12, color: '#2A2A2D', prefix: '' }
const SECONDARY_STYLE: TeamCellStyle = { fontWeight: 400, fontSize: 11, color: '#8F9495', prefix: '+ ' }
const EQUAL_STYLE: TeamCellStyle = { fontWeight: 400, fontSize: 12, color: '#2A2A2D', prefix: '' }

export function getTeamCellStyle(emphasis: TeamEmphasis): TeamCellStyle {
  if (emphasis === 'primary') return PRIMARY_STYLE
  if (emphasis === 'secondary') return SECONDARY_STYLE
  return EQUAL_STYLE
}
