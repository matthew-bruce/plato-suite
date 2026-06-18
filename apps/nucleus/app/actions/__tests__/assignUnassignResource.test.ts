import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// Both assignResourceToAllocation and unassignResourceFromAllocation issue a
// single Supabase query:
//
//   resource_period_allocations UPDATE → .eq('allocation_id', ...) → .select('allocation_id')
//
// Success: data array has ≥ 1 row → { success: true }
// Not found: data array is empty → { success: false, error: 'Allocation not found' }
// DB error: error object present → { success: false, error: message }

let queryResult: unknown

const fromMock = vi.fn()

vi.mock('@plato/schema', () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}))

import { assignResourceToAllocation, unassignResourceFromAllocation } from '../schedule'

function makeUpdateSelectChain(resolveWith: unknown) {
  // resource_period_allocations path: .update().eq().select()
  // resource_team_assignments migration path: .update().eq().is()
  const select = vi.fn().mockResolvedValue(resolveWith)
  const is = vi.fn().mockResolvedValue({ error: null })
  const eq = vi.fn().mockReturnValue({ select, is })
  const update = vi.fn().mockReturnValue({ eq })
  return { update }
}

beforeEach(() => {
  vi.clearAllMocks()
  queryResult = { data: [{ allocation_id: 'alloc-1' }], error: null }
})

function setupMock() {
  fromMock.mockImplementation(() => makeUpdateSelectChain(queryResult))
}

// ── assignResourceToAllocation ────────────────────────────────────────────────

describe('assignResourceToAllocation', () => {
  it('updates resource_id and returns success', async () => {
    queryResult = { data: [{ allocation_id: 'alloc-1' }], error: null }
    setupMock()

    const result = await assignResourceToAllocation('alloc-1', 'res-abc')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('resource_period_allocations')
  })

  it('migrates TBC team assignments to the newly assigned resource', async () => {
    queryResult = { data: [{ allocation_id: 'alloc-1' }], error: null }
    setupMock()

    const result = await assignResourceToAllocation('alloc-1', 'res-abc')

    expect(result.success).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('resource_team_assignments')
  })

  it('returns { success: false } when allocationId not found (empty data)', async () => {
    queryResult = { data: [], error: null }
    setupMock()

    const result = await assignResourceToAllocation('nonexistent', 'res-abc')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns { success: false } on DB error', async () => {
    queryResult = { data: null, error: { message: 'foreign key violation' } }
    setupMock()

    const result = await assignResourceToAllocation('alloc-1', 'bad-resource')

    expect(result.success).toBe(false)
    expect(result.error).toBe('foreign key violation')
  })
})

// ── unassignResourceFromAllocation ───────────────────────────────────────────

describe('unassignResourceFromAllocation', () => {
  it('sets resource_id to null and returns success', async () => {
    queryResult = { data: [{ allocation_id: 'alloc-2' }], error: null }
    setupMock()

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('resource_period_allocations')
  })

  it('returns { success: false } when allocationId not found (empty data)', async () => {
    queryResult = { data: [], error: null }
    setupMock()

    const result = await unassignResourceFromAllocation('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns { success: false } on DB error', async () => {
    queryResult = { data: null, error: { message: 'permission denied' } }
    setupMock()

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
  })
})
