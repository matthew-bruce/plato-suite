// Q3 FY 26/27 (period 10cfda7c-8c57-4da3-9dab-b8210032b030) — a frozen
// snapshot taken 2026-09-09 15:31 UTC (the period's last edit at the time:
// 12:25 UTC). This period is actively edited, so every figure below belongs
// to that instant and to each other; nothing here is mixed from another read.
//
// It backs three fixes to the Rate Calculator export, all found by asking
// whether the workbook agrees with the Schedule page it exports:
//
//   1. The export summed the BAU and NPC allocations the page excludes
//      (+£89,597 here) and never applied VAT to ad-hoc items (−£9,297),
//      so its Total Platform Cost and Advised Rate were both wrong.
//   2. The Summary tab's supplier and location breakdown had the first of
//      those defects too, so its rows did not add up to the headline above
//      them — all £89,597 of it Capgemini, whose ten rows are every one NPC.
//   3. The export read each row's location from the resources table alone,
//      while the page reads the allocation's own column and falls back to
//      the resource only for legacy rows. Vacant seats have no resources
//      row, so their location vanished; five named rows carried a different
//      location on the allocation than on the resource and were filed under
//      the wrong one.
//
// Rows are [planview, utilisation %, capacity days, day rate pence,
// vat_applies, supplier, location]. The location here is the page's — the
// allocation's own value, which every row in this snapshot carries.

import type { TotalsAllocation, TotalsCostItem } from '../../scheduleTotals'

export const VAT_UPLIFT_PERCENT = 7.082
export const Q3_VAT_MULTIPLIER = parseFloat((1 + VAT_UPLIFT_PERCENT / 100).toFixed(5))

/** An allocation carrying the two columns the export's breakdown groups by. */
export interface Q3Allocation extends TotalsAllocation {
  supplier_name: string | null
  resource_location: string | null
}

type RawRow = [string, number, number, number, number, string, string]

const Q3_RAW: RawRow[] = [
  ['NPC', 100, 22, 31370, 1, 'Capgemini', 'Onshore'],
  ['NPC', 100, 22, 27557, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 5, 15559, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 22, 37980, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 22, 44181, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 22, 117492, 1, 'Capgemini', 'Onshore'],
  ['NPC', 100, 12, 44181, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 22, 31370, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 22, 31370, 1, 'Capgemini', 'Offshore'],
  ['NPC', 100, 22, 31370, 1, 'Capgemini', 'Offshore'],
  ['F_Gov', 100, 6, 22500, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 60, 65000, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 53, 75000, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 57, 60000, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 57, 52500, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 60, 84000, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 52, 0, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 62, 67500, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 36, 145000, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 54, 46000, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 65, 49500, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 65, 90000, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 65, 43300, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 18, 105000, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 60, 43300, 1, 'EPAM', 'Nearshore'],
  ['PR', 100, 65, 86500, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 65, 75000, 1, 'EPAM', 'Onshore'],
  ['PR', 100, 12, 140000, 1, 'EPAM', 'Onshore'],
  ['F_Gov', 100, 32, 60000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 36000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 34000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 60000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 60000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 34000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 45000, 1, 'Happy Team', 'Nearshore'],
  ['PR', 100, 64, 80000, 1, 'Lean Tree', 'Onshore'],
  ['PR', 100, 64, 80000, 1, 'Lean Tree', 'Onshore'],
  ['PR', 90, 64, 98200, 1, 'North Highland', 'Onshore'],
  ['PR', 90, 64, 90400, 1, 'North Highland', 'Onshore'],
  ['PR', 90, 22, 73200, 1, 'North Highland', 'Onshore'],
  ['PR', 90, 64, 83500, 1, 'North Highland', 'Onshore'],
  ['BAU', 90, 64, 0, 0, 'Royal Mail Group', 'Onshore'],
  ['F_Gov', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['F_Gov', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['F_Gov', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['F_Gov', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['F_Gov', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 58000, 0, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 27, 91485, 1, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 40000, 1, 'TAAS', 'Onshore'],
  ['F_Gov', 100, 63, 18000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['F_Gov', 100, 15, 55000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['F_Gov', 100, 63, 20000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 40000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 64, 56000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 51, 16000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 22500, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 62, 85000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 64, 45000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 64, 17000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 55000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 41, 13500, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 42, 40000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 63, 16000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 25000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 45000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 63, 18000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 31, 25000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 18000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 85000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 51, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 47500, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 63, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 21, 22500, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 16000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 56, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 45000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 51, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 16000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 56, 13500, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 41, 30000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 21, 22500, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 20000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 42500, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 21, 20000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 18000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 41, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
]

export const Q3_ALLOCATIONS: Q3Allocation[] = Q3_RAW.map(
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

// Q3 carries two ad-hoc items and no ETP / Shared Services rows.
export const Q3_COST_ITEMS: TotalsCostItem[] = [
  { cost_item_category: 'ADHOC', amount_pence: 11495801, vat_applies: true },
  { cost_item_category: 'ADHOC', amount_pence: 1632500, vat_applies: true },
]

/** What the live Schedule page shows for this snapshot. Every value is
 *  derived from the rows above, so the two cannot drift apart. */
export const Q3_EXPECTED = {
  totalPlatformGbp: 2645419,
  advisedRateGbp: 575.58,
  xChargeableDays: 4596.1,
  /** The allocations that count toward cost, VAT-inclusive. The supplier,
   *  location and planview breakdowns each sum to exactly this. */
  includedResourcesGbp: 2504838,
  /** BAU + NPC, VAT-inclusive — what the old export wrongly added. */
  excludedRowsGbp: 89597,
  /** Ad-hoc VAT — what the old export wrongly left off. */
  adhocVatGbp: 9297,
  /** What the old export produced from this snapshot. */
  oldExportTotalGbp: 2725719,
  oldExportAdvisedRateGbp: 593.05,
  /** Every allocation row on the schedule, costed or not. */
  allocationRows: 103,
  /** Rows excluded from cost: ten NPC (all Capgemini) and one BAU. */
  excludedRows: 11,
  /** Capgemini's ten rows are every one NPC, so it contributes nothing. */
  capgeminiVatGbpBefore: 89597,
  /** The location breakdown, VAT-inclusive, costed rows only. These three
   *  add up to includedResourcesGbp with nothing left over — every row in
   *  this period carries a location on its allocation. */
  locationGbp: {
    Onshore: 1473869,
    Nearshore: 758167,
    Offshore: 272802,
  },
} as const
