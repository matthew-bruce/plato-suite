// Source-wiring tests for the stale-row bug: after an assign the page kept
// resource_id = null on the row, so Edit Teams opened in vacant-seat mode and
// wrote a seat-keyed team row onto a seat that had a person.
//
// The behaviour itself is unit-tested in
// lib/schedule/__tests__/assignRowState.test.ts. There is no DOM-rendering
// setup for these components (see schedulePrivacyMode.test.ts), so these pin
// that the page, the modal and the wizard actually route through it.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const testDir = fileURLToPath(new URL('.', import.meta.url))
const read = (file: string) => readFileSync(new URL(`../${file}`, `file://${testDir}`), 'utf8')

const page = read('SchedulePageClient.tsx')
const modal = read('EditTeamsModal.tsx')
const wizard = read('AddResourceWizard.tsx')

/** The body of a function, from its declaration to the next top-level-ish one. */
function functionBody(text: string, declaration: string, next: string): string {
  const start = text.indexOf(declaration)
  if (start === -1) throw new Error(`Not found: ${declaration}`)
  const end = text.indexOf(next, start + declaration.length)
  if (end === -1) throw new Error(`Not found after ${declaration}: ${next}`)
  return text.slice(start, end)
}

describe('SchedulePageClient keeps the row in step with an assign', () => {
  const assign = functionBody(page, 'function handleAssignSuccess(', 'function handleOpenAssignWizard(')
  const unassign = functionBody(page, 'async function handleUnassignResource(', 'const [editTeamsTarget')

  it('uses the resource id it is given instead of ignoring it', () => {
    expect(assign).not.toContain('_resourceId')
    expect(assign).toContain('applyAssignToRow(a, { resourceId, resourceName, teams })')
  })

  it('treats a switch back to vacant as an unassign', () => {
    expect(assign).toContain('applyUnassignToRow(a, teams)')
  })

  it('re-fetches when the saved teams are not known', () => {
    expect(assign).toContain('if (teams === undefined) router.refresh()')
  })

  it('clears resource_id on unassign, and restores the whole row if it fails', () => {
    expect(unassign).toContain('applyUnassignToRow(a)')
    expect(unassign).toContain('? previous : a')
  })

  it('the row\'s Edit Teams button passes the row\'s own resource_id', () => {
    expect(page).toContain('onEditTeams(row.allocation_id, row.resource_id,')
  })
})

describe('EditTeamsModal picks person or seat mode from the target', () => {
  it('reads and writes through teamEditSeatId, never an inline copy of the rule', () => {
    expect(modal.match(/teamEditSeatId\(target\)/g)).toHaveLength(2)
    expect(modal).not.toContain('target.resourceId ? undefined : target.allocationId')
  })
})

describe('AddResourceWizard reports the teams it saved', () => {
  it('passes them on every assign-mode success — vacant, existing person, new person', () => {
    // Vacant and new person write the editor's rows directly.
    const calls = wizard.match(/teamResult\.success \? savedTeamAssignments\(teamAssignments, teams\) : undefined/g)
    expect(calls).toHaveLength(2)
    // An existing person goes through the confirmed write decision
    // (lib/schedule/assignTeams) — written rows, or the unchanged teams.
    expect(wizard).toContain('teamResult.success ? savedTeamAssignments(decision.assignments, teams) : undefined')
    expect(wizard).toContain('decision.teams.map((t) => ({ teamId: t.teamId, capacitySplit: t.split }))')
  })

  it('checks each team save rather than discarding its result', () => {
    expect(wizard).not.toMatch(/\n\s+await updateTeamAssignments\(/)
  })
})

describe('Edit Teams on a role someone else has just filled', () => {
  const save = functionBody(modal, 'async function handleSave()', 'const overlay')
  const roleFilled = functionBody(page, 'function handleRoleFilled(', 'async function handleConnectedToVacancy(')
  const connected = functionBody(page, 'async function handleConnectedToVacancy(', 'function handleEditTeamsSave(')

  it('detects the case by the action\'s flag (set from the error code), not by message text', () => {
    expect(save).toContain('if (result.roleAlreadyFilled)')
    for (const source of [modal, page, wizard, read('../../app/actions/schedule-wizard.ts')]) {
      expect(source).not.toContain('already has a person assigned')
    }
  })

  it('re-reads just the one role through recoverFromRoleFilled', () => {
    expect(save).toContain('recoverFromRoleFilled(')
    expect(save).toContain('getRoleAssignment(target.allocationId, periodId)')
  })

  it('hands a patched outcome to the page, and shows the fallback message otherwise', () => {
    expect(save).toContain("if (outcome.kind === 'patched')")
    expect(save).toContain('onRoleFilled(target.allocationId, outcome.person, outcome.message)')
    expect(save).toContain('setSubmitError(outcome.message)')
  })

  it('the page patches only that row and reopens the modal on the person, without a re-fetch', () => {
    expect(roleFilled).toContain('patchRow(prev, allocationId, (a) => applyAssignToRow(a, person))')
    expect(roleFilled).toContain('resourceId: person.resourceId')
    expect(roleFilled).toContain('notice: message')
    expect(roleFilled).not.toContain('router.refresh')
  })

  it('the modal shows the notice in its existing message slot', () => {
    expect(modal).toContain('{submitError ?? target.notice}')
  })

  it('"Connect and use vacant seat details" patches the filled role and drops the removed row', () => {
    expect(wizard).toContain('onConnectedToVacancy(assignMode.allocationId, supersededId, form.resourceLocation)')
    expect(connected).toContain('getRoleAssignment(allocationId, period.period_id)')
    expect(connected).toContain('prev.filter((a) => a.allocation_id !== supersededAllocationId)')
    expect(connected).toContain('applyAssignToRow(a, { resourceId, resourceName, teams })')
  })
})
