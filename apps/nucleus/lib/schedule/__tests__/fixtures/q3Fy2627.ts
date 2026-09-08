// Q3 FY 26/27 (period 10cfda7c-8c57-4da3-9dab-b8210032b030) as it stood when
// the Rate Calculator export was found to disagree with the Schedule page.
//
// The page showed £2,671,777 and £577.13/day. The export showed £2,752,077
// and £594/day, because it summed the BAU and NPC allocations the page
// excludes (+£89,597) and never applied VAT to the ad-hoc items (−£9,297) —
// two defects pulling opposite ways, which is why the net gap looked smaller
// than either. This is the real data behind that reconciliation, kept in one
// place so every test that pins it uses the same numbers.
//
// Rows are [planview, utilisation %, capacity days, day rate pence, vat_applies].

import type { TotalsAllocation, TotalsCostItem } from '../../scheduleTotals'

export const VAT_UPLIFT_PERCENT = 7.082
export const Q3_VAT_MULTIPLIER = parseFloat((1 + VAT_UPLIFT_PERCENT / 100).toFixed(5))

type RawRow = [string, number, number, number, number]

const Q3_RAW: RawRow[] = [
  ['BAU', 90, 64, 0, 0],
  ['F_Gov', 90, 64, 58000, 0], ['F_Gov', 100, 63, 18000, 1], ['F_Gov', 100, 15, 55000, 1],
  ['F_Gov', 100, 63, 20000, 1], ['F_Gov', 90, 52, 58000, 0], ['F_Gov', 100, 6, 22500, 1],
  ['F_Gov', 90, 64, 58000, 0], ['F_Gov', 90, 64, 58000, 0], ['F_Gov', 90, 64, 58000, 0],
  ['F_Gov', 100, 32, 60000, 1],
  ['NPC', 100, 22, 31370, 1], ['NPC', 100, 22, 27557, 1], ['NPC', 100, 5, 15559, 1],
  ['NPC', 100, 22, 37980, 1], ['NPC', 100, 22, 44181, 1], ['NPC', 100, 22, 117492, 1],
  ['NPC', 100, 12, 44181, 1], ['NPC', 100, 22, 31370, 1], ['NPC', 100, 22, 31370, 1],
  ['NPC', 100, 22, 31370, 1],
  ['PR', 100, 64, 40000, 1], ['PR', 100, 60, 65000, 1], ['PR', 100, 53, 75000, 1],
  ['PR', 100, 64, 56000, 1], ['PR', 100, 64, 45000, 1], ['PR', 90, 64, 98200, 1],
  ['PR', 100, 51, 16000, 1], ['PR', 100, 57, 60000, 1], ['PR', 100, 63, 22500, 1],
  ['PR', 90, 64, 90400, 1], ['PR', 100, 62, 85000, 1], ['PR', 90, 64, 58000, 0],
  ['PR', 100, 64, 45000, 1], ['PR', 100, 64, 17000, 1], ['PR', 100, 57, 52500, 1],
  ['PR', 90, 64, 58000, 0], ['PR', 100, 63, 15000, 1], ['PR', 100, 64, 55000, 1],
  ['PR', 100, 60, 84000, 1], ['PR', 100, 52, 0, 1], ['PR', 100, 64, 45000, 1],
  ['PR', 100, 41, 13500, 1], ['PR', 100, 64, 36000, 1], ['PR', 90, 64, 58000, 0],
  ['PR', 100, 42, 40000, 1], ['PR', 100, 64, 80000, 1], ['PR', 100, 64, 45000, 1],
  ['PR', 100, 62, 67500, 1], ['PR', 100, 63, 16000, 1], ['PR', 100, 64, 80000, 1],
  ['PR', 100, 63, 25000, 1], ['PR', 100, 64, 45000, 1], ['PR', 100, 63, 18000, 1],
  ['PR', 100, 63, 15000, 1], ['PR', 100, 64, 45000, 1], ['PR', 100, 36, 145000, 1],
  ['PR', 100, 54, 46000, 1], ['PR', 100, 31, 25000, 1], ['PR', 100, 63, 18000, 1],
  ['PR', 90, 22, 73200, 1], ['PR', 100, 64, 85000, 1], ['PR', 100, 51, 15000, 1],
  ['PR', 100, 64, 47500, 1], ['PR', 100, 63, 15000, 1], ['PR', 100, 64, 34000, 1],
  ['PR', 90, 64, 58000, 0], ['PR', 100, 64, 45000, 1], ['PR', 100, 65, 49500, 1],
  ['PR', 100, 65, 90000, 1], ['PR', 90, 64, 58000, 0], ['PR', 90, 64, 58000, 0],
  ['PR', 100, 65, 43300, 1], ['PR', 100, 64, 45000, 1], ['PR', 100, 18, 105000, 1],
  ['PR', 100, 60, 43300, 1], ['PR', 100, 21, 22500, 1], ['PR', 100, 64, 60000, 1],
  ['PR', 100, 63, 16000, 1], ['PR', 100, 65, 86500, 1], ['PR', 100, 56, 15000, 1],
  ['PR', 100, 64, 45000, 1], ['PR', 100, 51, 15000, 1], ['PR', 100, 63, 16000, 1],
  ['PR', 100, 56, 13500, 1], ['PR', 90, 64, 91485, 1], ['PR', 100, 64, 45000, 1],
  ['PR', 100, 65, 75000, 1], ['PR', 100, 41, 30000, 1], ['PR', 100, 64, 60000, 1],
  ['PR', 100, 12, 140000, 1], ['PR', 100, 21, 22500, 1], ['PR', 100, 63, 20000, 1],
  ['PR', 90, 64, 83500, 1], ['PR', 100, 64, 42500, 1], ['PR', 100, 21, 20000, 1],
  ['PR', 100, 63, 18000, 1], ['PR', 100, 64, 45000, 1], ['PR', 100, 64, 34000, 1],
  ['PR', 100, 41, 15000, 1], ['PR', 100, 64, 45000, 1], ['PR', 100, 64, 45000, 1],
  ['PR', 90, 64, 40000, 1],
]

export const Q3_ALLOCATIONS: TotalsAllocation[] = Q3_RAW.map(([code, util, days, rate, vat]) => ({
  planview_code: code,
  utilisation_percent: util,
  capacity_days: days,
  day_rate: rate,
  vat_applies: vat === 1,
}))

// Q3 carries two ad-hoc items and no ETP / Shared Services rows.
export const Q3_COST_ITEMS: TotalsCostItem[] = [
  { cost_item_category: 'ADHOC', amount_pence: 11495801, vat_applies: true },
  { cost_item_category: 'ADHOC', amount_pence: 1632500, vat_applies: true },
]

/** What the live Schedule page shows for this period. */
export const Q3_EXPECTED = {
  totalPlatformGbp: 2671777,
  advisedRateGbp: 577.13,
  xChargeableDays: 4629.4,
  /** BAU + NPC, VAT-inclusive — what the old export wrongly added. */
  excludedRowsGbp: 89597,
  /** Ad-hoc VAT — what the old export wrongly left off. */
  adhocVatGbp: 9297,
  /** The figure the old export produced. */
  oldExportTotalGbp: 2752077,
} as const
