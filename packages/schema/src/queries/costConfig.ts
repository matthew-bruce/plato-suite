// Server-side effective-dated cost-configuration reads. All callers (the
// Schedule page, the homepage, and the .xlsx "Rate Calculator" export) resolve
// the applicable cost_configurations row through this one function, so the
// effective-dating rule lives in a single place (see utils/costConfig).

import { getSupabaseServerComponentClient } from '../serverComponent'
import { pickEffectiveCostConfig } from '../utils/costConfig'
import type { CostConfiguration } from '../types/schedule'

export interface AppliedConfigPeriod {
  period_id: string
  locked: boolean
  period_start_date: string
}

const COST_CONFIG_COLUMNS =
  'cost_configuration_id, platform_id, vat_uplift_percent, on_costs_uplift_percent, blended_day_rate_override, effective_from, deleted_at'

type RawCostConfigRow = {
  cost_configuration_id: string
  platform_id: string
  vat_uplift_percent: number | string
  on_costs_uplift_percent: number | string
  blended_day_rate_override: number | null
  effective_from: string
  deleted_at: string | null
}

function toCostConfiguration(row: RawCostConfigRow): CostConfiguration {
  return {
    cost_configuration_id: row.cost_configuration_id,
    platform_id: row.platform_id,
    vat_uplift_percent: Number(row.vat_uplift_percent),
    on_costs_uplift_percent: Number(row.on_costs_uplift_percent),
    blended_day_rate_override:
      row.blended_day_rate_override === null ? null : Number(row.blended_day_rate_override),
    effective_from: row.effective_from,
  }
}

/**
 * Resolve the cost_configurations row in effect for `platformId` on
 * `targetDateISO` (a period's start date). Returns null when no non-deleted row
 * is effective on or before that date — never throws for "no config".
 */
export async function resolveCostConfiguration(
  platformId: string,
  targetDateISO: string,
): Promise<CostConfiguration | null> {
  const supabase = await getSupabaseServerComponentClient()
  const { data, error } = await supabase
    .from('cost_configurations')
    .select(COST_CONFIG_COLUMNS)
    .eq('platform_id', platformId)
    .is('deleted_at', null)

  if (error) throw new Error(`Failed to load cost configurations: ${error.message}`)

  const row = pickEffectiveCostConfig((data ?? []) as unknown as RawCostConfigRow[], targetDateISO)
  return row ? toCostConfiguration(row) : null
}

/**
 * Same as resolveCostConfiguration but resolves the platform by its
 * `platform_code` first (used by surfaces that only know the code, e.g. the
 * schedule .xlsx export which is scoped to the Web platform).
 */
export async function resolveCostConfigurationByCode(
  platformCode: string,
  targetDateISO: string,
): Promise<CostConfiguration | null> {
  const supabase = await getSupabaseServerComponentClient()
  const { data: platformRow } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('platform_code', platformCode)
    .is('deleted_at', null)
    .maybeSingle()

  if (!platformRow?.platform_id) return null
  return resolveCostConfiguration(platformRow.platform_id as string, targetDateISO)
}

type RawSnapshotRow = {
  snapshot_id: string
  source_cost_configuration_id: string | null
  platform_id: string
  vat_uplift_percent: number | string
  on_costs_uplift_percent: number | string
  blended_day_rate_override: number | null
  effective_from: string | null
}

/**
 * Resolve the configuration that *applies* to a period (see pickAppliedCostConfig):
 * a locked period is served from its frozen period_cost_snapshots row and never
 * from the live table; a draft period uses the live effective-dated lookup.
 *
 * Returns null when a locked period has no snapshot for the platform (no rate
 * was configured at lock time) or when no live row is effective for a draft —
 * both read identically as "no rate configured".
 */
export async function resolveAppliedCostConfiguration(
  platformId: string,
  period: AppliedConfigPeriod,
): Promise<CostConfiguration | null> {
  if (!period.locked) {
    return resolveCostConfiguration(platformId, period.period_start_date)
  }

  const supabase = await getSupabaseServerComponentClient()
  const { data, error } = await supabase
    .from('period_cost_snapshots')
    .select(
      'snapshot_id, source_cost_configuration_id, platform_id, vat_uplift_percent, on_costs_uplift_percent, blended_day_rate_override, effective_from',
    )
    .eq('period_id', period.period_id)
    .eq('platform_id', platformId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(`Failed to load period cost snapshot: ${error.message}`)
  if (!data) return null

  const row = data as unknown as RawSnapshotRow
  return {
    // Provenance id where known, else the snapshot's own id — never the live row.
    cost_configuration_id: row.source_cost_configuration_id ?? row.snapshot_id,
    platform_id: row.platform_id,
    vat_uplift_percent: Number(row.vat_uplift_percent),
    on_costs_uplift_percent: Number(row.on_costs_uplift_percent),
    blended_day_rate_override:
      row.blended_day_rate_override === null ? null : Number(row.blended_day_rate_override),
    effective_from: row.effective_from ?? period.period_start_date,
  }
}

/**
 * As resolveAppliedCostConfiguration but resolves the platform by code first
 * (used by the Web-scoped Schedule page).
 */
export async function resolveAppliedCostConfigurationByCode(
  platformCode: string,
  period: AppliedConfigPeriod,
): Promise<CostConfiguration | null> {
  const supabase = await getSupabaseServerComponentClient()
  const { data: platformRow } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('platform_code', platformCode)
    .is('deleted_at', null)
    .maybeSingle()

  if (!platformRow?.platform_id) return null
  return resolveAppliedCostConfiguration(platformRow.platform_id as string, period)
}
