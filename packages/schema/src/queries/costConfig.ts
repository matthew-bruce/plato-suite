// Server-side effective-dated cost-configuration reads. All callers (the
// Schedule page, the homepage, and the .xlsx "Rate Calculator" export) resolve
// the applicable cost_configurations row through this one function, so the
// effective-dating rule lives in a single place (see utils/costConfig).

import { getSupabaseServerClient } from '../server'
import { pickEffectiveCostConfig } from '../utils/costConfig'
import type { CostConfiguration } from '../types/schedule'

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
  const supabase = getSupabaseServerClient()
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
  const supabase = getSupabaseServerClient()
  const { data: platformRow } = await supabase
    .from('platforms')
    .select('platform_id')
    .eq('platform_code', platformCode)
    .is('deleted_at', null)
    .maybeSingle()

  if (!platformRow?.platform_id) return null
  return resolveCostConfiguration(platformRow.platform_id as string, targetDateISO)
}
