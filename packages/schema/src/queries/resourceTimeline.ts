// Server-side data fetching for the Resource Timeline view (ADR-028).
// All Supabase access goes through the @plato/schema server client (ADR-027) —
// the page component never touches the SDK.
//
// The query's job is to assemble derivation INPUTS and hand them to
// lib/resource-timeline. It deliberately does no date arithmetic of its own:
// every boundary on the rendered timeline comes out of deriveSegments so there
// is exactly one place where that logic lives.

import { getSupabaseServerComponentClient } from '../serverComponent'
import {
  classifyTransition,
  deriveGaps,
  deriveSegments,
} from '../lib/resource-timeline/deriveSegments'
import { resolveTeamsByResource } from '../lib/resource-timeline/resolveTeams'
import { monthStartOf } from '../lib/resource-timeline/workingDays'
import type {
  AllocationInput,
  SegmentCode,
  TeamAssignmentInput,
  TransitionRecord,
} from '../lib/resource-timeline/types'
import type {
  ResourceTimelineData,
  TimelineResource,
  TimelineSupplier,
} from '../types/resourceTimeline'

/**
 * The coarse period carries no month-level granularity; the granular one does.
 * Named by period rather than hardcoded dates so rolling the view forward a
 * quarter is a one-line change.
 */
const COARSE_PERIOD_NAME = 'Q2 FY 26/27'
const GRANULAR_PERIOD_NAME = 'Q3 FY 26/27'

/**
 * Matthew Bruce is the Platform Head, not a delivery resource, and must never
 * appear on this view (standing rule, confirmed 16 Aug). Excluded here at the
 * query level rather than filtered in the UI, so no grouping mode, filter
 * combination or export path can surface him.
 */
const EXCLUDED_RESOURCE_NAMES = ['Matthew Bruce']

type SupplierRow = {
  supplier_id: string
  supplier_name: string
  supplier_abbreviation: string
  supplier_colour: string | null
  sort_order: number | null
}

type PeriodRow = {
  period_id: string
  period_name: string
  period_start_date: string
  period_end_date: string
}

type AllocationRow = {
  allocation_id: string
  period_id: string
  resource_id: string | null
  supplier_id: string | null
  planview_code: string | null
}

type MonthlyDaysRow = {
  allocation_id: string
  month_start_date: string
  days: number | string
}

type ResourceRow = {
  resource_id: string
  resource_name: string
  disciplines: { discipline_name: string } | { discipline_name: string }[] | null
}

type TeamAssignmentRow = {
  resource_id: string
  period_id: string
  capacity_split: number | string
  teams: { team_name: string } | { team_name: string }[] | null
}

type TransitionRow = {
  resource_id: string
  from_supplier_id: string | null
  to_supplier_id: string | null
  last_working_day: string | null
  joining_date: string | null
  commercial_start: string | null
  status: string
  notes: string | null
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

export async function getResourceTimelineData(): Promise<ResourceTimelineData | null> {
  const supabase = await getSupabaseServerComponentClient()

  const { data: periodsData, error: periodsErr } = await supabase
    .from('periods')
    .select('period_id, period_name, period_start_date, period_end_date')
    .in('period_name', [COARSE_PERIOD_NAME, GRANULAR_PERIOD_NAME])
    .is('deleted_at', null)

  if (periodsErr) throw new Error(`Failed to load periods: ${periodsErr.message}`)

  const periods = (periodsData ?? []) as unknown as PeriodRow[]
  const coarse = periods.find((p) => p.period_name === COARSE_PERIOD_NAME)
  const granular = periods.find((p) => p.period_name === GRANULAR_PERIOD_NAME)
  if (!coarse || !granular) return null

  const [suppliersResult, allocsResult, transitionsResult, bankHolidaysResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select('supplier_id, supplier_name, supplier_abbreviation, supplier_colour, sort_order')
      .order('sort_order'),
    supabase
      .from('resource_period_allocations')
      .select('allocation_id, period_id, resource_id, supplier_id, planview_code')
      .in('period_id', [coarse.period_id, granular.period_id])
      .not('resource_id', 'is', null)
      .is('deleted_at', null),
    supabase
      .from('resource_supplier_transitions')
      .select(
        'resource_id, from_supplier_id, to_supplier_id, last_working_day, joining_date, commercial_start, status, notes',
      )
      .is('deleted_at', null),
    // Bank holidays make December 21 working days rather than 23. Bounded to
    // the calendar years the window touches.
    supabase
      .from('uk_bank_holidays')
      .select('holiday_date')
      .gte('holiday_date', `${coarse.period_start_date.slice(0, 4)}-01-01`)
      .lte('holiday_date', `${granular.period_end_date.slice(0, 4)}-12-31`),
  ])

  if (suppliersResult.error) {
    throw new Error(`Failed to load suppliers: ${suppliersResult.error.message}`)
  }
  if (allocsResult.error) {
    throw new Error(`Failed to load allocations: ${allocsResult.error.message}`)
  }
  if (transitionsResult.error) {
    throw new Error(`Failed to load transitions: ${transitionsResult.error.message}`)
  }

  const supplierRows = (suppliersResult.data ?? []) as unknown as SupplierRow[]
  const allocRows = (allocsResult.data ?? []) as unknown as AllocationRow[]
  const transitionRows = (transitionsResult.data ?? []) as unknown as TransitionRow[]
  const bankHolidays = ((bankHolidaysResult.data ?? []) as unknown as { holiday_date: string }[]).map(
    (h) => h.holiday_date.slice(0, 10),
  )

  const supplierById = new Map(supplierRows.map((s) => [s.supplier_id, s]))
  const abbrevOf = (id: string | null): string | null =>
    id === null ? null : (supplierById.get(id)?.supplier_abbreviation ?? null)

  const resourceIds = [...new Set(allocRows.map((a) => a.resource_id).filter((id): id is string => id !== null))]
  if (resourceIds.length === 0) return null

  const [resourcesResult, teamsResult, monthlyResult] = await Promise.all([
    supabase
      .from('resources')
      .select('resource_id, resource_name, disciplines ( discipline_name )')
      .in('resource_id', resourceIds)
      .is('deleted_at', null),
    supabase
      .from('resource_team_assignments')
      .select('resource_id, period_id, capacity_split, teams ( team_name )')
      .in('resource_id', resourceIds)
      .in('period_id', [coarse.period_id, granular.period_id])
      .is('deleted_at', null),
    supabase
      .from('resource_period_allocation_monthly_days')
      .select('allocation_id, month_start_date, days')
      .in(
        'allocation_id',
        allocRows.map((a) => a.allocation_id),
      ),
  ])

  if (resourcesResult.error) {
    throw new Error(`Failed to load resources: ${resourcesResult.error.message}`)
  }
  if (teamsResult.error) {
    throw new Error(`Failed to load team assignments: ${teamsResult.error.message}`)
  }
  if (monthlyResult.error) {
    throw new Error(`Failed to load monthly days: ${monthlyResult.error.message}`)
  }

  const resourceRows = ((resourcesResult.data ?? []) as unknown as ResourceRow[]).filter(
    (r) => !EXCLUDED_RESOURCE_NAMES.includes(r.resource_name.trim()),
  )
  const includedIds = new Set(resourceRows.map((r) => r.resource_id))

  // allocation_id → { 'YYYY-MM-01': days }
  const monthlyByAllocation = new Map<string, Record<string, number>>()
  for (const row of (monthlyResult.data ?? []) as unknown as MonthlyDaysRow[]) {
    const existing = monthlyByAllocation.get(row.allocation_id) ?? {}
    existing[row.month_start_date.slice(0, 10)] = Number(row.days)
    monthlyByAllocation.set(row.allocation_id, existing)
  }

  // Team assignments are period-scoped, and the query below fetches both
  // periods so a resource with no granular-period row yet still gets their
  // last-known (coarse-period) team rather than "Unassigned" — see
  // resolveTeamsByResource() for how the two periods get collapsed to the
  // one team set the timeline shows per person.
  const teamAssignmentInputs: TeamAssignmentInput[] = ((teamsResult.data ?? []) as unknown as TeamAssignmentRow[])
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
  const teamsByResource = resolveTeamsByResource(teamAssignmentInputs, granular.period_id)

  const transitionByResource = new Map<string, TransitionRecord>()
  for (const row of transitionRows) {
    if (!includedIds.has(row.resource_id)) continue
    transitionByResource.set(row.resource_id, {
      fromSupplier: abbrevOf(row.from_supplier_id),
      toSupplier: abbrevOf(row.to_supplier_id),
      lastWorkingDay: row.last_working_day,
      joiningDate: row.joining_date,
      commercialStart: row.commercial_start,
      status: row.status,
      notes: row.notes,
    })
  }

  // resource_id → period_id → allocation inputs
  const allocsByResource = new Map<string, Map<string, AllocationInput[]>>()
  for (const row of allocRows) {
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
      monthlyDays: monthlyByAllocation.get(row.allocation_id) ?? {},
    })
    byPeriod.set(row.period_id, list)
    allocsByResource.set(row.resource_id, byPeriod)
  }

  const coarseWindow = { start: coarse.period_start_date, end: coarse.period_end_date }
  const granularWindow = { start: granular.period_start_date, end: granular.period_end_date }

  const resources: TimelineResource[] = resourceRows
    .map((row): TimelineResource => {
      const byPeriod = allocsByResource.get(row.resource_id)
      const transition = transitionByResource.get(row.resource_id) ?? null

      const segments = deriveSegments({
        transition,
        coarseAllocations: byPeriod?.get(coarse.period_id) ?? [],
        granularAllocations: byPeriod?.get(granular.period_id) ?? [],
        coarseWindow,
        granularWindow,
        bankHolidays,
      })

      const classification = classifyTransition(transition, segments, granularWindow.start)
      const teams = teamsByResource.get(row.resource_id) ?? []

      return {
        resourceId: row.resource_id,
        name: row.resource_name,
        initials: initialsOf(row.resource_name),
        discipline: pickEmbed(row.disciplines)?.discipline_name ?? null,
        teams: teams.length > 0 ? teams : [{ teamName: 'Unassigned', capacitySplit: 1 }],
        status: classification.status,
        category: classification.category,
        categoryLabel: classification.categoryLabel,
        segments,
        gaps: deriveGaps(segments, bankHolidays),
        joiningDate: transition?.joiningDate ?? null,
        notes: transition?.notes ?? null,
      }
    })
    // Drop anyone the data is entirely silent about rather than rendering an
    // empty row — this view is about coverage, and no coverage is not a row.
    .filter((r) => r.segments.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const suppliers: TimelineSupplier[] = supplierRows
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
  const disciplines = [
    ...new Set(resources.map((r) => r.discipline ?? 'Unassigned discipline')),
  ].sort()

  return {
    windowStart: coarseWindow.start,
    windowEnd: granularWindow.end,
    months: monthsBetween(monthStartOf(coarseWindow.start), granularWindow.end),
    resources,
    suppliers,
    teams,
    disciplines,
    coarsePeriodName: coarse.period_name,
    granularPeriodName: granular.period_name,
    granularWindowStart: monthStartOf(granularWindow.start),
  }
}
