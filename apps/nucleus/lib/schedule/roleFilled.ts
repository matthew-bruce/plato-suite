// "This role has just been filled" — what Edit Teams does when someone else
// assigns a person to a vacant role while this page still shows it as vacant.
//
// update_team_assignments refuses to write vacant-role team rows onto a role
// that has a person (migration 040). It raises with a dedicated SQLSTATE, so
// the page recognises the case by that code and never by the message text,
// which is free to be reworded. The page then re-reads that one role, patches
// just that row, and reopens Edit Teams on the person.
//
// User-facing wording says "role", the Schedule's own word for these rows —
// never "seat" or "allocation".

import type { TeamAssignment } from '@plato/schema'
import type { AssignedPerson } from './assignRowState'

/**
 * The SQLSTATE migration 040 raises when update_team_assignments is asked to
 * edit a vacant role that already has a person. Keep in step with the
 * migration.
 */
export const ROLE_ALREADY_FILLED_ERRCODE = 'RFILL'

/** True when a Supabase/PostgREST error is the "role already filled" refusal. */
export function isRoleAlreadyFilledError(
  error: { code?: string | null } | null | undefined,
): boolean {
  return error?.code === ROLE_ALREADY_FILLED_ERRCODE
}

/** Shown when the role was filled and the page has caught up with it. */
export function roleFilledMessage(name: string): string {
  return (
    `${name} has just been assigned to this role, so your changes weren't saved. ` +
    `The page has been updated and you're now viewing ${name}'s teams.`
  )
}

/** Shown when the role was filled but re-reading it failed too. */
export const ROLE_FILLED_FALLBACK_MESSAGE =
  'This role has just been filled by someone else. Reload the page to see the latest.'

/** One role's current person and teams, as getRoleAssignment returns them. */
export interface RoleAssignmentSnapshot {
  resourceId: string | null
  resourceName: string | null
  teams: TeamAssignment[]
}

export type RoleFilledOutcome =
  | { kind: 'patched'; person: AssignedPerson & { teams: TeamAssignment[] }; message: string }
  | { kind: 'failed'; message: string }

/**
 * Re-read the role and decide what to show. Anything short of a named person
 * holding the role — a failed or thrown read, a role that is vacant again, a
 * person with no name to show — falls back to asking for a reload, and the
 * page is left untouched.
 */
export async function recoverFromRoleFilled(
  load: () => Promise<RoleAssignmentSnapshot | null>,
): Promise<RoleFilledOutcome> {
  let snapshot: RoleAssignmentSnapshot | null
  try {
    snapshot = await load()
  } catch {
    snapshot = null
  }
  if (!snapshot?.resourceId || !snapshot.resourceName) {
    return { kind: 'failed', message: ROLE_FILLED_FALLBACK_MESSAGE }
  }
  return {
    kind: 'patched',
    person: {
      resourceId: snapshot.resourceId,
      resourceName: snapshot.resourceName,
      teams: snapshot.teams,
    },
    message: roleFilledMessage(snapshot.resourceName),
  }
}
