import { isChargeableRow } from './planview'

export interface HomepageCostRow {
  planview_code: string | null
  /** Integer pence. */
  day_rate: number
  utilisation_percent: number | string
  capacity_days: number | string | null
  /** Supplier is Royal Mail Group — internal, so no VAT. */
  isInternal: boolean
}

export interface HomepageCostSummary {
  base_cost_pence: number
  vat_cost_pence: number
  chargeable_cost_pence: number
  missingPlanview: number
  missingCapacity: number
}

/** The homepage's period cost figures and data-quality counts. Chargeability
 *  comes from planview_code via isChargeableRow, never the stored
 *  is_chargeable column. */
export function summariseHomepageCost(
  rows: readonly HomepageCostRow[],
  vatPct: number,
): HomepageCostSummary {
  const summary: HomepageCostSummary = {
    base_cost_pence: 0,
    vat_cost_pence: 0,
    chargeable_cost_pence: 0,
    missingPlanview: 0,
    missingCapacity: 0,
  }
  for (const row of rows) {
    const utilisation = Number(row.utilisation_percent)
    const capacityDays = row.capacity_days === null ? null : Number(row.capacity_days)

    if (!row.planview_code) summary.missingPlanview++
    if (capacityDays === null) summary.missingCapacity++

    const base =
      capacityDays === null ? 0 : Math.round(row.day_rate * capacityDays * (utilisation / 100))
    const vat = row.isInternal ? base : Math.round(base * (1 + vatPct / 100))

    summary.base_cost_pence += base
    summary.vat_cost_pence += vat
    if (isChargeableRow(row.planview_code)) summary.chargeable_cost_pence += vat
  }
  return summary
}
