// Pure day-math for the Add Role/Resource wizard's same-period conflict check.
//
// When an already-recognised resource is about to be connected to a new
// allocation but already holds other active allocations in the same period,
// the wizard frames the decision in terms of the period's standard working
// days (the same workingDaysBetween utility used by the Rate Calculator / VAT
// / day-rate calculations). This is informational framing only — never a hard
// block — and decides which dialog option is visually emphasised.

export interface ConflictDayMath {
  /** Number of other active allocations found for this resource in the period. */
  existingCount: number
  /** Sum of capacity_days across all existing allocations found. */
  existingTotalCapacityDays: number
  /** existingTotalCapacityDays + the new row's proposed capacity_days. */
  combinedCapacityDays: number
  /** The period's standard working days (workingDaysBetween of the period). */
  periodWorkingDays: number
  /**
   * True when the combined capacity_days strictly exceeds the period's standard
   * working days. Exactly at capacity is NOT over — a full quarter still fits.
   * When true the "keep existing details" option is the recommended one.
   */
  overCapacity: boolean
}

/**
 * Compute the combined capacity-day picture for a resource that already has
 * one or more active allocations in a period and is about to gain another.
 *
 * @param existingCapacityDays capacity_days of every OTHER active allocation
 *   the resource already holds in the period (excluding the one being created).
 * @param newCapacityDays proposed capacity_days of the row being connected now.
 * @param periodWorkingDays the period's standard working days.
 */
export function computeConflictDayMath(
  existingCapacityDays: Array<number | null | undefined>,
  newCapacityDays: number | null | undefined,
  periodWorkingDays: number,
): ConflictDayMath {
  const existingTotalCapacityDays = existingCapacityDays.reduce<number>(
    (sum, d) => sum + (d ?? 0),
    0,
  )
  const combinedCapacityDays = existingTotalCapacityDays + (newCapacityDays ?? 0)

  return {
    existingCount: existingCapacityDays.length,
    existingTotalCapacityDays,
    combinedCapacityDays,
    periodWorkingDays,
    overCapacity: combinedCapacityDays > periodWorkingDays,
  }
}
