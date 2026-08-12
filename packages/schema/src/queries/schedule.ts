// Server-side data fetching for the Platform Schedule page (ADR-028).
// All Supabase access goes through the @plato/schema server client (ADR-027).

import { getSupabaseServerComponentClient } from '../serverComponent'
import { computeUnallocatedPct, selectDefaultPeriod } from '../utils/schedule'
import { resolveAppliedCostConfigurationByCode } from './costConfig'
import type {
  SchedulePageData,
  ScheduleAllocation,
  TeamAssignment,
  Period,
  CostConfiguration,
  PlanviewCode,
  ResourceLocation,
  PlatformCostItem,
} from '../types/schedule'

const WEB_PLATFORM_CODE = 'WEB'

type SupplierEmbed = {
  supplier_name: string
  supplier_colour: string | null
  sort_order: number | null
}

type TeamEmbed = {
  team_name: string
}

type RawAllocationRow = {
  allocation_id: string
  resource_id: string | null
  supplier_id: string | null
  role_title: string | null
  planview_code: string | null
  day_rate: number
  utilisation_percent: number | string
  capacity_days: number | string | null
  is_chargeable: boolean
  vat_applies: boolean | null
  is_confirmed: boolean
  display_order: number | null
  resource_location: string | null
  suppliers: SupplierEmbed | SupplierEmbed[] | null
}

type RawResourceRow = {
  resource_id: string
  resource_name: string
  resource_location: string | null
}

type RawMonthlyDaysRow = {
  allocation_id: string
  month_start_date: string
  days: number | string
}

type RawTeamAssignmentRow = {
  resource_id: string
  team_id: string
  capacity_split: number
  teams: TeamEmbed | TeamEmbed[] | null
}

type RawTbcTeamAssignmentRow = {
  allocation_id: string | null
  team_id: string
  capacity_split: number
  teams: TeamEmbed | TeamEmbed[] | null
}

function pickEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

export async function getSchedulePageData(
  periodId?: string,
): Promise<SchedulePageData | null> {
  const supabase = await getSupabaseServerComponentClient()

  const { data: allPeriodsData, error: periodsErr } = await supabase
    .from('periods')
    .select('period_id, period_name, period_status, period_start_date, period_end_date')
    .is('deleted_at', null)
    .order('period_start_date', { ascending: false })

  if (periodsErr) throw new Error(`Failed to load periods: ${periodsErr.message}`)
  const allPeriods = (allPeriodsData ?? []).map((p) => ({
    period_id: p.period_id as string,
    period_name: p.period_name as string,
    period_status: p.period_status as Period['period_status'],
    period_start_date: p.period_start_date as string,
    period_end_date: p.period_end_date as string,
  }))

  // Default to the latest period by end date (see selectDefaultPeriod) rather
  // than the one flagged period_status = 'active' — status lags reality, so a
  // stale 'active' flag on an earlier quarter used to load instead of the
  // genuinely-current one. An explicit ?period= override always wins.
  let activePeriodId = periodId
  if (!activePeriodId) {
    activePeriodId = selectDefaultPeriod(allPeriods)?.period_id
  }
  if (!activePeriodId) return null

  const { data: periodData, error: periodErr } = await supabase
    .from('periods')
    .select('period_id, period_name, period_start_date, period_end_date, period_status, locked')
    .eq('period_id', activePeriodId)
    .is('deleted_at', null)
    .maybeSingle()

  if (periodErr) throw new Error(`Failed to load period: ${periodErr.message}`)
  if (!periodData) return null

  const period: Period = {
    period_id: periodData.period_id as string,
    period_name: periodData.period_name as string,
    period_start_date: periodData.period_start_date as string,
    period_end_date: periodData.period_end_date as string,
    period_status: periodData.period_status as Period['period_status'],
    locked: periodData.locked as boolean,
  }

  // Applied cost config for the Web platform: a locked period reads its frozen
  // snapshot; a draft reads the live effective-dated lookup. Same shape either
  // way, so everything derived from it (Applied Blended Rate, Total Platform
  // Cost, Recovery Variance) is automatically snapshot-correct once locked.
  const costConfig: CostConfiguration | null = await resolveAppliedCostConfigurationByCode(
    WEB_PLATFORM_CODE,
    { period_id: period.period_id, locked: period.locked, period_start_date: period.period_start_date },
  )

  const [allocsResult, costItemsResult, bankHolidaysResult] = await Promise.all([
    supabase
      .from('resource_period_allocations')
      .select(
        `
        allocation_id,
        resource_id,
        supplier_id,
        role_title,
        planview_code,
        day_rate,
        utilisation_percent,
        capacity_days,
        is_chargeable,
        vat_applies,
        is_confirmed,
        display_order,
        resource_location,
        suppliers!left ( supplier_name, supplier_colour, sort_order )
      `,
      )
      .eq('period_id', activePeriodId)
      .is('deleted_at', null),
    supabase
      .from('platform_cost_items')
      .select('cost_item_id, label, amount_pence, vat_applies, sort_order, notes, cost_item_category')
      .eq('period_id', activePeriodId)
      .is('deleted_at', null)
      .order('sort_order'),
    // Bank holidays for every calendar year this period touches. Bounded by
    // the period's own dates rather than fetched wholesale, and read through
    // the same request as everything else so the Populate button has its data
    // without a second client round trip.
    supabase
      .from('uk_bank_holidays')
      .select('holiday_date')
      .gte('holiday_date', `${period.period_start_date.slice(0, 4)}-01-01`)
      .lte('holiday_date', `${period.period_end_date.slice(0, 4)}-12-31`)
      .order('holiday_date'),
  ])

  const { data: allocsData, error: allocsErr } = allocsResult
  if (allocsErr) throw new Error(`Failed to load allocations: ${allocsErr.message}`)
  const { data: costItemsData } = costItemsResult
  const { data: bankHolidaysData } = bankHolidaysResult
  const bankHolidays = ((bankHolidaysData ?? []) as unknown as { holiday_date: string }[])
    .map((h) => h.holiday_date.slice(0, 10))

  // Optional monthly breakdown, keyed allocation_id → { 'YYYY-MM-01': days }.
  // Allocations with no rows simply get an empty object, which is what puts
  // their total in directly-editable manual mode on the client.
  const allocationIds = ((allocsData ?? []) as unknown as RawAllocationRow[]).map(
    (r) => r.allocation_id,
  )
  const monthlyDaysMap = new Map<string, Record<string, number>>()
  if (allocationIds.length > 0) {
    const { data: monthlyData, error: monthlyErr } = await supabase
      .from('resource_period_allocation_monthly_days')
      .select('allocation_id, month_start_date, days')
      .in('allocation_id', allocationIds)

    if (monthlyErr) throw new Error(`Failed to load monthly days: ${monthlyErr.message}`)

    for (const r of (monthlyData ?? []) as unknown as RawMonthlyDaysRow[]) {
      const existing = monthlyDaysMap.get(r.allocation_id) ?? {}
      existing[r.month_start_date.slice(0, 10)] = Number(r.days)
      monthlyDaysMap.set(r.allocation_id, existing)
    }
  }

  // Collect non-null resource IDs for separate lookups (resources + teams).
  // Keeping resource data in a separate query guarantees TBC rows (resource_id=null)
  // are never silently dropped by PostgREST embedding behaviour.
  const resourceIds = ((allocsData ?? []) as unknown as RawAllocationRow[])
    .map((r) => r.resource_id)
    .filter((id): id is string => id !== null)

  // Build resource_id → { resource_name, resource_location } map
  const resourceMap = new Map<string, RawResourceRow>()
  if (resourceIds.length > 0) {
    const { data: resourceData, error: resourceErr } = await supabase
      .from('resources')
      .select('resource_id, resource_name, resource_location')
      .in('resource_id', resourceIds)

    if (resourceErr) throw new Error(`Failed to load resources: ${resourceErr.message}`)

    for (const r of (resourceData ?? []) as unknown as RawResourceRow[]) {
      resourceMap.set(r.resource_id, r)
    }
  }

  const teamMap = new Map<string, TeamAssignment[]>()
  if (resourceIds.length > 0) {
    const { data: teamData, error: teamErr } = await supabase
      .from('resource_team_assignments')
      .select('resource_id, team_id, capacity_split, teams ( team_name )')
      .in('resource_id', resourceIds)
      .eq('period_id', activePeriodId)
      .is('deleted_at', null)

    if (teamErr) throw new Error(`Failed to load team assignments: ${teamErr.message}`)

    for (const r of (teamData ?? []) as unknown as RawTeamAssignmentRow[]) {
      const team = pickEmbed(r.teams)
      if (team?.team_name) {
        const existing = teamMap.get(r.resource_id) ?? []
        existing.push({
          teamId: r.team_id,
          teamName: team.team_name,
          capacitySplit: Number(r.capacity_split),
        })
        teamMap.set(r.resource_id, existing)
      }
    }
  }

  // TBC rows (resource_id IS NULL) key their team assignments on allocation_id
  // instead, since resource_team_assignments.resource_id is NULL for those rows
  // and can't be joined via the resourceIds lookup above.
  const tbcAllocationIds = ((allocsData ?? []) as unknown as RawAllocationRow[])
    .filter((r) => r.resource_id === null)
    .map((r) => r.allocation_id)

  const allocationTeamMap = new Map<string, TeamAssignment[]>()
  if (tbcAllocationIds.length > 0) {
    const { data: tbcTeamData, error: tbcTeamErr } = await supabase
      .from('resource_team_assignments')
      .select('allocation_id, team_id, capacity_split, teams ( team_name )')
      .in('allocation_id', tbcAllocationIds)
      .is('resource_id', null)
      .is('deleted_at', null)

    if (tbcTeamErr) throw new Error(`Failed to load TBC team assignments: ${tbcTeamErr.message}`)

    for (const r of (tbcTeamData ?? []) as unknown as RawTbcTeamAssignmentRow[]) {
      const team = pickEmbed(r.teams)
      if (team?.team_name && r.allocation_id) {
        const existing = allocationTeamMap.get(r.allocation_id) ?? []
        existing.push({
          teamId: r.team_id,
          teamName: team.team_name,
          capacitySplit: Number(r.capacity_split),
        })
        allocationTeamMap.set(r.allocation_id, existing)
      }
    }
  }

  const vatPct = costConfig?.vat_uplift_percent ?? 0
  const allocations: ScheduleAllocation[] = (
    (allocsData ?? []) as unknown as RawAllocationRow[]
  )
    .map((row): ScheduleAllocation => {
      const resource = row.resource_id ? (resourceMap.get(row.resource_id) ?? null) : null
      const supplier = pickEmbed(row.suppliers)
      const utilisation = Number(row.utilisation_percent)
      const capacityDays =
        row.capacity_days === null ? null : Number(row.capacity_days)
      const base =
        capacityDays === null
          ? 0
          : Math.round(row.day_rate * capacityDays * (utilisation / 100))
      const vatApplies = row.vat_applies ?? true
      const vat = vatApplies ? Math.round(base * (1 + vatPct / 100)) : base
      const teams =
        row.resource_id !== null
          ? (teamMap.get(row.resource_id) ?? [])
          : (allocationTeamMap.get(row.allocation_id) ?? [])
      const unallocatedPct = computeUnallocatedPct(teams)
      return {
        allocation_id: row.allocation_id,
        resource_id: row.resource_id,
        resource_name: resource?.resource_name ?? null,
        role_title: row.role_title,
        supplier_id: row.supplier_id,
        supplier_name: supplier?.supplier_name ?? null,
        supplier_colour: supplier?.supplier_colour ?? null,
        supplier_sort_order: supplier?.sort_order ?? null,
        resource_location: ((row.resource_location ?? resource?.resource_location) as
          | ResourceLocation
          | undefined) ?? null,
        planview_code: (row.planview_code ?? null) as PlanviewCode | null,
        day_rate: row.day_rate,
        utilisation_percent: utilisation,
        capacity_days: capacityDays,
        is_chargeable: row.is_chargeable,
        vat_applies: vatApplies,
        is_confirmed: row.is_confirmed,
        monthly_days: monthlyDaysMap.get(row.allocation_id) ?? {},
        teams,
        unallocatedPct,
        base_total_pence: base,
        vat_total_pence: vat,
        display_order: row.display_order,
      }
    })
    .sort((a, b) => {
      const s = (a.supplier_name ?? '').localeCompare(b.supplier_name ?? '')
      if (s !== 0) return s
      // Within a supplier group, honour the persisted manual order
      // (display_order ASC, NULLS LAST), falling back to resource name.
      const ao = a.display_order ?? Number.POSITIVE_INFINITY
      const bo = b.display_order ?? Number.POSITIVE_INFINITY
      if (ao !== bo) return ao - bo
      return (a.resource_name ?? '').localeCompare(b.resource_name ?? '')
    })

  return {
    period,
    costConfig,
    allocations,
    allPeriods,
    costItems: (costItemsData ?? []) as PlatformCostItem[],
    bankHolidays,
  }
}
