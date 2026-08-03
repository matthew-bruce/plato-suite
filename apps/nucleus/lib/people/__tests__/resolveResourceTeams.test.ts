import { describe, it, expect } from 'vitest'
import { resolveResourceTeams, type TeamAssignmentRow } from '@plato/schema'

function row(overrides: Partial<TeamAssignmentRow>): TeamAssignmentRow {
  return {
    team_id: 'team-1',
    team_name: 'Orion',
    period_id: null,
    period_start_date: null,
    ...overrides,
  }
}

describe('resolveResourceTeams', () => {
  it('returns [] when the resource has no assignment rows at all', () => {
    expect(resolveResourceTeams([])).toEqual([])
  })

  it('prefers a period_id IS NULL "live" row when one exists', () => {
    const rows = [
      row({ team_id: 't-live', team_name: 'Cygnus', period_id: null, period_start_date: null }),
      row({ team_id: 't-old', team_name: 'Janus', period_id: 'p1', period_start_date: '2026-01-01' }),
    ]
    expect(resolveResourceTeams(rows)).toEqual(['Cygnus'])
  })

  it('falls back to the row with the latest period_start_date when no live row exists', () => {
    const rows = [
      row({ team_id: 't-q1', team_name: 'Janus', period_id: 'p1', period_start_date: '2026-01-01' }),
      row({ team_id: 't-q2', team_name: 'Orion', period_id: 'p2', period_start_date: '2026-04-01' }),
    ]
    expect(resolveResourceTeams(rows)).toEqual(['Orion'])
  })

  it('joins multiple team names for capacity-split rows in the winning period, sorted', () => {
    const rows = [
      row({ team_id: 't-a', team_name: 'Pulsar', period_id: null, period_start_date: null }),
      row({ team_id: 't-b', team_name: 'Nebula', period_id: null, period_start_date: null }),
    ]
    expect(resolveResourceTeams(rows)).toEqual(['Nebula', 'Pulsar'])
  })

  it('joins multiple team names for capacity-split rows in the latest historical period', () => {
    const rows = [
      row({ team_id: 't-a', team_name: 'Orion', period_id: 'p1', period_start_date: '2026-01-01' }),
      row({ team_id: 't-b', team_name: 'Nebula', period_id: 'p1', period_start_date: '2026-01-01' }),
      // Older period — must not be included even though it's a different team.
      row({ team_id: 't-c', team_name: 'Janus', period_id: 'p0', period_start_date: '2025-10-01' }),
    ]
    expect(resolveResourceTeams(rows)).toEqual(['Nebula', 'Orion'])
  })

  it('de-duplicates a team name that appears twice in the winning row set', () => {
    const rows = [
      row({ team_id: 't-dup', team_name: 'Orion', period_id: null, period_start_date: null }),
      row({ team_id: 't-dup', team_name: 'Orion', period_id: null, period_start_date: null }),
    ]
    expect(resolveResourceTeams(rows)).toEqual(['Orion'])
  })
})
