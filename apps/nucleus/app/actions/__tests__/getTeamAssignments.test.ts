import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Strategy ─────────────────────────────────────────────────────────────────
//
// getTeamAssignments runs a single Supabase query:
//   resource_team_assignments
//     .select('team_id, capacity_split, teams:team_id ( team_name )')
//     .eq('resource_id', resourceId)
//     .eq('period_id', periodId)
//     .is('deleted_at', null)
//
// The chain is: .from().select().eq().eq().is() → resolves to { data, error }

const fromMock = vi.fn()

vi.mock('@plato/schema', () => ({
  getSupabaseServerClient: () => ({ from: fromMock }),
}))

import { getTeamAssignments } from '../schedule-wizard'

function makeSelectChain(resolveWith: unknown) {
  const is = vi.fn().mockResolvedValue(resolveWith)
  const eq2 = vi.fn().mockReturnValue({ is })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  return { select }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getTeamAssignments', () => {
  it('returns correct team assignments for a resource in a period', async () => {
    const rawData = [
      { team_id: 'team-1', capacity_split: 0.6, teams: { team_name: 'Alpha' } },
      { team_id: 'team-2', capacity_split: 0.4, teams: { team_name: 'Beta' } },
    ]
    fromMock.mockReturnValue(makeSelectChain({ data: rawData, error: null }))

    const result = await getTeamAssignments('res-1', 'period-1')

    expect(result).toEqual([
      { teamId: 'team-1', teamName: 'Alpha', split: 60 },
      { teamId: 'team-2', teamName: 'Beta', split: 40 },
    ])
    expect(fromMock).toHaveBeenCalledWith('resource_team_assignments')
  })

  it('returns empty array when no assignments exist', async () => {
    fromMock.mockReturnValue(makeSelectChain({ data: [], error: null }))

    const result = await getTeamAssignments('res-new', 'period-1')

    expect(result).toEqual([])
  })

  it('handles teams embed returned as array (Supabase normalisation)', async () => {
    const rawData = [
      { team_id: 'team-1', capacity_split: 1.0, teams: [{ team_name: 'Gamma' }] },
    ]
    fromMock.mockReturnValue(makeSelectChain({ data: rawData, error: null }))

    const result = await getTeamAssignments('res-1', 'period-1')

    expect(result).toEqual([{ teamId: 'team-1', teamName: 'Gamma', split: 100 }])
  })

  it('throws when the DB returns an error', async () => {
    fromMock.mockReturnValue(
      makeSelectChain({ data: null, error: { message: 'permission denied' } }),
    )

    await expect(getTeamAssignments('res-1', 'period-1')).rejects.toThrow('permission denied')
  })
})
