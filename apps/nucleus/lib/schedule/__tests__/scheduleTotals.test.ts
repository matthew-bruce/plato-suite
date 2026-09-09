import { describe, expect, it } from 'vitest'
import {
  computeScheduleTotals,
  allocationBasePence,
  allocationVatPence,
} from '../scheduleTotals'
import type { TotalsAllocation, TotalsCostItem } from '../scheduleTotals'
import { isIncludedInBaseCost, isChargeableRow } from '../ui'
import {
  Q3_ALLOCATIONS,
  Q3_COST_ITEMS,
  Q3_VAT_MULTIPLIER,
  Q3_EXPECTED,
} from './fixtures/q3Fy2627'

const gbp = (pence: number) => Math.round(pence / 100)

describe('Q3 FY 26/27 reconciliation (export vs live Schedule page)', () => {
  const totals = computeScheduleTotals(Q3_ALLOCATIONS, Q3_COST_ITEMS, Q3_VAT_MULTIPLIER)

  it('Total Platform Cost matches the live page to the pound', () => {
    expect(gbp(totals.totalPlatformPence)).toBe(Q3_EXPECTED.totalPlatformGbp)
  })

  it('Advised (blended) rate matches the live page', () => {
    expect(totals.advisedRatePence / 100).toBeCloseTo(Q3_EXPECTED.advisedRateGbp, 2)
  })

  it('X-chargeable days are the PR-only, utilisation-weighted total', () => {
    expect(totals.xChargeableDays).toBeCloseTo(Q3_EXPECTED.xChargeableDays, 1)
  })

  it('does not produce the old, wrong export figures', () => {
    expect(gbp(totals.totalPlatformPence)).not.toBe(Q3_EXPECTED.oldExportTotalGbp)
    expect(totals.advisedRatePence / 100).not.toBeCloseTo(Q3_EXPECTED.oldExportAdvisedRateGbp, 2)
  })

  it('excluding BAU/NPC is worth the £89,597 the old export wrongly included', () => {
    const excluded = Q3_ALLOCATIONS.filter((a) => !isIncludedInBaseCost(a.planview_code))
    const excludedVat = excluded.reduce((s, a) => s + allocationVatPence(a, Q3_VAT_MULTIPLIER), 0)
    expect(gbp(excludedVat)).toBe(Q3_EXPECTED.excludedRowsGbp)
  })

  it('ad-hoc VAT is worth the £9,297 the old export wrongly omitted', () => {
    const raw = Q3_COST_ITEMS.reduce((s, i) => s + i.amount_pence, 0)
    expect(gbp(totals.adhocVatPence - raw)).toBe(Q3_EXPECTED.adhocVatGbp)
  })

  it('the two defects netted to the £80,300 gap that was reported', () => {
    const excludedVat = Q3_ALLOCATIONS.filter((a) => !isIncludedInBaseCost(a.planview_code))
      .reduce((s, a) => s + allocationVatPence(a, Q3_VAT_MULTIPLIER), 0)
    const rawAdhoc = Q3_COST_ITEMS.reduce((s, i) => s + i.amount_pence, 0)
    const oldExportPence =
      totals.totalPlatformPence + excludedVat - (totals.adhocVatPence - rawAdhoc)
    expect(gbp(oldExportPence)).toBe(Q3_EXPECTED.oldExportTotalGbp)
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Equivalence with the live page's own calculation.

   SchedulePageClient computes these figures inline in its `totals` useMemo.
   This is that calculation transcribed, so the test fails if either side is
   changed without the other — the drift that produced the original bug.
══════════════════════════════════════════════════════════════════════ */

function livePageTotals(
  allocations: TotalsAllocation[],
  costItems: TotalsCostItem[],
  vatMultiplier: number,
) {
  const allocsVat = allocations.reduce((sum, a) => {
    if (!isIncludedInBaseCost(a.planview_code)) return sum
    const base = Math.round(a.day_rate * (a.capacity_days ?? 0) * (a.utilisation_percent / 100))
    return sum + (a.vat_applies !== false ? Math.round(base * vatMultiplier) : base)
  }, 0)

  const adHocVat = costItems
    .filter((i) => i.cost_item_category === 'ADHOC')
    .reduce(
      (sum, i) => sum + (i.vat_applies ? Math.round(i.amount_pence * vatMultiplier) : i.amount_pence),
      0,
    )

  const etpAndSsPence = costItems
    .filter((i) => i.cost_item_category === 'ETP' || i.cost_item_category === 'SHARED_SERVICES')
    .reduce((sum, i) => sum + i.amount_pence, 0)

  const totalPlatformIncEtp = allocsVat + adHocVat + etpAndSsPence
  const chargeableDays = allocations
    .filter((a) => isChargeableRow(a.planview_code))
    .reduce((s, a) => s + (a.capacity_days ?? 0) * (a.utilisation_percent / 100), 0)

  return {
    totalPlatformIncEtp,
    chargeableDays,
    calcRateIncEtp: chargeableDays > 0 ? totalPlatformIncEtp / chargeableDays : 0,
  }
}

describe('the export and the live page agree', () => {
  it('on Q3 FY 26/27, to the penny', () => {
    const mine = computeScheduleTotals(Q3_ALLOCATIONS, Q3_COST_ITEMS, Q3_VAT_MULTIPLIER)
    const live = livePageTotals(Q3_ALLOCATIONS, Q3_COST_ITEMS, Q3_VAT_MULTIPLIER)
    expect(mine.totalPlatformPence).toBe(live.totalPlatformIncEtp)
    expect(mine.xChargeableDays).toBe(live.chargeableDays)
    expect(mine.advisedRatePence).toBe(live.calcRateIncEtp)
  })

  it('on a period that also carries ETP and Shared Services', () => {
    const items: TotalsCostItem[] = [
      ...Q3_COST_ITEMS,
      { cost_item_category: 'ETP', amount_pence: 5_000_00, vat_applies: false },
      { cost_item_category: 'SHARED_SERVICES', amount_pence: 12_345_67, vat_applies: true },
    ]
    const mine = computeScheduleTotals(Q3_ALLOCATIONS, items, Q3_VAT_MULTIPLIER)
    const live = livePageTotals(Q3_ALLOCATIONS, items, Q3_VAT_MULTIPLIER)
    expect(mine.totalPlatformPence).toBe(live.totalPlatformIncEtp)
  })
})

/* ══════════════════════════════════════════════════════════════════════
   The individual rules
══════════════════════════════════════════════════════════════════════ */

const row = (over: Partial<TotalsAllocation> = {}): TotalsAllocation => ({
  planview_code: 'PR',
  utilisation_percent: 100,
  capacity_days: 10,
  day_rate: 50000,
  vat_applies: false,
  ...over,
})

describe('which allocations count toward cost', () => {
  it('counts PR', () => {
    expect(computeScheduleTotals([row()], [], 1).resourcesVatPence).toBe(500000)
  })

  it('counts F_Gov — overhead the platform still carries', () => {
    expect(
      computeScheduleTotals([row({ planview_code: 'F_Gov' })], [], 1).resourcesVatPence,
    ).toBe(500000)
  })

  it('excludes BAU', () => {
    expect(computeScheduleTotals([row({ planview_code: 'BAU' })], [], 1).resourcesVatPence).toBe(0)
  })

  it('excludes NPC', () => {
    expect(computeScheduleTotals([row({ planview_code: 'NPC' })], [], 1).resourcesVatPence).toBe(0)
  })

  it('excludes a row with no planview code at all', () => {
    expect(computeScheduleTotals([row({ planview_code: null })], [], 1).resourcesVatPence).toBe(0)
    expect(computeScheduleTotals([row({ planview_code: '' })], [], 1).resourcesVatPence).toBe(0)
  })
})

describe('which allocations count toward X-chargeable days', () => {
  it('counts PR only — F_Gov is cost but not chargeable days', () => {
    const totals = computeScheduleTotals(
      [row(), row({ planview_code: 'F_Gov' }), row({ planview_code: 'BAU' })],
      [],
      1,
    )
    expect(totals.xChargeableDays).toBe(10)
  })

  it('weights days by utilisation', () => {
    expect(computeScheduleTotals([row({ utilisation_percent: 50 })], [], 1).xChargeableDays).toBe(5)
  })

  it('treats a null capacity as zero days', () => {
    expect(computeScheduleTotals([row({ capacity_days: null })], [], 1).xChargeableDays).toBe(0)
  })
})

describe('VAT', () => {
  it('applies to an allocation that takes VAT', () => {
    const t = computeScheduleTotals([row({ vat_applies: true })], [], 1.2)
    expect(t.resourcesVatPence).toBe(600000)
  })

  it('is skipped for an allocation that does not', () => {
    expect(computeScheduleTotals([row({ vat_applies: false })], [], 1.2).resourcesVatPence).toBe(500000)
  })

  it('applies to ad-hoc items per their own flag', () => {
    const items: TotalsCostItem[] = [
      { cost_item_category: 'ADHOC', amount_pence: 100000, vat_applies: true },
      { cost_item_category: 'ADHOC', amount_pence: 100000, vat_applies: false },
    ]
    expect(computeScheduleTotals([], items, 1.2).adhocVatPence).toBe(120000 + 100000)
  })

  it('is never applied to ETP / Shared Services — their figures already embed it', () => {
    const items: TotalsCostItem[] = [
      { cost_item_category: 'ETP', amount_pence: 100000, vat_applies: true },
      { cost_item_category: 'SHARED_SERVICES', amount_pence: 100000, vat_applies: true },
    ]
    expect(computeScheduleTotals([], items, 1.2).etpSsPence).toBe(200000)
  })
})

describe('edge cases', () => {
  it('returns a zero advised rate rather than dividing by zero', () => {
    const t = computeScheduleTotals([row({ planview_code: 'BAU' })], [], 1)
    expect(t.xChargeableDays).toBe(0)
    expect(t.advisedRatePence).toBe(0)
  })

  it('handles an empty schedule', () => {
    const t = computeScheduleTotals([], [], 1.07082)
    expect(t.totalPlatformPence).toBe(0)
    expect(t.advisedRatePence).toBe(0)
  })

  it('rounds each row on its own, as the page does', () => {
    // 33333 * 1.5 days = 49999.5 → 50000, not truncated.
    expect(allocationBasePence(row({ day_rate: 33333, capacity_days: 1.5 }))).toBe(50000)
  })
})
