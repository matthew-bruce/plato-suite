import { describe, expect, it } from 'vitest'
import { pickEffectiveCostConfig } from '../costConfig'

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
