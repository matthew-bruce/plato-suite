// Monthly day-breakdown helpers for the Platform Schedule page.
//
// An allocation's capacity_days remains the single authoritative total that
// every cost calculation (BASE, blended rate, recovery variance) reads. The
// optional per-month breakdown in resource_period_allocation_monthly_days is
// a data-entry aid layered on top: when months are populated, capacity_days
// is kept equal to their sum (enforced atomically in SQL — see migration 029).
//
// All date maths is done in UTC, matching workingDaysBetween in ./format, so
// date-only ISO strings never drift by a day in non-UTC timezones.

/** One calendar month the period spans, with the month's own bounds. */
export interface PeriodMonth {
  /** ISO date of the first of the month — the natural key for a monthly row. */
  key: string
  /** Short label for the column input, e.g. "Oct". */
  label: string
  /** Calendar year, used to check bank-holiday data coverage. */
  year: number
  monthStart: Date
  monthEnd: Date
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** UTC midnight Date from a date-only ISO string (YYYY-MM-DD). */
export function parseIsoDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

/** Date → date-only ISO string (YYYY-MM-DD), in UTC. */
export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Every calendar month the period touches, in order. A period running
 * 2026-10-01 → 2026-12-31 yields Oct, Nov, Dec 2026; a period starting
 * mid-month still yields that whole month (the month's own bounds are
 * returned — clipping to the period is calculateWorkingDaysInMonth's job).
 */
export function getPeriodMonths(periodStartISO: string, periodEndISO: string): PeriodMonth[] {
  const start = parseIsoDate(periodStartISO)
  const end = parseIsoDate(periodEndISO)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return []

  const months: PeriodMonth[] = []
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))

  while (cursor <= end) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()
    const monthStart = new Date(Date.UTC(year, month, 1))
    // Day 0 of the next month is the last day of this one.
    const monthEnd = new Date(Date.UTC(year, month + 1, 0))
    months.push({
      key: toIsoDate(monthStart),
      label: MONTH_LABELS[month],
      year,
      monthStart,
      monthEnd,
    })
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  return months
}

/**
 * Working days for one month, clipped to the period and holiday-adjusted.
 *
 * Counts weekdays (Mon–Fri) in the intersection of [monthStart, monthEnd]
 * and [periodStart, periodEnd], then subtracts any supplied holiday that
 * falls on a weekday inside that same intersection. A holiday landing on a
 * weekend reduces nothing — it was never counted in the first place.
 *
 * Returns 0 when the month and period do not overlap.
 */
export function calculateWorkingDaysInMonth(
  monthStart: Date,
  monthEnd: Date,
  periodStart: Date,
  periodEnd: Date,
  holidays: Date[],
): number {
  const from = monthStart > periodStart ? monthStart : periodStart
  const to = monthEnd < periodEnd ? monthEnd : periodEnd
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return 0

  const holidaySet = new Set(holidays.map(toIsoDate))

  let days = 0
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const last = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())

  while (cursor.getTime() <= last) {
    const dow = cursor.getUTCDay()
    const isWeekend = dow === 0 || dow === 6
    if (!isWeekend && !holidaySet.has(toIsoDate(cursor))) days += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return days
}

/**
 * Sum of the populated month values. Blank/absent months contribute nothing,
 * so a partially-filled breakdown still totals what has been entered.
 */
export function sumMonthlyDays(values: Record<string, number | null | undefined>): number {
  return Object.values(values).reduce<number>(
    (sum, v) => (typeof v === 'number' && !isNaN(v) ? sum + v : sum),
    0,
  )
}

/**
 * Whether the breakdown is "in monthly mode" — i.e. at least one month
 * carries a value. This is what locks the total input to the live sum; the
 * clear action empties every month and hands the total back to manual entry.
 */
export function hasAnyMonthlyValue(values: Record<string, number | null | undefined>): boolean {
  return Object.values(values).some((v) => typeof v === 'number' && !isNaN(v))
}
