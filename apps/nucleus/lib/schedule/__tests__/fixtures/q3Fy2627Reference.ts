// Q3 FY 26/27 (period 10cfda7c-8c57-4da3-9dab-b8210032b030) — the money-rounding
// reference. A frozen read of the live period taken 2026-10-01, the one the
// three disagreeing totals were reported against:
//
//   Schedule page   £2,892,442.35  — float multiplier 1.0708199999999999 rounded
//                                     eight half-penny VAT rows DOWN
//   Export Summary  £2,892,442.43  — per-row, half-up, exact 1.07082
//   Export detail   £2,892,442.37  — no per-row rounding at all
//
// Under the one money rule (docs/decisions/036-money-rounding.md) every
// surface lands on £2,892,442.43. Every row here is at 100% utilisation and
// whole days; the VAT rate is 7.082%.
//
// Rows are [planview, capacity days, day rate pence, vat_applies, supplier,
// location, vacant]. Supplier and location are carried so the same rows can
// be fed through the export route, which groups by both.

import { vatRateMilliPct } from '@plato/schema'
import type { TotalsAllocation, TotalsCostItem } from '../../scheduleTotals'

export const Q3_REF_VAT_RATE = vatRateMilliPct('7.08200')
/** The applied blended rate for the period, pence per day. */
export const Q3_REF_APPLIED_RATE_PENCE = 60500

/** The figures every surface must produce from these rows. */
export const Q3_REF_EXPECTED = {
  /** Costed rows (PR + F_Gov), before VAT. */
  basePence: 259_287_642,
  /** Costed rows, inc VAT. */
  resourcesIncVatPence: 274_758_677,
  /** Total Platform Cost: resources inc VAT + ad-hoc (which takes no VAT here). */
  totalPlatformPence: 289_244_243,
  /** What the page's old float multiplier produced from the same rows. */
  oldPageTotalPence: 289_244_235,
  /** PR-only, utilisation-weighted. */
  prDays: 4_920,
  /** At the applied £605/day: 4,920 × £605 − £2,892,442.43. */
  recoveryVariancePence: 8_415_757,
} as const

type RawRow = [string, number, number, number, string, string, number]

export const Q3_REF_SUPPLIERS: Record<string, { abbreviation: string; sortOrder: number; colour: string }> = {
  'Royal Mail Group': { abbreviation: 'RMG', sortOrder: 1, colour: '#E2001A' },
  'Happy Team': { abbreviation: 'HT', sortOrder: 2, colour: '#FF8C00' },
  'Capgemini': { abbreviation: 'CG', sortOrder: 3, colour: '#003C82' },
  'Tata Consultancy Services': { abbreviation: 'TCS', sortOrder: 4, colour: '#9B0A6E' },
  'EPAM': { abbreviation: 'EPAM', sortOrder: 5, colour: '#3D3D3D' },
  'North Highland': { abbreviation: 'NH', sortOrder: 7, colour: '#1A2B5B' },
  'Lean Tree': { abbreviation: 'LT', sortOrder: 8, colour: '#3ABFB8' },
  'TAAS': { abbreviation: 'TAAS', sortOrder: 9, colour: '#7C3AED' },
}

const Q3_REF_RAW: RawRow[] = [
  ['PR', 63, 20000, 1, 'Tata Consultancy Services', 'offshore', 1],
  ['PR', 64, 36000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 22, 27557, 1, 'Capgemini', 'offshore', 0],
  ['PR', 22, 31370, 1, 'Capgemini', 'offshore', 0],
  ['PR', 21, 20000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 12, 44181, 1, 'Capgemini', 'offshore', 0],
  ['PR', 63, 18000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 90400, 1, 'North Highland', 'onshore', 0],
  ['PR', 64, 98200, 1, 'North Highland', 'onshore', 0],
  ['PR', 63, 18000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 60000, 1, 'Happy Team', 'nearshore', 1],
  ['F_Gov', 15, 55000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 56, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 83500, 1, 'North Highland', 'onshore', 0],
  ['PR', 22, 31370, 1, 'Capgemini', 'offshore', 0],
  ['PR', 64, 60000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 63, 16000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 52, 65000, 1, 'EPAM', 'nearshore', 0],
  ['PR', 15, 105000, 1, 'EPAM', 'onshore', 0],
  ['PR', 50, 49500, 1, 'EPAM', 'nearshore', 0],
  ['PR', 64, 40000, 1, 'TAAS', 'onshore', 0],
  ['PR', 64, 45000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 9, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 40000, 1, 'Tata Consultancy Services', 'onshore', 1],
  ['F_Gov', 63, 18000, 1, 'Tata Consultancy Services', 'offshore', 1],
  ['PR', 63, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['F_Gov', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 56, 52500, 1, 'EPAM', 'nearshore', 0],
  ['PR', 54, 50000, 1, 'EPAM', 'nearshore', 0],
  ['PR', 55, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 63, 25000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 62, 85000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 51, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 21, 22500, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 57, 86500, 1, 'EPAM', 'onshore', 0],
  ['PR', 51, 75000, 1, 'EPAM', 'onshore', 0],
  ['PR', 24, 140000, 1, 'EPAM', 'onshore', 0],
  ['PR', 36, 145000, 1, 'EPAM', 'onshore', 0],
  ['PR', 53, 43300, 1, 'EPAM', 'nearshore', 0],
  ['F_Gov', 6, 22500, 1, 'EPAM', 'nearshore', 0],
  ['PR', 57, 75000, 1, 'EPAM', 'onshore', 0],
  ['PR', 57, 43300, 1, 'EPAM', 'nearshore', 0],
  ['PR', 57, 90000, 1, 'EPAM', 'onshore', 0],
  ['PR', 57, 84000, 1, 'EPAM', 'onshore', 0],
  ['PR', 57, 60000, 1, 'EPAM', 'nearshore', 0],
  ['PR', 55, 67500, 1, 'EPAM', 'nearshore', 0],
  ['PR', 53, 46000, 1, 'EPAM', 'nearshore', 0],
  ['PR', 64, 34000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 60000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['F_Gov', 32, 60000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 34000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['PR', 64, 56000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 64, 45000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 51, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 41, 30000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['F_Gov', 63, 20000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 56, 13500, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 55000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 64, 42500, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['F_Gov', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 90000, 1, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 41, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 85000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 31, 25000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 40000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 22, 31370, 1, 'Capgemini', 'offshore', 0],
  ['PR', 22, 44181, 1, 'Capgemini', 'offshore', 0],
  ['PR', 22, 31370, 1, 'Capgemini', 'onshore', 0],
  ['PR', 64, 45000, 1, 'Happy Team', 'nearshore', 0],
  ['BAU', 64, 0, 0, 'Royal Mail Group', 'onshore', 0],
  ['F_Gov', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 51, 16000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 45000, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 64, 80000, 1, 'Lean Tree', 'onshore', 0],
  ['PR', 63, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 63, 16000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['F_Gov', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['F_Gov', 64, 58000, 0, 'Royal Mail Group', 'onshore', 0],
  ['PR', 27, 91485, 1, 'Royal Mail Group', 'onshore', 0],
  ['PR', 64, 80000, 1, 'Lean Tree', 'onshore', 0],
  ['PR', 63, 16000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 63, 18000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 64, 47500, 1, 'Tata Consultancy Services', 'onshore', 0],
  ['PR', 5, 15559, 1, 'Capgemini', 'offshore', 0],
  ['PR', 22, 37980, 1, 'Capgemini', 'offshore', 0],
  ['PR', 21, 22500, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 41, 13500, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 63, 15000, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 22, 117492, 1, 'Capgemini', 'onshore', 0],
  ['PR', 63, 22500, 1, 'Tata Consultancy Services', 'offshore', 0],
  ['PR', 63, 18000, 1, 'Tata Consultancy Services', 'offshore', 0],
]

export interface Q3RefAllocation extends TotalsAllocation {
  allocation_id: string
  resource_id: string | null
  supplier_name: string
  resource_location: string
}

export const Q3_REF_ALLOCATIONS: Q3RefAllocation[] = Q3_REF_RAW.map(
  ([planview_code, capacity_days, day_rate, vat, supplier_name, resource_location, vacant], i) => ({
    allocation_id: `q3-${i + 1}`,
    resource_id: vacant ? null : `r-${i + 1}`,
    planview_code,
    utilisation_percent: 100,
    capacity_days,
    day_rate,
    vat_applies: vat === 1,
    supplier_name,
    resource_location,
  }),
)

export const Q3_REF_COST_ITEMS: Array<TotalsCostItem & { cost_item_id: string; label: string }> = [
  {
    cost_item_id: 'q3-adhoc-1',
    label: 'Enterprise Tooling Platform / Shared Services',
    cost_item_category: 'ADHOC',
    amount_pence: 14485566,
    vat_applies: false,
  },
]
