import { describe, expect, it } from 'vitest'
import { resolveTeamsByResource } from '../resolveTeams'
import type { TeamAssignmentInput } from '../types'

const COARSE = 'q2-period'
const GRANULAR = 'q3-period'

function row(overrides: Partial<TeamAssignmentInput> = {}): TeamAssignmentInput {
  return {
    resourceId: 'r1',
    periodId: GRANULAR,
    teamName: 'Orion',
    capacitySplit: 1,
    ...overrides,
  }
}

describe('resolveTeamsByResource', () => {
  it('round 9 regression: a resource with a soft-deleted old-team row (already excluded by the caller) and a genuinely current row for the new team shows only the new team', () => {
    // Mirrors Grzegorz Bech: the caller's query filters deleted_at IS NULL,
    // so the soft-deleted Q3 Orion row never reaches this function at all —
    // only the still-live Nebula row for Q3, plus his separate, still-live
    // Q2 Orion row (a real row from before the move, not a duplicate).
    const rows = [
      row({ resourceId: 'bech', periodId: COARSE, teamName: 'Orion' }),
      row({ resourceId: 'bech', periodId: GRANULAR, teamName: 'Nebula' }),
    ]

    const result = resolveTeamsByResource(rows, GRANULAR)

    expect(result.get('bech')).toEqual([{ teamName: 'Nebula', capacitySplit: 1 }])
  })

  it('falls back to the coarse period when a resource has no granular-period row at all', () => {
    // A real, current case (Dat Ly, Tom Tanser, et al.): team assignments
    // aren't always rolled forward before the coarse-period query catches
    // them. Losing their last-known team would be a regression, not a fix.
    const rows = [row({ resourceId: 'no-q3-row', periodId: COARSE, teamName: 'Cygnus' })]

    const result = resolveTeamsByResource(rows, GRANULAR)

    expect(result.get('no-q3-row')).toEqual([{ teamName: 'Cygnus', capacitySplit: 1 }])
  })

  it('keeps a genuine capacity split across two teams within the same (granular) period', () => {
    const rows = [
      row({ resourceId: 'split', periodId: GRANULAR, teamName: 'Pulsar', capacitySplit: 0.5 }),
      row({ resourceId: 'split', periodId: GRANULAR, teamName: 'Vega', capacitySplit: 0.5 }),
    ]

    const result = resolveTeamsByResource(rows, GRANULAR)

    expect(result.get('split')).toEqual([
      { teamName: 'Pulsar', capacitySplit: 0.5 },
      { teamName: 'Vega', capacitySplit: 0.5 },
    ])
  })

  it('collapses two rows in the same period that share a team name (last one wins)', () => {
    const rows = [
      row({ resourceId: 'dup', periodId: GRANULAR, teamName: 'Helion', capacitySplit: 1 }),
      row({ resourceId: 'dup', periodId: GRANULAR, teamName: 'Helion', capacitySplit: 0.75 }),
    ]

    const result = resolveTeamsByResource(rows, GRANULAR)

    expect(result.get('dup')).toEqual([{ teamName: 'Helion', capacitySplit: 0.75 }])
  })

  it('does not merge a coarse-period team into the result once a granular-period row exists', () => {
    // The bug this round fixes: a per-team-name union across periods kept
    // BOTH the old (coarse) and new (granular) team whenever the names
    // differed, since only same-name rows ever collapsed.
    const rows = [
      row({ resourceId: 'mover', periodId: COARSE, teamName: 'Sagan' }),
      row({ resourceId: 'mover', periodId: GRANULAR, teamName: 'Cygnus' }),
    ]

    const result = resolveTeamsByResource(rows, GRANULAR)

    expect(result.get('mover')).toEqual([{ teamName: 'Cygnus', capacitySplit: 1 }])
    expect(result.get('mover')).not.toContainEqual(
      expect.objectContaining({ teamName: 'Sagan' }),
    )
  })

  it('returns an empty map for no input rows', () => {
    expect(resolveTeamsByResource([], GRANULAR).size).toBe(0)
  })

  it('handles multiple unrelated resources independently', () => {
    const rows = [
      row({ resourceId: 'a', periodId: GRANULAR, teamName: 'Orion' }),
      row({ resourceId: 'b', periodId: COARSE, teamName: 'Nebula' }),
      row({ resourceId: 'b', periodId: GRANULAR, teamName: 'Sagan' }),
    ]

    const result = resolveTeamsByResource(rows, GRANULAR)

    expect(result.get('a')).toEqual([{ teamName: 'Orion', capacitySplit: 1 }])
    expect(result.get('b')).toEqual([{ teamName: 'Sagan', capacitySplit: 1 }])
  })
})
