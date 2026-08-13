import { describe, expect, it } from 'vitest'
import { calculateConfirmedCount } from '../ui'

describe('calculateConfirmedCount', () => {
  it('returns 0/0 for an empty array', () => {
    expect(calculateConfirmedCount([])).toEqual({ confirmed: 0, total: 0 })
  })

  it('returns confirmed = total when every row is confirmed', () => {
    const rows = [{ is_confirmed: true }, { is_confirmed: true }, { is_confirmed: true }]
    expect(calculateConfirmedCount(rows)).toEqual({ confirmed: 3, total: 3 })
  })

  it('returns confirmed = 0 when no row is confirmed', () => {
    const rows = [{ is_confirmed: false }, { is_confirmed: false }]
    expect(calculateConfirmedCount(rows)).toEqual({ confirmed: 0, total: 2 })
  })

  it('counts only the confirmed rows in a mixed set', () => {
    const rows = [
      { is_confirmed: true },
      { is_confirmed: false },
      { is_confirmed: true },
      { is_confirmed: false },
      { is_confirmed: false },
    ]
    expect(calculateConfirmedCount(rows)).toEqual({ confirmed: 2, total: 5 })
  })

  // The Filtered Totals footer count spans both resource allocations and
  // platform cost items (Ad-Hoc/ETP/Shared Services) in one call — this is
  // a structural type ({ is_confirmed: boolean }[]), not an allocation-only
  // one, specifically so callers can pass a combined array like this without
  // a cast or a second counting function.
  it('counts correctly across a mixed array of resource-allocation-shaped and cost-item-shaped rows', () => {
    const allocations = [
      { allocation_id: 'a1', is_confirmed: true },
      { allocation_id: 'a2', is_confirmed: false },
    ]
    const costItems = [
      { cost_item_id: 'c1', is_confirmed: true },
      { cost_item_id: 'c2', is_confirmed: true },
      { cost_item_id: 'c3', is_confirmed: false },
    ]
    expect(calculateConfirmedCount([...allocations, ...costItems])).toEqual({ confirmed: 3, total: 5 })
  })
})
