// Q3 FY 26/27 (period 10cfda7c-8c57-4da3-9dab-b8210032b030) — a frozen
// snapshot of the period the Rate Calculator export was found to disagree
// with the Schedule page on.
//
// The export had two defects, pulling opposite ways, which is why the net gap
// looked smaller than either:
//   - it summed the BAU and NPC allocations the page excludes  (+£89,597)
//   - it never applied VAT to the ad-hoc items                  (−£9,297)
// The Summary tab's supplier and location breakdown carried the first of
// those too, so its rows did not add up to the headline figure sitting
// directly above them — on this period all £89,597 of it is Capgemini, whose
// ten allocations are every one NPC.
//
// NOTE ON THE FIGURES. The incident was originally reported against this
// period showing £2,671,777 on the page and £2,752,077 in the export. The
// period has been edited since (87 of its 103 rows), so this snapshot totals
// £2,678,041 instead. The two defect sizes above are unchanged — they are
// what characterises the bug, and what these tests pin. Every figure in
// Q3_EXPECTED comes from this one snapshot, taken at a single instant, so the
// reconciliations hold exactly rather than approximately.
//
// Rows are [planview, utilisation %, capacity days, day rate pence,
// vat_applies, supplier, location]. A blank location is real in this data,
// not a placeholder: four allocations carry none.

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
  ['NPC', 100, 22, 31370, 1, 'Capgemini', 'Offshore'],
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
  ['PR', 100, 64, 45000, 1, 'Happy Team', ''],
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
  ['PR', 90, 64, 91485, 1, 'Royal Mail Group', 'Onshore'],
  ['PR', 90, 64, 40000, 1, 'TAAS', 'Onshore'],
  ['F_Gov', 100, 63, 18000, 1, 'Tata Consultancy Services', ''],
  ['F_Gov', 100, 15, 55000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['F_Gov', 100, 63, 20000, 1, 'Tata Consultancy Services', 'Onshore'],
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
  ['PR', 100, 42, 40000, 1, 'Tata Consultancy Services', ''],
  ['PR', 100, 63, 16000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 25000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 45000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 63, 18000, 1, 'Tata Consultancy Services', 'Onshore'],
  ['PR', 100, 63, 15000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 31, 25000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 63, 18000, 1, 'Tata Consultancy Services', 'Offshore'],
  ['PR', 100, 64, 85000, 1, 'Tata Consultancy Services', 'Offshore'],
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
  ['PR', 100, 63, 20000, 1, 'Tata Consultancy Services', ''],
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

/** What the live Schedule page shows for this snapshot. */
export const Q3_EXPECTED = {
  totalPlatformGbp: 2678041,
  advisedRateGbp: 578.49,
  xChargeableDays: 4629.4,
  /** The allocations that count toward cost, VAT-inclusive. */
  includedResourcesGbp: 2537460,
  /** BAU + NPC, VAT-inclusive — what the old export wrongly added. */
  excludedRowsGbp: 89597,
  /** Ad-hoc VAT — what the old export wrongly left off. */
  adhocVatGbp: 9297,
  /** What the old export produced from this snapshot. */
  oldExportTotalGbp: 2758341,
  oldExportAdvisedRateGbp: 595.83,
  /** Every allocation row on the schedule, costed or not. */
  allocationRows: 103,
  /** Rows excluded from cost: ten NPC (all Capgemini) and one BAU. */
  excludedRows: 11,
  /** Capgemini's ten rows are every one NPC, so after the fix it contributes
   *  nothing — the most visible consequence of correcting the breakdown. */
  capgeminiVatGbpBefore: 89597,
  /** Allocations with no location, so absent from the three location rows. */
  blankLocationRows: 4,
  /** Their cost, which is why the location rows fall short of the supplier
   *  total — pre-existing, and unrelated to the BAU/NPC fix. */
  blankLocationGbp: 74465,
} as const
