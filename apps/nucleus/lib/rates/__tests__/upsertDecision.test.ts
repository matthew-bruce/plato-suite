import { describe, it, expect } from 'vitest'
import { decideRateUpsert } from '../upsertDecision'

describe('decideRateUpsert', () => {
  it('no existing row → insert (unchanged behaviour)', () => {
    expect(decideRateUpsert(null)).toEqual({ kind: 'insert' })
  })

  it('existing row for this platform + effective_from → update, not insert', () => {
    const decision = decideRateUpsert({
      cost_configuration_id: 'cc-1',
      blended_day_rate_override: 55000,
      vat_uplift_percent: 7.082,
      on_costs_uplift_percent: 0,
    })
    expect(decision.kind).toBe('update')
    if (decision.kind === 'update') {
      expect(decision.costConfigurationId).toBe('cc-1')
      expect(decision.oldRatePence).toBe(55000)
      expect(decision.vatUpliftPercent).toBe(7.082)
      expect(decision.onCostsUpliftPercent).toBe(0)
    }
  })

  it('existing row with a null rate is still an update target (not an insert)', () => {
    const decision = decideRateUpsert({
      cost_configuration_id: 'cc-2',
      blended_day_rate_override: null,
      vat_uplift_percent: 0,
      on_costs_uplift_percent: 0,
    })
    expect(decision.kind).toBe('update')
    if (decision.kind === 'update') expect(decision.oldRatePence).toBeNull()
  })
})
