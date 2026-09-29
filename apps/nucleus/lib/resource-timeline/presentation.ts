// Presentation logic for the Resource Timeline view.
//
// Kept out of the component for the same reason the derivation is: it is
// ordinary logic with edge cases, and the standalone HTML export has to apply
// exactly the same grouping, sorting and filtering rules as the live page.
// One implementation, two renderers.

import type { TimelineResource, TimelineSegment, TransitionStatus } from '@plato/schema'

export type GroupMode = 'team' | 'discipline' | 'category'

export const UNASSIGNED_TEAM = 'Unassigned'
export const UNASSIGNED_DISCIPLINE = 'Unassigned discipline'

/** Everyone in this list is mid-transition in some direction. */
const TRANSITION_STATUSES: readonly TransitionStatus[] = [
  'mover',
  'mover_doj_tbc',
  'joiner',
  'rolledoff',
  'rolledoff_hypercare',
  'overlap_risk',
]

export const STATUS_LABELS: Record<TransitionStatus, { text: string; colour: string }> = {
  mover: { text: 'CG → TCS', colour: 'var(--rmg-color-text-light)' },
  mover_doj_tbc: { text: 'Signed · tentative', colour: 'var(--rmg-color-text-light)' },
  joiner: { text: 'New TCS hire', colour: 'var(--rmg-color-green-contrast)' },
  rolledoff: { text: 'Not moving', colour: 'var(--rmg-color-grey-1)' },
  rolledoff_hypercare: { text: 'Hypercare only', colour: 'var(--rmg-color-grey-1)' },
  overlap_risk: { text: '⚠ Overlap risk', colour: 'var(--rmg-color-red)' },
  incumbent: { text: '', colour: '' },
}

/**
 * Role-taxonomy ordering for Team view: PO/delivery lead → analyst →
 * architect/scrum master → engineers → QA, alphabetical within a tier.
 *
 * Approximates the drag-drop order used on the Nucleus Schedule rather than
 * reading it, because that order is stored per period and this view spans two.
 */
const DISCIPLINE_RANK: Record<string, number> = {
  Leadership: 0,
  'Product Management': 0,
  'Product Strategy': 0,
  'Product Discovery': 0,
  'Delivery Management': 0,
  'Programme & Project Management': 0,
  Analysis: 1,
  'Data & Analytics': 1,
  Architecture: 2,
  'Scrum Master': 2,
  'Agile Coaching': 2,
  'Backend Engineering': 3,
  'Frontend Engineering': 3,
  'Full Stack Engineering': 3,
  'Mobile Engineering': 3,
  'Platform & DevOps': 3,
  'Site Reliability Engineering': 3,
  'Developer Experience': 3,
  'Data Engineering': 3,
  'Data Science': 3,
  'AI / ML Engineering': 3,
  'Cyber Security': 3,
  'UX & Design': 3,
  'Quality Assurance': 4,
}

const UNRANKED_TIER = 5

export function disciplineRank(discipline: string | null): number {
  if (discipline === null) return UNRANKED_TIER
  return DISCIPLINE_RANK[discipline] ?? UNRANKED_TIER
}

/** Role-taxonomy order, then alphabetical within a tier. */
export function sortForTeamView(resources: readonly TimelineResource[]): TimelineResource[] {
  return [...resources].sort((a, b) => {
    const rankDiff = disciplineRank(a.discipline) - disciplineRank(b.discipline)
    if (rankDiff !== 0) return rankDiff
    return a.name.localeCompare(b.name)
  })
}

export function disciplineOf(resource: TimelineResource): string {
  return resource.discipline ?? UNASSIGNED_DISCIPLINE
}

/** Full view shows everyone; Presentation view can hide individual resources. */
export type ViewMode = 'full' | 'presentation'

export interface FilterState {
  groupBy: GroupMode
  activeSuppliers: ReadonlySet<string>
  /** Multi-select, unlike secondaryFilter below — applies in every GROUP BY
   *  mode, not just Team view, matching how the supplier filter already works. */
  activeTeams: ReadonlySet<string>
  /** Skillset name in Team view, team name in Skillset view, '' for none. */
  secondaryFilter: string
  transitionOnly: boolean
  viewMode: ViewMode
  /** Edit mode reveals hidden resources in Presentation view so they can be
   *  reviewed and toggled back — see isResourceVisible. */
  editMode: boolean
}

/**
 * Whether a resource renders at all — decided before, and independent of,
 * every other filter below (supplier, team, skillset, transition-only).
 *
 * Full view ignores hidden_from_timeline entirely; that is the whole point of
 * having a Full view. Presentation view hides a flagged resource UNLESS edit
 * mode is on, in which case it has to stay visible — otherwise there would be
 * no row left to show the show/hide control on, and a resource hidden by
 * mistake could never be found again to un-hide it.
 */
export function isResourceVisible(
  resource: Pick<TimelineResource, 'hiddenFromTimeline'>,
  viewMode: ViewMode,
  editMode: boolean,
): boolean {
  if (viewMode === 'full') return true
  if (editMode) return true
  return !resource.hiddenFromTimeline
}

/**
 * Every filter EXCEPT the visibility rule above — split out so countHidden
 * below can ask "would this resource be showing if it weren't hidden" without
 * duplicating the supplier/team/skillset/transition checks.
 *
 * A resource survives on supplier only if at least one of its segments
 * belongs to an active supplier — filtering by supplier is about coverage, so
 * someone with no visible bars is not a meaningful row. Team filtering
 * follows the same shape: at least one of the resource's own teams must be
 * active.
 */
function passesContentFilters(
  resource: TimelineResource,
  state: Omit<FilterState, 'viewMode' | 'editMode'>,
): boolean {
  if (!resource.segments.some((s) => state.activeSuppliers.has(s.supplier))) return false
  // An empty activeTeams set is reachable via toggleTeamSelection below
  // (isolate a team, then click it off again) and is treated as "no team
  // filter applied" rather than "nothing matches" — the same all-or-nothing
  // convention isResourceVisible uses, so narrowing to zero never blanks
  // the board.
  if (state.activeTeams.size > 0 && !resource.teams.some((t) => state.activeTeams.has(t.teamName)))
    return false

  if (state.groupBy === 'team' && state.secondaryFilter) {
    if (disciplineOf(resource) !== state.secondaryFilter) return false
  }
  if (state.groupBy === 'discipline' && state.secondaryFilter) {
    if (!resource.teams.some((t) => t.teamName === state.secondaryFilter)) return false
  }
  if (state.transitionOnly && !TRANSITION_STATUSES.includes(resource.status)) return false

  return true
}

export function filterResources(
  resources: readonly TimelineResource[],
  state: FilterState,
): TimelineResource[] {
  return resources.filter(
    (resource) =>
      isResourceVisible(resource, state.viewMode, state.editMode) &&
      passesContentFilters(resource, state),
  )
}

/**
 * How many resources Presentation view is currently keeping off the screen —
 * the "N hidden" note next to the view toggle. Zero outside Presentation view
 * (Full view hides nothing) and zero in edit mode (nothing is actually hidden
 * from the screen while reviewing). Counted among resources that already pass
 * every OTHER filter, so the number matches what turning Full view on would
 * actually add back, not the platform-wide hidden count.
 */
export function countHidden(resources: readonly TimelineResource[], state: FilterState): number {
  if (state.viewMode !== 'presentation' || state.editMode) return 0
  return resources.filter((r) => r.hiddenFromTimeline && passesContentFilters(r, state)).length
}

/**
 * Which of the full group-name list should actually render, given the active
 * team filter — Team mode only. A team's group renders iff the team itself is
 * selected, full stop: a resource surviving the (resource-level) team filter
 * because ONE of their teams is active must never cause an unselected team's
 * group to appear just because that resource also happens to belong to it.
 *
 * Kept separate from `groupNames` in the caller (rather than filtering
 * `groupNames` itself) so the "which groups start collapsed" bookkeeping,
 * which intentionally ignores the team filter, is untouched by this.
 *
 * An empty activeTeams set is treated as "all teams" — see
 * toggleTeamSelection — so a selection narrowed all the way to nothing never
 * blanks the board.
 */
export function renderedGroupNames(
  groupNames: readonly string[],
  groupBy: GroupMode,
  activeTeams: ReadonlySet<string>,
): readonly string[] {
  if (groupBy !== 'team') return groupNames
  if (activeTeams.size === 0) return groupNames
  return groupNames.filter((name) => activeTeams.has(name))
}

/**
 * Team-chip click behaviour. Isolates to just the clicked team on the first
 * click away from "all teams" selected — turning "isolate one team" from
 * deselecting every other chip into a single click — then behaves as an
 * ordinary additive/subtractive multi-select once the selection is no longer
 * "all". An empty selection is treated the same as "all" here too (not just
 * in the filters above): clicking a chip while nothing is selected isolates
 * to that one team, the same as clicking from "all" would, rather than
 * leaving the board in whatever state produced the empty set.
 */
export function toggleTeamSelection(
  current: ReadonlySet<string>,
  allTeams: readonly string[],
  clicked: string,
): ReadonlySet<string> {
  if (current.size === 0 || current.size === allTeams.length) {
    return new Set([clicked])
  }
  const next = new Set(current)
  if (next.has(clicked)) next.delete(clicked)
  else next.add(clicked)
  return next
}

export function memberInGroup(
  resource: TimelineResource,
  groupName: string,
  groupBy: GroupMode,
): boolean {
  if (groupBy === 'team') return resource.teams.some((t) => t.teamName === groupName)
  if (groupBy === 'discipline') return disciplineOf(resource) === groupName
  return resource.categoryLabel === groupName
}

export interface TimelineGroup {
  name: string
  displayName: string
  resources: TimelineResource[]
}

/** Build the visible groups, in display order, dropping any that are empty. */
export function buildGroups(
  resources: readonly TimelineResource[],
  groupNames: readonly string[],
  groupBy: GroupMode,
): TimelineGroup[] {
  const groups: TimelineGroup[] = []

  for (const name of groupNames) {
    const members = resources.filter((r) => memberInGroup(r, name, groupBy))
    if (members.length === 0) continue

    groups.push({
      name,
      // "Unassigned" on its own reads as a data gap; these are the F_Gov and
      // overhead roles that genuinely sit outside a delivery team.
      displayName: name === UNASSIGNED_TEAM ? 'Unassigned — F_Gov / Overheads' : name,
      resources: groupBy === 'team' ? sortForTeamView(members) : [...members],
    })
  }
  return groups
}

/* ── Geometry ──────────────────────────────────────────────────────── */

const MS_PER_DAY = 86_400_000

/** Position of a date within the window, as a 0–100 percentage. Clamped. */
export function percentOf(iso: string, windowStart: string, windowEnd: string): number {
  const start = Date.parse(`${windowStart}T00:00:00Z`)
  const end = Date.parse(`${windowEnd}T00:00:00Z`)
  const value = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  const span = (end - start) / MS_PER_DAY
  if (span <= 0) return 0
  const clamped = Math.max(start, Math.min(end, value))
  return ((clamped - start) / MS_PER_DAY / span) * 100
}

/** Minimum bar width so a single-day segment stays visible and hoverable. */
export const MIN_SEGMENT_WIDTH_PCT = 0.6

export function segmentGeometry(
  segment: TimelineSegment,
  windowStart: string,
  windowEnd: string,
): { left: number; width: number } {
  const left = percentOf(segment.start, windowStart, windowEnd)
  const right = percentOf(segment.end, windowStart, windowEnd)
  return { left, width: Math.max(right - left, MIN_SEGMENT_WIDTH_PCT) }
}

/**
 * Percent positions of real calendar week boundaries (Mondays) within the
 * window — a finer scale reference sitting behind the month gridlines, round
 * 7. Deliberately snapped to actual Mondays rather than 7-day slices from
 * windowStart, so a line lands where someone would recognise it as a week
 * boundary rather than an arbitrary offset. Positioned with the same
 * day-accurate percentOf() the segment bars and today-line use (not the
 * month gridlines' equal-per-column flex split), so a week line is a
 * meaningful reference for where a bar actually starts/ends. The boundary
 * Mondays themselves (0%/100%) are excluded — a line sitting on the row's
 * own edge adds nothing.
 */
export function weekLinePositions(windowStart: string, windowEnd: string): number[] {
  const start = Date.parse(`${windowStart}T00:00:00Z`)
  const end = Date.parse(`${windowEnd}T00:00:00Z`)
  if (end <= start) return []

  const startDay = new Date(start).getUTCDay() // 0 (Sun) – 6 (Sat)
  const daysToMonday = (8 - startDay) % 7 // 0 when windowStart is already a Monday
  const firstMonday = start + daysToMonday * MS_PER_DAY

  const positions: number[] = []
  for (let t = firstMonday; t < end; t += 7 * MS_PER_DAY) {
    if (t <= start) continue
    const iso = new Date(t).toISOString().slice(0, 10)
    positions.push(percentOf(iso, windowStart, windowEnd))
  }
  return positions
}

/* ── Labels ────────────────────────────────────────────────────────── */

export function formatShortDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export function formatLongDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

export function formatMonthLabel(monthStart: string): string {
  const date = new Date(`${monthStart.slice(0, 10)}T00:00:00Z`)
  const month = date.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  return `${month} '${String(date.getUTCFullYear()).slice(2)}`
}

export interface QuarterSpan {
  label: string
  /** Month columns (YYYY-MM-01) this quarter covers, in order. */
  months: string[]
}

/**
 * Groups the month header's columns into their quarters, for the row above
 * the month labels. Split on the real granularWindowStart boundary rather
 * than assuming an even 3/3 split, so this stays correct if the two periods
 * are ever different lengths. A quarter with zero months in the current
 * window (shouldn't happen given how the window is built, but the caller
 * shouldn't have to guard against a 0-width cell) is omitted rather than
 * rendered empty.
 */
export function buildQuarterSpans(
  months: readonly string[],
  granularWindowStart: string,
  coarsePeriodName: string,
  granularPeriodName: string,
): QuarterSpan[] {
  const coarseMonths = months.filter((m) => m < granularWindowStart)
  const granularMonths = months.filter((m) => m >= granularWindowStart)

  const spans: QuarterSpan[] = []
  if (coarseMonths.length > 0) spans.push({ label: coarsePeriodName, months: coarseMonths })
  if (granularMonths.length > 0) spans.push({ label: granularPeriodName, months: granularMonths })
  return spans
}

/**
 * Bar label. Dates appear only for boundaries that are real facts — a last
 * working day, a derived commercial start, a hypercare end. The window's own
 * edges are not start or end dates for anybody and printing them there would
 * assert something untrue.
 */
export function segmentLabel(segment: TimelineSegment): { text: string; dates: string } {
  const text = segment.code === 'NPC' ? `${segment.supplier} Hypercare` : segment.supplier

  if (segment.realStart && segment.realEnd) {
    return { text, dates: `${formatShortDate(segment.start)}–${formatShortDate(segment.end)}` }
  }
  if (segment.realStart) return { text, dates: `from ${formatShortDate(segment.start)}` }
  if (segment.realEnd) return { text, dates: `to ${formatShortDate(segment.end)}` }
  return { text, dates: '' }
}

/* ── Supplier colour ───────────────────────────────────────────────── */

/**
 * Tint a supplier's hex colour by appending an alpha channel. Precomputed as
 * 8-digit hex rather than color-mix() so the exported standalone file renders
 * identically wherever it is opened.
 */
function withAlpha(hex: string, alpha: number): string {
  const normalised = hex.trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(normalised)) return normalised
  const byte = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
  return `${normalised}${byte.toString(16).padStart(2, '0')}`
}

/** Bar fill — ~18% per the Gantt bar spec. */
export function supplierTint(hex: string): string {
  return withAlpha(hex, 0.18)
}

/** Hypercare stripe — a touch stronger so the diagonal actually reads. */
export function supplierStripe(hex: string): string {
  return withAlpha(hex, 0.3)
}

export const CG_TCS_FOCUS: readonly string[] = ['CG', 'TCS']

/* ── Avatar colour ─────────────────────────────────────────────────── */

export type AvatarColour =
  | { mode: 'solid'; colour: string }
  | { mode: 'split'; fromColour: string; toColour: string }

const FALLBACK_AVATAR_COLOUR = '#8F9495'

/**
 * Resolve avatar colouring from a resource's own segment history — not from
 * its status field. A resource whose segments touch exactly one supplier
 * gets that colour solid, regardless of status (this is what makes
 * rolledoff_hypercare fall out correctly: CG hypercare doesn't introduce a
 * second supplier, so it never qualifies for a split even though hypercare
 * gets a distinct treatment on the timeline itself — the avatar reflects
 * supplier identity, not segment type).
 *
 * A resource whose segments touch two or more suppliers splits the avatar:
 * left = the supplier of its chronologically first segment ("from"), right =
 * the supplier of its chronologically last segment ("to"). Segments arrive
 * pre-sorted by deriveSegments, so first/last here is genuinely
 * chronological. This generalises to any future supplier pair — nothing here
 * is CG/TCS-specific.
 */
export function resolveAvatarColours(
  resource: TimelineResource,
  supplierColours: ReadonlyMap<string, string>,
): AvatarColour {
  const segments = resource.segments
  if (segments.length === 0) {
    return { mode: 'solid', colour: FALLBACK_AVATAR_COLOUR }
  }

  const fromSupplier = segments[0]!.supplier
  const toSupplier = segments[segments.length - 1]!.supplier

  if (fromSupplier === toSupplier) {
    return {
      mode: 'solid',
      colour: supplierColours.get(fromSupplier) ?? FALLBACK_AVATAR_COLOUR,
    }
  }

  return {
    mode: 'split',
    fromColour: supplierColours.get(fromSupplier) ?? FALLBACK_AVATAR_COLOUR,
    toColour: supplierColours.get(toSupplier) ?? FALLBACK_AVATAR_COLOUR,
  }
}
