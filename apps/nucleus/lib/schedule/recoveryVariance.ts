// The single comparison behind every "surplus vs shortfall" figure on the
// Schedule page and in the exported workbook: is the rate actually being
// charged (Current Rate) enough to recover the platform's cost (Advised
// Rate)?
//
// Advised Rate is the break-even rate — Total Platform Cost ÷ X-Chargeable
// Days. If Current Rate is HIGHER than that, more is being recovered than
// the platform costs: a surplus, over-recovery, good news. If Current Rate
// is LOWER, less is being recovered than cost: a shortfall, under-recovery.
// So the sign is unambiguous: positive (current − advised) is a surplus,
// negative is a shortfall.
//
// The exported Rate Calculator workbook computed this as (advised − current)
// instead — the negation — and then hard-coded the "▲ Shortfall" / "under
// recovery" label onto it regardless of the actual sign, so a surplus (the
// common case at the time) rendered as a shortfall. The page never had this
// bug; the export had reimplemented the comparison independently rather than
// sharing the page's version. This module is that shared version, so nothing
// downstream can compute its own sign again and get it backwards.

export type RecoveryDirection = 'surplus' | 'shortfall' | 'onTarget'

export interface RecoveryVariance {
  /** currentRate − advisedRate, in whatever unit the two inputs share
   *  (pounds or pence — this module doesn't care, it only compares). */
  perUnitVariance: number
  /** perUnitVariance × days — the total over/under-recovery for the period,
   *  in the same unit as perUnitVariance. */
  totalVariance: number
  /** 'surplus' when Current Rate exceeds Advised Rate (recovering more than
   *  cost), 'shortfall' when it falls short, 'onTarget' when exactly equal. */
  direction: RecoveryDirection
  /** '▲' for a surplus, '▼' for a shortfall, '' when on target — up means
   *  more is being recovered, down means less, matching the sign above. */
  triangle: '▲' | '▼' | ''
}

/**
 * @param currentRate the rate actually in effect (the applied blended rate).
 * @param advisedRate the break-even rate — Total Platform Cost ÷ X-Chargeable Days.
 * @param days X-Chargeable Days for the period, to project the per-unit gap
 *   into a total over/under-recovery.
 */
export function computeRecoveryVariance(
  currentRate: number,
  advisedRate: number,
  days: number,
): RecoveryVariance {
  const perUnitVariance = currentRate - advisedRate
  const totalVariance = perUnitVariance * days
  const direction: RecoveryDirection =
    perUnitVariance > 0 ? 'surplus' : perUnitVariance < 0 ? 'shortfall' : 'onTarget'
  const triangle = direction === 'surplus' ? '▲' : direction === 'shortfall' ? '▼' : ''
  return { perUnitVariance, totalVariance, direction, triangle }
}
