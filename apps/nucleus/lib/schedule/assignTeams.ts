// The team decisions the assign wizard makes when a person is put into a
// vacant role.
//
// Team rows belong to the person and the period, not to one schedule row, and
// updateTeamAssignments(resourceId, …) REPLACES all of them. So assigning a
// person who already has teams this period must never assume anything: the
// editor starts from the union of their teams and the role's, the user
// confirms the result explicitly, and only then is anything written. A person
// with no teams simply takes the role's — having no team is fine, and the
// user can still skip.
//
// Splits here are whole percentages (100 = full time), as the editor shows
// them. User-facing text says "role", never "seat" or "allocation".

/** One team on the editor or on a record, split in whole percent. */
export interface TeamSplit {
  teamId: string
  split: number
}

/** A team the wizard can name — for the reference lines. */
export interface NamedTeamSplit extends TeamSplit {
  teamName: string
}

/** The empty editor row: no team chosen, full time. */
const EMPTY_ROW: TeamSplit = { teamId: '', split: 100 }

/** A person with teams this period must have their result confirmed. */
export function requiresTeamConfirmation(personTeams: readonly TeamSplit[]): boolean {
  return personTeams.length > 0
}

/** "Skip team assignment" is an assumption when the person has teams. */
export function canSkipTeams(personTeams: readonly TeamSplit[]): boolean {
  return !requiresTeamConfirmation(personTeams)
}

/**
 * What the Team(s) editor starts with.
 *
 * - Person with teams: their teams (their splits), then any team only the
 *   role has (the role's split). A team on both sides appears once, at the
 *   person's split. The total may exceed 100% — the user then has to decide.
 * - Person with none: the role's teams, else the page's team filter, else one
 *   empty row.
 */
export function resolveAssignTeamPrefill(input: {
  personTeams: readonly TeamSplit[]
  roleTeams: readonly TeamSplit[]
  filterTeamId: string | null
}): TeamSplit[] {
  const { personTeams, roleTeams, filterTeamId } = input
  if (personTeams.length > 0) {
    const personIds = new Set(personTeams.map((t) => t.teamId))
    return [
      ...personTeams.map(({ teamId, split }) => ({ teamId, split })),
      ...roleTeams.filter((t) => !personIds.has(t.teamId)).map(({ teamId, split }) => ({ teamId, split })),
    ]
  }
  if (roleTeams.length > 0) return roleTeams.map(({ teamId, split }) => ({ teamId, split }))
  if (filterTeamId) return [{ teamId: filterTeamId, split: 100 }]
  return [{ ...EMPTY_ROW }]
}

function describeTeams(teams: readonly NamedTeamSplit[]): string {
  return teams.map((t) => `${t.teamName} ${t.split}%`).join(', ')
}

/** "Cygnus 60%, Pluto 40%" for the rows that will be written. */
export function describeSelection(
  selection: readonly TeamSplit[],
  teamOptions: ReadonlyArray<{ team_id: string; team_name: string }>,
): string {
  return describeTeams(
    normaliseSelection(selection).map((r) => ({
      ...r,
      teamName: teamOptions.find((t) => t.team_id === r.teamId)?.team_name ?? 'Unknown team',
    })),
  )
}

/**
 * The plain-language reference shown above the editor — only when the person
 * already has teams this period. Empty otherwise.
 */
export function teamReferenceLines(
  personName: string,
  personTeams: readonly NamedTeamSplit[],
  roleTeams: readonly NamedTeamSplit[],
): string[] {
  if (personTeams.length === 0) return []
  return [
    `${personName} is currently on ${describeTeams(personTeams)} this period.`,
    roleTeams.length > 0
      ? `This role is set to ${describeTeams(roleTeams)}.`
      : 'This role has no team.',
  ]
}

/** The editor's running total, exactly as it displays it (every row counts). */
export function teamTotal(rows: readonly TeamSplit[]): number {
  return rows.reduce((s, r) => s + r.split, 0)
}

/** Over 100% blocks; 100% and under are allowed. */
export function isTeamTotalAllowed(rows: readonly TeamSplit[]): boolean {
  return teamTotal(rows) <= 100
}

/** The rows that will actually be written: teamless rows dropped, in a stable order. */
export function normaliseSelection(rows: readonly TeamSplit[]): TeamSplit[] {
  return rows
    .filter((r) => r.teamId !== '')
    .map(({ teamId, split }) => ({ teamId, split }))
    .sort((a, b) => a.teamId.localeCompare(b.teamId) || a.split - b.split)
}

/** A stable fingerprint of a selection — what a confirmation is tied to. */
export function selectionSignature(rows: readonly TeamSplit[]): string {
  return normaliseSelection(rows)
    .map((r) => `${r.teamId}:${r.split}`)
    .join('|')
}

function sameSelection(a: readonly TeamSplit[], b: readonly TeamSplit[]): boolean {
  return selectionSignature(a) === selectionSignature(b)
}

/**
 * The line shown before confirming an empty selection for someone who has
 * teams — removing all of them has to be a conscious choice.
 */
export function emptySelectionWarning(
  personName: string,
  personTeams: readonly TeamSplit[],
  selection: readonly TeamSplit[],
): string | null {
  if (!requiresTeamConfirmation(personTeams)) return null
  return normaliseSelection(selection).length === 0
    ? `${personName} will have no team this period.`
    : null
}

/**
 * What Edit Teams allows. Any total from 0% to 100% saves — a person can be
 * part-time on teams, or on none at all; only over 100% is blocked. Removing
 * every team from someone who has some carries a plain-language line, shown
 * before they press Save.
 */
export function editTeamsSaveCheck(input: {
  personName: string
  currentTeams: readonly TeamSplit[]
  selection: readonly TeamSplit[]
}): { canSave: boolean; warning: string | null } {
  return {
    canSave: isTeamTotalAllowed(input.selection),
    warning: emptySelectionWarning(input.personName, input.currentTeams, input.selection),
  }
}

/** Is the confirmation the user gave still for the selection on screen? */
export function isTeamSelectionConfirmed(
  selection: readonly TeamSplit[],
  confirmedSignature: string | null,
): boolean {
  return confirmedSignature !== null && confirmedSignature === selectionSignature(selection)
}

/** One row of the assign RPC's p_assignments, split as a percentage. */
export interface AssignTeamPayloadRow {
  teamId: string
  capacitySplit: number
}

export type AssignTeamsPlan =
  /** The person has teams and the selection on screen was not confirmed. */
  | { kind: 'needs-confirmation' }
  /**
   * Ready for the single atomic assign (migration 041).
   *
   * `assignments` is the RPC's p_assignments: `null` lets the role's own
   * teams become the person's (as migration 028 did); an array — possibly
   * empty, meaning "no team" — replaces the person's teams for the period
   * with exactly those rows. `resultingTeams` is what the person holds after.
   */
  | { kind: 'assign'; assignments: AssignTeamPayloadRow[] | null; resultingTeams: TeamSplit[] }

/**
 * Everything the assign wizard sends for an existing person, in one call.
 *
 * - Person with teams this period: the confirmed selection, always — even
 *   when it is empty or unchanged. NULL is never right here, because it would
 *   hand them the role's teams on top of their own. Unconfirmed → no call.
 * - Person with none: NULL when they keep the role's teams as they are, so
 *   the role's rows simply move across. If the user changed them — edited a
 *   split, picked other teams, or skipped — the edited selection is sent, so
 *   the edit lands in the same transaction instead of a second save.
 */
export function planAssignTeams(input: {
  personTeams: readonly TeamSplit[]
  roleTeams: readonly TeamSplit[]
  selection: readonly TeamSplit[]
  confirmedSignature: string | null
}): AssignTeamsPlan {
  const { personTeams, roleTeams, selection, confirmedSignature } = input
  const confirmedRows = normaliseSelection(selection)
  const asPayload = (rows: TeamSplit[]): AssignTeamPayloadRow[] =>
    rows.map((r) => ({ teamId: r.teamId, capacitySplit: r.split }))

  if (requiresTeamConfirmation(personTeams)) {
    if (!isTeamSelectionConfirmed(selection, confirmedSignature)) return { kind: 'needs-confirmation' }
    return { kind: 'assign', assignments: asPayload(confirmedRows), resultingTeams: confirmedRows }
  }
  if (sameSelection(selection, roleTeams)) {
    return { kind: 'assign', assignments: null, resultingTeams: normaliseSelection(roleTeams) }
  }
  return { kind: 'assign', assignments: asPayload(confirmedRows), resultingTeams: confirmedRows }
}
