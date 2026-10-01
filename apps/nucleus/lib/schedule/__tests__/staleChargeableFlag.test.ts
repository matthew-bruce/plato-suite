import { describe, expect, it } from 'vitest'
import { isChargeableRow, sortAllocations } from '../ui'
import { MIXED_ROWS } from './fixtures/mixedSchedule'

// One F_Gov row in the fixture stores is_chargeable = true — the live stale
// case. Chargeability must come from planview_code, so it sorts with the
// non-chargeable rows, where its "Not charged" badge says it belongs.
describe('Chargeable column sort ignores the stored is_chargeable flag', () => {
  const stale = MIXED_ROWS.find((r) => r.allocation_id === 'a-fgov-stale')!

  it('the fixture really does carry a stale flag', () => {
    expect(stale.planview_code).toBe('F_Gov')
    expect(stale.is_chargeable).toBe(true)
    expect(isChargeableRow(stale.planview_code)).toBe(false)
  })

  it.each(['asc', 'desc'] as const)('%s: rows group by planview chargeability, stale row among the non-chargeable', (dir) => {
    const sorted = sortAllocations(MIXED_ROWS, 'chargeable', dir)
    const chargeableFlags = sorted.map((r) => isChargeableRow(r.planview_code))
    const prCount = MIXED_ROWS.filter((r) => isChargeableRow(r.planview_code)).length

    const expected = dir === 'desc'
      ? [...Array(prCount).fill(true), ...Array(MIXED_ROWS.length - prCount).fill(false)]
      : [...Array(MIXED_ROWS.length - prCount).fill(false), ...Array(prCount).fill(true)]
    expect(chargeableFlags).toEqual(expected)

    const staleIndex = sorted.indexOf(stale)
    expect(chargeableFlags[staleIndex]).toBe(false)
  })
})
