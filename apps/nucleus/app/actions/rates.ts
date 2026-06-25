'use server'

import { getSupabaseServerClient } from '@plato/schema'

export interface SetBlendedRateResult {
  success: boolean
  error?: string
  costConfigurationId?: string
}

/**
 * Set a new blended day rate for a platform, effective from a given date.
 *
 * INSERT-ONLY: this always creates a new cost_configurations row and never
 * UPDATEs an existing row's blended_day_rate_override — rate history is
 * immutable and versioned by effective_from. VAT and on-costs uplifts are
 * carried forward unchanged from the platform's most recent configuration (this
 * action never alters those).
 *
 * The (platform_id, effective_from) unique index (deleted_at IS NULL) prevents
 * two live rows sharing a date. A collision is surfaced as a clear message
 * rather than a raw constraint error, and never silently overwrites.
 *
 * @param newRatePence new blended day rate in integer pence.
 */
export async function setBlendedRate(
  platformId: string,
  effectiveFrom: string,
  newRatePence: number,
): Promise<SetBlendedRateResult> {
  if (!platformId) return { success: false, error: 'Pick a platform.' }
  if (!effectiveFrom) return { success: false, error: 'Pick an effective-from date.' }
  if (!Number.isFinite(newRatePence) || newRatePence < 0) {
    return { success: false, error: 'Enter a valid rate.' }
  }

  const supabase = getSupabaseServerClient()

  // Carry VAT / on-costs forward from the platform's most recent live config so
  // those uplifts are unchanged — only the blended rate moves.
  const { data: latest } = await supabase
    .from('cost_configurations')
    .select('vat_uplift_percent, on_costs_uplift_percent')
    .eq('platform_id', platformId)
    .is('deleted_at', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()

  const vatUplift = latest?.vat_uplift_percent ?? 0
  const onCostsUplift = latest?.on_costs_uplift_percent ?? 0

  const { data, error } = await supabase
    .from('cost_configurations')
    .insert({
      platform_id: platformId,
      effective_from: effectiveFrom,
      blended_day_rate_override: Math.round(newRatePence),
      vat_uplift_percent: vatUplift,
      on_costs_uplift_percent: onCostsUplift,
    })
    .select('cost_configuration_id')
    .single()

  if (error) {
    // 23505 = unique_violation — the (platform_id, effective_from) index caught
    // a same-date row. Surface a real message, do not overwrite.
    if (error.code === '23505') {
      return {
        success: false,
        error: `A rate already exists for this platform effective ${effectiveFrom}. Choose a different effective-from date.`,
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true, costConfigurationId: data?.cost_configuration_id as string }
}
