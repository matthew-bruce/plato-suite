// Resolved-value impact analysis for Rate History edits (add / edit / delete).
//
// The single edit-time question this answers: for a proposed cost_configurations
// change, which periods would actually see their *resolved* Applied Blended Rate
// move? It compares the currently-resolved rate against the would-be resolved
// rate per period — never a mere date-range overlap.
//
// Locked periods are excluded from warnings ENTIRELY and under all circumstances:
// their figures come exclusively from a permanent snapshot and cannot be moved by
// any cost_configurations change, whatever the value. A locked period whose date
// range the change touches is reported only in `unchanged`, so the UI can
// reassure ("no schedule figures will change") — never block or warn.
//
// Drafts vs active/historic is left to the caller via `warnStatuses`, so the add
// path (active/historic only) and the edit/delete path (all unlocked statuses)
// can share one comparison.

import { pickEffectiveCostConfig } from '@plato/schema'
import type { RateHistoryRow, RatePeriod } from '@plato/schema'

export type ConsideredStatus = 'draft' | 'active' | 'historic'

export interface RateEditChange {
  kind: 'add' | 'edit' | 'delete'
  platformId: string
  /** edit / delete target row. */
  targetRow?: RateHistoryRow
  /** add / edit — proposed effective_from (ISO). */
  nextEffectiveFrom?: string
  /** add / edit — proposed rate in pence (null clears it). */
  nextRatePence?: number | null
}

export interface PeriodRateImpact {
  period: RatePeriod
  fromPence: number | null
  toPence: number | null
}

export interface RateEditImpact {
  /** Unlocked periods (of a warned status) whose resolved rate genuinely changes. */
  warnings: PeriodRateImpact[]
  /** Periods the change touches whose figures will NOT change (locked, or identical). */
  unchanged: RatePeriod[]
}

const NEW_ROW_ID = '__proposed_new_row__'

/**
 * Build the platform's row set as it WOULD be after `change`, tagging the
 * added/edited/deleted row so we can tell whether a period actually resolves to
 * (or away from) it.
 */
function projectRows(current: RateHistoryRow[], change: RateEditChange): { next: RateHistoryRow[]; changedId: string } {
  if (change.kind === 'add') {
    const row: RateHistoryRow = {
      cost_configuration_id: NEW_ROW_ID,
      platform_id: change.platformId,
      effective_from: change.nextEffectiveFrom ?? '',
      blended_day_rate_override: change.nextRatePence ?? null,
      vat_uplift_percent: 0,
      on_costs_uplift_percent: 0,
    }
    return { next: [...current, row], changedId: NEW_ROW_ID }
  }
  const changedId = change.targetRow!.cost_configuration_id
  if (change.kind === 'delete') {
    return { next: current.filter((r) => r.cost_configuration_id !== changedId), changedId }
  }
  // edit
  const next = current.map((r) =>
    r.cost_configuration_id === changedId
      ? {
          ...r,
          effective_from: change.nextEffectiveFrom ?? r.effective_from,
          blended_day_rate_override:
            change.nextRatePence === undefined ? r.blended_day_rate_override : change.nextRatePence,
        }
      : r,
  )
  return { next, changedId }
}

export function computeRateEditImpact(
  history: RateHistoryRow[],
  periods: RatePeriod[],
  change: RateEditChange,
  opts: { warnStatuses: ConsideredStatus[] },
): RateEditImpact {
  const current = history.filter((r) => r.platform_id === change.platformId)
  const { next, changedId } = projectRows(current, change)

  const warnings: PeriodRateImpact[] = []
  const unchanged: RatePeriod[] = []

  for (const period of periods) {
    const before = pickEffectiveCostConfig(current, period.period_start_date)
    const after = pickEffectiveCostConfig(next, period.period_start_date)
    const beforeRate = before?.blended_day_rate_override ?? null
    const afterRate = after?.blended_day_rate_override ?? null
    // The change touches this period if the affected row is what it resolves
    // to before or after (i.e. the edit lands within this period's effective range).
    const touched = before?.cost_configuration_id === changedId || after?.cost_configuration_id === changedId

    if (period.locked) {
      // Frozen — never warns. Only surfaced (when touched) so the UI can reassure.
      if (touched) unchanged.push(period)
      continue
    }

    if (!opts.warnStatuses.includes(period.period_status as ConsideredStatus)) continue

    if (beforeRate !== afterRate) {
      warnings.push({ period, fromPence: beforeRate, toPence: afterRate })
    } else if (touched) {
      unchanged.push(period)
    }
  }

  return { warnings, unchanged }
}
