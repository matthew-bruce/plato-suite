// Mathematical generation of RMG financial-quarter boundary lines for the
// Blended Rates trend chart. Replaces a periods-table lookup: quarter
// boundaries are a fixed calendar rule, not data that can be missing, so this
// works for any visible window (1Y/3Y/5Y/All time) with no dependency on
// which `periods` rows happen to exist in the database.
//
// RMG financial year: Q1 starts 1 Apr, Q2 starts 1 Jul, Q3 starts 1 Oct,
// Q4 starts 1 Jan. FY label follows the quarter that starts it — Apr–Dec
// dates are "this calendar year → next" (e.g. 1 Jul 2023 = Q2 FY 23/24);
// Jan–Mar dates are "previous calendar year → this" (e.g. 1 Jan 2026 =
// Q4 FY 25/26).

export interface QuarterMark {
  ms: number
  label: string
  quarter: 1 | 2 | 3 | 4
}

// [quarter number, FY-start-year offset from the boundary's own calendar year]
const QUARTER_BY_MONTH: Record<number, { quarter: 1 | 2 | 3 | 4; fyStartYearOffset: 0 | -1 }> = {
  3: { quarter: 1, fyStartYearOffset: 0 }, // 1 Apr
  6: { quarter: 2, fyStartYearOffset: 0 }, // 1 Jul
  9: { quarter: 3, fyStartYearOffset: 0 }, // 1 Oct
  0: { quarter: 4, fyStartYearOffset: -1 }, // 1 Jan
}

function yy(year: number): string {
  return String(((year % 100) + 100) % 100).padStart(2, '0')
}

function fyQuarterLabel(calendarYear: number, monthIndex0: number): string {
  const { quarter, fyStartYearOffset } = QUARTER_BY_MONTH[monthIndex0]
  const fyStartYear = calendarYear + fyStartYearOffset
  return `Q${quarter} FY ${yy(fyStartYear)}/${yy(fyStartYear + 1)}`
}

/**
 * Every RMG quarter boundary (1 Jan/Apr/Jul/Oct, UTC midnight) whose instant
 * falls within [startMs, endMs] inclusive, ascending. UTC throughout to match
 * how effective_from ISO date strings (and the chart window) are parsed
 * elsewhere in this app.
 */
export function generateQuarterMarks(startMs: number, endMs: number): QuarterMark[] {
  if (endMs < startMs) return []

  const startYear = new Date(startMs).getUTCFullYear() - 1
  const endYear = new Date(endMs).getUTCFullYear() + 1

  const marks: QuarterMark[] = []
  for (let year = startYear; year <= endYear; year++) {
    for (const monthIndex0 of [0, 3, 6, 9]) {
      const ms = Date.UTC(year, monthIndex0, 1)
      if (ms < startMs || ms > endMs) continue
      marks.push({ ms, label: fyQuarterLabel(year, monthIndex0), quarter: QUARTER_BY_MONTH[monthIndex0].quarter })
    }
  }
  return marks.sort((a, b) => a.ms - b.ms)
}

// A 5-year window has 20 quarters — every one gets a text label. Beyond that
// (e.g. "All time" spanning many years) the axis gets crowded, so labels thin
// to one per financial year (the 1 Apr / Q1 boundary only). The dashed
// reference line itself is unaffected — it is always drawn for every quarter,
// regardless of range; only which marks carry text changes.
const LABEL_ALL_THRESHOLD = 20

/**
 * Whether `mark` should carry a text label, given how many quarter marks are
 * currently in view. `totalMarksInView` is the full count for the visible
 * window (i.e. `generateQuarterMarks(...).length`), not a per-mark index.
 */
export function shouldShowQuarterLabel(mark: Pick<QuarterMark, 'quarter'>, totalMarksInView: number): boolean {
  if (totalMarksInView <= LABEL_ALL_THRESHOLD) return true
  return mark.quarter === 1
}
