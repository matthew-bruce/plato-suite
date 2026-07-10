// Insert-vs-update decision for the Schedule page's inline Applied Blended
// Rate editor.
//
// set_blended_rate is INSERT-only and collides on the (platform_id,
// effective_from) unique index if a live row already exists for that exact
// date. The inline widget always saves at the period's own start date, so
// re-saving a period that already has a rate is a normal "correct it" action,
// not an error — this decides which RPC path that requires.

export interface ExistingCostConfigRow {
  cost_configuration_id: string
  blended_day_rate_override: number | null
  vat_uplift_percent: number
  on_costs_uplift_percent: number
}

export type RateUpsertDecision =
  | { kind: 'insert' }
  | {
      kind: 'update'
      costConfigurationId: string
      oldRatePence: number | null
      vatUpliftPercent: number
      onCostsUpliftPercent: number
    }

/**
 * `existing` is the live cost_configurations row (if any) already at the
 * platform + effective_from the save is targeting. No row → insert, exactly
 * as before. A row already there → update it in place (preserving its VAT /
 * on-costs uplifts, which this editor never touches), never insert.
 */
export function decideRateUpsert(existing: ExistingCostConfigRow | null): RateUpsertDecision {
  if (!existing) return { kind: 'insert' }
  return {
    kind: 'update',
    costConfigurationId: existing.cost_configuration_id,
    oldRatePence: existing.blended_day_rate_override,
    vatUpliftPercent: existing.vat_uplift_percent,
    onCostsUpliftPercent: existing.on_costs_uplift_percent,
  }
}
