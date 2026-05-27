// Server-side data fetching for the Nucleus homepage dashboard (ADR-028).
// This function never throws — all errors return the empty structure.

import { getSupabaseServerClient } from '../server'
import type { HomepageData, PeriodSummary, AttentionItem } from '../types/homepage'
import type { PeriodStatus } from '../types/schedule'

const WEB_PLATFORM_CODE = 'WEB'
const INTERNAL_SUPPLIER_NAME = 'Royal Mail Group'

const EMPTY: HomepageData = { periods: [], activePeriod: null, attentionItems: [] }

type RawAllocRow = {
  allocation_id: string
  planview_code: string | null
  day_rate: number
  utilisation_percent: number | string
  capacity_days: number | string | null
  is_chargeable: boolean
  resources:
    | { suppliers: { supplier_name: string } | { supplier_name: string }[] | null }
    | { suppliers: { supplier_name: string } | { supplier_name: string }[] | null }[]
    | null
}

function pickFirst<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

export async function getHomepageData(periodId?: string): Promise<HomepageData> {
  try {
    const supabase = getSupabaseServerClient()

    const { data: periodsData, error: periodsErr } = await supabase
      .from('periods')
      .select('period_id, period_name, period_status, period_start_date')
      .is('deleted_at', null)
      .order('period_start_date', { ascending: false })

    if (periodsErr || !periodsData) return EMPTY

    const periods = periodsData.map((p) => ({
      period_id: p.period_id as string,
      period_name: p.period_name as string,
      period_status: p.period_status as PeriodStatus,
    }))

    if (periods.length === 0) return EMPTY

    let activePeriodId = periodId
    if (!activePeriodId) {
      const active = periodsData.find((p) => p.period_status === 'active')
      activePeriodId = (active?.period_id ?? periodsData[0]?.period_id) as string | undefined
    }
    if (!activePeriodId) return { ...EMPTY, periods }

    const [periodResult, platformResult] = await Promise.all([
      supabase
        .from('periods')
        .select('period_id, period_name, period_start_date, period_end_date, period_status')
        .eq('period_id', activePeriodId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabase
        .from('platforms')
        .select('platform_id')
        .eq('platform_code', WEB_PLATFORM_CODE)
        .is('deleted_at', null)
        .maybeSingle(),
    ])

    if (periodResult.error || !periodResult.data) return { ...EMPTY, periods }
    const periodRow = periodResult.data

    let vatPct = 0
    if (platformResult.data?.platform_id) {
      const { data: ccData } = await supabase
        .from('cost_configurations')
        .select('vat_uplift_percent')
        .eq('platform_id', platformResult.data.platform_id)
        .lte('effective_from', periodRow.period_start_date as string)
        .is('deleted_at', null)
        .order('effective_from', { ascending: false })
        .limit(1)
      if (ccData?.[0]) vatPct = Number(ccData[0].vat_uplift_percent)
    }

    const { data: allocsRaw, error: allocsErr } = await supabase
      .from('resource_period_allocations')
      .select(`
        allocation_id,
        planview_code,
        day_rate,
        utilisation_percent,
        capacity_days,
        is_chargeable,
        resources:resource_id (
          suppliers:supplier_id ( supplier_name )
        )
      `)
      .eq('period_id', activePeriodId)
      .is('deleted_at', null)

    if (allocsErr) return { ...EMPTY, periods }

    const allocs = (allocsRaw ?? []) as unknown as RawAllocRow[]
    let base_cost_pence = 0
    let vat_cost_pence = 0
    let chargeable_cost_pence = 0
    let missingPlanview = 0
    let missingCapacity = 0

    for (const row of allocs) {
      const utilisation = Number(row.utilisation_percent)
      const capacityDays = row.capacity_days === null ? null : Number(row.capacity_days)

      const resource = pickFirst(row.resources)
      const supplier = resource ? pickFirst(resource.suppliers) : null
      const isInternal = supplier?.supplier_name === INTERNAL_SUPPLIER_NAME

      if (!row.planview_code) missingPlanview++
      if (capacityDays === null) missingCapacity++

      const base =
        capacityDays === null
          ? 0
          : Math.round(row.day_rate * capacityDays * (utilisation / 100))
      const vat = isInternal ? base : Math.round(base * (1 + vatPct / 100))

      base_cost_pence += base
      vat_cost_pence += vat
      if (row.is_chargeable) chargeable_cost_pence += vat
    }

    const activePeriod: PeriodSummary = {
      period_id: periodRow.period_id as string,
      period_name: periodRow.period_name as string,
      period_start_date: periodRow.period_start_date as string,
      period_end_date: periodRow.period_end_date as string,
      period_status: periodRow.period_status as PeriodStatus,
      headcount: allocs.length,
      base_cost_pence,
      vat_cost_pence,
      chargeable_cost_pence,
    }

    const attentionItems: AttentionItem[] = []

    if (missingPlanview > 0) {
      attentionItems.push({
        type: 'missing_planview',
        label: `${missingPlanview} allocation${missingPlanview !== 1 ? 's' : ''} missing Planview code`,
        count: missingPlanview,
        href: '/schedule',
      })
    }

    if (missingCapacity > 0) {
      attentionItems.push({
        type: 'missing_capacity',
        label: `${missingCapacity} allocation${missingCapacity !== 1 ? 's' : ''} with no capacity days set`,
        count: missingCapacity,
        href: '/schedule',
      })
    }

    const draftCount = periods.filter((p) => p.period_status === 'draft').length
    if (draftCount > 0) {
      attentionItems.push({
        type: 'draft_period',
        label: `${draftCount} period${draftCount !== 1 ? 's' : ''} still in draft`,
        count: draftCount,
        href: '/schedule',
      })
    }

    return { periods, activePeriod, attentionItems }
  } catch {
    return EMPTY
  }
}
