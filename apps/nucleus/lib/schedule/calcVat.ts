export function calcVat(amountPence: number, vatApplies: boolean, vatUpliftPercent: number): number {
  if (!vatApplies) return amountPence
  return Math.round(amountPence * (1 + vatUpliftPercent / 100))
}
