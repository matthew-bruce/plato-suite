import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { TeamAssignment } from '@plato/schema'
import {
  ROLE_ALREADY_FILLED_ERRCODE,
  ROLE_FILLED_FALLBACK_MESSAGE,
  isRoleAlreadyFilledError,
  recoverFromRoleFilled,
  roleFilledMessage,
} from '../roleFilled'

const CYGNUS: TeamAssignment = { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 1 }
const MIGRATION_MESSAGE =
  "This role already has a person assigned. Edit the person's team assignments instead."

describe('isRoleAlreadyFilledError — detection is by code, never by text', () => {
  it('recognises the dedicated SQLSTATE', () => {
    expect(isRoleAlreadyFilledError({ code: ROLE_ALREADY_FILLED_ERRCODE })).toBe(true)
  })

  it('ignores the same wording under any other code', () => {
    const sameWords: { code: string; message: string } = { code: 'P0001', message: MIGRATION_MESSAGE }
    expect(isRoleAlreadyFilledError(sameWords)).toBe(false)
  })

  it('ignores errors with no code, and no error at all', () => {
    expect(isRoleAlreadyFilledError({})).toBe(false)
    expect(isRoleAlreadyFilledError(null)).toBe(false)
    expect(isRoleAlreadyFilledError(undefined)).toBe(false)
  })

  it('uses the same code the migration raises', () => {
    const migration = readFileSync(
      new URL('../../../../../packages/schema/migrations/040_update_team_assignments_seat_guard.sql', import.meta.url),
      'utf8',
    )
    expect(migration).toContain(`errcode = '${ROLE_ALREADY_FILLED_ERRCODE}'`)
  })
})

describe('messages', () => {
  it('names the person twice, as specified', () => {
    expect(roleFilledMessage('Sivaramakrishnan P')).toBe(
      "Sivaramakrishnan P has just been assigned to this role, so your changes weren't saved. " +
        "The page has been updated and you're now viewing Sivaramakrishnan P's teams.",
    )
  })

  it('never says "seat" or "allocation" to the user', () => {
    for (const text of [roleFilledMessage('Ann'), ROLE_FILLED_FALLBACK_MESSAGE, MIGRATION_MESSAGE]) {
      expect(text).not.toMatch(/\bseats?\b|\ballocations?\b/i)
    }
  })
})

describe('recoverFromRoleFilled', () => {
  it('returns the person, their teams and the named message when the role now has a person', async () => {
    const outcome = await recoverFromRoleFilled(async () => ({
      resourceId: 'res-1',
      resourceName: 'Ann Lee',
      teams: [CYGNUS],
    }))
    expect(outcome).toEqual({
      kind: 'patched',
      person: { resourceId: 'res-1', resourceName: 'Ann Lee', teams: [CYGNUS] },
      message: roleFilledMessage('Ann Lee'),
    })
  })

  it('falls back when the re-read throws', async () => {
    const outcome = await recoverFromRoleFilled(async () => {
      throw new Error('network')
    })
    expect(outcome).toEqual({ kind: 'failed', message: ROLE_FILLED_FALLBACK_MESSAGE })
  })

  it('falls back when the re-read returns nothing', async () => {
    expect(await recoverFromRoleFilled(async () => null)).toEqual({
      kind: 'failed',
      message: ROLE_FILLED_FALLBACK_MESSAGE,
    })
  })

  it('falls back when the role turns out to be vacant again', async () => {
    const outcome = await recoverFromRoleFilled(async () => ({ resourceId: null, resourceName: null, teams: [] }))
    expect(outcome.kind).toBe('failed')
  })

  it('falls back rather than show a nameless message', async () => {
    const outcome = await recoverFromRoleFilled(async () => ({ resourceId: 'res-1', resourceName: null, teams: [] }))
    expect(outcome.kind).toBe('failed')
  })
})
