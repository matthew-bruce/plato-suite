// Server-side data fetching for the Nucleus homepage dashboard (ADR-028).
// This function never throws — all errors return the empty structure.

import { getSupabaseServerComponentClient } from '../serverComponent'
import { resolveAppliedCostConfiguration } from './costConfig'
import type { HomepageData, PeriodSummary, AttentionItem } from '../types/homepage'
import type { PeriodStatus } from '../types/schedule'
import { countHeadcount } from '../utils/headcount'
import { summariseHomepageCost } from '../utils/homepageCost'
import { vatRateMilliPct } from '../utils/money'

const WEB_PLATFORM_CODE = 'WEB'
const INTERNAL_SUPPLIER_NAME = 'Royal Mail Group'

const EMPTY: HomepageData = { periods: [], activePeriod: null, attentionItems: [] }

type RawAllocRow = {
  allocation_id: string
  resource_id: string | null
  planview_code: string | null
  day_rate: number
  utilisation_percent: number | string
  capacity_days: number | string | null
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
    const supabase = await getSupabaseServerComponentClient()

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
        .select('period_id, period_name, period_start_date, period_end_date, period_status, locked')
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

    // Snapshot-aware: a locked period's VAT uplift comes from its frozen
    // snapshot, never the live table, so dashboard cost figures stay fixed once
    // the period is locked.
    let vatPct = 0
    if (platformResult.data?.platform_id) {
      const cc = await resolveAppliedCostConfiguration(
        platformResult.data.platform_id as string,
        {
          period_id: periodRow.period_id as string,
          locked: periodRow.locked as boolean,
          period_start_date: periodRow.period_start_date as string,
        },
      )
      if (cc) vatPct = cc.vat_uplift_percent
    }

    const { data: allocsRaw, error: allocsErr } = await supabase
      .from('resource_period_allocations')
      .select(`
        allocation_id,
        resource_id,
        planview_code,
        day_rate,
        utilisation_percent,
        capacity_days,
        resources:resource_id (
          suppliers:supplier_id ( supplier_name )
        )
      `)
      .eq('period_id', activePeriodId)
      .is('deleted_at', null)

    if (allocsErr) return { ...EMPTY, periods }

    const allocs = (allocsRaw ?? []) as unknown as RawAllocRow[]
    const {
      base_cost_pence,
      vat_cost_pence,
      chargeable_cost_pence,
      missingPlanview,
      missingCapacity,
    } = summariseHomepageCost(
      allocs.map((row) => {
        const resource = pickFirst(row.resources)
        const supplier = resource ? pickFirst(resource.suppliers) : null
        return { ...row, isInternal: supplier?.supplier_name === INTERNAL_SUPPLIER_NAME }
      }),
      vatRateMilliPct(vatPct),
    )

    const activePeriod: PeriodSummary = {
      period_id: periodRow.period_id as string,
      period_name: periodRow.period_name as string,
      period_start_date: periodRow.period_start_date as string,
      period_end_date: periodRow.period_end_date as string,
      period_status: periodRow.period_status as PeriodStatus,
      headcount: countHeadcount(allocs),
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
