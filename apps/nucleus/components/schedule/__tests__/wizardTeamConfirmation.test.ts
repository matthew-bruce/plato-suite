// Source-wiring tests: the assign wizard never silently keeps, drops or
// overrides an existing person's teams. The rules themselves are unit-tested
// in lib/schedule/__tests__/assignTeams.test.ts; there is no DOM-rendering
// setup for these components (see schedulePrivacyMode.test.ts), so these pin
// that the wizard actually routes through them and through the team editor
// Edit Teams uses.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = fileURLToPath(new URL('.', import.meta.url))
const read = (file: string) => readFileSync(new URL(`../${file}`, `file://${testDir}`), 'utf8')

const wizard = read('AddResourceWizard.tsx')
const editTeams = read('EditTeamsModal.tsx')
const builder = read('TeamAssignmentBuilder.tsx')

function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start)
  if (from === -1) throw new Error(`Not found: ${start}`)
  const to = text.indexOf(end, from + start.length)
  if (to === -1) throw new Error(`Not found after ${start}: ${end}`)
  return text.slice(from, to)
}

describe('one team editor for the wizard and Edit Teams', () => {
  it('the wizard uses the shared TeamAssignmentBuilder and has no copy of its own', () => {
    expect(wizard).toContain("import { TeamAssignmentBuilder } from './TeamAssignmentBuilder'")
    expect(wizard).not.toContain('function TeamBuilder(')
    expect(wizard).not.toContain('<TeamBuilder')
  })

  it('both of the wizard\'s Team(s) fields use it with the up-to-100% rule', () => {
    expect(wizard.match(/<TeamAssignmentBuilder\s+key=\{teamEditorKey\}/g)).toHaveLength(2)
    expect(wizard.match(/totalRule="max"/g)).toHaveLength(2)
  })

  it('Edit Teams still uses it with its existing exact-100% rule', () => {
    expect(editTeams).toContain('<TeamAssignmentBuilder')
    expect(editTeams).not.toContain('totalRule="max"')
  })

  it('the editor flags over 100% under the max rule, and only that', () => {
    expect(builder).toContain("{totalRule === 'max' && total > 100 && (")
    expect(builder).toContain("{totalRule === 'exact' && total !== 100 && (")
  })
})

describe('the wizard goes through lib/schedule/assignTeams', () => {
  const pick = between(wizard, 'async function pickResource(', 'function addAsNew(')
  const existingSubmit = between(wizard, "if (mode === 'existing' && selectedResource) {", "if (mode === 'new') {")

  it('reads the person\'s teams for the period before the Team(s) step opens', () => {
    expect(pick).toContain('getTeamAssignments(r.resource_id, periodId)')
    expect(pick).toContain('resolveAssignTeamPrefill({')
    expect(pick.indexOf('resolveAssignTeamPrefill')).toBeLessThan(pick.indexOf('setStep(2)'))
  })

  it('never assumes "no teams" when that read fails', () => {
    expect(pick).toContain("teams. Please try again.`)")
  })

  it('shows the reference lines from teamReferenceLines', () => {
    expect(wizard).toContain('teamReferenceLines(selectedResource.resource_name, personTeams, roleTeams)')
  })

  it('offers "Skip team assignment" only when the person has no teams', () => {
    expect(wizard).toContain("{(mode !== 'existing' || canSkipTeams(personTeams)) && (")
  })

  it('blocks Next only when the total is over 100%', () => {
    expect(wizard).toContain('const teamsOverLimit = !isTeamTotalAllowed(teamSplits)')
    expect(wizard).not.toMatch(/teamTotal !== 100/)
  })

  it('keeps Assign disabled until the teams are confirmed', () => {
    expect(wizard).toContain('isTeamSelectionConfirmed(teamSplits, confirmedTeamSignature)')
    expect(wizard).toContain('const submitDisabled = isSubmitting || rateChoicePending || teamConfirmPending')
  })

  it('decides the team write before assigning, and stops if it is unconfirmed', () => {
    expect(existingSubmit.indexOf('decideTeamWrite({')).toBeLessThan(
      existingSubmit.indexOf('assignResourceToAllocation('),
    )
    expect(existingSubmit).toContain("if (decision.kind === 'needs-confirmation') {")
  })

  it('writes only a changed, confirmed selection', () => {
    expect(existingSubmit).toContain("if (decision.kind === 'write') {")
    expect(existingSubmit).toContain('decision.assignments,')
    expect(existingSubmit).not.toContain('teamRows')
  })

  it('clears the role\'s own team rows first when the person already has teams, and restores them on failure', () => {
    expect(existingSubmit).toContain('clearsRoleTeamsBeforeAssign(personTeams, roleTeams)')
    expect(existingSubmit.indexOf('updateTeamAssignments(null, periodId, [], allocationId)')).toBeLessThan(
      existingSubmit.indexOf('assignResourceToAllocation('),
    )
    expect(existingSubmit).toContain('roleTeams.map((t) => ({ teamId: t.teamId, capacitySplit: t.split }))')
  })
})
