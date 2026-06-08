import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the Supabase server client from @plato/schema. The action calls
// getSupabaseServerClient().from(...).update(...).eq(...) and inspects `error`.
const eqMock = vi.fn()
const updateMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn(() => ({ update: updateMock }))

vi.mock('@plato/schema', () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}))

import { batchUpdateDisplayOrder } from '../schedule'

beforeEach(() => {
  eqMock.mockReset()
  updateMock.mockClear()
  fromMock.mockClear()
  // Default: every write succeeds.
  eqMock.mockResolvedValue({ error: null })
})

describe('batchUpdateDisplayOrder', () => {
  it('returns { success: false } when passed an empty array', async () => {
    const result = await batchUpdateDisplayOrder([])
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
    // No DB writes should be attempted.
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns { success: true } when passed valid updates', async () => {
    const result = await batchUpdateDisplayOrder([
      { allocationId: 'a1', displayOrder: 1 },
      { allocationId: 'a2', displayOrder: 2 },
    ])
    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    // One update + eq per allocation.
    expect(updateMock).toHaveBeenCalledTimes(2)
    expect(eqMock).toHaveBeenCalledWith('allocation_id', 'a1')
    expect(eqMock).toHaveBeenCalledWith('allocation_id', 'a2')
  })

  it('returns { success: false } with the message when a write fails', async () => {
    eqMock.mockResolvedValueOnce({ error: { message: 'db exploded' } })
    const result = await batchUpdateDisplayOrder([
      { allocationId: 'a1', displayOrder: 1 },
    ])
    expect(result.success).toBe(false)
    expect(result.error).toBe('db exploded')
  })
})
