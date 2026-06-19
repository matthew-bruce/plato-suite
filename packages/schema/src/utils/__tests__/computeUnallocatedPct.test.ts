import { describe, expect, it } from 'vitest'
import { computeUnallocatedPct } from '../schedule'
import type { TeamAssignment } from '../../types/schedule'

function team(teamId: string, capacitySplit: number): TeamAssignment {
  return { teamId, teamName: `Team ${teamId}`, capacitySplit }
}

describe('computeUnallocatedPct', () => {
  it('returns null when a single team is allocated at 100%', () => {
    expect(computeUnallocatedPct([team('a', 1)])).toBeNull()
  })

  it('returns null when two teams sum to 100% (50/50 split)', () => {
    expect(computeUnallocatedPct([team('a', 0.5), team('b', 0.5)])).toBeNull()
  })

  it('returns the missing percentage when one team is allocated at 50% with no second leg', () => {
    expect(computeUnallocatedPct([team('a', 0.5)])).toBe(50)
  })

  it('returns null when there are zero team assignments', () => {
    expect(computeUnallocatedPct([])).toBeNull()
  })

  it('behaves the same for TBC allocations with a partial split', () => {
    const namedRowTeams = [team('a', 0.5)]
    const tbcRowTeams = [team('a', 0.5)]
    expect(computeUnallocatedPct(tbcRowTeams)).toBe(computeUnallocatedPct(namedRowTeams))
    expect(computeUnallocatedPct(tbcRowTeams)).toBe(50)
  })
})
