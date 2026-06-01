import { describe, it, expect } from 'vitest'
import { getCapacitySplit } from '../scheduleUtils'

const twoTeams = [
  { teamId: 'a', teamName: 'Janus', capacitySplit: 0.5 },
  { teamId: 'b', teamName: 'Nebula', capacitySplit: 0.5 },
]
const oneTeam = [
  { teamId: 'c', teamName: 'Orion', capacitySplit: 1.0 },
]

describe('getCapacitySplit', () => {
  it('returns 1.0 when no filter active', () => {
    expect(getCapacitySplit(twoTeams, null)).toBe(1.0)
    expect(getCapacitySplit(twoTeams, 'All')).toBe(1.0)
  })
  it('returns the split for the matched team', () => {
    expect(getCapacitySplit(twoTeams, 'Janus')).toBe(0.5)
    expect(getCapacitySplit(twoTeams, 'Nebula')).toBe(0.5)
  })
  it('returns 1.0 when resource not on filtered team', () => {
    expect(getCapacitySplit(oneTeam, 'Janus')).toBe(1.0)
  })
  it('returns 1.0 for a single-team resource', () => {
    expect(getCapacitySplit(oneTeam, 'Orion')).toBe(1.0)
  })
})
