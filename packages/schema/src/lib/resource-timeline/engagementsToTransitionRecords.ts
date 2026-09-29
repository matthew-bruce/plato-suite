// Phase 1 translator (ADR-035): resource_engagements → the existing
// TransitionRecord shape, so the derivation engine keeps running unchanged
// while the Timeline reads engagements instead of
// resource_supplier_transitions. Removed in Phase 2, when the engine is
// rebuilt natively on engagements.

import type { EngagementRecord, TransitionRecord } from './types'

/** roll_on_date ascending, nulls first. Stable for equal dates. */
function byRollOn(a: EngagementRecord, b: EngagementRecord): number {
  if (a.rollOnDate === b.rollOnDate) return 0
  if (a.rollOnDate === null) return -1
  if (b.rollOnDate === null) return 1
  return a.rollOnDate < b.rollOnDate ? -1 : 1
}

/**
 * At most one TransitionRecord for one resource's engagements, by the first
 * rule that applies:
 *
 *  1. MOVE — an engagement A followed by a later engagement B at a different
 *     supplier whose roll-on is verified. The latest such pair wins.
 *  2. NEW HIRE — the earliest engagement's roll-on is verified.
 *  3. ROLL-OFF — the latest engagement has a roll-off date.
 *  4. Otherwise no record.
 */
function translateOne(engagements: readonly EngagementRecord[]): TransitionRecord | null {
  const ordered = [...engagements].sort(byRollOn)
  if (ordered.length === 0) return null

  // Rule 1. Walk B from the latest backwards; for the first qualifying B take
  // the latest A before it at a different supplier.
  for (let j = ordered.length - 1; j > 0; j--) {
    const b = ordered[j]!
    if (b.rollOnEstimated) continue
    for (let i = j - 1; i >= 0; i--) {
      const a = ordered[i]!
      if (a.supplier === b.supplier) continue
      return {
        fromSupplier: a.supplier,
        toSupplier: b.supplier,
        lastWorkingDay: a.rollOffDate,
        joiningDate: null,
        commercialStart: b.rollOnDate,
        status: b.rollOnTentative ? 'signed_doj_tbc' : 'confirmed',
        notes: null,
      }
    }
  }

  // Rule 2.
  const earliest = ordered[0]!
  if (!earliest.rollOnEstimated) {
    return {
      fromSupplier: null,
      toSupplier: earliest.supplier,
      lastWorkingDay: null,
      joiningDate: earliest.rollOnDate,
      commercialStart: null,
      status: 'confirmed',
      notes: null,
    }
  }

  // Rule 3.
  const latest = ordered[ordered.length - 1]!
  if (latest.rollOffDate !== null) {
    return {
      fromSupplier: latest.supplier,
      toSupplier: null,
      lastWorkingDay: latest.rollOffDate,
      joiningDate: null,
      commercialStart: null,
      status: 'not_moving',
      notes: null,
    }
  }

  return null
}

/** resource_id → the one TransitionRecord its engagements translate to, if any. */
export function engagementsToTransitionRecords(
  engagements: readonly EngagementRecord[],
): Map<string, TransitionRecord> {
  const byResource = new Map<string, EngagementRecord[]>()
  for (const engagement of engagements) {
    const list = byResource.get(engagement.resourceId) ?? []
    list.push(engagement)
    byResource.set(engagement.resourceId, list)
  }

  const result = new Map<string, TransitionRecord>()
  for (const [resourceId, list] of byResource) {
    const record = translateOne(list)
    if (record) result.set(resourceId, record)
  }
  return result
}
