// Pure logic for the "Export current view" modal: in-memory sorting of the
// currently-filtered rows, team-assignment de-emphasis when a specific team
// filter is active, and the copied table's lines and grand totals. None of
// this touches the Schedule page's own state or persisted display_order; the
// totals come from the same computeFooterTotals the on-screen footer uses.

import { countHeadcount, type TeamAssignment } from '@plato/schema'
import { calcCostItemVat } from './costItems'
import {
  computeFooterTotals,
  rowDisplayFigures,
  type FooterOptions,
  type FooterTotals,
  type RowDisplayFigures,
} from './footerTotals'

export interface ExportRow {
  allocation_id: string
  /** NULL for a vacant seat — needed so the modal's resource count is headcount, not rows. */
  resource_id: string | null
  resource_name: string | null
  role_title: string | null
  resource_location: string | null
  planview_code: string | null
  capacity_days: number | null
  /** Base cost for the period, integer pence — this view's "Run rate cost". */
  base_total_pence?: number
  /** Cost after VAT for the period, integer pence. */
  vat_total_pence?: number
  teams: TeamAssignment[]
}

/** An Ad-hoc / ETP / Shared Services line, as the page holds it. */
export interface ExportCostItem {
  cost_item_id: string
  label: string
  cost_item_category: string
  /** Integer pence. */
  amount_pence: number
  vat_applies: boolean
}

const COST_ITEM_CATEGORY_LABELS: Record<string, string> = {
  ADHOC: 'Ad-hoc expense',
  ETP: 'Enterprise Tooling Platform',
  SHARED_SERVICES: 'Shared Services',
}

export function costItemCategoryLabel(category: string): string {
  return COST_ITEM_CATEGORY_LABELS[category] ?? category
}

export type CopyViewLine =
  | ({ kind: 'allocation'; row: ExportRow } & RowDisplayFigures)
  | { kind: 'costItem'; item: ExportCostItem; basePence: number; vatPence: number }

export interface CopyView {
  /** Allocation rows in the given order, then cost items (when included). */
  lines: CopyViewLine[]
  /** Identical to the on-screen "Filtered totals" footer for the same inputs. */
  totals: FooterTotals
  /** People + vacant seats; cost items never count. */
  headcount: number
}

/**
 * Everything the Copy view shows. Allocation lines carry the same prorated
 * figures as the on-screen rows; cost items are appended only when the view is
 * unfiltered, exactly as the page's Ad-hoc and ETP/SS sections are.
 */
export function buildCopyView(
  rows: readonly ExportRow[],
  costItems: readonly ExportCostItem[],
  options: FooterOptions,
): CopyView {
  const allocationLines: CopyViewLine[] = rows.map((row) => ({
    kind: 'allocation',
    row,
    ...rowDisplayFigures(row, options.activeTeamFilter),
  }))
  const costItemLines: CopyViewLine[] = options.includeCostItems
    ? costItems.map((item) => ({
        kind: 'costItem',
        item,
        basePence: item.amount_pence,
        vatPence: calcCostItemVat(item.amount_pence, item.vat_applies, options.vatRate),
      }))
    : []
  return {
    lines: [...allocationLines, ...costItemLines],
    totals: computeFooterTotals(rows, costItems, options),
    headcount: countHeadcount(rows),
  }
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
