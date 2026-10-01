import { describe, expect, it } from 'vitest'
import { summariseHomepageCost, type HomepageCostRow } from '../homepageCost'
import { isChargeableRow } from '../planview'

const VAT_PCT = 7.082

type Row = HomepageCostRow & { label: string; is_chargeable: boolean }

function row(label: string, planview_code: string | null, days: number | null, dayRate: number, is_chargeable: boolean, isInternal = false): Row {
  return { label, planview_code, day_rate: dayRate, utilisation_percent: 100, capacity_days: days, isInternal, is_chargeable }
}

// The stored is_chargeable values below are deliberately not all derivable
// from planview_code: the F_Gov row carries the live stale `true`.
const ROWS: Row[] = [
  row('PR', 'PR', 60, 50_000, true), //            base 3,000,000 · VAT 3,212,460
  row('F_Gov stale', 'F_Gov', 20, 55_000, true), // base 1,100,000 · VAT 1,177,902 — must NOT be chargeable
  row('BAU', 'BAU', 64, 0, false, true), //          £0
  row('NPC', 'NPC', 10, 45_000, false), //           base   450,000 · VAT   481,869
  row('Vacant PR', 'PR', 30, 40_000, true), //       base 1,200,000 · VAT 1,284,984
]

describe('summariseHomepageCost', () => {
  it('the homepage Chargeable £ ignores the stale is_chargeable flag', () => {
    const summary = summariseHomepageCost(ROWS, VAT_PCT)
    // PR rows only: 3,212,460 + 1,284,984. The stale F_Gov row's 1,177,902
    // would have been added when this read the stored column.
    expect(summary.chargeable_cost_pence).toBe(4_497_444)
  })

  it('derives chargeability from planview_code for every row', () => {
    for (const r of ROWS) {
      const alone = summariseHomepageCost([r], VAT_PCT)
      const expected = isChargeableRow(r.planview_code) ? alone.vat_cost_pence : 0
      expect(alone.chargeable_cost_pence, r.label).toBe(expected)
    }
  })

  it('leaves base, VAT and the data-quality counts as they were', () => {
    const summary = summariseHomepageCost(
      [...ROWS, row('No code', null, 5, 10_000, false), row('No days', 'PR', null, 10_000, true)],
      VAT_PCT,
    )
    expect(summary.base_cost_pence).toBe(3_000_000 + 1_100_000 + 0 + 450_000 + 1_200_000 + 50_000 + 0)
    expect(summary.missingPlanview).toBe(1)
    expect(summary.missingCapacity).toBe(1)
  })

  it('internal (Royal Mail Group) rows carry no VAT', () => {
    const internal = row('Internal PR', 'PR', 10, 30_000, true, true)
    expect(summariseHomepageCost([internal], VAT_PCT).vat_cost_pence).toBe(300_000)
  })
})
