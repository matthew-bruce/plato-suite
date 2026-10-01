import { describe, expect, it } from 'vitest'
import { computeFooterTotals, rowDisplayFigures, type FooterOptions } from '../footerTotals'
import { buildCopyView, type ExportRow } from '../exportView'
import { isIncludedInBaseCost } from '../ui'
import { calcCostItemVat } from '../costItems'
import { getCapacitySplit } from '../../scheduleUtils'
import {
  MIXED_ALPHA_ROWS,
  MIXED_COST_ITEMS,
  MIXED_ROWS,
  MIXED_VAT_PCT,
  type MixedRow,
} from './fixtures/mixedSchedule'

const UNFILTERED: FooterOptions = { activeTeamFilter: null, includeCostItems: true, vatPct: MIXED_VAT_PCT }
const ALPHA: FooterOptions = { activeTeamFilter: 'Alpha', includeCostItems: false, vatPct: MIXED_VAT_PCT }

/** The footer's Base/+VAT exactly as SchedulePageClient computed them before
 *  this change — the cost figures must not move. */
function previousFooterCost(rows: MixedRow[], options: FooterOptions) {
  let basePence = 0
  let vatPence = 0
  for (const r of rows) {
    if (!isIncludedInBaseCost(r.planview_code)) continue
    basePence += Math.round(r.base_total_pence * getCapacitySplit(r.teams, options.activeTeamFilter))
    vatPence += Math.round(r.vat_total_pence * getCapacitySplit(r.teams, options.activeTeamFilter))
  }
  if (options.includeCostItems) {
    basePence += MIXED_COST_ITEMS.reduce((s, i) => s + i.amount_pence, 0)
    vatPence += MIXED_COST_ITEMS.reduce((s, i) => s + calcCostItemVat(i.amount_pence, i.vat_applies, options.vatPct), 0)
  }
  return { basePence, vatPence }
}

describe('footer Days — the sum of the displayed Days column', () => {
  it('counts every displayed row, BAU and NPC included', () => {
    // 60 + 40 + 20 + 64 (BAU) + 10 (NPC) + 30 + 25 + 35
    expect(computeFooterTotals(MIXED_ROWS, MIXED_COST_ITEMS, UNFILTERED).days).toBe(284)
  })

  it('no longer drops BAU and NPC days (the cost-filter regression: 210)', () => {
    expect(computeFooterTotals(MIXED_ROWS, MIXED_COST_ITEMS, UNFILTERED).days).not.toBe(210)
  })

  it('equals the sum of each row as displayed, unfiltered and team-filtered', () => {
    for (const [rows, options] of [[MIXED_ROWS, UNFILTERED], [MIXED_ALPHA_ROWS, ALPHA]] as const) {
      const displayed = rows.reduce((s, r) => s + rowDisplayFigures(r, options.activeTeamFilter).days, 0)
      expect(computeFooterTotals(rows, MIXED_COST_ITEMS, options).days).toBe(displayed)
    }
  })

  it('prorates by the active team split (Bob is 50% Alpha)', () => {
    // 60 + 40×0.5 + 64 + 30 + 25 + 35
    expect(computeFooterTotals(MIXED_ALPHA_ROWS, MIXED_COST_ITEMS, ALPHA).days).toBe(234)
  })
})

describe('footer Base / +VAT — unchanged', () => {
  it('matches the previous footer formula, unfiltered and team-filtered', () => {
    for (const [rows, options] of [[MIXED_ROWS, UNFILTERED], [MIXED_ALPHA_ROWS, ALPHA]] as const) {
      const { basePence, vatPence } = computeFooterTotals(rows, MIXED_COST_ITEMS, options)
      expect({ basePence, vatPence }).toEqual(previousFooterCost([...rows], options))
    }
  })

  it('pins the unfiltered figures: BAU and NPC excluded, Ad-hoc included', () => {
    const totals = computeFooterTotals(MIXED_ROWS, MIXED_COST_ITEMS, UNFILTERED)
    expect(totals.basePence).toBe(9_460_000)
    expect(totals.vatPence).toBe(10_129_957)
  })

  it('pins the Alpha-filtered figures: prorated, no cost items', () => {
    const totals = computeFooterTotals(MIXED_ALPHA_ROWS, MIXED_COST_ITEMS, ALPHA)
    expect(totals.basePence).toBe(7_660_000)
    expect(totals.vatPence).toBe(8_202_481)
  })
})

describe('Copy view (ExportCurrentViewModal)', () => {
  const asExportRows = (rows: MixedRow[]): ExportRow[] => rows

  it('grand totals equal the on-screen footer for the same rows and filter', () => {
    for (const [rows, options] of [[MIXED_ROWS, UNFILTERED], [MIXED_ALPHA_ROWS, ALPHA]] as const) {
      const view = buildCopyView(asExportRows([...rows]), MIXED_COST_ITEMS, options)
      expect(view.totals).toEqual(computeFooterTotals(rows, MIXED_COST_ITEMS, options))
    }
  })

  it('includes the Ad-hoc item, and its own lines add up to its totals', () => {
    const view = buildCopyView(asExportRows(MIXED_ROWS), MIXED_COST_ITEMS, UNFILTERED)
    const costItemLines = view.lines.filter((l) => l.kind === 'costItem')
    expect(costItemLines).toHaveLength(1)

    let days = 0
    let basePence = 0
    let vatPence = 0
    for (const line of view.lines) {
      if (line.kind === 'allocation') {
        days += line.days
        if (!line.countsTowardCost) continue
      }
      basePence += line.basePence
      vatPence += line.vatPence
    }
    expect({ days, basePence, vatPence }).toEqual(view.totals)
  })

  it('leaves cost items out when a filter is active, exactly as the page does', () => {
    const view = buildCopyView(asExportRows(MIXED_ALPHA_ROWS), MIXED_COST_ITEMS, ALPHA)
    expect(view.lines.some((l) => l.kind === 'costItem')).toBe(false)
  })

  it('never counts the Ad-hoc item toward headcount — the mover counts once, the vacant seat once', () => {
    // alice, bob, carol, matt, dan, eve (two rows) + 1 vacant seat
    expect(buildCopyView(asExportRows(MIXED_ROWS), MIXED_COST_ITEMS, UNFILTERED).headcount).toBe(7)
  })
})
