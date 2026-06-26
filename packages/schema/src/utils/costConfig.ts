// Effective-dated cost-configuration resolution.
//
// cost_configurations is versioned per platform by `effective_from` (a unique
// (platform_id, effective_from) index where deleted_at IS NULL). The applicable
// configuration for a given period is the row with the latest effective_from on
// or before the period's start date. This pure selector is the single source of
// truth for that rule — both the live read paths and the unit tests use it, so
// there is exactly one place where "which row applies" is decided.

export interface EffectiveDatedRow {
  /** ISO date string, YYYY-MM-DD. */
  effective_from: string
  /** Soft-delete marker; deleted rows never apply. */
  deleted_at?: string | null
}

/**
 * Pick the configuration in effect on `targetDateISO`: the row with the latest
 * `effective_from` that is on or before the target date and not soft-deleted.
 * Future-dated rows (effective_from > target) never apply. Returns null when no
 * row qualifies.
 *
 * ISO date strings (YYYY-MM-DD) compare correctly lexicographically, so no Date
 * parsing is needed.
 */
export function pickEffectiveCostConfig<T extends EffectiveDatedRow>(
  rows: T[],
  targetDateISO: string,
): T | null {
  let best: T | null = null
  for (const row of rows) {
    if (row.deleted_at != null) continue
    if (row.effective_from > targetDateISO) continue
    if (best === null || row.effective_from > best.effective_from) {
      best = row
    }
  }
  return best
}

/**
 * Resolve the *applied* configuration for a period — the single rule the
 * Schedule page (Applied Blended Rate and everything derived from it) and the
 * homepage obey:
 *
 *   - locked period  → always its frozen snapshot, captured at lock time. The
 *     live rows are never consulted, so later edits/deletes to
 *     cost_configurations cannot move a locked period's figures, full stop.
 *   - unlocked (draft) → the live effective-dated lookup, exactly as before, so
 *     a draft immediately reflects rate-table changes.
 *
 * Keeping this decision in one pure function means the "locked reads snapshot,
 * draft reads live" rule is unit-testable without touching the database.
 */
export function pickAppliedCostConfig<T extends EffectiveDatedRow>(opts: {
  locked: boolean
  snapshot: T | null
  liveRows: T[]
  targetDateISO: string
}): T | null {
  if (opts.locked) return opts.snapshot
  return pickEffectiveCostConfig(opts.liveRows, opts.targetDateISO)
}
