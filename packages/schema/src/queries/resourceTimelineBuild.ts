// Pure assembly of the Resource Timeline dataset from already-fetched rows.
//
// Split out of queries/resourceTimeline.ts so the two engines can be run side
// by side from the same rows: the page (via the Supabase fetch there) and the
// engine diff harness (from a snapshot, no database). Nothing in this file
// touches Supabase.
//
//  - buildLegacyTimeline: the translator path (ADR-035 Phase 1). Engagements →
//    TransitionRecord → deriveSegments/deriveGaps/classifyTransition. Kept
//    callable until the diff report has been reviewed.
//  - buildEngagementTimeline: the native engine (engagementEngine.ts).

import {
  CATEGORY_LABELS,
  NOT_IN_TRANSITION_LABEL,
  classifyTransition,
  deriveGaps,
  deriveSegments,
} from '../lib/resource-timeline/deriveSegments'
import {
  deriveEngagementTimeline,
  type DataIssue,
  type EngineAllocation,
  type EngineEngagement,
} from '../lib/resource-timeline/engagementEngine'
import { engagementsToTransitionRecords } from '../lib/resource-timeline/engagementsToTransitionRecords'
import { resolveTeamsByResource } from '../lib/resource-timeline/resolveTeams'
import { monthStartOf } from '../lib/resource-timeline/workingDays'
import type {
  AllocationInput,
  EngagementRecord,
  SegmentCode,
  TeamAssignmentInput,
  TeamOutput,
} from '../lib/resource-timeline/types'
import type {
  ResourceTimelineData,
  TimelineResource,
  TimelineSupplier,
} from '../types/resourceTimeline'

/**
 * Matthew Bruce is the Platform Head, not a delivery resource, and must never
 * appear on this view (standing rule, confirmed 16 Aug). Excluded at the data
 * level rather than filtered in the UI, so no grouping mode, filter
 * combination or export path can surface him — whichever engine runs.
 */
const EXCLUDED_RESOURCE_NAMES = ['Matthew Bruce']

/* ── Row shapes, exactly as selected by fetchTimelineRows ───────────── */

export type SupplierRow = {
  supplier_id: string
  supplier_name: string
  supplier_abbreviation: string
  supplier_colour: string | null
  sort_order: number | null
}

export type PeriodRow = {
  period_id: string
  period_name: string
  period_start_date: string
  period_end_date: string
}

export type AllocationRow = {
  allocation_id: string
  period_id: string
  resource_id: string | null
  supplier_id: string | null
  planview_code: string | null
  engagement_id: string | null
}

export type MonthlyDaysRow = {
  allocation_id: string
  month_start_date: string
  days: number | string
}

type DisciplineEmbed = { discipline_name: string; sort_order: number | null }

export type ResourceRow = {
  resource_id: string
  resource_name: string
  disciplines: DisciplineEmbed | DisciplineEmbed[] | null
  hidden_from_timeline: boolean
}

export type TeamAssignmentRow = {
  resource_id: string
  period_id: string
  capacity_split: number | string
  teams: { team_name: string } | { team_name: string }[] | null
}

export type EngagementRow = {
  engagement_id: string
  resource_id: string
  supplier_id: string
  roll_on_date: string | null
  roll_off_date: string | null
  /** Read by the legacy translator only. The native engine never reads it. */
  roll_on_estimated: boolean
  /** Read by the legacy translator only. The native engine never reads it. */
  roll_on_tentative: boolean
}

/** Everything both builders need, as fetched for one coarse + granular window. */
export interface RawTimelineRows {
  coarse: PeriodRow
  granular: PeriodRow
  suppliers: SupplierRow[]
  /** Non-deleted allocations with a resource, in either period. */
  allocations: AllocationRow[]
  monthlyDays: MonthlyDaysRow[]
  bankHolidays: string[]
  /** Non-deleted resources for every id in allocations or engagements. */
  resources: ResourceRow[]
  /** Non-deleted team assignments in either period. */
  teamAssignments: TeamAssignmentRow[]
  /** Every non-deleted engagement. */
  engagements: EngagementRow[]
}

/* ── Shared helpers ─────────────────────────────────────────────────── */

/* The label for a resource with no discipline row. Duplicated from the UI's
   own UNASSIGNED_DISCIPLINE rather than imported: @plato/schema is the data
   boundary and must not depend on an app. The two must agree — the UI groups
   on the string this query emits. */
const UNASSIGNED_DISCIPLINE_LABEL = 'Unassigned discipline'

/**
 * The distinct Skillset names present, in the disciplines table's own
 * sort_order — the grouping order for the timeline's Skillset view and the
 * options in its secondary filter.
 *
 * This used to be a plain `.sort()`, which is alphabetical and is not an order
 * anyone chose: it opened the list with "AI / ML Engineering" and "Agile
 * Coaching" and scattered the taxonomy the column exists to express. The
 * column was not even selected by the query, so the data to order by never
 * reached the sort — the same shape of defect as display_order going unread by
 * the schedule exports.
 *
 * Ordered by sort_order with the name as the tiebreak, matching how the
 * supplier list here and the filter chips on Schedule and People already do
 * it. "Unassigned discipline" has no table row and therefore no order, so it
 * sorts last rather than wherever its initial letter would put it.
 *
 * Exported for its own tests: the ordering is the part worth pinning, and it
 * is not reachable through the full query.
 */
export function orderDisciplines(
  resources: readonly { discipline: string | null; disciplineSortOrder: number | null }[],
): string[] {
  const order = new Map<string, number>()
  for (const r of resources) {
    if (r.discipline && !order.has(r.discipline)) {
      order.set(r.discipline, r.disciplineSortOrder ?? Number.POSITIVE_INFINITY)
    }
  }
  return [...new Set(resources.map((r) => r.discipline ?? UNASSIGNED_DISCIPLINE_LABEL))].sort(
    (a, b) => {
      if (a === UNASSIGNED_DISCIPLINE_LABEL) return 1
      if (b === UNASSIGNED_DISCIPLINE_LABEL) return -1
      const oa = order.get(a) ?? Number.POSITIVE_INFINITY
      const ob = order.get(b) ?? Number.POSITIVE_INFINITY
      return oa !== ob ? oa - ob : a.localeCompare(b)
    },
  )
}

function pickEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

/** Two letters, upper case. Neutral avatars — never coloured by supplier. */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Every YYYY-MM-01 from start to end inclusive. */
function monthsBetween(start: string, end: string): string[] {
  const months: string[] = []
  const cursor = new Date(`${start.slice(0, 8)}01T00:00:00Z`)
  const last = new Date(`${end.slice(0, 8)}01T00:00:00Z`)

  while (cursor <= last) {
    months.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return months
}

function abbreviator(rows: RawTimelineRows): (id: string | null) => string | null {
  const supplierById = new Map(rows.suppliers.map((s) => [s.supplier_id, s]))
  return (id) => (id === null ? null : (supplierById.get(id)?.supplier_abbreviation ?? null))
}

function monthlyByAllocation(rows: RawTimelineRows): Map<string, Record<string, number>> {
  // allocation_id → { 'YYYY-MM-01': days }
  const map = new Map<string, Record<string, number>>()
  for (const row of rows.monthlyDays) {
    const existing = map.get(row.allocation_id) ?? {}
    existing[row.month_start_date.slice(0, 10)] = Number(row.days)
    map.set(row.allocation_id, existing)
  }
  return map
}

// Team assignments are period-scoped, and both periods are fetched so a
// resource with no granular-period row yet still gets their last-known
// (coarse-period) team rather than "Unassigned" — see resolveTeamsByResource()
// for how the two periods get collapsed to the one team set shown per person.
function teamsByResource(rows: RawTimelineRows): Map<string, TeamOutput[]> {
  const inputs: TeamAssignmentInput[] = rows.teamAssignments
    .map((row) => {
      const teamName = pickEmbed(row.teams)?.team_name
      return teamName
        ? {
            resourceId: row.resource_id,
            periodId: row.period_id,
            teamName,
            capacitySplit: Number(row.capacity_split),
          }
        : null
    })
    .filter((row): row is TeamAssignmentInput => row !== null)
  return resolveTeamsByResource(inputs, rows.granular.period_id)
}

function includedResources(rows: RawTimelineRows, ids: ReadonlySet<string>): ResourceRow[] {
  return rows.resources.filter(
    (r) => ids.has(r.resource_id) && !EXCLUDED_RESOURCE_NAMES.includes(r.resource_name.trim()),
  )
}

/** Identity, team and discipline fields — identical whichever engine runs. */
function resourceBase(
  row: ResourceRow,
  teams: TeamOutput[],
): Pick<
  TimelineResource,
  'resourceId' | 'name' | 'initials' | 'discipline' | 'disciplineSortOrder' | 'teams' | 'hiddenFromTimeline'
> {
  return {
    resourceId: row.resource_id,
    name: row.resource_name,
    initials: initialsOf(row.resource_name),
    discipline: pickEmbed(row.disciplines)?.discipline_name ?? null,
    disciplineSortOrder: pickEmbed(row.disciplines)?.sort_order ?? null,
    teams: teams.length > 0 ? teams : [{ teamName: 'Unassigned', capacitySplit: 1 }],
    hiddenFromTimeline: row.hidden_from_timeline,
  }
}

function assemble(rows: RawTimelineRows, unsorted: TimelineResource[]): ResourceTimelineData {
  // Drop anyone the data is entirely silent about rather than rendering an
  // empty row — this view is about coverage, and no coverage is not a row.
  const resources = unsorted
    .filter((r) => r.segments.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const suppliers: TimelineSupplier[] = rows.suppliers
    .filter((s) => resources.some((r) => r.segments.some((seg) => seg.supplier === s.supplier_abbreviation)))
    .map((s) => ({
      abbreviation: s.supplier_abbreviation,
      name: s.supplier_name,
      // DB is the source of truth for supplier colour (design system §2).
      colour: s.supplier_colour ?? '#8F9495',
      sortOrder: s.sort_order ?? 0,
    }))

  const teams = [...new Set(resources.flatMap((r) => r.teams.map((t) => t.teamName)))].sort((a, b) =>
    a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b),
  )

  return {
    windowStart: rows.coarse.period_start_date,
    windowEnd: rows.granular.period_end_date,
    months: monthsBetween(monthStartOf(rows.coarse.period_start_date), rows.granular.period_end_date),
    resources,
    suppliers,
    teams,
    disciplines: orderDisciplines(resources),
    coarsePeriodName: rows.coarse.period_name,
    granularPeriodName: rows.granular.period_name,
    granularWindowStart: monthStartOf(rows.granular.period_start_date),
  }
}

/* ── Legacy: translator → deriveSegments ────────────────────────────── */

export function buildLegacyTimeline(rows: RawTimelineRows): ResourceTimelineData | null {
  const { coarse, granular } = rows
  const abbrevOf = abbreviator(rows)

  // The legacy view's population: whoever holds an allocation in either period.
  const allocationResourceIds = new Set(
    rows.allocations.map((a) => a.resource_id).filter((id): id is string => id !== null),
  )
  if (allocationResourceIds.size === 0) return null

  const resourceRows = includedResources(rows, allocationResourceIds)
  const includedIds = new Set(resourceRows.map((r) => r.resource_id))
  const monthly = monthlyByAllocation(rows)
  const teams = teamsByResource(rows)

  // Phase 1 (ADR-035): engagements are translated into the TransitionRecord
  // shape the derivation already consumes, so deriveSegments/deriveGaps and
  // classification run unchanged.
  const engagementInputs: EngagementRecord[] = []
  for (const row of rows.engagements) {
    if (!includedIds.has(row.resource_id)) continue
    const supplier = abbrevOf(row.supplier_id)
    if (!supplier) continue
    engagementInputs.push({
      engagementId: row.engagement_id,
      resourceId: row.resource_id,
      supplier,
      rollOnDate: row.roll_on_date,
      rollOffDate: row.roll_off_date,
      rollOnEstimated: row.roll_on_estimated,
      rollOnTentative: row.roll_on_tentative,
    })
  }
  const transitionByResource = engagementsToTransitionRecords(engagementInputs)

  // resource_id → period_id → allocation inputs
  const allocsByResource = new Map<string, Map<string, AllocationInput[]>>()
  for (const row of rows.allocations) {
    if (row.resource_id === null || !includedIds.has(row.resource_id)) continue
    const supplier = abbrevOf(row.supplier_id)
    if (!supplier) continue

    const byPeriod = allocsByResource.get(row.resource_id) ?? new Map<string, AllocationInput[]>()
    const list = byPeriod.get(row.period_id) ?? []
    list.push({
      supplier,
      // Only hypercare changes how a segment is anchored; every other planview
      // code renders the same way.
      code: (row.planview_code === 'NPC' ? 'NPC' : 'REG') satisfies SegmentCode,
      monthlyDays: monthly.get(row.allocation_id) ?? {},
    })
    byPeriod.set(row.period_id, list)
    allocsByResource.set(row.resource_id, byPeriod)
  }

  const coarseWindow = { start: coarse.period_start_date, end: coarse.period_end_date }
  const granularWindow = { start: granular.period_start_date, end: granular.period_end_date }

  const resources = resourceRows.map((row): TimelineResource => {
    const byPeriod = allocsByResource.get(row.resource_id)
    const transition = transitionByResource.get(row.resource_id) ?? null

    const segments = deriveSegments({
      transition,
      coarseAllocations: byPeriod?.get(coarse.period_id) ?? [],
      granularAllocations: byPeriod?.get(granular.period_id) ?? [],
      coarseWindow,
      granularWindow,
      bankHolidays: rows.bankHolidays,
    })

    const classification = classifyTransition(transition, segments, granularWindow.start)

    return {
      ...resourceBase(row, teams.get(row.resource_id) ?? []),
      status: classification.status,
      category: classification.category,
      categoryLabel: classification.categoryLabel,
      segments,
      // Off the transition record, never off the segments — see deriveGaps.
      gaps: deriveGaps(transition, rows.bankHolidays),
      joiningDate: transition?.joiningDate ?? null,
      notes: transition?.notes ?? null,
    }
  })

  return assemble(rows, resources)
}

/* ── Native: engagementEngine ───────────────────────────────────────── */

export interface EngagementTimelineBuild {
  data: ResourceTimelineData | null
  dataIssues: DataIssue[]
}

export function buildEngagementTimeline(rows: RawTimelineRows): EngagementTimelineBuild {
  const { coarse, granular } = rows
  const abbrevOf = abbreviator(rows)
  const window = { start: coarse.period_start_date, end: granular.period_end_date }

  const engagements: EngineEngagement[] = []
  for (const row of rows.engagements) {
    const supplier = abbrevOf(row.supplier_id)
    if (!supplier) continue
    engagements.push({
      engagementId: row.engagement_id,
      resourceId: row.resource_id,
      supplier,
      rollOnDate: row.roll_on_date,
      rollOffDate: row.roll_off_date,
    })
  }

  const monthly = monthlyByAllocation(rows)
  const allocations: EngineAllocation[] = []
  for (const row of rows.allocations) {
    if (row.resource_id === null) continue
    allocations.push({
      allocationId: row.allocation_id,
      resourceId: row.resource_id,
      engagementId: row.engagement_id,
      periodId: row.period_id,
      code: row.planview_code === 'NPC' ? 'NPC' : 'REG',
      monthlyDays: monthly.get(row.allocation_id) ?? {},
    })
  }

  // Population: anyone holding an allocation in either period, plus anyone
  // on the platform during the window without one (engaged, not scheduled).
  const ids = new Set<string>(allocations.map((a) => a.resourceId))
  for (const e of engagements) {
    if (e.rollOnDate !== null && e.rollOnDate <= window.end && (e.rollOffDate === null || e.rollOffDate >= window.start)) {
      ids.add(e.resourceId)
    }
  }
  if (ids.size === 0) return { data: null, dataIssues: [] }

  const resourceRows = includedResources(rows, ids)
  const includedIds = new Set(resourceRows.map((r) => r.resource_id))

  const { resources: derived, dataIssues } = deriveEngagementTimeline({
    engagements: engagements.filter((e) => includedIds.has(e.resourceId)),
    allocations: allocations.filter((a) => includedIds.has(a.resourceId)),
    periods: [coarse, granular].map((p) => ({
      periodId: p.period_id,
      start: p.period_start_date,
      end: p.period_end_date,
    })),
    window,
    bankHolidays: rows.bankHolidays,
  })

  const teams = teamsByResource(rows)
  const resources = resourceRows.map((row): TimelineResource => {
    const d = derived.get(row.resource_id)
    const category = d?.classification.category ?? null
    return {
      ...resourceBase(row, teams.get(row.resource_id) ?? []),
      status: d?.classification.status ?? 'incumbent',
      category,
      categoryLabel: category === null ? NOT_IN_TRANSITION_LABEL : (CATEGORY_LABELS[category] ?? NOT_IN_TRANSITION_LABEL),
      segments: d?.segments ?? [],
      gaps: d?.gaps ?? [],
      joiningDate: null,
      notes: null,
      windowSuppliers: d?.windowSuppliers ?? [],
    }
  })

  return { data: assemble(rows, resources), dataIssues }
}
