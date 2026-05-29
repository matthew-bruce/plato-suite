// Server-side data fetching for the Platform Schedule page (ADR-028).
// All Supabase access goes through the @plato/schema server client (ADR-027).

import { getSupabaseServerClient } from '../server'
import type {
  SchedulePageData,
  ScheduleAllocation,
  Period,
  CostConfiguration,
  PlanviewCode,
  ResourceLocation,
} from '../types/schedule'

const WEB_PLATFORM_CODE = 'WEB'
const INTERNAL_SUPPLIER_NAME = 'Royal Mail Group'

type ResourceEmbed = {
  resource_name: string
  resource_location: string | null
  suppliers: { supplier_name: string; supplier_colour: string | null } | null
}

type RawAllocationRow = {
  allocation_id: string
  role_title: string | null
  planview_code: string | null
  day_rate: number
  utilisation_percent: number | string
  capacity_days: number | string | null
  is_chargeable: boolean
  resources: ResourceEmbed | ResourceEmbed[] | null
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
    .select('period_id, period_name, period_status, period_start_date')
    .is('deleted_at', null)
    .order('period_start_date', { ascending: false })

  if (periodsErr) throw new Error(`Failed to load periods: ${periodsErr.message}`)
  const allPeriods = (allPeriodsData ?? []).map((p) => ({
    period_id: p.period_id as string,
    period_name: p.period_name as string,
    period_status: p.period_status as Period['period_status'],
  }))

  let activePeriodId = periodId
  if (!activePeriodId) {
    // Default to the most recent non-draft period: active first, else closed.
    // allPeriodsData is already ordered by period_start_date DESC.
    const active = allPeriodsData?.find((p) => p.period_status === 'active')
    const closed = allPeriodsData?.find((p) => p.period_status === 'closed')
    activePeriodId =
      (active?.period_id as string | undefined) ??
      (closed?.period_id as string | undefined) ??
      (allPeriodsData?.[0]?.period_id as string | undefined)
  }
  if (!activePeriodId) return null

  const { data: periodData, error: periodErr } = await supabase
    .from('periods')
    .select('period_id, period_name, period_start_date, period_end_date, period_status')
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

  const { data: allocsData, error: allocsErr } = await supabase
    .from('resource_period_allocations')
    .select(
      `
      allocation_id,
      role_title,
      planview_code,
      day_rate,
      utilisation_percent,
      capacity_days,
      is_chargeable,
      resources:resource_id (
        resource_name,
        resource_location,
        suppliers:supplier_id ( supplier_name, supplier_colour )
      )
    `,
    )
    .eq('period_id', activePeriodId)
    .is('deleted_at', null)

  if (allocsErr) throw new Error(`Failed to load allocations: ${allocsErr.message}`)

  const vatPct = costConfig?.vat_uplift_percent ?? 0
  const allocations: ScheduleAllocation[] = (
    (allocsData ?? []) as unknown as RawAllocationRow[]
  )
    .map((row): ScheduleAllocation => {
      const resource = pickEmbed(row.resources)
      const supplier = pickEmbed(resource?.suppliers)
      const utilisation = Number(row.utilisation_percent)
      const capacityDays =
        row.capacity_days === null ? null : Number(row.capacity_days)
      const base =
        capacityDays === null
          ? 0
          : Math.round(row.day_rate * capacityDays * (utilisation / 100))
      const isInternal = supplier?.supplier_name === INTERNAL_SUPPLIER_NAME
      const vat = isInternal ? base : Math.round(base * (1 + vatPct / 100))
      return {
        allocation_id: row.allocation_id,
        resource_name: resource?.resource_name ?? '',
        role_title: row.role_title,
        supplier_name: supplier?.supplier_name ?? 'Unknown',
        supplier_colour: supplier?.supplier_colour ?? null,
        resource_location: (resource?.resource_location ??
          'offshore') as ResourceLocation,
        planview_code: (row.planview_code ?? null) as PlanviewCode | null,
        day_rate: row.day_rate,
        utilisation_percent: utilisation,
        capacity_days: capacityDays,
        is_chargeable: row.is_chargeable,
        base_total_pence: base,
        vat_total_pence: vat,
      }
    })
    .sort((a, b) => {
      const s = a.supplier_name.localeCompare(b.supplier_name)
      if (s !== 0) return s
      return a.resource_name.localeCompare(b.resource_name)
    })

  return { period, costConfig, allocations, allPeriods }
}
