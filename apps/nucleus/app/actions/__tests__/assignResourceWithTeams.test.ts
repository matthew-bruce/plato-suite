import { describe, it, expect, vi, beforeEach } from 'vitest'

// The single atomic assign (migration 041). The RPC is mocked: these pin what
// the action sends — null vs [] vs a selection reach the database unchanged —
// and that a failure is reported, never swallowed.

let rpcResult: unknown
const rpcMock = vi.fn()

vi.mock('@plato/schema/server', () => ({
  getSupabaseServerComponentClient: () => ({ rpc: rpcMock }),
}))

import { assignResourceWithTeams } from '../schedule'

beforeEach(() => {
  vi.clearAllMocks()
  rpcResult = { data: null, error: null }
  rpcMock.mockImplementation(() => Promise.resolve(rpcResult))
})

describe('assignResourceWithTeams', () => {
  it('sends NULL assignments as NULL', async () => {
    const result = await assignResourceWithTeams('alloc-1', 'res-1', 'period-1', 'onshore', null)
    expect(result.success).toBe(true)
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock).toHaveBeenCalledWith('assign_resource_to_vacant_allocation_with_teams', {
      p_allocation_id: 'alloc-1',
      p_resource_id: 'res-1',
      p_period_id: 'period-1',
      p_resource_location: 'onshore',
      p_assignments: null,
    })
  })

  it('sends [] as [] — "no team"', async () => {
    await assignResourceWithTeams('alloc-1', 'res-1', 'period-1', null, [])
    expect(rpcMock.mock.calls[0][1].p_assignments).toEqual([])
  })

  it('sends a selection as { team_id, capacity_split } percentages', async () => {
    await assignResourceWithTeams('alloc-1', 'res-1', 'period-1', null, [{ teamId: 't-a', capacitySplit: 50 }])
    expect(rpcMock.mock.calls[0][1].p_assignments).toEqual([{ team_id: 't-a', capacity_split: 50 }])
  })

  it('reports a failure with its message', async () => {
    rpcResult = { data: null, error: { code: 'P0001', message: "Each team's split must be more than 0% and no more than 100%." } }
    const result = await assignResourceWithTeams('alloc-1', 'res-1', 'period-1', null, [])
    expect(result).toEqual({
      success: false,
      error: "Each team's split must be more than 0% and no more than 100%.",
      roleAlreadyFilled: false,
    })
  })

  it('flags a role someone else filled first by its RFILL code', async () => {
    rpcResult = {
      data: null,
      error: { code: 'RFILL', message: "This role already has a person assigned. Edit the person's team assignments instead." },
    }
    const result = await assignResourceWithTeams('alloc-1', 'res-1', 'period-1', null, null)
    expect(result.success).toBe(false)
    expect(result.roleAlreadyFilled).toBe(true)
  })
})
