import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// updateTeamAssignments issues two sequential Supabase queries:
//   1. resource_team_assignments UPDATE (soft-delete) → .eq().eq().is()
//   2. resource_team_assignments INSERT → direct resolve
//
// If realAssignments is empty (all "No Team"), the INSERT is skipped.
// Validation rejects early (before any DB call) if real splits sum ≠ 100.

let updateResult: unknown
let insertResult: unknown

const fromMock = vi.fn()

vi.mock('@plato/schema', () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}))

import { updateTeamAssignments } from '../schedule-wizard'

function makeUpdateChain(resolveWith: unknown) {
  const is = vi.fn().mockResolvedValue(resolveWith)
  const eq2 = vi.fn().mockReturnValue({ is })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const update = vi.fn().mockReturnValue({ eq: eq1 })
  return { update }
}

// TBC path: .update().eq('allocation_id', ...).is('resource_id', null).is('deleted_at', null)
function makeTbcUpdateChain(resolveWith: unknown) {
  const is2 = vi.fn().mockResolvedValue(resolveWith)
  const is1 = vi.fn().mockReturnValue({ is: is2 })
  const eq = vi.fn().mockReturnValue({ is: is1 })
  const update = vi.fn().mockReturnValue({ eq })
  return { update }
}

function makeInsertDirect(resolveWith: unknown) {
  const insert = vi.fn().mockResolvedValue(resolveWith)
  return { insert }
}

beforeEach(() => {
  vi.clearAllMocks()
  updateResult = { error: null }
  insertResult = { error: null }
})

function setupMocks() {
  let callIdx = 0
  fromMock.mockImplementation(() => {
    callIdx++
    if (callIdx === 1) return makeUpdateChain(updateResult)
    if (callIdx === 2) return makeInsertDirect(insertResult)
    return {}
  })
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('updateTeamAssignments', () => {
  it('rejects if real splits do not sum to 100', async () => {
    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 60 },
      { teamId: 'team-b', capacitySplit: 30 },
    ])

    expect(result.success).toBe(false)
    expect(result.error).toContain('100')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('replaces existing assignments correctly', async () => {
    setupMocks()

    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 60 },
      { teamId: 'team-b', capacitySplit: 40 },
    ])

    expect(result.success).toBe(true)
    // Both the soft-delete UPDATE and the INSERT were called
    const calls = (fromMock.mock.calls as string[][]).map(([t]) => t)
    expect(calls).toHaveLength(2)
    calls.forEach((t) => expect(t).toBe('resource_team_assignments'))
  })

  it('handles the case where no prior assignments exist (soft-delete is a no-op)', async () => {
    // The update finds no rows to update — still succeeds
    updateResult = { error: null }
    insertResult = { error: null }
    setupMocks()

    const result = await updateTeamAssignments('res-new', 'period-x', [
      { teamId: 'team-z', capacitySplit: 100 },
    ])

    expect(result.success).toBe(true)
    expect(fromMock).toHaveBeenCalledTimes(2)
  })

  it('succeeds with empty assignments (all No Team — no INSERT issued)', async () => {
    // Only the soft-delete UPDATE is needed; INSERT is skipped when list is empty
    let callIdx = 0
    fromMock.mockImplementation(() => {
      callIdx++
      if (callIdx === 1) return makeUpdateChain({ error: null })
      return {}
    })

    const result = await updateTeamAssignments('res-1', 'period-1', [])

    expect(result.success).toBe(true)
    // Only one from() call (the delete); no insert
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('returns { success: false } when the soft-delete UPDATE fails', async () => {
    updateResult = { error: { message: 'permission denied' } }
    setupMocks()

    const result = await updateTeamAssignments('res-1', 'period-1', [
      { teamId: 'team-a', capacitySplit: 100 },
    ])

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
    // INSERT should not have been attempted
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  // ── TBC path (allocationId provided, resourceId null) ───────────────────

  it('TBC path: replaces assignments keyed on allocation_id', async () => {
    let callIdx = 0
    fromMock.mockImplementation(() => {
      callIdx++
      if (callIdx === 1) return makeTbcUpdateChain({ error: null })
      if (callIdx === 2) return makeInsertDirect({ error: null })
      return {}
    })

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
    const calls = (fromMock.mock.calls as string[][]).map(([t]) => t)
    expect(calls).toHaveLength(2)
    calls.forEach((t) => expect(t).toBe('resource_team_assignments'))
  })

  it('TBC path: succeeds with empty assignments (no INSERT issued)', async () => {
    let callIdx = 0
    fromMock.mockImplementation(() => {
      callIdx++
      if (callIdx === 1) return makeTbcUpdateChain({ error: null })
      return {}
    })

    const result = await updateTeamAssignments(null, 'period-1', [], 'alloc-1')

    expect(result.success).toBe(true)
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('TBC path: returns { success: false } when the soft-delete UPDATE fails', async () => {
    let callIdx = 0
    fromMock.mockImplementation(() => {
      callIdx++
      if (callIdx === 1) return makeTbcUpdateChain({ error: { message: 'permission denied' } })
      return {}
    })

    const result = await updateTeamAssignments(
      null,
      'period-1',
      [{ teamId: 'team-a', capacitySplit: 100 }],
      'alloc-1',
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('permission denied')
    expect(fromMock).toHaveBeenCalledTimes(1)
  })
})
