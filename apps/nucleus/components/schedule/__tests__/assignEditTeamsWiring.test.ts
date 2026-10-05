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
    const calls = wizard.match(/teamResult\.success \? savedTeamAssignments\(teamAssignments, teams\) : undefined/g)
    expect(calls).toHaveLength(3)
  })

  it('checks each team save rather than discarding its result', () => {
    expect(wizard).not.toMatch(/\n\s+await updateTeamAssignments\(/)
  })
})
