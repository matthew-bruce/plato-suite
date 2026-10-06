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

  it('Edit Teams uses it with the same up-to-100% rule and alert as the wizard', () => {
    expect(editTeams).toContain('<TeamAssignmentBuilder')
    expect(editTeams).toContain('totalRule="max"')
  })

  it('Edit Teams saves 0–100% and warns before removing every team, through editTeamsSaveCheck', () => {
    expect(editTeams).toContain('editTeamsSaveCheck({')
    expect(editTeams).toContain('const saveDisabled = isSubmitting || loading || !saveCheck.canSave')
    expect(editTeams).not.toMatch(/total !== 100/)
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

  it('plans the teams before assigning, and stops if they are unconfirmed', () => {
    expect(existingSubmit.indexOf('planAssignTeams({')).toBeLessThan(
      existingSubmit.indexOf('assignResourceWithTeams('),
    )
    expect(existingSubmit).toContain("if (plan.kind === 'needs-confirmation') {")
  })

  it('assigns the person and sets their teams in ONE call (migration 041)', () => {
    expect(existingSubmit.match(/assignResourceWithTeams\(/g)).toHaveLength(1)
    expect(existingSubmit).toContain('plan.assignments,')
    expect(existingSubmit).not.toContain('teamRows')
  })

  it('the old clear-then-assign-then-restore path is gone', () => {
    expect(existingSubmit).not.toContain('assignResourceToAllocation(')
    expect(existingSubmit).not.toContain('updateTeamAssignments(')
    expect(existingSubmit).not.toContain('clearsRoleTeamsBeforeAssign')
    expect(existingSubmit).not.toContain('restored')
    expect(wizard).not.toContain("the role's teams could not be put back")
  })

  it('a failed call changed nothing, so it shows the error and leaves the wizard open', () => {
    const failure = between(existingSubmit, 'if (!result.success) {', '}')
    expect(failure).toContain('setSubmitError(result.error')
    expect(failure).toContain('return')
    expect(failure).not.toContain('onClose')
  })
})
