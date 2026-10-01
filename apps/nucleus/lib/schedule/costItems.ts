import { computeVatPence, type VatRateMilliPct } from '@plato/schema'

/** A cost item's amount after VAT, in pence — VAT per the item's own flag,
 *  by the suite's one money rule (computeVatPence). */
export function calcCostItemVat(amountPence: number, vatApplies: boolean, vatRate: VatRateMilliPct): number {
  return amountPence + computeVatPence(amountPence, vatApplies, vatRate)
}
