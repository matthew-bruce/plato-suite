import { describe, expect, it } from 'vitest'
import { assignResourceWithTeamsArgs } from '../assignTeamsPayload'

describe('assignResourceWithTeamsArgs — the RPC payload', () => {
  const base = ['alloc-1', 'res-1', 'period-1', 'onshore'] as const

  it('NULL stays NULL — the role\'s own teams become the person\'s', () => {
    expect(assignResourceWithTeamsArgs(...base, null)).toEqual({
      p_allocation_id: 'alloc-1',
      p_resource_id: 'res-1',
      p_period_id: 'period-1',
      p_resource_location: 'onshore',
      p_assignments: null,
    })
  })

  it('[] stays [] — "no team", never turned into NULL', () => {
    expect(assignResourceWithTeamsArgs(...base, []).p_assignments).toEqual([])
  })

  it('a selection becomes { team_id, capacity_split } rows, splits still percentages', () => {
    expect(
      assignResourceWithTeamsArgs(...base, [
        { teamId: 't-cygnus', capacitySplit: 60 },
        { teamId: 't-pluto', capacitySplit: 40 },
      ]).p_assignments,
    ).toEqual([
      { team_id: 't-cygnus', capacity_split: 60 },
      { team_id: 't-pluto', capacity_split: 40 },
    ])
  })
})
