// Server-side data fetching for the Platform Schedule page (ADR-028).
// All Supabase access goes through the @plato/schema server client (ADR-027).

import { getSupabaseServerClient } from '../server'
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
  display_order: number | null
  suppliers: SupplierEmbed | SupplierEmbed[] | null
}

type RawResourceRow = {
  resource_id: string
  resource_name: string
  resource_location: string | null
}

type RawTeamAssignmentRow = {
  resource_id: string
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
  const supabase = getSupabaseServerClient()

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

  let activePeriodId = periodId
  if (!activePeriodId) {
    const active = allPeriodsData?.find((p) => p.period_status === 'active')
    activePeriodId =
      (active?.period_id as string | undefined) ??
      (allPeriodsData?.[0]?.period_id as string | undefined)
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

  const { data: platformRow } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('platform_code', WEB_PLATFORM_CODE)
    .is('deleted_at', null)
    .maybeSingle()

  let costConfig: CostConfiguration | null = null
  if (platformRow?.platform_id) {
    const { data: ccData, error: ccErr } = await supabase
      .from('cost_configurations')
      .select(
        'cost_configuration_id, platform_id, vat_uplift_percent, on_costs_uplift_percent, blended_day_rate_override, effective_from',
      )
      .eq('platform_id', platformRow.platform_id)
      .lte('effective_from', period.period_start_date)
      .is('deleted_at', null)
      .order('effective_from', { ascending: false })
      .limit(1)

    if (ccErr) throw new Error(`Failed to load cost config: ${ccErr.message}`)
    const row = ccData?.[0]
    if (row) {
      costConfig = {
        cost_configuration_id: row.cost_configuration_id as string,
        platform_id: row.platform_id as string,
        vat_uplift_percent: Number(row.vat_uplift_percent),
        on_costs_uplift_percent: Number(row.on_costs_uplift_percent),
        blended_day_rate_override:
          row.blended_day_rate_override === null
            ? null
            : Number(row.blended_day_rate_override),
        effective_from: row.effective_from as string,
      }
    }
  }

  const [allocsResult, costItemsResult] = await Promise.all([
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
        display_order,
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
  ])

  const { data: allocsData, error: allocsErr } = allocsResult
  if (allocsErr) throw new Error(`Failed to load allocations: ${allocsErr.message}`)
  const { data: costItemsData } = costItemsResult

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
      return {
        allocation_id: row.allocation_id,
        resource_id: row.resource_id,
        resource_name: resource?.resource_name ?? null,
        role_title: row.role_title,
        supplier_id: row.supplier_id,
        supplier_name: supplier?.supplier_name ?? null,
        supplier_colour: supplier?.supplier_colour ?? null,
        supplier_sort_order: supplier?.sort_order ?? null,
        resource_location: (resource?.resource_location as ResourceLocation | undefined) ?? null,
        planview_code: (row.planview_code ?? null) as PlanviewCode | null,
        day_rate: row.day_rate,
        utilisation_percent: utilisation,
        capacity_days: capacityDays,
        is_chargeable: row.is_chargeable,
        vat_applies: vatApplies,
        teams: row.resource_id !== null ? (teamMap.get(row.resource_id) ?? []) : ([] as TeamAssignment[]),
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

  return { period, costConfig, allocations, allPeriods, costItems: (costItemsData ?? []) as PlatformCostItem[] }
}
