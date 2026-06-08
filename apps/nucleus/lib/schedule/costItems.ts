export function calcCostItemVat(amountPence: number, vatApplies: boolean, vatPct: number): number {
  if (!vatApplies) return amountPence
  return Math.round(amountPence * (1 + vatPct / 100))
}
