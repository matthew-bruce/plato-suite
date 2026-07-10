import { describe, expect, it } from 'vitest'
import { pickEffectiveCostConfig, pickAppliedCostConfig } from '../costConfig'

interface Row {
  id: string
  effective_from: string
  deleted_at?: string | null
}

describe('pickEffectiveCostConfig', () => {
  const TARGET = '2026-04-01'

  it('returns the single applicable row when exactly one exists', () => {
    const rows: Row[] = [{ id: 'a', effective_from: '2025-01-01' }]
    expect(pickEffectiveCostConfig(rows, TARGET)?.id).toBe('a')
  })

  it('picks the latest effective_from on or before the target when several apply', () => {
    const rows: Row[] = [
      { id: 'old', effective_from: '2024-01-01' },
      { id: 'mid', effective_from: '2025-06-01' },
      { id: 'newest-applicable', effective_from: '2026-01-01' },
    ]
    expect(pickEffectiveCostConfig(rows, TARGET)?.id).toBe('newest-applicable')
  })

  it('does NOT apply a future-dated row', () => {
    const rows: Row[] = [
      { id: 'current', effective_from: '2026-01-01' },
      { id: 'future', effective_from: '2026-07-01' }, // after TARGET — must not win
    ]
    expect(pickEffectiveCostConfig(rows, TARGET)?.id).toBe('current')
  })

  it('returns null when every row is future-dated', () => {
    const rows: Row[] = [{ id: 'future', effective_from: '2027-01-01' }]
    expect(pickEffectiveCostConfig(rows, TARGET)).toBeNull()
  })

  it('returns null for a platform with no rows at all (graceful empty, not error)', () => {
    expect(pickEffectiveCostConfig([], TARGET)).toBeNull()
  })

  it('ignores soft-deleted rows even if they are the latest applicable', () => {
    const rows: Row[] = [
      { id: 'live', effective_from: '2025-01-01' },
      { id: 'deleted-newer', effective_from: '2026-02-01', deleted_at: '2026-03-01T00:00:00Z' },
    ]
    expect(pickEffectiveCostConfig(rows, TARGET)?.id).toBe('live')
  })

  it('treats a row effective exactly on the target date as applicable', () => {
    const rows: Row[] = [{ id: 'boundary', effective_from: TARGET }]
    expect(pickEffectiveCostConfig(rows, TARGET)?.id).toBe('boundary')
  })
})

describe('pickAppliedCostConfig — locked reads snapshot, draft reads live', () => {
  const TARGET = '2026-04-01'
  // The frozen snapshot captured when the period locked.
  const snapshot: Row = { id: 'snapshot', effective_from: '2025-01-01' }
  // The live table at lock time resolved to the same row the snapshot froze.
  const liveAtLock: Row[] = [{ id: 'snapshot', effective_from: '2025-01-01' }]

  it('a locked period ignores ALL changes to the live rows (add/edit/delete)', () => {
    // Someone later adds a newer rate, edits the old one, and soft-deletes another —
    // none of it may move a locked period's resolved figures.
    const tamperedLive: Row[] = [
      { id: 'edited', effective_from: '2025-01-01' }, // same date, different row id
      { id: 'added-newer', effective_from: '2026-03-01' }, // would win the live lookup
      { id: 'snapshot', effective_from: '2025-01-01', deleted_at: '2026-03-02T00:00:00Z' }, // deleted
    ]
    const applied = pickAppliedCostConfig({
      locked: true,
      snapshot,
      liveRows: tamperedLive,
      targetDateISO: TARGET,
    })
    expect(applied).toBe(snapshot) // exactly the frozen row, regardless of live churn
    expect(applied?.id).toBe('snapshot')
  })

  it('a locked period with no snapshot resolves to null (no rate frozen)', () => {
    expect(
      pickAppliedCostConfig({ locked: true, snapshot: null, liveRows: liveAtLock, targetDateISO: TARGET }),
    ).toBeNull()
  })

  it('a draft period immediately reflects a newly added rate', () => {
    const withNewRate: Row[] = [
      ...liveAtLock,
      { id: 'added-newer', effective_from: '2026-03-01' },
    ]
    const applied = pickAppliedCostConfig({
      locked: false,
      snapshot,
      liveRows: withNewRate,
      targetDateISO: TARGET,
    })
    expect(applied?.id).toBe('added-newer')
  })

  it('a draft period immediately reflects a deletion', () => {
    const deleted: Row[] = [{ id: 'snapshot', effective_from: '2025-01-01', deleted_at: '2026-03-02T00:00:00Z' }]
    expect(
      pickAppliedCostConfig({ locked: false, snapshot, liveRows: deleted, targetDateISO: TARGET }),
    ).toBeNull()
  })

  it('locking takes a snapshot equal to what the live lookup returned the instant before', () => {
    // Model the lock transition: the snapshot is whatever pickEffectiveCostConfig
    // returned at that instant. Resolving the now-locked period must match it.
    const liveJustBeforeLock: Row[] = [
      { id: 'old', effective_from: '2024-01-01' },
      { id: 'applies', effective_from: '2025-06-01' },
      { id: 'future', effective_from: '2026-07-01' },
    ]
    const frozen = pickEffectiveCostConfig(liveJustBeforeLock, TARGET)
    expect(frozen?.id).toBe('applies')

    const appliedAfterLock = pickAppliedCostConfig({
      locked: true,
      snapshot: frozen,
      liveRows: [], // live table irrelevant once locked
      targetDateISO: TARGET,
    })
    expect(appliedAfterLock).toEqual(frozen)
  })
})
