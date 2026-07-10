// Trailing-window computation for the Blended Rates trend chart's range
// control (1Y / 3Y / 5Y / All time).
//
// 1Y/3Y/5Y are literal trailing windows from today (not from the latest
// entered rate) — that's what the pill labels read as. The right edge still
// extends to cover a future-dated draft rate beyond today, so a newly entered
// rate is never clipped. "All time" starts exactly at the earliest
// effective_from across whatever platforms are currently visible — driven by
// the data, never a hardcoded year — with no left padding, so a window that
// exactly reaches the first real point needs no carry-forward synthesis.

const DAY_MS = 24 * 60 * 60 * 1000
// Right-edge-only breathing room so the most recent point isn't flush against
// the frame. Never applied to the left edge — carry-forward synthesis (in
// chartPoints.ts) anchors exactly to window.min.
const RIGHT_PAD_MS = 18 * DAY_MS

export type ChartRange = '1y' | '3y' | '5y' | 'all'

export const CHART_RANGE_OPTIONS: { value: ChartRange; label: string }[] = [
  { value: '1y', label: '1Y' },
  { value: '3y', label: '3Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'All time' },
]

export interface ChartWindow {
  min: number
  max: number
}

const RANGE_YEARS: Record<Exclude<ChartRange, 'all'>, number> = { '1y': 1, '3y': 3, '5y': 5 }

/**
 * `effectiveFromDates` — ISO effective_from dates of every rated row across
 * whatever platforms are currently visible (selected AND have data). Only
 * used to find the earliest point for "All time" and to keep the right edge
 * from clipping a future-dated draft; it never influences the 1Y/3Y/5Y left
 * edge, which is always exactly `today − N years`.
 */
export function computeChartWindow(
  effectiveFromDates: string[],
  range: ChartRange,
  todayISO: string,
): ChartWindow {
  const todayMs = Date.parse(todayISO)
  const dataMs = effectiveFromDates.map((d) => Date.parse(d))
  const latestMs = dataMs.length ? Math.max(...dataMs) : todayMs
  const max = Math.max(todayMs, latestMs) + RIGHT_PAD_MS

  if (range === 'all') {
    const earliestMs = dataMs.length ? Math.min(...dataMs) : todayMs
    return { min: earliestMs, max }
  }

  const minD = new Date(todayMs)
  minD.setFullYear(minD.getFullYear() - RANGE_YEARS[range])
  return { min: minD.getTime(), max }
}
