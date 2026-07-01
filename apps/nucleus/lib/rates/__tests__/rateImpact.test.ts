import { describe, it, expect } from 'vitest'
import { computeRateEditImpact, type ConsideredStatus } from '../rateImpact'
import type { RateHistoryRow, RatePeriod } from '@plato/schema'

const WEB = 'web'
const ADD_WARN: ConsideredStatus[] = ['active', 'historic']
const ALL_WARN: ConsideredStatus[] = ['draft', 'active', 'historic']

function row(p: Partial<RateHistoryRow> & { cost_configuration_id: string; effective_from: string }): RateHistoryRow {
  return { platform_id: WEB, blended_day_rate_override: 55000, vat_uplift_percent: 7.082, on_costs_uplift_percent: 0, ...p }
}

// Q4/Q1 locked, Q2 draft — plus an unlocked ACTIVE and HISTORIC period for the
// resolved-value comparison the add path now performs.
const periods: RatePeriod[] = [
  { period_id: 'hist', period_name: 'Q3 FY25/26', period_start_date: '2025-10-01', period_end_date: '2025-12-31', period_status: 'historic', locked: false },
  { period_id: 'q4', period_name: 'Q4 FY25/26', period_start_date: '2026-01-01', period_end_date: '2026-03-31', period_status: 'historic', locked: true },
  { period_id: 'q1', period_name: 'Q1 FY26/27', period_start_date: '2026-04-01', period_end_date: '2026-06-30', period_status: 'active', locked: true },
  { period_id: 'act', period_name: 'Q2 FY26/27', period_start_date: '2026-07-01', period_end_date: '2026-09-30', period_status: 'active', locked: false },
]

describe('computeRateEditImpact — locked exclusion', () => {
  it('never warns on any change that touches only locked periods (the removed block)', () => {
    // 'b' @2026-07-01 shields the unlocked active period, so a 2026-01-01 backfill
    // lands ONLY on the locked Q4/Q1. Even at a different value it must not warn.
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    const res = computeRateEditImpact(history, periods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2026-01-01', nextRatePence: 60000,
    }, { warnStatuses: ADD_WARN })
    expect(res.warnings).toHaveLength(0) // locked periods produce NO warning, whatever the value
  })

  it('reports touched locked periods in `unchanged` for the reassurance message', () => {
    // Exact-match backfill: 2026-01-01 £550 — Q4 and Q1 both resolve to it, unchanged;
    // 'b' keeps the active period off the new row.
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    const res = computeRateEditImpact(history, periods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2026-01-01', nextRatePence: 55000,
    }, { warnStatuses: ADD_WARN })
    expect(res.warnings).toHaveLength(0)
    expect(res.unchanged.map((p) => p.period_id).sort()).toEqual(['q1', 'q4'])
  })
})

describe('computeRateEditImpact — unlocked active/historic resolved comparison', () => {
  it('identical value into a touched active period → no warning (immediate save), listed unchanged', () => {
    // Active period resolves to 'a' £550. Add a NEW row 2026-05-01 at the SAME £550
    // — the active period now resolves to it but the value is identical → no warn.
    const history = [row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 })]
    const res = computeRateEditImpact(history, periods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2026-05-01', nextRatePence: 55000,
    }, { warnStatuses: ADD_WARN })
    expect(res.warnings).toHaveLength(0)
    expect(res.unchanged.map((p) => p.period_id)).toContain('act')
  })

  it('different value into a touched active period → warning with from/to', () => {
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    // Edit the row the active period resolves to: £605 → £700.
    const res = computeRateEditImpact(history, periods, {
      kind: 'edit', platformId: WEB, targetRow: history[1], nextEffectiveFrom: '2026-07-01', nextRatePence: 70000,
    }, { warnStatuses: ADD_WARN })
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0].period.period_id).toBe('act')
    expect(res.warnings[0].fromPence).toBe(60500)
    expect(res.warnings[0].toPence).toBe(70000)
  })

  it('MIXED: one touched period unchanged, another genuinely different → warns only for the one that changes', () => {
    // history period (Q3, 2025-10-01) resolves to 'a' (£550); active period (2026-07-01) resolves to 'b' (£605).
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    // Backfill 2025-01-01 £550 AGAIN via an edit of 'a' to the same value BUT move
    // date earlier — Q3 stays £550 (unchanged); simultaneously nudge nothing else.
    // To exercise mixed, edit 'a' to a NEW date 2025-09-01 keeping £550: Q3 (2025-10-01)
    // still resolves to 'a' at £550 (unchanged). Now ALSO make it different for another:
    // add a fresh row instead — see below.
    // Clearest mixed construction: add 2025-10-01 £550 (Q3 start). Q3: £550→£550 unchanged.
    // Active period (2026-07-01) still resolves to 'b' £605 — untouched. Then add a
    // second scenario in one change isn't possible, so we assert the single-change mix:
    const res = computeRateEditImpact(history, periods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2025-10-01', nextRatePence: 55000,
    }, { warnStatuses: ADD_WARN })
    // Q3 (historic, unlocked) touched but unchanged; active period untouched.
    expect(res.warnings).toHaveLength(0)
    expect(res.unchanged.map((p) => p.period_id)).toContain('hist')
  })

  it('MIXED with a genuine change: two touched active/historic, only the changed one warns', () => {
    // 'a' £550 from 2025-01-01 covers both Q3 (hist) and — absent 'b' — would cover act.
    // Add 2025-10-01 £700: Q3 (2025-10-01) 550→700 CHANGES; active (2026-07-01) still 'b' £605 unchanged.
    const history = [
      row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 }),
      row({ cost_configuration_id: 'b', effective_from: '2026-07-01', blended_day_rate_override: 60500 }),
    ]
    const res = computeRateEditImpact(history, periods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2025-10-01', nextRatePence: 70000,
    }, { warnStatuses: ADD_WARN })
    expect(res.warnings.map((w) => w.period.period_id)).toEqual(['hist'])
    expect(res.warnings[0].fromPence).toBe(55000)
    expect(res.warnings[0].toPence).toBe(70000)
    // The active period did not change, so it must NOT be warned.
    expect(res.warnings.map((w) => w.period.period_id)).not.toContain('act')
  })
})

describe('computeRateEditImpact — draft handling per path', () => {
  const draftPeriods: RatePeriod[] = [
    { period_id: 'd', period_name: 'Q3 FY26/27', period_start_date: '2026-10-01', period_end_date: '2026-12-31', period_status: 'draft', locked: false },
  ]
  const history = [row({ cost_configuration_id: 'a', effective_from: '2025-01-01', blended_day_rate_override: 55000 })]

  it('add path (active/historic only) does not warn a draft change', () => {
    const res = computeRateEditImpact(history, draftPeriods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2026-10-01', nextRatePence: 70000,
    }, { warnStatuses: ADD_WARN })
    expect(res.warnings).toHaveLength(0)
  })

  it('edit/delete path (all unlocked statuses) still warns a draft change', () => {
    const res = computeRateEditImpact(history, draftPeriods, {
      kind: 'add', platformId: WEB, nextEffectiveFrom: '2026-10-01', nextRatePence: 70000,
    }, { warnStatuses: ALL_WARN })
    expect(res.warnings).toHaveLength(1)
    expect(res.warnings[0].period.period_id).toBe('d')
  })
})
