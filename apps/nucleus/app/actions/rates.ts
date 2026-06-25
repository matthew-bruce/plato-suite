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

  // Write through the set_blended_rate RPC rather than a direct INSERT.
  // cost_configurations has FORCE ROW LEVEL SECURITY and was deliberately left
  // off the dev-phase open-write policy (migration 018), so the anon role the
  // app uses cannot INSERT into it directly. The RPC is SECURITY DEFINER and
  // owned by a BYPASSRLS role — the single sanctioned write path. It also
  // carries VAT / on-costs forward from the platform's most recent live config,
  // so those uplifts are unchanged; only the blended rate moves.
  const { data, error } = await supabase.rpc('set_blended_rate', {
    p_platform_id: platformId,
    p_effective_from: effectiveFrom,
    p_blended_rate_pence: Math.round(newRatePence),
  })

  if (error) {
    // 23505 = unique_violation — the (platform_id, effective_from) index caught
    // a same-date row. The RPC lets it propagate, so PostgREST surfaces the
    // SQLSTATE here. Surface a real message, do not overwrite.
    if (error.code === '23505') {
      return {
        success: false,
        error: `A rate already exists for this platform effective ${effectiveFrom}. Choose a different effective-from date.`,
      }
    }
    return { success: false, error: error.message }
  }

  // The RPC returns the new cost_configuration_id (uuid) as its scalar result.
  return { success: true, costConfigurationId: (data as string | null) ?? undefined }
}
