import { describe, expect, it } from 'vitest'
import { buildPlatformTotalFormula } from '../platformTotalFormula'
import { evaluateFormula } from './helpers/evaluateSheetFormula'
import type { Grid } from './helpers/evaluateSheetFormula'
import { computeScheduleTotals } from '../../schedule/scheduleTotals'
import {
  Q3_ALLOCATIONS,
  Q3_COST_ITEMS,
  Q3_VAT_MULTIPLIER,
  Q3_EXPECTED,
} from '../../schedule/__tests__/fixtures/q3Fy2627'

/* ══════════════════════════════════════════════════════════════════════
   The exported workbook has three tabs that each carry Total Platform
   Cost, by three different mechanisms:

     Summary          — a literal computed in TypeScript
     Rate Calculator  — a live formula over that sheet's own rows
     Raw Data         — a live formula over its flat copy of the rows

   Before the fix they disagreed with the Schedule page and, in the case of
   the two formula tabs, would have disagreed with the Summary as well once
   the Summary was corrected. This builds each tab's rows from the same Q3
   data and checks all three land on the page's own figure.
══════════════════════════════════════════════════════════════════════ */

const vat = Q3_VAT_MULTIPLIER

/** Cost in pounds, as the sheets' own =(H*I)*J formula computes it. */
function rowBaseGbp(a: (typeof Q3_ALLOCATIONS)[number]): number {
  return (a.utilisation_percent / 100) * (a.capacity_days ?? 0) * (a.day_rate / 100)
}

/**
 * The Rate Calculator sheet: a blank row, a header, then supplier band rows
 * interleaved with allocation rows, then the ad-hoc block. Q3 has no ETP or
 * Shared Services items, so that block is absent — which is itself worth
 * covering, since the formula has to omit rather than mis-range it.
 */
function buildRateCalculatorSheet() {
  const grid: Grid = new Map()
  const FIRST_DATA_ROW = 3
  let row = FIRST_DATA_ROW

  // One supplier band row, as the export writes before each supplier's block:
  // no planview code, and text in the +VAT column.
  grid.set(`E${row}`, '')
  grid.set(`M${row}`, 'avg/day  £450.00')
  row++

  for (const a of Q3_ALLOCATIONS) {
    const base = rowBaseGbp(a)
    const isZeroCost = (a.capacity_days ?? 0) === 0 || a.utilisation_percent === 0
    grid.set(`E${row}`, a.planview_code ?? '')
    // Zero-cost rows are written as an em dash, not a number.
    grid.set(`L${row}`, isZeroCost ? '—' : base)
    grid.set(`M${row}`, isZeroCost ? '—' : a.vat_applies ? base * vat : base)
    row++
  }
  const lastResourceRow = row - 1

  row += 2 // blank + section header
  const firstAdhocRow = row
  for (const item of Q3_COST_ITEMS) {
    const amount = item.amount_pence / 100
    grid.set(`L${row}`, amount)
    grid.set(`M${row}`, item.vat_applies ? amount * vat : amount)
    row++
  }
  const lastAdhocRow = row - 1

  return {
    grid,
    formula: (column: 'L' | 'M') =>
      buildPlatformTotalFormula({
        column,
        planviewColumn: 'E',
        resources: { first: FIRST_DATA_ROW, last: lastResourceRow },
        costSections: [
          { first: firstAdhocRow, last: lastAdhocRow },
          { first: 0, last: 0 }, // no ETP / Shared Services this period
        ],
      }),
  }
}

/** The Raw Data tab: header on row 1, then every allocation, then every cost item. */
function buildRawDataSheet() {
  const grid: Grid = new Map()
  let row = 2

  for (const a of Q3_ALLOCATIONS) {
    const base = rowBaseGbp(a)
    grid.set(`E${row}`, a.planview_code ?? '')
    grid.set(`L${row}`, base)
    grid.set(`M${row}`, a.vat_applies ? base * vat : base)
    row++
  }
  const lastAllocRow = row - 1

  const firstCostRow = row
  for (const item of Q3_COST_ITEMS) {
    const amount = item.amount_pence / 100
    grid.set(`L${row}`, amount)
    grid.set(
      `M${row}`,
      item.cost_item_category === 'ADHOC' && item.vat_applies ? amount * vat : amount,
    )
    row++
  }

  return {
    grid,
    formula: (column: 'L' | 'M') =>
      buildPlatformTotalFormula({
        column,
        planviewColumn: 'E',
        resources: { first: 2, last: lastAllocRow },
        costSections: [{ first: firstCostRow, last: row - 1 }],
      }),
  }
}

describe('Q3 FY 26/27 — all three tabs agree with the live page', () => {
  const summaryGbp = computeScheduleTotals(Q3_ALLOCATIONS, Q3_COST_ITEMS, vat).totalPlatformPence / 100

  const rateCalc = buildRateCalculatorSheet()
  const rawData = buildRawDataSheet()
  const rateCalcGbp = evaluateFormula(rateCalc.formula('M'), rateCalc.grid)
  const rawDataGbp = evaluateFormula(rawData.formula('M'), rawData.grid)

  it('Summary matches the live page', () => {
    expect(Math.round(summaryGbp)).toBe(Q3_EXPECTED.totalPlatformGbp)
  })

  it('the Rate Calculator sheet subtotal matches the live page', () => {
    expect(Math.round(rateCalcGbp)).toBe(Q3_EXPECTED.totalPlatformGbp)
  })

  it('the Raw Data subtotal matches the live page', () => {
    expect(Math.round(rawDataGbp)).toBe(Q3_EXPECTED.totalPlatformGbp)
  })

  // The two formula tabs compute each row in pounds as a float; the Summary
  // rounds each row to the penny, as the page does. Over ~100 rows that leaves
  // a few pence of drift between the two conventions (7p on this data) — far
  // inside the whole pounds all three are displayed in, but real, so this
  // pins the size of it rather than pretending it is zero.
  it('the three agree with each other to within pennies, and to the same pound', () => {
    expect(Math.abs(rateCalcGbp - summaryGbp)).toBeLessThan(0.5)
    expect(Math.abs(rawDataGbp - summaryGbp)).toBeLessThan(0.5)
    // The two formula tabs share one convention, so they should be identical.
    expect(rateCalcGbp).toBeCloseTo(rawDataGbp, 6)
    // What actually reaches the reader is the rounded figure, and that is equal.
    expect(Math.round(rateCalcGbp)).toBe(Math.round(summaryGbp))
    expect(Math.round(rawDataGbp)).toBe(Math.round(summaryGbp))
  })

  it('the Advised Rate that follows from each is the page\'s', () => {
    const days = Q3_EXPECTED.xChargeableDays
    expect(summaryGbp / days).toBeCloseTo(Q3_EXPECTED.advisedRateGbp, 2)
    expect(rateCalcGbp / days).toBeCloseTo(Q3_EXPECTED.advisedRateGbp, 2)
    expect(rawDataGbp / days).toBeCloseTo(Q3_EXPECTED.advisedRateGbp, 2)
  })

  it('none of the three reproduces the old, unfiltered total', () => {
    for (const figure of [summaryGbp, rateCalcGbp, rawDataGbp]) {
      expect(Math.round(figure)).not.toBe(Q3_EXPECTED.oldExportTotalGbp)
    }
  })

  it('the BAU and NPC rows are still present in both sheets, just not counted', () => {
    const excluded = Q3_ALLOCATIONS.filter(
      (a) => a.planview_code === 'BAU' || a.planview_code === 'NPC',
    )
    expect(excluded.length).toBeGreaterThan(0)
    for (const grid of [rateCalc.grid, rawData.grid]) {
      const codes = [...grid.entries()]
        .filter(([ref]) => ref.startsWith('E'))
        .map(([, v]) => v)
      expect(codes).toContain('BAU')
      expect(codes).toContain('NPC')
    }
  })
})
