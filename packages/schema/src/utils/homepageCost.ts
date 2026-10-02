import { computeRowMoneyPence, type VatRateMilliPct } from './money'
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
  vatRate: VatRateMilliPct,
): HomepageCostSummary {
  const summary: HomepageCostSummary = {
    base_cost_pence: 0,
    vat_cost_pence: 0,
    chargeable_cost_pence: 0,
    missingPlanview: 0,
    missingCapacity: 0,
  }
  for (const row of rows) {
    if (!row.planview_code) summary.missingPlanview++
    if (row.capacity_days === null) summary.missingCapacity++

    // The homepage's own VAT rule (internal supplier = no VAT, rather than the
    // row's vat_applies) is unchanged; only the arithmetic is the shared rule.
    const money = computeRowMoneyPence({
      capacityDays: row.capacity_days,
      dayRatePence: row.day_rate,
      utilisationPercent: row.utilisation_percent,
      vatApplies: !row.isInternal,
      vatRateMilliPct: vatRate,
    })
    const vat = money.incVatPence

    summary.base_cost_pence += money.basePence
    summary.vat_cost_pence += vat
    if (isChargeableRow(row.planview_code)) summary.chargeable_cost_pence += vat
  }
  return summary
}
