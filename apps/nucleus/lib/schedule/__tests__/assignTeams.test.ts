import { describe, expect, it } from 'vitest'
import {
  canSkipTeams,
  clearsRoleTeamsBeforeAssign,
  decideTeamWrite,
  describeSelection,
  emptySelectionWarning,
  isTeamSelectionConfirmed,
  isTeamTotalAllowed,
  requiresTeamConfirmation,
  resolveAssignTeamPrefill,
  selectionSignature,
  teamReferenceLines,
  teamsAfterAssign,
  type NamedTeamSplit,
} from '../assignTeams'

const cygnus = (split = 100): NamedTeamSplit => ({ teamId: 't-cygnus', teamName: 'Cygnus', split })
const pluto = (split = 100): NamedTeamSplit => ({ teamId: 't-pluto', teamName: 'Pluto', split })
const orion = (split = 100): NamedTeamSplit => ({ teamId: 't-orion', teamName: 'Orion', split })
const plain = (t: NamedTeamSplit) => ({ teamId: t.teamId, split: t.split })

describe('resolveAssignTeamPrefill', () => {
  it('a person with no teams takes the role\'s teams', () => {
    expect(
      resolveAssignTeamPrefill({ personTeams: [], roleTeams: [cygnus(60), pluto(40)], filterTeamId: 't-orion' }),
    ).toEqual([plain(cygnus(60)), plain(pluto(40))])
  })

  it('a person with no teams and a role with none falls back to the page\'s team filter', () => {
    expect(resolveAssignTeamPrefill({ personTeams: [], roleTeams: [], filterTeamId: 't-orion' })).toEqual([
      { teamId: 't-orion', split: 100 },
    ])
  })

  it('then to one empty row at 100%', () => {
    expect(resolveAssignTeamPrefill({ personTeams: [], roleTeams: [], filterTeamId: null })).toEqual([
      { teamId: '', split: 100 },
    ])
  })

  it('a person with teams gets the union of theirs and the role\'s', () => {
    expect(
      resolveAssignTeamPrefill({ personTeams: [cygnus(100)], roleTeams: [pluto(100)], filterTeamId: null }),
    ).toEqual([plain(cygnus(100)), plain(pluto(100))])
  })

  it('a team on both sides appears once, at the person\'s current split', () => {
    expect(
      resolveAssignTeamPrefill({
        personTeams: [cygnus(50), orion(50)],
        roleTeams: [cygnus(100), pluto(20)],
        filterTeamId: null,
      }),
    ).toEqual([plain(cygnus(50)), plain(orion(50)), plain(pluto(20))])
  })

  it('a role with no team pre-fills the person\'s own teams', () => {
    expect(
      resolveAssignTeamPrefill({ personTeams: [cygnus(50), pluto(50)], roleTeams: [], filterTeamId: 't-orion' }),
    ).toEqual([plain(cygnus(50)), plain(pluto(50))])
  })
})

describe('teamReferenceLines', () => {
  it('names the person\'s current teams and the role\'s team', () => {
    expect(teamReferenceLines('Ann Lee', [cygnus(60), pluto(40)], [orion(100)])).toEqual([
      'Ann Lee is currently on Cygnus 60%, Pluto 40% this period.',
      'This role is set to Orion 100%.',
    ])
  })

  it('says when the role has no team', () => {
    expect(teamReferenceLines('Ann Lee', [cygnus(100)], [])).toEqual([
      'Ann Lee is currently on Cygnus 100% this period.',
      'This role has no team.',
    ])
  })

  it('is absent for a person with no teams', () => {
    expect(teamReferenceLines('Ann Lee', [], [orion(100)])).toEqual([])
  })

  it('never says "seat" or "allocation"', () => {
    for (const line of teamReferenceLines('Ann', [cygnus()], [])) {
      expect(line).not.toMatch(/\bseats?\b|\ballocations?\b/i)
    }
  })
})

describe('confirmation rule', () => {
  it('a person with teams must confirm, and cannot skip', () => {
    expect(requiresTeamConfirmation([plain(cygnus())])).toBe(true)
    expect(canSkipTeams([plain(cygnus())])).toBe(false)
  })

  it('a person with no teams needs no confirmation, and can skip', () => {
    expect(requiresTeamConfirmation([])).toBe(false)
    expect(canSkipTeams([])).toBe(true)
  })

  it('saving is impossible without confirmation — even when nothing changed', () => {
    const personTeams = [plain(cygnus())]
    expect(
      decideTeamWrite({ personTeams, roleTeams: [], selection: personTeams, confirmedSignature: null }),
    ).toEqual({ kind: 'needs-confirmation' })
  })

  it('a confirmation is tied to the exact selection — editing afterwards needs a fresh one', () => {
    const confirmed = selectionSignature([plain(cygnus(100))])
    expect(isTeamSelectionConfirmed([plain(cygnus(100))], confirmed)).toBe(true)
    expect(isTeamSelectionConfirmed([plain(cygnus(50))], confirmed)).toBe(false)
    expect(isTeamSelectionConfirmed([plain(cygnus(100))], null)).toBe(false)
  })

  it('ignores teamless rows and row order when matching a confirmation', () => {
    const confirmed = selectionSignature([plain(cygnus(50)), plain(pluto(50))])
    expect(
      isTeamSelectionConfirmed([{ teamId: '', split: 0 }, plain(pluto(50)), plain(cygnus(50))], confirmed),
    ).toBe(true)
  })

  it('when the person has no teams, skipping writes nothing', () => {
    expect(
      decideTeamWrite({
        personTeams: [],
        roleTeams: [],
        selection: [{ teamId: '', split: 100 }],
        confirmedSignature: null,
      }),
    ).toEqual({ kind: 'unchanged', teams: [] })
  })
})

describe('validation', () => {
  it('over 100% blocks', () => {
    expect(isTeamTotalAllowed([plain(cygnus(60)), plain(pluto(50))])).toBe(false)
  })

  it('exactly 100% passes', () => {
    expect(isTeamTotalAllowed([plain(cygnus(60)), plain(pluto(40))])).toBe(true)
  })

  it('under 100% passes', () => {
    expect(isTeamTotalAllowed([plain(cygnus(50))])).toBe(true)
  })

  it('counts every row, as the editor\'s running total does', () => {
    expect(isTeamTotalAllowed([{ teamId: '', split: 60 }, plain(cygnus(50))])).toBe(false)
  })
})

describe('emptySelectionWarning', () => {
  it('warns before an empty selection replaces someone\'s teams', () => {
    expect(emptySelectionWarning('Ann Lee', [plain(cygnus())], [{ teamId: '', split: 100 }])).toBe(
      'Ann Lee will have no team this period.',
    )
  })

  it('is silent when something is selected, or the person had no teams', () => {
    expect(emptySelectionWarning('Ann Lee', [plain(cygnus())], [plain(pluto())])).toBeNull()
    expect(emptySelectionWarning('Ann Lee', [], [])).toBeNull()
  })
})

describe('decideTeamWrite', () => {
  it('an empty selection is saved only after the explicit "no team" confirmation', () => {
    const personTeams = [plain(cygnus())]
    const empty = [{ teamId: '', split: 100 }]
    expect(decideTeamWrite({ personTeams, roleTeams: [], selection: empty, confirmedSignature: null })).toEqual({
      kind: 'needs-confirmation',
    })
    expect(
      decideTeamWrite({ personTeams, roleTeams: [], selection: empty, confirmedSignature: selectionSignature(empty) }),
    ).toEqual({ kind: 'write', assignments: [] })
  })

  it('an unchanged, confirmed selection writes nothing', () => {
    const personTeams = [plain(cygnus(50)), plain(pluto(50))]
    const selection = [plain(pluto(50)), plain(cygnus(50))]
    expect(
      decideTeamWrite({
        personTeams,
        roleTeams: [plain(orion())],
        selection,
        confirmedSignature: selectionSignature(selection),
      }),
    ).toEqual({ kind: 'unchanged', teams: [plain(cygnus(50)), plain(pluto(50))] })
  })

  it('a changed, confirmed selection writes exactly the confirmed rows', () => {
    const personTeams = [plain(cygnus(100))]
    const selection = [plain(cygnus(50)), { teamId: '', split: 0 }, plain(orion(50))]
    expect(
      decideTeamWrite({
        personTeams,
        roleTeams: [plain(orion())],
        selection,
        confirmedSignature: selectionSignature(selection),
      }),
    ).toEqual({
      kind: 'write',
      assignments: [
        { teamId: 't-cygnus', capacitySplit: 50 },
        { teamId: 't-orion', capacitySplit: 50 },
      ],
    })
  })

  it('a person with no teams keeping the role\'s teams writes nothing — the assign moves them across', () => {
    const roleTeams = [plain(cygnus())]
    expect(
      decideTeamWrite({ personTeams: [], roleTeams, selection: roleTeams, confirmedSignature: null }),
    ).toEqual({ kind: 'unchanged', teams: roleTeams })
  })

  it('a person with no teams skipping a role\'s teams writes the empty selection, so none are moved across', () => {
    expect(
      decideTeamWrite({
        personTeams: [],
        roleTeams: [plain(cygnus())],
        selection: [{ teamId: '', split: 100 }],
        confirmedSignature: null,
      }),
    ).toEqual({ kind: 'write', assignments: [] })
  })
})

describe('the role\'s own team rows around the assign', () => {
  it('are cleared first only when the person already has teams and the role has some', () => {
    expect(clearsRoleTeamsBeforeAssign([plain(cygnus())], [plain(cygnus())])).toBe(true)
    expect(clearsRoleTeamsBeforeAssign([plain(cygnus())], [])).toBe(false)
    expect(clearsRoleTeamsBeforeAssign([], [plain(cygnus())])).toBe(false)
  })

  it('so a person with teams keeps exactly their own until the confirmed write', () => {
    expect(teamsAfterAssign([plain(cygnus())], [plain(pluto())])).toEqual([plain(cygnus())])
  })

  it('while a person with none receives the role\'s', () => {
    expect(teamsAfterAssign([], [plain(pluto())])).toEqual([plain(pluto())])
  })
})

describe('describeSelection', () => {
  const options = [
    { team_id: 't-cygnus', team_name: 'Cygnus' },
    { team_id: 't-pluto', team_name: 'Pluto' },
  ]

  it('names the rows that will be written, teamless rows dropped', () => {
    expect(describeSelection([plain(pluto(40)), { teamId: '', split: 0 }, plain(cygnus(60))], options)).toBe(
      'Cygnus 60%, Pluto 40%',
    )
  })
})
