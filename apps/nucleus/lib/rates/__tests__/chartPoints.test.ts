import { describe, it, expect } from 'vitest'
import { buildPlatformChartPoints } from '../chartPoints'
import type { RateHistoryRow } from '@plato/schema'

const WINDOW_START = Date.parse('2025-07-01')

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

describe('buildPlatformChartPoints — carry-forward synthesis', () => {
  it('window start 2025-07-01, one real point at 2025-01-01 (£550): synthesises the entry point, excludes the off-window real point', () => {
    const points = buildPlatformChartPoints([row('2025-01-01', 55000)], WINDOW_START)
    expect(points).toEqual([{ x: WINDOW_START, y: 550 }])
  })

  it('window start 2025-07-01, real points at 2025-01-01 (£550) and 2025-10-01 (£600): synthesises entry at window start, includes 2025-10-01, excludes 2025-01-01', () => {
    const points = buildPlatformChartPoints(
      [row('2025-01-01', 55000), row('2025-10-01', 60000)],
      WINDOW_START,
    )
    expect(points).toEqual([
      { x: WINDOW_START, y: 550 },
      { x: Date.parse('2025-10-01'), y: 600 },
    ])
  })

  it('window start 2025-07-01, first real point already inside the window (2025-09-01): no synthesis, renders from the real point as-is', () => {
    const points = buildPlatformChartPoints([row('2025-09-01', 55000)], WINDOW_START)
    expect(points).toEqual([{ x: Date.parse('2025-09-01'), y: 550 }])
  })

  it('platform with no rate data at all: no synthesis attempted, empty array', () => {
    expect(buildPlatformChartPoints([], WINDOW_START)).toEqual([])
    // Also covers rows that exist but carry no rate value.
    expect(buildPlatformChartPoints([row('2025-01-01', null)], WINDOW_START)).toEqual([])
  })

  it('a real point landing exactly on the window start is not duplicated by synthesis', () => {
    const points = buildPlatformChartPoints(
      [row('2025-01-01', 55000), row('2025-07-01', 60000)],
      WINDOW_START,
    )
    expect(points).toEqual([{ x: WINDOW_START, y: 600 }])
  })
})
