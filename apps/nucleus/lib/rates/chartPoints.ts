// Point-array construction for the Blended Rates trend chart.
//
// The chart renders a trailing window. A platform's earliest real rate row
// often sits before the window (or has no row at all inside it), which would
// otherwise leave the line either missing at the left edge or picking up
// mid-interpolation from an off-screen point. This resolves what rate was
// actually in effect at the window's left-edge date — via the same
// effective-dated lookup the rest of the app uses — and, when that rate comes
// from a row outside the window, synthesises an entry point there so the line
// always enters the frame flat at the correct value.

import { pickEffectiveCostConfig } from '@plato/schema'
import type { RateHistoryRow } from '@plato/schema'

export interface ChartPoint {
  x: number
  y: number
}

/**
 * Build one platform's Chart.js point array for the rate-trend chart.
 *
 * `rows` — this platform's rate-history rows (any order, null-rate rows are
 * filtered out here). `windowStartMs` — the chart window's left-edge, in ms.
 *
 * Real rows dated before the window are dropped from the rendered set. If the
 * rate in effect at the window start (per the effective-dated lookup) comes
 * from a row strictly before the window — i.e. there is no real row exactly
 * on the window's left edge — a synthesised point carrying that value is
 * prepended at windowStartMs. When no row is effective at the window start
 * (nothing precedes it), no synthesis happens and the line simply starts from
 * the first real point inside the window.
 */
export function buildPlatformChartPoints(
  rows: RateHistoryRow[],
  windowStartMs: number,
): ChartPoint[] {
  const rated = rows.filter((r) => r.blended_day_rate_override !== null)
  if (rated.length === 0) return []

  const windowStartISO = new Date(windowStartMs).toISOString().slice(0, 10)

  const points: ChartPoint[] = []

  const effective = pickEffectiveCostConfig(rated, windowStartISO)
  if (effective && effective.effective_from < windowStartISO) {
    points.push({ x: windowStartMs, y: effective.blended_day_rate_override! / 100 })
  }

  for (const r of rated) {
    if (r.effective_from < windowStartISO) continue
    points.push({ x: Date.parse(r.effective_from), y: r.blended_day_rate_override! / 100 })
  }

  return points.sort((a, b) => a.x - b.x)
}
