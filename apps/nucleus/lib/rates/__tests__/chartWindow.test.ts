import { describe, it, expect } from 'vitest'
import { computeChartWindow } from '../chartWindow'
import { buildPlatformChartPoints } from '../chartPoints'
import type { RateHistoryRow } from '@plato/schema'

const TODAY = '2026-07-08'

function row(effectiveFrom: string, pence: number | null): RateHistoryRow {
  return {
    cost_configuration_id: `cc-${effectiveFrom}`,
    platform_id: 'web',
    effective_from: effectiveFrom,
    blended_day_rate_override: pence,
    vat_uplift_percent: 7.082,
    on_costs_uplift_percent: 0,
  }
}

describe('computeChartWindow', () => {
  it('"All time" with the earliest data point at 2020-01-01 starts exactly there, needing no carry-forward', () => {
    const window = computeChartWindow(['2020-01-01', '2026-07-01'], 'all', TODAY)
    expect(window.min).toBe(Date.parse('2020-01-01'))

    // Confirm no synthesis fires when the window starts exactly on the earliest row.
    const rows = [row('2020-01-01', 55000), row('2026-07-01', 60500)]
    const points = buildPlatformChartPoints(rows, window.min)
    expect(points).toHaveLength(2)
    expect(points[0]).toEqual({ x: Date.parse('2020-01-01'), y: 550 })
  })

  it('1Y window is anchored to today, not the latest entered rate — carry-forward synthesises a point at (today − 1Y)', () => {
    const window = computeChartWindow(['2020-01-01', '2023-10-01'], '1y', TODAY)
    const expectedMin = new Date(Date.parse(TODAY))
    expectedMin.setFullYear(expectedMin.getFullYear() - 1)
    expect(window.min).toBe(expectedMin.getTime())

    const rows = [row('2020-01-01', 55000), row('2023-10-01', 60000)]
    const points = buildPlatformChartPoints(rows, window.min)
    // The rate active at (today − 1Y) is the 2023-10-01 row (the latest one
    // on or before that date) — carried forward to exactly the window start.
    expect(points[0]).toEqual({ x: window.min, y: 600 })
  })

  it('"All time" across two platforms starts at the earliest effective_from across BOTH', () => {
    const webDates = ['2020-01-01', '2026-07-01']
    const appDates = ['2018-04-01']
    const window = computeChartWindow([...webDates, ...appDates], 'all', TODAY)
    expect(window.min).toBe(Date.parse('2018-04-01'))
  })

  it('the selected range is independent of which platforms are visible — toggling platforms never changes it', () => {
    const range = '3y'
    const webOnly = computeChartWindow(['2020-01-01'], range, TODAY)
    const webAndApp = computeChartWindow(['2020-01-01', '2018-04-01'], range, TODAY)

    const expectedMin = new Date(Date.parse(TODAY))
    expectedMin.setFullYear(expectedMin.getFullYear() - 3)

    // The 3Y rule — anchored to today — holds regardless of which platforms'
    // dates are fed in; only `range` (untouched by platform selection) decides it.
    expect(webOnly.min).toBe(expectedMin.getTime())
    expect(webAndApp.min).toBe(expectedMin.getTime())
  })

  it('5Y and All-time both extend the right edge to cover a future-dated draft beyond today', () => {
    const future = '2027-01-01'
    const window5y = computeChartWindow(['2020-01-01', future], '5y', TODAY)
    const windowAll = computeChartWindow(['2020-01-01', future], 'all', TODAY)
    expect(window5y.max).toBeGreaterThan(Date.parse(future))
    expect(windowAll.max).toBeGreaterThan(Date.parse(future))
  })
})
