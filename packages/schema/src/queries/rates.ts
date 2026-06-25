// Server-side data for the standalone Blended Rates page (Nucleus / Finance).
// Scope is rate-setting and history only — no cost-impact analysis (that lives
// on the Schedule page). Reads go through the shared @plato/schema server client.

import { getSupabaseServerClient } from '../server'
import type { PeriodStatus } from '../types/schedule'

export interface RatePlatform {
  platform_id: string
  platform_name: string
  platform_abbreviation: string | null
  platform_code: string
  sort_order: number
}

export interface RateHistoryRow {
  cost_configuration_id: string
  platform_id: string
  effective_from: string
  /** Blended day rate in integer pence, or null when unset. */
  blended_day_rate_override: number | null
  vat_uplift_percent: number
  on_costs_uplift_percent: number
}

export interface RatePeriod {
  period_id: string
  period_name: string
  period_start_date: string
  period_end_date: string
  period_status: PeriodStatus
  locked: boolean
}

export interface RatesPageData {
  platforms: RatePlatform[]
  history: RateHistoryRow[]
  periods: RatePeriod[]
}

export async function getRatesPageData(): Promise<RatesPageData> {
  const supabase = getSupabaseServerClient()

  const [platformsResult, historyResult, periodsResult] = await Promise.all([
    supabase
      .from('platforms')
      .select('platform_id, platform_name, platform_abbreviation, platform_code, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('cost_configurations')
      .select(
        'cost_configuration_id, platform_id, effective_from, blended_day_rate_override, vat_uplift_percent, on_costs_uplift_percent',
      )
      .is('deleted_at', null)
      .order('effective_from', { ascending: true }),
    supabase
      .from('periods')
      .select('period_id, period_name, period_start_date, period_end_date, period_status, locked')
      .is('deleted_at', null)
      .order('period_start_date', { ascending: true }),
  ])

  if (platformsResult.error) throw new Error(`Failed to load platforms: ${platformsResult.error.message}`)
  if (historyResult.error) throw new Error(`Failed to load rate history: ${historyResult.error.message}`)
  if (periodsResult.error) throw new Error(`Failed to load periods: ${periodsResult.error.message}`)

  type RawPlatform = {
    platform_id: string
    platform_name: string
    platform_abbreviation: string | null
    platform_code: string
    sort_order: number
  }
  type RawHistory = {
    cost_configuration_id: string
    platform_id: string
    effective_from: string
    blended_day_rate_override: number | null
    vat_uplift_percent: number | string
    on_costs_uplift_percent: number | string
  }
  type RawPeriod = {
    period_id: string
    period_name: string
    period_start_date: string
    period_end_date: string
    period_status: PeriodStatus
    locked: boolean
  }

  const platforms: RatePlatform[] = ((platformsResult.data ?? []) as unknown as RawPlatform[]).map((p) => ({
    platform_id: p.platform_id,
    platform_name: p.platform_name,
    platform_abbreviation: p.platform_abbreviation,
    platform_code: p.platform_code,
    sort_order: p.sort_order,
  }))

  const history: RateHistoryRow[] = ((historyResult.data ?? []) as unknown as RawHistory[]).map((h) => ({
    cost_configuration_id: h.cost_configuration_id,
    platform_id: h.platform_id,
    effective_from: h.effective_from,
    blended_day_rate_override:
      h.blended_day_rate_override === null ? null : Number(h.blended_day_rate_override),
    vat_uplift_percent: Number(h.vat_uplift_percent),
    on_costs_uplift_percent: Number(h.on_costs_uplift_percent),
  }))

  const periods: RatePeriod[] = ((periodsResult.data ?? []) as unknown as RawPeriod[]).map((p) => ({
    period_id: p.period_id,
    period_name: p.period_name,
    period_start_date: p.period_start_date,
    period_end_date: p.period_end_date,
    period_status: p.period_status,
    locked: p.locked,
  }))

  return { platforms, history, periods }
}
