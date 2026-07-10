import { describe, it, expect } from 'vitest'
import {
  sortExportRows,
  nextExportSortState,
  sortIndicator,
  splitTeamAssignments,
  getTeamCellStyle,
  type ExportRow,
} from '../exportView'

function row(p: Partial<ExportRow> & { allocation_id: string }): ExportRow {
  return {
    resource_name: null,
    role_title: null,
    resource_location: null,
    capacity_days: null,
    base_total_pence: 0,
    teams: [],
    ...p,
  }
}

describe('sortExportRows', () => {
  it('sort by Days descending → highest days row is first', () => {
    const rows = [
      row({ allocation_id: 'a', capacity_days: 20 }),
      row({ allocation_id: 'b', capacity_days: 65 }),
      row({ allocation_id: 'c', capacity_days: 40 }),
    ]
    const sorted = sortExportRows(rows, 'days', 'desc')
    expect(sorted.map((r) => r.allocation_id)).toEqual(['b', 'c', 'a'])
  })

  it('sort by Resource ascending → alphabetical', () => {
    const rows = [
      row({ allocation_id: 'a', resource_name: 'Priya Shah' }),
      row({ allocation_id: 'b', resource_name: 'Amir Khan' }),
      row({ allocation_id: 'c', resource_name: 'Beth Owens' }),
    ]
    const sorted = sortExportRows(rows, 'resource', 'asc')
    expect(sorted.map((r) => r.resource_name)).toEqual(['Amir Khan', 'Beth Owens', 'Priya Shah'])
  })

  it('sort by Role and Location and Run rate cost (total) all work', () => {
    const roleRows = [row({ allocation_id: 'a', role_title: 'Zebra' }), row({ allocation_id: 'b', role_title: 'Alpha' })]
    expect(sortExportRows(roleRows, 'role', 'asc').map((r) => r.role_title)).toEqual(['Alpha', 'Zebra'])

    const locRows = [row({ allocation_id: 'a', resource_location: 'offshore' }), row({ allocation_id: 'b', resource_location: 'nearshore' })]
    expect(sortExportRows(locRows, 'location', 'asc').map((r) => r.resource_location)).toEqual(['nearshore', 'offshore'])

    const costRows = [row({ allocation_id: 'a', base_total_pence: 50000 }), row({ allocation_id: 'b', base_total_pence: 120000 })]
    expect(sortExportRows(costRows, 'total', 'desc').map((r) => r.allocation_id)).toEqual(['b', 'a'])
  })

  it('a null column returns rows unchanged (the current filtered view order)', () => {
    const rows = [row({ allocation_id: 'z' }), row({ allocation_id: 'a' })]
    expect(sortExportRows(rows, null, 'asc')).toBe(rows)
  })

  it('does not mutate the input array', () => {
    const rows = [row({ allocation_id: 'a', capacity_days: 1 }), row({ allocation_id: 'b', capacity_days: 2 })]
    const original = [...rows]
    sortExportRows(rows, 'days', 'desc')
    expect(rows).toEqual(original)
  })
})

describe('nextExportSortState — click-to-sort transitions', () => {
  it('clicking a fresh column resets to ascending', () => {
    expect(nextExportSortState('days', { col: null, dir: 'asc' })).toEqual({ col: 'days', dir: 'asc' })
    expect(nextExportSortState('resource', { col: 'days', dir: 'desc' })).toEqual({ col: 'resource', dir: 'asc' })
  })

  it('clicking the same column twice reverses direction', () => {
    expect(nextExportSortState('days', { col: 'days', dir: 'asc' })).toEqual({ col: 'days', dir: 'desc' })
    expect(nextExportSortState('days', { col: 'days', dir: 'desc' })).toEqual({ col: 'days', dir: 'asc' })
  })
})

describe('sortIndicator', () => {
  it('shows ↕ for an unsorted column, ↑/↓ for the active one', () => {
    expect(sortIndicator('resource', { col: null, dir: 'asc' })).toBe('↕')
    expect(sortIndicator('resource', { col: 'days', dir: 'asc' })).toBe('↕')
    expect(sortIndicator('resource', { col: 'resource', dir: 'asc' })).toBe('↑')
    expect(sortIndicator('resource', { col: 'resource', dir: 'desc' })).toBe('↓')
  })
})

describe('splitTeamAssignments + getTeamCellStyle — team de-emphasis', () => {
  const teams = [
    { teamId: 't1', teamName: 'Nebula', capacitySplit: 0.5 },
    { teamId: 't2', teamName: 'Falcon', capacitySplit: 0.5 },
  ]

  it('team filter active → the filtered team is primary (bold, full colour), the other is secondary (muted, small, "+")', () => {
    const split = splitTeamAssignments(teams, 'Nebula')
    const nebula = split.find((t) => t.teamName === 'Nebula')!
    const falcon = split.find((t) => t.teamName === 'Falcon')!
    expect(nebula.emphasis).toBe('primary')
    expect(falcon.emphasis).toBe('secondary')

    const primaryStyle = getTeamCellStyle(nebula.emphasis)
    expect(primaryStyle.fontWeight).toBe(700)
    expect(primaryStyle.color).toBe('#2A2A2D') // normal (non-muted) colour
    expect(primaryStyle.prefix).toBe('')

    const secondaryStyle = getTeamCellStyle(falcon.emphasis)
    expect(secondaryStyle.fontSize).toBe(11)
    expect(secondaryStyle.color).toBe('#8F9495') // muted grey
    expect(secondaryStyle.prefix).toBe('+ ')
    expect(secondaryStyle.fontWeight).toBeLessThan(primaryStyle.fontWeight)
  })

  it('team filter can also match by teamId, not just teamName', () => {
    const split = splitTeamAssignments(teams, 't2')
    expect(split.find((t) => t.teamId === 't2')!.emphasis).toBe('primary')
    expect(split.find((t) => t.teamId === 't1')!.emphasis).toBe('secondary')
  })

  it('no team filter active → all team cells render at equal weight, no primary/secondary distinction', () => {
    const split = splitTeamAssignments(teams, null)
    expect(split.every((t) => t.emphasis === 'equal')).toBe(true)
    const styles = split.map((t) => getTeamCellStyle(t.emphasis))
    // Every style is identical — no assignment is emphasised over another.
    expect(styles[0]).toEqual(styles[1])
    expect(styles[0].prefix).toBe('')
  })
})
