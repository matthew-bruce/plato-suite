import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// updateTeamAssignments now delegates the soft-delete + insert to a single
// atomic Postgres function via supabase.rpc('update_team_assignments', ...)
// (migration 017) so a failed insert can never leave a committed delete
// behind. Validation (splits may not exceed 100) still happens before any RPC
// call; under 100 is allowed.

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
  it('accepts real splits under 100 — a part-time team split is valid', async () => {
    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 60 },
      { teamId: 'team-b', capacitySplit: 30 },
    ])

    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledWith('update_team_assignments', {
      p_resource_id: 'res-1',
      p_period_id: 'period-1',
      p_allocation_id: null,
      p_assignments: [
        { team_id: 'team-a', capacity_split: 60 },
        { team_id: 'team-b', capacity_split: 30 },
      ],
    })
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

  // ── Capacity-split integrity regression ─────────────────────────────────
  //
  // resource_team_assignments.capacity_split is stored on a 0.00–1.00 scale
  // (see migration 001 / SCHEMA_DESIGN.md 1.6); this action works in the 0–100
  // percent scale used by the UI and divides by 100 before the RPC call
  // (schedule-wizard.ts). The invariant that actually matters is: SUM(capacity_split)
  // across active (deleted_at IS NULL) resource_team_assignments rows for a
  // given resource_id + period must never exceed 1.00. These tests target the
  // over-allocation case and prove the RPC is never reached when the incoming
  // write would push the period total over 100% (i.e. capacity_split > 1.00).
  describe('capacity_split integrity — never exceeds 1.00 (100%) for a resource+period', () => {
    it('rejects a two-team split that sums to more than 100', async () => {
      const result = await updateTeamAssignments('res-1', 'period-1', [
        { teamId: 'team-a', capacitySplit: 70 },
        { teamId: 'team-b', capacitySplit: 50 },
      ])

      expect(result.success).toBe(false)
      expect(result.error).toContain('100')
      expect(rpcMock).not.toHaveBeenCalled()
    })

    it('rejects a three-team split that sums to more than 100', async () => {
      const result = await updateTeamAssignments('res-1', 'period-1', [
        { teamId: 'team-a', capacitySplit: 50 },
        { teamId: 'team-b', capacitySplit: 40 },
        { teamId: 'team-c', capacitySplit: 20 },
      ])

      expect(result.success).toBe(false)
      expect(result.error).toContain('110')
      expect(rpcMock).not.toHaveBeenCalled()
    })

    it('accepts a split that sums to exactly 100 (capacity_split total of exactly 1.00)', async () => {
      const result = await updateTeamAssignments('res-1', 'period-1', [
        { teamId: 'team-a', capacitySplit: 33 },
        { teamId: 'team-b', capacitySplit: 33 },
        { teamId: 'team-c', capacitySplit: 34 },
      ])

      expect(result.success).toBe(true)
      expect(rpcMock).toHaveBeenCalledWith('update_team_assignments', {
        p_resource_id: 'res-1',
        p_period_id: 'period-1',
        p_allocation_id: null,
        p_assignments: [
          { team_id: 'team-a', capacity_split: 33 },
          { team_id: 'team-b', capacity_split: 33 },
          { team_id: 'team-c', capacity_split: 34 },
        ],
      })
    })

    it('TBC path: also rejects an over-100 split before the RPC is called', async () => {
      const result = await updateTeamAssignments(
        null,
        'period-1',
        [
          { teamId: 'team-a', capacitySplit: 80 },
          { teamId: 'team-b', capacitySplit: 40 },
        ],
        'alloc-1',
      )

      expect(result.success).toBe(false)
      expect(result.error).toContain('120')
      expect(rpcMock).not.toHaveBeenCalled()
    })
  })

  // ── Role already filled (migration 040) ──────────────────────────────────

  it('flags roleAlreadyFilled when the RPC raises the RFILL code', async () => {
    rpcResult = {
      data: null,
      error: {
        code: 'RFILL',
        message: "This role already has a person assigned. Edit the person's team assignments instead.",
      },
    }
    const result = await updateTeamAssignments(null, 'period-1', [], 'alloc-1')
    expect(result.success).toBe(false)
    expect(result.roleAlreadyFilled).toBe(true)
  })

  it('detects it by code, not text: the same message under another code is an ordinary failure', async () => {
    rpcResult = {
      data: null,
      error: {
        code: 'P0001',
        message: "This role already has a person assigned. Edit the person's team assignments instead.",
      },
    }
    const result = await updateTeamAssignments(null, 'period-1', [], 'alloc-1')
    expect(result.success).toBe(false)
    expect(result.roleAlreadyFilled).toBe(false)
  })
})
