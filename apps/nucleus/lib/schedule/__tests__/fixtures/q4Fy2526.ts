// Q4 FY 25/26 (period bb000001-0000-0000-0000-000000000001) — a frozen
// snapshot taken 2026-09-09 23:17 UTC, at the same instant as q2Fy2627.ts.
//
// This period exists here for one reason: four of its allocations carry
// resource_location = 'unspecified'. A location breakdown that only knew
// Onshore / Nearshore / Offshore silently dropped all four — £40,303 of
// VAT-inclusive cost that appeared in the headline but in none of the rows
// beneath it. Q3 FY 26/27 cannot catch that: it has no unspecified rows at
// all, so its three-bucket breakdown ties by luck rather than by rule.
//
// Rows are [planview, utilisation %, capacity days, day rate pence,
// vat_applies, supplier, location]. Location is the raw column value, in the
// database's own lower case, so the fixture exercises the bucketing rather
// than pre-applying it.

import type { TotalsAllocation, TotalsCostItem } from '../../scheduleTotals'

export const Q4_VAT_UPLIFT_PERCENT = 7.082
export const Q4_VAT_MULTIPLIER = parseFloat((1 + Q4_VAT_UPLIFT_PERCENT / 100).toFixed(5))

export interface LocatedAllocation extends TotalsAllocation {
  supplier_name: string | null
  resource_location: string | null
}

type RawRow = [string, number, number, number, number, string, string]

const Q4_RAW: RawRow[] = [
  ['F_Gov', 100, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 100, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 17, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 0, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['BAU', 0, 0, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 100, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 100, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 52, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 100, 63, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 100, 63, 91485, 1, 'Royal Mail Group', 'onshore'],
  ['PR', 50, 63, 40000, 1, 'Royal Mail Group', 'unspecified'],
  ['F_Gov', 0, 63, 58000, 0, 'Royal Mail Group', 'unspecified'],
  ['PR', 50, 25, 99500, 1, 'Royal Mail Group', 'unspecified'],
  ['PR', 50, 63, 40000, 1, 'Royal Mail Group', 'unspecified'],
  ['PR', 100, 57, 75000, 1, 'North Highland', 'onshore'],
  ['PR', 100, 57, 99500, 1, 'North Highland', 'onshore'],
  ['PR', 100, 57, 85000, 1, 'North Highland', 'onshore'],
  ['PR', 100, 57, 75000, 1, 'North Highland', 'onshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 50, 63, 60000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 38000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 48000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 48000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 60000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 60000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 36000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 36000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 36000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 63, 45000, 1, 'Happy Team', 'nearshore'],
  ['F_Gov', 100, 45, 40082, 1, 'Capgemini', 'onshore'],
  ['F_Gov', 100, 9, 20422, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 18517, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 20422, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 57, 117492, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 19, 81177, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 117492, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 44181, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 15, 15559, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 20948, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 18, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 12, 132020, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 27557, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 6, 132020, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 20422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 18, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 6, 31634, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 20901, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 54, 37980, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 28422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 14895, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 18, 12446, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 54, 28422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 3, 100242, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 47, 91715, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 56, 111694, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 54, 20948, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 63, 80000, 1, 'Lean Tree', 'onshore'],
  ['PR', 90, 63, 40000, 1, 'TAAS', 'onshore'],
]

export const Q4_ALLOCATIONS: LocatedAllocation[] = Q4_RAW.map(
  ([code, util, days, rate, vat, supplier, location]) => ({
    planview_code: code,
    utilisation_percent: util,
    capacity_days: days,
    day_rate: rate,
    vat_applies: vat === 1,
    supplier_name: supplier || null,
    resource_location: location || null,
  }),
)

export const Q4_COST_ITEMS: TotalsCostItem[] = [
  { cost_item_category: 'SHARED_SERVICES', amount_pence: 1376969, vat_applies: false },
  { cost_item_category: 'ETP', amount_pence: 10366456, vat_applies: false },
  { cost_item_category: 'ADHOC', amount_pence: 6820000, vat_applies: false },
  { cost_item_category: 'ADHOC', amount_pence: 4708000, vat_applies: false },
  { cost_item_category: 'ADHOC', amount_pence: 1922000, vat_applies: false },
]

/** Every figure below is derived from the rows above, so the two cannot drift. */
export const Q4_EXPECTED = {
  allocationRows: 74,
  /** One BAU row, and it is zero-cost, so nothing is lost by excluding it. */
  excludedRows: 1,
  totalPlatformGbp: 2038940,
  includedResourcesGbp: 1787005,
  xChargeableDays: 3047.2,
  advisedRateGbp: 669.12,
  /** Four buckets, VAT-inclusive, costed rows only. They sum to
   *  includedResourcesGbp exactly — that is the property under test. */
  locationGbp: {
    Onshore: 947885,
    Nearshore: 507312,
    Offshore: 291505,
    Unspecified: 40303,
  },
  /** Rows per bucket counted toward COST (isIncludedInBaseCost — BAU and
   *  NPC both excluded). This period's one BAU row is Onshore, so this is
   *  one less than locationHeadcounts.Onshore below. */
  locationCostedRowCounts: {
    Onshore: 27,
    Nearshore: 17,
    Offshore: 25,
    Unspecified: 4,
  },
  /** Rows per bucket counted toward HEADCOUNT (isCountedInHeadcount — BAU
   *  included, NPC excluded). The export's Summary tab counts headcount
   *  this way, not the cost way above — see scheduleTotals.ts. */
  locationHeadcounts: {
    Onshore: 28,
    Nearshore: 17,
    Offshore: 25,
    Unspecified: 4,
  },
  /** What the three-name breakdown showed, and what it lost. The shortfall
   *  is pinned in pence: the sum of the Unspecified rows exactly, with no
   *  rounding convention standing between the two figures. */
  threeBucketOnlyGbp: 1746702,
  droppedByThreeBucketPence: 4030298,
} as const
