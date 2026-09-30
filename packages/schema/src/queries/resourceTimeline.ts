// Server-side data fetching for the Resource Timeline view (ADR-028).
// All Supabase access goes through the @plato/schema server client (ADR-027) —
// the page component never touches the SDK.
//
// The query's job is to fetch derivation INPUTS and hand them to a builder
// (queries/resourceTimelineBuild.ts). It deliberately does no date arithmetic
// of its own: every boundary on the rendered timeline comes out of the engine.
//
// Two engines run side by side until the diff report is reviewed (ADR-035):
// 'engagements' (native, the default) and 'legacy' (translator →
// deriveSegments). Both build from the same fetched rows.

import { getSupabaseServerComponentClient } from '../serverComponent'
import {
  buildEngagementTimeline,
  buildLegacyTimeline,
  type AllocationRow,
  type EngagementRow,
  type MonthlyDaysRow,
  type PeriodRow,
  type RawTimelineRows,
  type ResourceRow,
  type SupplierRow,
  type TeamAssignmentRow,
} from './resourceTimelineBuild'
import type { ResourceTimelineData } from '../types/resourceTimeline'

export { orderDisciplines } from './resourceTimelineBuild'

/**
 * The coarse period carries no month-level granularity; the granular one does.
 * Named by period rather than hardcoded dates so rolling the view forward a
 * quarter is a one-line change.
 */
const COARSE_PERIOD_NAME = 'Q2 FY 26/27'
const GRANULAR_PERIOD_NAME = 'Q3 FY 26/27'

export type TimelineEngine = 'engagements' | 'legacy'

/**
 * Which engine the page renders from unless the request asks otherwise
 * (?engine=legacy). The legacy path stays callable for side-by-side checks
 * until Phase 2 removes it.
 */
export const DEFAULT_TIMELINE_ENGINE: TimelineEngine = 'engagements'

/** Fetch every row either builder needs, for the coarse + granular window. */
export async function fetchTimelineRows(): Promise<RawTimelineRows | null> {
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

  const [suppliersResult, allocsResult, bankHolidaysResult, engagementsResult] = await Promise.all([
    supabase
      .from('suppliers')
      .select('supplier_id, supplier_name, supplier_abbreviation, supplier_colour, sort_order')
      .order('sort_order'),
    supabase
      .from('resource_period_allocations')
      .select('allocation_id, period_id, resource_id, supplier_id, planview_code, engagement_id')
      .in('period_id', [coarse.period_id, granular.period_id])
      .not('resource_id', 'is', null)
      .is('deleted_at', null),
    // Bank holidays make December 21 working days rather than 23. Bounded to
    // the calendar years the window touches.
    supabase
      .from('uk_bank_holidays')
      .select('holiday_date')
      .gte('holiday_date', `${coarse.period_start_date.slice(0, 4)}-01-01`)
      .lte('holiday_date', `${granular.period_end_date.slice(0, 4)}-12-31`),
    // Every non-deleted engagement: the native engine also draws people who
    // are on the platform in the window without holding an allocation.
    // roll_on_estimated / roll_on_tentative are read by the legacy translator
    // only.
    supabase
      .from('resource_engagements')
      .select(
        'engagement_id, resource_id, supplier_id, roll_on_date, roll_off_date, roll_on_estimated, roll_on_tentative',
      )
      .is('deleted_at', null),
  ])

  if (suppliersResult.error) {
    throw new Error(`Failed to load suppliers: ${suppliersResult.error.message}`)
  }
  if (allocsResult.error) {
    throw new Error(`Failed to load allocations: ${allocsResult.error.message}`)
  }
  if (engagementsResult.error) {
    throw new Error(`Failed to load engagements: ${engagementsResult.error.message}`)
  }

  const allocations = (allocsResult.data ?? []) as unknown as AllocationRow[]
  const engagements = (engagementsResult.data ?? []) as unknown as EngagementRow[]

  const resourceIds = [
    ...new Set([
      ...allocations.map((a) => a.resource_id).filter((id): id is string => id !== null),
      ...engagements.map((e) => e.resource_id),
    ]),
  ]

  const [resourcesResult, teamsResult, monthlyResult] = await Promise.all([
    supabase
      .from('resources')
      .select(
        'resource_id, resource_name, hidden_from_timeline, disciplines ( discipline_name, sort_order )',
      )
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
        allocations.map((a) => a.allocation_id),
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

  return {
    coarse,
    granular,
    suppliers: (suppliersResult.data ?? []) as unknown as SupplierRow[],
    allocations,
    monthlyDays: (monthlyResult.data ?? []) as unknown as MonthlyDaysRow[],
    bankHolidays: ((bankHolidaysResult.data ?? []) as unknown as { holiday_date: string }[]).map((h) =>
      h.holiday_date.slice(0, 10),
    ),
    resources: (resourcesResult.data ?? []) as unknown as ResourceRow[],
    teamAssignments: (teamsResult.data ?? []) as unknown as TeamAssignmentRow[],
    engagements,
  }
}

export async function getResourceTimelineData(
  engine: TimelineEngine = DEFAULT_TIMELINE_ENGINE,
): Promise<ResourceTimelineData | null> {
  const rows = await fetchTimelineRows()
  if (rows === null) return null
  return engine === 'legacy' ? buildLegacyTimeline(rows) : buildEngagementTimeline(rows).data
}
