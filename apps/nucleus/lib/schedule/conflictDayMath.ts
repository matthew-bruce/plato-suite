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

/**
 * How the conflict dialog should present a given set of existing allocations.
 * This is the display decision only — the day-math above is untouched; this
 * just reasons about how many rows are involved.
 *
 * - Exactly one existing row, filling a vacant seat → side-by-side comparison
 *   with all four options (the two "Connect and…" merges plus keep-separate and
 *   cancel). Merging into a single counterpart is a clean decision.
 * - Two or more existing rows (or no vacant seat to merge into) → a plain list;
 *   merging would mean choosing which of several rows to fold into, so only
 *   "keep all separate" and "cancel" are offered.
 */
export interface ConflictPresentation {
  /** Existing rows + the new one being added. */
  totalRows: number
  /** 'compare' = side-by-side cards; 'list' = vertical list of rows. */
  layout: 'compare' | 'list'
  /** Whether the two "Connect and…" merge options are offered. */
  showConnectOptions: boolean
  /** Total number of action buttons shown, including Cancel. */
  optionCount: number
  /** Copy for the keep-separate button, pluralised/counted live. */
  keepLabel: string
}

export function describeConflictPresentation(
  existingCount: number,
  hasVacantSeat: boolean,
): ConflictPresentation {
  const totalRows = existingCount + 1
  const showConnectOptions = hasVacantSeat && existingCount === 1
  return {
    totalRows,
    layout: showConnectOptions ? 'compare' : 'list',
    showConnectOptions,
    // compare → keep-existing, use-vacant, keep-separate, cancel (4)
    // list    → keep-separate, cancel (2)
    optionCount: showConnectOptions ? 4 : 2,
    keepLabel:
      totalRows === 2
        ? 'Keep both as separate rows'
        : `Keep all ${totalRows} as separate rows`,
  }
}
