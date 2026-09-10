// Q2 FY 26/27 (period bb000001-0000-0000-0000-000000000003) — a frozen
// snapshot taken 2026-09-09 23:17 UTC, at the same instant as q4Fy2526.ts.
//
// The second of the two periods that currently carry an 'unspecified'
// location, and deliberately the thinner of them: a single row, £3,140 of
// 2.84m. It is here because a breakdown that drops one row out of 102 still
// looks right at a glance — the kind of shortfall that hides until Finance
// adds up the column. Q4's four rows prove the bucket works; this proves the
// tie is exact rather than approximate.
//
// Rows are [planview, utilisation %, capacity days, day rate pence,
// vat_applies, supplier, location], location in the database's own lower case.

import type { TotalsCostItem } from '../../scheduleTotals'
import type { LocatedAllocation } from './q4Fy2526'

export const Q2_VAT_UPLIFT_PERCENT = 7.082
export const Q2_VAT_MULTIPLIER = parseFloat((1 + Q2_VAT_UPLIFT_PERCENT / 100).toFixed(5))

type RawRow = [string, number, number, number, number, string, string]

const Q2_RAW: RawRow[] = [
  ['F_Gov', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['BAU', 90, 65, 0, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 62.5, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['F_Gov', 90, 65, 58000, 0, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 65, 91485, 1, 'Royal Mail Group', 'onshore'],
  ['PR', 90, 61, 90400, 1, 'North Highland', 'onshore'],
  ['PR', 90, 61, 98200, 1, 'North Highland', 'onshore'],
  ['PR', 90, 61, 83500, 1, 'North Highland', 'onshore'],
  ['PR', 90, 61, 73200, 1, 'North Highland', 'onshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 32.5, 60000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 38000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 48000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 48000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 60000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 60000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 36000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 36000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['PR', 100, 65, 45000, 1, 'Happy Team', 'nearshore'],
  ['F_Gov', 100, 48.5, 20422, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 10.5, 40082, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 59, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 20422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 20422, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 49, 117492, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 57, 117492, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 20, 44181, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 44181, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 15, 15559, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 21, 18517, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 6, 132020, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 59, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 27557, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 58, 132020, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 58, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 20422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 16661, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 3, 31634, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 35, 20901, 1, 'Capgemini', 'offshore'],
  ['F_Gov', 100, 54, 37980, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 59, 28422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 3, 100242, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 59, 31370, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 58, 20422, 1, 'Capgemini', 'offshore'],
  ['PR', 100, 56, 111694, 1, 'Capgemini', 'onshore'],
  ['PR', 100, 14, 20948, 1, 'Capgemini', 'unspecified'],
  ['PR', 100, 23, 20000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 42, 47500, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 64, 16000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 64, 18000, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 64, 25000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 64, 15000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 65, 45000, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 65, 40000, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 65, 47500, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 64, 15000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 64, 22500, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 64, 16000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 65, 42500, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 42, 70000, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 41, 18000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 64, 15000, 1, 'Tata Consultancy Services', 'offshore'],
  ['PR', 100, 42, 70000, 1, 'Tata Consultancy Services', 'onshore'],
  ['PR', 100, 41, 80000, 1, 'Lean Tree', 'onshore'],
  ['PR', 100, 61, 80000, 1, 'Lean Tree', 'onshore'],
  ['PR', 100, 60, 65000, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 57, 52500, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 18, 105000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 65, 49500, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 65, 86500, 1, 'EPAM', 'onshore'],
  ['PR', 100, 53, 75000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 12, 140000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 36, 145000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 60, 43300, 1, 'EPAM', 'nearshore'],
  ['F_Gov', 100, 6, 22500, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 65, 75000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 8, 115000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 65, 43300, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 65, 90000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 60, 84000, 1, 'EPAM', 'onshore'],
  ['PR', 100, 57, 60000, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 52, 50000, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 62, 67500, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 54, 46000, 1, 'EPAM', 'nearshore'],
  ['PR', 100, 18, 50000, 1, 'EPAM', 'nearshore'],
  ['PR', 90, 61, 40000, 1, 'TAAS', 'onshore'],
]

export const Q2_ALLOCATIONS: LocatedAllocation[] = Q2_RAW.map(
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

/** Q2 carries no ad-hoc items — only ETP and Shared Services. */
export const Q2_COST_ITEMS: TotalsCostItem[] = [
  { cost_item_category: 'ETP', amount_pence: 11495801, vat_applies: false },
  { cost_item_category: 'SHARED_SERVICES', amount_pence: 1632500, vat_applies: false },
]

/** Every figure below is derived from the rows above, so the two cannot drift. */
export const Q2_EXPECTED = {
  allocationRows: 103,
  /** One BAU row, at a zero day rate. */
  excludedRows: 1,
  totalPlatformGbp: 2973068,
  includedResourcesGbp: 2841785,
  xChargeableDays: 4899.8,
  advisedRateGbp: 606.78,
  locationGbp: {
    Onshore: 1635699,
    Nearshore: 811537,
    Offshore: 391409,
    Unspecified: 3140,
  },
  /** Rows per bucket counted toward COST (isIncludedInBaseCost — BAU and
   *  NPC both excluded). This period's one BAU row is Onshore, so this is
   *  one less than locationHeadcounts.Onshore below. */
  locationCostedRowCounts: {
    Onshore: 43,
    Nearshore: 27,
    Offshore: 31,
    Unspecified: 1,
  },
  /** Rows per bucket counted toward HEADCOUNT (isCountedInHeadcount — BAU
   *  included, NPC excluded). The export's Summary tab counts headcount
   *  this way, not the cost way above — see scheduleTotals.ts. */
  locationHeadcounts: {
    Onshore: 44,
    Nearshore: 27,
    Offshore: 31,
    Unspecified: 1,
  },
  /** What the three-name breakdown showed, and what it lost, in pence. */
  threeBucketOnlyGbp: 2838644,
  droppedByThreeBucketPence: 314042,
} as const
