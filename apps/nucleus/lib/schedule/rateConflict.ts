// Pure rate-comparison logic for assigning a resource to an existing vacant
// role on the Schedule page's wizard (assign mode).
//
// A vacant role carries its own day_rate (what the role was budgeted at); a
// resource may carry a day_rate_override on the resources table (what that
// person actually costs). When both are known and they disagree, the wizard
// has to ask rather than silently picking one — whichever it picked would be
// wrong half the time, and the figure feeds BASE/+VAT and every roll-up.
//
// All rates are integer pence, matching resource_period_allocations.day_rate
// and resources.day_rate_override.

export interface RateConflict {
  /** The role's current rate, normalised: null when absent or zero. */
  roleDayRate: number | null
  /** The resource's day_rate_override, normalised: null when absent or zero. */
  resourceDayRate: number | null
  /**
   * True only when both rates are genuinely set (non-null, non-zero) AND they
   * differ. Anything else resolves on its own and must not interrupt the user.
   */
  needsPrompt: boolean
  /**
   * The rate to write when no prompt is needed: whichever of the two is
   * present (the resource's override wins when the role sits at 0/null, since
   * an unpriced role gains a real figure), or 0 when neither is set.
   * Meaningless — and not to be used — when needsPrompt is true.
   */
  resolvedDayRate: number
}

/**
 * Compare a vacant role's day rate against the rate of the resource being
 * assigned to it, and decide whether the user has to choose between them.
 *
 * Null and zero are treated identically: both mean "no rate recorded". That
 * matches how the schedule stores an unpriced row (day_rate defaults to 0 on
 * insert) and how resources.day_rate_override reads when never set.
 *
 * @param roleDayRate the allocation's current day_rate, in integer pence.
 * @param resourceDayRate the resource's day_rate_override, in integer pence.
 */
export function describeRateConflict(
  roleDayRate: number | null | undefined,
  resourceDayRate: number | null | undefined,
): RateConflict {
  const role = roleDayRate ? roleDayRate : null
  const resource = resourceDayRate ? resourceDayRate : null

  if (role !== null && resource !== null && role !== resource) {
    return {
      roleDayRate: role,
      resourceDayRate: resource,
      needsPrompt: true,
      // Not used while needsPrompt is true — the caller takes one of the two
      // explicit outcomes below instead.
      resolvedDayRate: role,
    }
  }

  return {
    roleDayRate: role,
    resourceDayRate: resource,
    needsPrompt: false,
    resolvedDayRate: role ?? resource ?? 0,
  }
}

/** The rate written when the user keeps the role's budgeted figure. */
export function resolveKeepRoleRate(conflict: RateConflict): number {
  return conflict.roleDayRate ?? conflict.resourceDayRate ?? 0
}

/** The rate written when the user takes the resource's own rate. */
export function resolveUseResourceRate(conflict: RateConflict): number {
  return conflict.resourceDayRate ?? conflict.roleDayRate ?? 0
}
