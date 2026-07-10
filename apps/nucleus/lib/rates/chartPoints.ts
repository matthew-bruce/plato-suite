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
//
// Symmetrically, when the window's right edge is supplied, the last known
// rate is carried forward to it: an active platform's line always reaches the
// right boundary flat, rather than stopping dead at its last real data point
// — a flat line means "no change since this date", not "platform ceased to
// exist".

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
 * `windowEndMs` — the chart window's right-edge, in ms (optional; when
 * omitted, no right-edge synthesis happens).
 *
 * Real rows dated before the window are dropped from the rendered set. If the
 * rate in effect at the window start (per the effective-dated lookup) comes
 * from a row strictly before the window — i.e. there is no real row exactly
 * on the window's left edge — a synthesised point carrying that value is
 * prepended at windowStartMs. When no row is effective at the window start
 * (nothing precedes it), no synthesis happens and the line simply starts from
 * the first real point inside the window.
 *
 * Symmetrically, if the last rendered point sits before windowEndMs, a
 * synthesised point carrying the same rate is appended at windowEndMs, so the
 * line extends flat all the way to the right edge.
 */
export function buildPlatformChartPoints(
  rows: RateHistoryRow[],
  windowStartMs: number,
  windowEndMs?: number,
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

  points.sort((a, b) => a.x - b.x)

  if (windowEndMs !== undefined && points.length > 0) {
    const last = points[points.length - 1]
    if (last.x < windowEndMs) {
      points.push({ x: windowEndMs, y: last.y })
    }
  }

  return points
}
