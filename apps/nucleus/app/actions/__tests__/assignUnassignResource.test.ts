import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// assignResourceToAllocation issues:
//   resource_period_allocations UPDATE → .eq('allocation_id', ...).select('allocation_id')
//   resource_team_assignments UPDATE → .eq('allocation_id', ...).is('resource_id', ...)
//
// unassignResourceFromAllocation issues:
//   resource_period_allocations SELECT → .eq('allocation_id', ...).maybeSingle()
//   resource_period_allocations UPDATE → .eq('allocation_id', ...).select('allocation_id')
//   resource_team_assignments UPDATE → .eq('resource_id', ...).eq('period_id', ...).is('deleted_at', ...)
//
// A generic chainable mock is used: every chain method returns the same
// thenable object so any call sequence resolves to the queued response for
// that table.

let responses: Record<string, unknown[]>

const fromMock = vi.fn()

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: () => ({ from: fromMock }),
}))

import { assignResourceToAllocation, unassignResourceFromAllocation } from '../schedule'

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'update', 'eq', 'is', 'maybeSingle']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  // Make the chain awaitable, resolving to `result`.
  ;(chain as { then: unknown }).then = (resolve: (v: unknown) => void) => resolve(result)
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  responses = {
    resource_period_allocations: [{ data: [{ allocation_id: 'alloc-1' }], error: null }],
    resource_team_assignments: [{ error: null }],
  }
  fromMock.mockImplementation((table: string) => {
    const queue = responses[table] ?? [{ data: [], error: null }]
    const next = queue.length > 1 ? queue.shift() : queue[0]
    return makeChain(next)
  })
})

// ── assignResourceToAllocation ────────────────────────────────────────────────

describe('assignResourceToAllocation', () => {
  it('updates resource_id and returns success', async () => {
    const result = await assignResourceToAllocation('alloc-1', 'res-abc')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('resource_period_allocations')
  })

  it('migrates TBC team assignments to the newly assigned resource', async () => {
    const result = await assignResourceToAllocation('alloc-1', 'res-abc')

    expect(result.success).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('resource_team_assignments')
  })

  it('returns { success: false } when allocationId not found (empty data)', async () => {
    responses.resource_period_allocations = [{ data: [], error: null }]

    const result = await assignResourceToAllocation('nonexistent', 'res-abc')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns { success: false } on DB error', async () => {
    responses.resource_period_allocations = [{ data: null, error: { message: 'foreign key violation' } }]

    const result = await assignResourceToAllocation('alloc-1', 'bad-resource')

    expect(result.success).toBe(false)
    expect(result.error).toBe('foreign key violation')
  })
})

// ── unassignResourceFromAllocation ───────────────────────────────────────────

describe('unassignResourceFromAllocation', () => {
  it('sets resource_id to null and returns success', async () => {
    responses.resource_period_allocations = [
      { data: { resource_id: 'res-abc', period_id: 'period-1' }, error: null },
      { data: [{ allocation_id: 'alloc-2' }], error: null },
    ]

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(fromMock).toHaveBeenCalledWith('resource_period_allocations')
  })

  it('migrates named team assignments to the now-TBC allocation', async () => {
    responses.resource_period_allocations = [
      { data: { resource_id: 'res-abc', period_id: 'period-1' }, error: null },
      { data: [{ allocation_id: 'alloc-2' }], error: null },
    ]

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('resource_team_assignments')
  })

  it('skips team migration when there was no previous resource', async () => {
    responses.resource_period_allocations = [
      { data: { resource_id: null, period_id: 'period-1' }, error: null },
      { data: [{ allocation_id: 'alloc-2' }], error: null },
    ]

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(true)
    expect(fromMock).not.toHaveBeenCalledWith('resource_team_assignments')
  })

  it('returns { success: false } when allocationId not found (no existing row)', async () => {
    responses.resource_period_allocations = [{ data: null, error: null }]

    const result = await unassignResourceFromAllocation('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns { success: false } on fetch error', async () => {
    responses.resource_period_allocations = [{ data: null, error: { message: 'permission denied' } }]

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
  })

  it('returns { success: false } on update error', async () => {
    responses.resource_period_allocations = [
      { data: { resource_id: 'res-abc', period_id: 'period-1' }, error: null },
      { data: null, error: { message: 'permission denied' } },
    ]

    const result = await unassignResourceFromAllocation('alloc-2')

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
  })
})
