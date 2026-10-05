import { describe, expect, it } from 'vitest'
import type { TeamAssignment } from '@plato/schema'
import {
  applyAssignToRow,
  applyUnassignToRow,
  patchRow,
  savedTeamAssignments,
  teamEditSeatId,
  type SeatRowState,
} from '../assignRowState'

const CYGNUS: TeamAssignment = { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 }
const PLUTO_HALF: TeamAssignment = { teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 0.5 }

/** A vacant seat with no team rows — the shape of the Q3 Drupal seat. */
function vacantSeat(over: Partial<SeatRowState & Record<string, unknown>> = {}) {
  return {
    allocation_id: 'alloc-1',
    role_title: 'Engineer - Full Stack (Drupal)',
    day_rate: 20000,
    capacity_days: 63,
    resource_id: null,
    resource_name: null,
    teams: [] as TeamAssignment[],
    unallocatedPct: null,
    ...over,
  }
}

const SEAT_FIELDS = new Set(['resource_id', 'resource_name', 'teams', 'unallocatedPct'])

/** Everything on a row except the four fields an assign or unassign owns. */
function otherFields(row: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !SEAT_FIELDS.has(key)))
}

describe('applyAssignToRow', () => {
  it('sets resource_id and resource_name', () => {
    const row = applyAssignToRow(vacantSeat(), {
      resourceId: 'res-1',
      resourceName: 'Sivaramakrishnan P',
      teams: [CYGNUS],
    })
    expect(row.resource_id).toBe('res-1')
    expect(row.resource_name).toBe('Sivaramakrishnan P')
  })

  it('sets teams to the assignments just saved, so the team shows with no reload', () => {
    const row = applyAssignToRow(vacantSeat(), { resourceId: 'res-1', resourceName: 'P', teams: [CYGNUS] })
    expect(row.teams).toEqual([CYGNUS])
    expect(row.unallocatedPct).toBeNull()
  })

  it('recomputes unallocatedPct from the new teams', () => {
    const row = applyAssignToRow(vacantSeat(), { resourceId: 'res-1', resourceName: 'P', teams: [PLUTO_HALF] })
    expect(row.unallocatedPct).toBe(50)
  })

  it('keeps the row\'s teams when the saved teams are not known', () => {
    const row = applyAssignToRow(vacantSeat({ teams: [CYGNUS] }), {
      resourceId: 'res-1',
      resourceName: 'P',
      teams: undefined,
    })
    expect(row.teams).toEqual([CYGNUS])
    expect(row.resource_id).toBe('res-1')
  })

  it('leaves every other field untouched', () => {
    const before = vacantSeat()
    const after = applyAssignToRow(before, { resourceId: 'res-1', resourceName: 'P', teams: [CYGNUS] })
    expect(otherFields(after)).toEqual(otherFields(before))
  })

  it('does not mutate the row it was given', () => {
    const before = vacantSeat()
    applyAssignToRow(before, { resourceId: 'res-1', resourceName: 'P', teams: [CYGNUS] })
    expect(before.resource_id).toBeNull()
    expect(before.teams).toEqual([])
  })
})

describe('applyUnassignToRow', () => {
  const assigned = () =>
    vacantSeat({ resource_id: 'res-1', resource_name: 'P', teams: [CYGNUS] })

  it('clears resource_id and resource_name', () => {
    const row = applyUnassignToRow(assigned())
    expect(row.resource_id).toBeNull()
    expect(row.resource_name).toBeNull()
  })

  it('keeps the teams by default — the person\'s team rows are re-keyed onto the seat', () => {
    expect(applyUnassignToRow(assigned()).teams).toEqual([CYGNUS])
  })

  it('takes the teams the caller wrote for the seat when given', () => {
    const row = applyUnassignToRow(assigned(), [PLUTO_HALF])
    expect(row.teams).toEqual([PLUTO_HALF])
    expect(row.unallocatedPct).toBe(50)
  })

  it('clears teams when the caller wrote none', () => {
    const row = applyUnassignToRow(assigned(), [])
    expect(row.teams).toEqual([])
    expect(row.unallocatedPct).toBeNull()
  })

  it('leaves every other field untouched', () => {
    const before = assigned()
    const after = applyUnassignToRow(before, [])
    expect(otherFields(after)).toEqual(otherFields(before))
  })
})

describe('savedTeamAssignments', () => {
  const options = [
    { team_id: 't-cygnus', team_name: 'Cygnus' },
    { team_id: 't-pluto', team_name: 'Pluto' },
  ]

  it('converts the wizard\'s percentages to the page\'s fractions and resolves names', () => {
    expect(
      savedTeamAssignments(
        [
          { teamId: 't-cygnus', capacitySplit: 50 },
          { teamId: 't-pluto', capacitySplit: 50 },
        ],
        options,
      ),
    ).toEqual([
      { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 0.5 },
      { teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 0.5 },
    ])
  })

  it('drops rows with no team chosen, as updateTeamAssignments does', () => {
    expect(savedTeamAssignments([{ teamId: '', capacitySplit: 100 }], options)).toEqual([])
  })
})

describe('Edit Teams after an assign opens in person mode', () => {
  // The row's Edit Teams button passes (allocation_id, resource_id) straight
  // through to EditTeamsModal, which picks its mode with teamEditSeatId — see
  // components/schedule/__tests__/assignEditTeamsWiring.test.ts for the wiring.
  const editTeamsTargetFor = (row: { allocation_id: string; resource_id: string | null }) => ({
    allocationId: row.allocation_id,
    resourceId: row.resource_id,
  })

  it('receives the person\'s resource_id and so reads and writes by resource', () => {
    const row = applyAssignToRow(vacantSeat(), { resourceId: 'res-1', resourceName: 'P', teams: [CYGNUS] })
    const target = editTeamsTargetFor(row)
    expect(target.resourceId).toBe('res-1')
    expect(teamEditSeatId(target)).toBeUndefined()
  })

  it('was in vacant-seat mode before the fix — the stale row carried resource_id null', () => {
    const stale = { ...vacantSeat(), resource_name: 'P' }
    expect(teamEditSeatId(editTeamsTargetFor(stale))).toBe('alloc-1')
  })

  it('returns to vacant-seat mode after an unassign', () => {
    const assigned = applyAssignToRow(vacantSeat(), { resourceId: 'res-1', resourceName: 'P', teams: [CYGNUS] })
    const vacant = applyUnassignToRow(assigned)
    expect(teamEditSeatId(editTeamsTargetFor(vacant))).toBe('alloc-1')
  })
})

describe('patchRow — the row is patched, not the page re-fetched', () => {
  const rows = [
    { allocation_id: 'a1', resource_id: null as string | null },
    { allocation_id: 'a2', resource_id: null as string | null },
    { allocation_id: 'a3', resource_id: 'res-9' as string | null },
  ]

  it('replaces only the matching row', () => {
    const next = patchRow(rows, 'a2', (r) => ({ ...r, resource_id: 'res-1' }))
    expect(next.map((r) => r.resource_id)).toEqual([null, 'res-1', 'res-9'])
  })

  it('returns every other row as the same object, so nothing else re-renders', () => {
    const next = patchRow(rows, 'a2', (r) => ({ ...r, resource_id: 'res-1' }))
    expect(next[0]).toBe(rows[0])
    expect(next[2]).toBe(rows[2])
    expect(next[1]).not.toBe(rows[1])
  })

  it('keeps the order and length', () => {
    const next = patchRow(rows, 'a2', (r) => r)
    expect(next.map((r) => r.allocation_id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('changes nothing when no row matches', () => {
    const next = patchRow(rows, 'missing', (r) => ({ ...r, resource_id: 'x' }))
    expect(next).toEqual(rows)
  })
})
