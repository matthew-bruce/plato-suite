import { describe, it, expect } from 'vitest'
import { sortAllocationHistory } from '@plato/schema'

// Amol Tate's Q3 FY 26/27 split allocation — two separate allocation_id rows
// sharing the same period, onshore + offshore. Neither may be collapsed.
const AMOL_ONSHORE = {
  allocation_id: 'a-onshore',
  period_start_date: '2026-10-01',
  resource_location: 'onshore',
  role_title: 'Onshore Test Lead (UK Secondment)',
  capacity_days: 10.5,
}
const AMOL_OFFSHORE = {
  allocation_id: 'a-offshore',
  period_start_date: '2026-10-01',
  resource_location: 'offshore',
  role_title: 'Offshore Test Lead',
  capacity_days: 48.5,
}
const OLDER = {
  allocation_id: 'a-older',
  period_start_date: '2026-01-01',
  resource_location: 'onshore',
  role_title: 'Test Analyst',
  capacity_days: 45,
}

describe('sortAllocationHistory', () => {
  it('keeps both rows of a same-period split allocation — never collapses, averages, or dedupes', () => {
    const result = sortAllocationHistory([AMOL_OFFSHORE, AMOL_ONSHORE])
    expect(result).toHaveLength(2)
    expect(result.map((r) => r.allocation_id).sort()).toEqual(['a-offshore', 'a-onshore'])
  })

  it('orders period_start_date desc, then resource_location ascending within a tied period', () => {
    const result = sortAllocationHistory([OLDER, AMOL_OFFSHORE, AMOL_ONSHORE])
    // 'offshore' < 'onshore' alphabetically.
    expect(result.map((r) => r.allocation_id)).toEqual(['a-offshore', 'a-onshore', 'a-older'])
  })

  it('does not mutate the input array', () => {
    const input = [OLDER, AMOL_ONSHORE]
    const copy = [...input]
    sortAllocationHistory(input)
    expect(input).toEqual(copy)
  })
})
