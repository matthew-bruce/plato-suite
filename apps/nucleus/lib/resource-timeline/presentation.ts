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

export interface FilterState {
  groupBy: GroupMode
  activeSuppliers: ReadonlySet<string>
  /** Skillset name in Team view, team name in Skillset view, '' for none. */
  secondaryFilter: string
  transitionOnly: boolean
}

/**
 * A resource survives filtering only if at least one of its segments belongs
 * to an active supplier — filtering by supplier is about coverage, so someone
 * with no visible bars is not a meaningful row.
 */
export function filterResources(
  resources: readonly TimelineResource[],
  state: FilterState,
): TimelineResource[] {
  return resources.filter((resource) => {
    if (!resource.segments.some((s) => state.activeSuppliers.has(s.supplier))) return false

    if (state.groupBy === 'team' && state.secondaryFilter) {
      if (disciplineOf(resource) !== state.secondaryFilter) return false
    }
    if (state.groupBy === 'discipline' && state.secondaryFilter) {
      if (!resource.teams.some((t) => t.teamName === state.secondaryFilter)) return false
    }
    if (state.transitionOnly && !TRANSITION_STATUSES.includes(resource.status)) return false

    return true
  })
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
