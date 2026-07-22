import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// updateTeamAssignments now delegates the soft-delete + insert to a single
// atomic Postgres function via supabase.rpc('update_team_assignments', ...)
// (migration 017) so a failed insert can never leave a committed delete
// behind. Validation (splits must sum to 100) still happens client-side
// before any RPC call.

let rpcResult: unknown

const rpcMock = vi.fn()

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: () => ({ rpc: rpcMock }),
}))

import { updateTeamAssignments } from '../schedule-wizard'

beforeEach(() => {
  vi.clearAllMocks()
  rpcResult = { data: null, error: null }
  rpcMock.mockImplementation(() => Promise.resolve(rpcResult))
})

describe('updateTeamAssignments', () => {
  it('rejects if real splits do not sum to 100', async () => {
    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 60 },
      { teamId: 'team-b', capacitySplit: 30 },
    ])

    expect(result.success).toBe(false)
    expect(result.error).toContain('100')
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('replaces existing assignments correctly (named resource path)', async () => {
    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 60 },
      { teamId: 'team-b', capacitySplit: 40 },
    ])

    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('update_team_assignments', {
      p_resource_id: 'res-1',
      p_period_id: 'period-1',
      p_allocation_id: null,
      p_assignments: [
        { team_id: 'team-a', capacity_split: 60 },
        { team_id: 'team-b', capacity_split: 40 },
      ],
    })
  })

  it('succeeds with empty assignments (all No Team)', async () => {
    const result = await updateTeamAssignments('res-1', 'period-1', [])

    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('update_team_assignments', {
      p_resource_id: 'res-1',
      p_period_id: 'period-1',
      p_allocation_id: null,
      p_assignments: [],
    })
  })

  it('returns { success: false } and surfaces the error when the RPC fails', async () => {
    rpcResult = { data: null, error: { message: 'permission denied' } }

    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 100 },
    ])

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
  })

  it('does not swallow a unique-violation error from a simulated partial failure', async () => {
    // Mirrors the production incident: an insert that fails after the
    // soft-delete already ran. With the atomic RPC this is now reported
    // as a single failed call — there is no separate delete step to leave
    // committed, but the function must still surface the DB error as-is.
    rpcResult = { data: null, error: { message: 'duplicate key value violates unique constraint "rta_named_unique"' } }

    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 100 },
    ])

    expect(result.success).toBe(false)
    expect(result.error).toContain('rta_named_unique')
    expect(rpcMock).toHaveBeenCalledTimes(1)
  })

  // ── TBC path (allocationId provided, resourceId null) ───────────────────

  it('TBC path: replaces assignments keyed on allocation_id', async () => {
    const result = await updateTeamAssignments(
      null,
      'period-1',
      [
        { teamId: 'team-a', capacitySplit: 60 },
        { teamId: 'team-b', capacitySplit: 40 },
      ],
      'alloc-1',
    )

    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('update_team_assignments', {
      p_resource_id: null,
      p_period_id: 'period-1',
      p_allocation_id: 'alloc-1',
      p_assignments: [
        { team_id: 'team-a', capacity_split: 60 },
        { team_id: 'team-b', capacity_split: 40 },
      ],
    })
  })

  it('TBC path: succeeds with empty assignments', async () => {
    const result = await updateTeamAssignments(null, 'period-1', [], 'alloc-1')

    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('update_team_assignments', {
      p_resource_id: null,
      p_period_id: 'period-1',
      p_allocation_id: 'alloc-1',
      p_assignments: [],
    })
  })

  it('TBC path: returns { success: false } when the RPC fails', async () => {
    rpcResult = { data: null, error: { message: 'permission denied' } }

    const result = await updateTeamAssignments(
      null,
      'period-1',
      [{ teamId: 'team-a', capacitySplit: 100 }],
      'alloc-1',
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
  })
})
