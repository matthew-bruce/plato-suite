// Draft-impact analysis for Rate History edits/deletes.
//
// Editing or deleting a cost_configurations row can change which rate a
// *draft* period resolves to (drafts read the live effective-dated lookup).
// Locked periods are never affected — they read their frozen snapshot — so they
// are excluded by definition. This pure helper computes, for a proposed change,
// exactly which draft periods would resolve to a different Applied Blended Rate
// and what it would become, so the UI can show a confirm step (not a block).

import { pickEffectiveCostConfig } from '@plato/schema'
import type { RateHistoryRow, RatePeriod } from '@plato/schema'

export interface RateChange {
  kind: 'edit' | 'delete'
  /** The original row being edited or deleted. */
  row: RateHistoryRow
  /** Edit only — the proposed new effective_from (ISO). */
  nextEffectiveFrom?: string
  /** Edit only — the proposed new rate in pence (null clears it). */
  nextRatePence?: number | null
}

export interface DraftImpact {
  period: RatePeriod
  fromPence: number | null
  toPence: number | null
}

/**
 * Returns the draft periods whose resolved blended rate would change under
 * `change`. Empty array ⇒ no draft is affected ⇒ commit with no friction.
 * Only the changed row's own platform can be affected, so the comparison is
 * scoped to that platform's rows.
 */
export function computeDraftRateImpact(
  history: RateHistoryRow[],
  periods: RatePeriod[],
  change: RateChange,
): DraftImpact[] {
  const platformId = change.row.platform_id
  const current = history.filter((r) => r.platform_id === platformId)

  let next: RateHistoryRow[]
  if (change.kind === 'delete') {
    next = current.filter((r) => r.cost_configuration_id !== change.row.cost_configuration_id)
  } else {
    next = current.map((r) =>
      r.cost_configuration_id === change.row.cost_configuration_id
        ? {
            ...r,
            effective_from: change.nextEffectiveFrom ?? r.effective_from,
            blended_day_rate_override:
              change.nextRatePence === undefined ? r.blended_day_rate_override : change.nextRatePence,
          }
        : r,
    )
  }

  // Locked periods can't be affected (snapshot-served); only consider drafts.
  const drafts = periods.filter((p) => p.period_status === 'draft' && !p.locked)

  const impacts: DraftImpact[] = []
  for (const p of drafts) {
    const before =
      pickEffectiveCostConfig(current, p.period_start_date)?.blended_day_rate_override ?? null
    const after =
      pickEffectiveCostConfig(next, p.period_start_date)?.blended_day_rate_override ?? null
    if (before !== after) impacts.push({ period: p, fromPence: before, toPence: after })
  }
  return impacts
}
