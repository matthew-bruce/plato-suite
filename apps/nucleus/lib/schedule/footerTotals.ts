// The Schedule table's "Filtered totals" footer, as one pure function — so the
// on-screen footer and the Copy view (ExportCurrentViewModal) compute their
// grand totals the same way and cannot disagree.

// Relative imports: this module is unit-tested and vitest runs without the
// Next.js path alias.
import type { VatRateMilliPct } from '@plato/schema'
import { getCapacitySplit } from '../scheduleUtils'
import { calcCostItemVat } from './costItems'
import { isIncludedInBaseCost, sumFilteredDays } from './ui'

export interface FooterRow {
  planview_code: string | null | undefined
  capacity_days: number | null
  /** Integer pence, before VAT. */
  base_total_pence?: number
  /** Integer pence, after VAT. */
  vat_total_pence?: number
  teams?: Array<{ teamId: string; teamName: string; capacitySplit: number }>
}

export interface FooterCostItem {
  /** Integer pence. */
  amount_pence: number
  vat_applies: boolean
}

export interface FooterTotals {
  days: number
  basePence: number
  vatPence: number
}

export interface FooterOptions {
  activeTeamFilter: string | null
  /** Cost items belong to no resource/team, so they only count when the view
   *  is otherwise unfiltered — the page passes its `isUnfiltered` here. */
  includeCostItems: boolean
  /** The period's VAT rate in thousandths of a percent (7082 for 7.082%). */
  vatRate: VatRateMilliPct
}

export interface RowDisplayFigures {
  days: number
  basePence: number
  vatPence: number
  /** isIncludedInBaseCost — BAU and NPC rows show figures but add no cost. */
  countsTowardCost: boolean
}

/** One allocation row's Days / Base / +VAT as its cells display them, prorated
 *  to the active team's capacity split. The row's already-computed pence are
 *  prorated and NOT rounded here — rounding happens only at display, so a
 *  team-filtered total can differ from the unfiltered one by pennies. */
export function rowDisplayFigures(row: FooterRow, activeTeamFilter: string | null): RowDisplayFigures {
  const split = getCapacitySplit(row.teams ?? [], activeTeamFilter)
  return {
    days: (row.capacity_days ?? 0) * split,
    basePence: (row.base_total_pence ?? 0) * split,
    vatPence: (row.vat_total_pence ?? 0) * split,
    countsTowardCost: isIncludedInBaseCost(row.planview_code),
  }
}

/**
 * Days: every displayed row (the Days column's own sum).
 * Base / +VAT: cost-included rows only, plus cost items when unfiltered.
 */
export function computeFooterTotals(
  rows: readonly FooterRow[],
  costItems: readonly FooterCostItem[],
  options: FooterOptions,
): FooterTotals {
  let basePence = 0
  let vatPence = 0
  for (const row of rows) {
    const figures = rowDisplayFigures(row, options.activeTeamFilter)
    if (!figures.countsTowardCost) continue
    basePence += figures.basePence
    vatPence += figures.vatPence
  }
  if (options.includeCostItems) {
    for (const item of costItems) {
      basePence += item.amount_pence
      vatPence += calcCostItemVat(item.amount_pence, item.vat_applies, options.vatRate)
    }
  }
  return {
    days: sumFilteredDays([{ rows: [...rows] }], options.activeTeamFilter),
    basePence,
    vatPence,
  }
}
