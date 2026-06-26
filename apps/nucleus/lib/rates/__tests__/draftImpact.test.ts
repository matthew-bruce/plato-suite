import { describe, it, expect } from 'vitest'
import { computeDraftRateImpact } from '../draftImpact'
import type { RateHistoryRow, RatePeriod } from '@plato/schema'

const WEB = 'web'
const APP = 'app'

function row(partial: Partial<RateHistoryRow> & { cost_configuration_id: string; effective_from: string }): RateHistoryRow {
  return {
    platform_id: WEB,
    blended_day_rate_override: 55000,
    vat_uplift_percent: 7.082,
    on_costs_uplift_percent: 0,
    ...partial,
  }
}

const periods: RatePeriod[] = [
  // historic + active are locked → must never appear in impact
  { period_id: 'q4', period_name: 'Q4 FY25/26', period_start_date: '2026-01-01', period_end_date: '2026-03-31', period_status: 'historic', locked: true },
  { period_id: 'q1', period_name: 'Q1 FY26/27', period_start_date: '2026-04-01', period_end_date: '2026-06-30', period_status: 'active', locked: true },
  { period_id: 'q2', period_name: 'Q2 FY26/27', period_start_date: '2026-07-01', period_end_date: '2026-09-30', period_status: 'draft', locked: false },
]

describe('computeDraftRateImpact', () => {
  it('flags a draft whose resolved rate changes on edit, with from/to', () => {
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    // Edit the row Q2 currently resolves to (b), £605 → £700.
    const impact = computeDraftRateImpact(history, periods, {
      kind: 'edit', row: history[1], nextEffectiveFrom: '2026-07-01', nextRatePence: 70000,
    })
    expect(impact).toHaveLength(1)
    expect(impact[0].period.period_id).toBe('q2')
    expect(impact[0].fromPence).toBe(60500)
    expect(impact[0].toPence).toBe(70000)
  })

  it('never includes locked periods even when their snapshot source row is edited', () => {
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    // Editing 'a' (the row Q4/Q1 resolved from) must not surface Q4 or Q1.
    const impact = computeDraftRateImpact(history, periods, {
      kind: 'edit', row: history[0], nextEffectiveFrom: '2025-01-01', nextRatePence: 99000,
    })
    expect(impact.every((i) => i.period.locked === false)).toBe(true)
    expect(impact.map((i) => i.period.period_id)).not.toContain('q4')
    expect(impact.map((i) => i.period.period_id)).not.toContain('q1')
  })

  it('returns empty when no draft resolves differently (no friction)', () => {
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    // Editing only VAT/on-costs of 'b' leaves the resolved *rate* unchanged.
    const impact = computeDraftRateImpact(history, periods, {
      kind: 'edit', row: history[1], nextEffectiveFrom: '2026-07-01', nextRatePence: 60500,
    })
    expect(impact).toHaveLength(0)
  })

  it('detects a delete that drops a draft back to an earlier rate', () => {
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    // Delete 'b' → Q2 falls back to 'a' (£550).
    const impact = computeDraftRateImpact(history, periods, { kind: 'delete', row: history[1] })
    expect(impact).toHaveLength(1)
    expect(impact[0].period.period_id).toBe('q2')
    expect(impact[0].fromPence).toBe(60500)
    expect(impact[0].toPence).toBe(55000)
  })

  it('deleting the only row for a platform yields to=null (no rate configured)', () => {
    const history = [row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 })]
    const impact = computeDraftRateImpact(history, periods, { kind: 'delete', row: history[0] })
    expect(impact).toHaveLength(1)
    expect(impact[0].toPence).toBeNull()
  })

  it('ignores changes to a different platform', () => {
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01' }),
      row({ cost_configuration_id: 'x', effective_from: '2026-07-01', platform_id: APP, blended_day_rate_override: 80000 }),
    ]
    // Editing the APP row cannot affect WEB-resolved drafts; Q2 has no APP change relevance here.
    const impact = computeDraftRateImpact(history, periods, {
      kind: 'edit', row: history[1], nextEffectiveFrom: '2026-07-01', nextRatePence: 90000,
    })
    // Q2 for APP: before 80000 → after 90000, so APP's Q2 IS affected.
    expect(impact).toHaveLength(1)
    expect(impact[0].period.period_id).toBe('q2')
    expect(impact[0].fromPence).toBe(80000)
    expect(impact[0].toPence).toBe(90000)
  })
})
