// Working-day calendar for the Resource Timeline view.
//
// Every partial-month calculation in deriveSegments.ts is expressed as an
// index into one of these arrays. Calendar month-end is never used as a
// shortcut: "the 15th working day of October" and "15 October" are different
// dates, and conflating them is what made earlier versions of this view
// overstate coverage.
//
// Dates are handled as YYYY-MM-DD strings throughout and constructed at
// UTC midnight, so nothing here shifts by a day when the runtime's local
// timezone is behind UTC.

/** A calendar month, identified by its first day as YYYY-MM-01. */
export type MonthStart = string

/** An ISO date, YYYY-MM-DD. */
export type IsoDate = string

const MS_PER_DAY = 86_400_000

export function toUtcDate(iso: IsoDate): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`)
}

export function toIso(date: Date): IsoDate {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  return toIso(new Date(toUtcDate(iso).getTime() + days * MS_PER_DAY))
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return (toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY
}

export function isWeekend(iso: IsoDate): boolean {
  const day = toUtcDate(iso).getUTCDay()
  return day === 0 || day === 6
}

/**
 * Every Mon–Fri in the month, as YYYY-MM-DD. Bank holidays are NOT removed —
 * see workingDaysInMonth for the version that does, which is what the
 * derivation actually indexes into.
 */
export function weekdaysInMonth(monthStart: MonthStart): IsoDate[] {
  const start = toUtcDate(monthStart)
  const year = start.getUTCFullYear()
  const month = start.getUTCMonth()
  const out: IsoDate[] = []

  for (let d = new Date(Date.UTC(year, month, 1)); d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay()
    if (day !== 0 && day !== 6) out.push(toIso(d))
  }
  return out
}

/**
 * Every working day in the month: weekdays minus England-and-Wales bank
 * holidays. This is the array the derivation indexes into, and its length is
 * the month's "full" day count — which is why December 2026 is 21 (23
 * weekdays less Christmas Day and the Boxing Day substitute) rather than 23.
 *
 * Passing an empty holiday list degrades to weekdaysInMonth rather than
 * throwing; a month whose holidays simply have not been seeded then reads as
 * slightly longer than it is, which the noise threshold absorbs for a single
 * day and surfaces as a partial month beyond that.
 */
export function workingDaysInMonth(
  monthStart: MonthStart,
  bankHolidays: readonly IsoDate[] = [],
): IsoDate[] {
  const holidays = new Set(bankHolidays.map((h) => h.slice(0, 10)))
  return weekdaysInMonth(monthStart).filter((d) => !holidays.has(d))
}

/** Number of working days in the month — the "full month" denominator. */
export function fullMonthWorkingDays(
  monthStart: MonthStart,
  bankHolidays: readonly IsoDate[] = [],
): number {
  return workingDaysInMonth(monthStart, bankHolidays).length
}

/** First working day of the month. */
export function firstWorkingDayOfMonth(
  monthStart: MonthStart,
  bankHolidays: readonly IsoDate[] = [],
): IsoDate {
  const days = workingDaysInMonth(monthStart, bankHolidays)
  if (days.length === 0) throw new Error(`No working days in month ${monthStart}`)
  return days[0]!
}

/**
 * Last working day of the month. This — not the calendar 31st — is what a
 * contractual "to end of October" actually means, and it is the value the
 * CG hard cap in deriveSegments.ts clips to.
 */
export function lastWorkingDayOfMonth(
  monthStart: MonthStart,
  bankHolidays: readonly IsoDate[] = [],
): IsoDate {
  const days = workingDaysInMonth(monthStart, bankHolidays)
  if (days.length === 0) throw new Error(`No working days in month ${monthStart}`)
  return days[days.length - 1]!
}

/**
 * The Nth working day of a month, 0-indexed, clamped to the month's last
 * working day. Clamping rather than returning undefined keeps a bad day count
 * (more days booked than the month holds) rendering as a full month instead
 * of collapsing the bar to nothing.
 */
export function nthWorkingDay(
  monthStart: MonthStart,
  index: number,
  bankHolidays: readonly IsoDate[] = [],
): IsoDate {
  const days = workingDaysInMonth(monthStart, bankHolidays)
  if (days.length === 0) throw new Error(`No working days in month ${monthStart}`)
  const clamped = Math.max(0, Math.min(index, days.length - 1))
  return days[clamped]!
}

/** The month containing this date, as YYYY-MM-01. */
export function monthStartOf(iso: IsoDate): MonthStart {
  return `${iso.slice(0, 7)}-01`
}

/** Chronological compare for two ISO dates. */
export function minIso(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b
}

export function maxIso(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b
}

/** Clamp an ISO date into [lower, upper]. */
export function clampIso(iso: IsoDate, lower: IsoDate, upper: IsoDate): IsoDate {
  return minIso(maxIso(iso, lower), upper)
}
