import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// assignResourceToAllocation (as of migration 028) issues a single RPC call:
//   supabase.rpc('assign_resource_to_vacant_allocation', { p_allocation_id, p_resource_id, p_resource_location })
// This replaces the old two-write shape (rpa UPDATE + a best-effort rta
// re-key UPDATE whose failure was swallowed) — see the 2026-07-23
// investigation docs. The RPC is atomic: a single Supabase error covers
// "allocation not found" (RAISE EXCEPTION in the function) and any re-key
// failure, so there is no longer a partial-success state to test for.
//
// unassignResourceFromAllocation is unchanged and still issues:
//   resource_period_allocations SELECT → .eq('allocation_id', ...).maybeSingle()
//   resource_period_allocations UPDATE → .eq('allocation_id', ...).select('allocation_id')
//   resource_team_assignments UPDATE → .eq('resource_id', ...).eq('period_id', ...).is('deleted_at', ...)
//
// A generic chainable mock is used for the .from() path: every chain method
// returns the same thenable object so any call sequence resolves to the
// queued response for that table.

let responses: Record<string, unknown[]>
let rpcResult: unknown

const fromMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: () => ({ from: fromMock, rpc: rpcMock }),
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

  rpcResult = { data: null, error: null }
  rpcMock.mockImplementation(() => Promise.resolve(rpcResult))
})

// ── assignResourceToAllocation ────────────────────────────────────────────────

describe('assignResourceToAllocation', () => {
  it('calls the atomic RPC with the right params and returns success', async () => {
    const result = await assignResourceToAllocation('alloc-1', 'res-abc', 'onshore')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
    expect(rpcMock).toHaveBeenCalledWith('assign_resource_to_vacant_allocation', {
      p_allocation_id: 'alloc-1',
      p_resource_id: 'res-abc',
      p_resource_location: 'onshore',
    })
    // No direct table writes — the RPC does both writes server-side.
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('passes null resource_location when none is given', async () => {
    await assignResourceToAllocation('alloc-1', 'res-abc')

    expect(rpcMock).toHaveBeenCalledWith('assign_resource_to_vacant_allocation', {
      p_allocation_id: 'alloc-1',
      p_resource_id: 'res-abc',
      p_resource_location: null,
    })
  })

  it('returns { success: false } when the RPC reports "allocation not found"', async () => {
    rpcResult = { data: null, error: { message: 'Allocation not found' } }

    const result = await assignResourceToAllocation('nonexistent', 'res-abc')

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('returns { success: false } on a plain DB error from the RPC (e.g. FK violation)', async () => {
    rpcResult = { data: null, error: { message: 'foreign key violation' } }

    const result = await assignResourceToAllocation('alloc-1', 'bad-resource')

    expect(result.success).toBe(false)
    expect(result.error).toBe('foreign key violation')
  })

  // Regression test (per the 2026-07-23 fix): if the team-assignment re-key
  // half of the operation would fail, the RPC raises and the whole call
  // fails atomically — there is no way for the caller to observe a partial
  // state where the allocation was named but the re-key silently didn't
  // happen. Simulated here as a unique-violation error surfacing from the
  // single RPC call (what a colliding rta_named_unique looks like from the
  // Supabase client's point of view).
  it('reports the whole operation as failed if the re-key half would violate a unique constraint — no partial success', async () => {
    rpcResult = {
      data: null,
      error: {
        message: 'duplicate key value violates unique constraint "rta_named_unique"',
        code: '23505',
      },
    }

    const result = await assignResourceToAllocation('alloc-1', 'res-abc')

    expect(result.success).toBe(false)
    expect(result.error).toContain('rta_named_unique')
    // Exactly one call was made (the atomic RPC) — there is no second,
    // separate write that could have partially applied.
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(fromMock).not.toHaveBeenCalled()
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
