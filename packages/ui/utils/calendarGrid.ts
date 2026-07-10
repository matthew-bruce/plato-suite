// Pure date helpers for the CalendarDatePicker. All dates are handled as
// YYYY-MM-DD ISO strings in UTC, matching how date fields are stored and
// exchanged across Plato (FormField's date variant, period dates, etc.).

export interface DayCell {
  /** YYYY-MM-DD */
  iso: string
  /** Day of month, 1–31. */
  day: number
}

export interface MonthGrid {
  /** Empty leading cells before day 1 so the 1st lands under the right weekday
   *  (Monday-first: Mon=0 … Sun=6). */
  leadingBlanks: number
  days: DayCell[]
}

/** Two-digit pad. */
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD for a Y/M/D (month is 0-indexed), in UTC. */
export function toISO(year: number, month0: number, day: number): string {
  return `${year}-${pad(month0 + 1)}-${pad(day)}`
}

/** Parse YYYY-MM-DD into its numeric parts, or null if malformed. */
export function parseISO(iso: string): { year: number; month0: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return null
  const year = Number(m[1])
  const month0 = Number(m[2]) - 1
  const day = Number(m[3])
  if (month0 < 0 || month0 > 11 || day < 1 || day > 31) return null
  return { year, month0, day }
}

/** Monday-first weekday index (Mon=0 … Sun=6) for a UTC date. */
export function mondayIndex(year: number, month0: number, day: number): number {
  const dow = new Date(Date.UTC(year, month0, day)).getUTCDay() // Sun=0 … Sat=6
  return (dow + 6) % 7
}

/** Number of days in a given month (month0 0-indexed). */
export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** Step a (year, month0) by whole months, rolling the year over. */
export function addMonths(year: number, month0: number, delta: number): { year: number; month0: number } {
  const total = year * 12 + month0 + delta
  return { year: Math.floor(total / 12), month0: ((total % 12) + 12) % 12 }
}

/**
 * The calendar grid for a month: how many leading blank cells are needed so the
 * 1st sits under the correct weekday, plus one cell per day with its ISO date.
 */
export function buildMonthGrid(year: number, month0: number): MonthGrid {
  const leadingBlanks = mondayIndex(year, month0, 1)
  const count = daysInMonth(year, month0)
  const days: DayCell[] = []
  for (let d = 1; d <= count; d++) {
    days.push({ iso: toISO(year, month0, d), day: d })
  }
  return { leadingBlanks, days }
}

/**
 * Whether an ISO date is outside an optional [minISO, maxISO] range and so
 * should be disabled. String comparison is valid for zero-padded YYYY-MM-DD.
 */
export function isDateDisabled(iso: string, minISO?: string, maxISO?: string): boolean {
  if (minISO && iso < minISO) return true
  if (maxISO && iso > maxISO) return true
  return false
}

/** Clamp an ISO date into [minISO, maxISO] (used to keep keyboard focus in range). */
export function clampISO(iso: string, minISO?: string, maxISO?: string): string {
  if (minISO && iso < minISO) return minISO
  if (maxISO && iso > maxISO) return maxISO
  return iso
}

/** Shift an ISO date by whole days, returning a new ISO date (UTC). */
export function addDaysISO(iso: string, delta: number): string {
  const parts = parseISO(iso)
  if (!parts) return iso
  const d = new Date(Date.UTC(parts.year, parts.month0, parts.day + delta))
  return toISO(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** "October 2026" header label for a month. */
export function monthLabel(year: number, month0: number): string {
  return `${MONTH_NAMES[month0]} ${year}`
}

/** DD/MM/YYYY display (en-GB order) for the field trigger, or '' if unparseable. */
export function formatDisplay(iso: string): string {
  const parts = parseISO(iso)
  if (!parts) return ''
  return `${pad(parts.day)}/${pad(parts.month0 + 1)}/${parts.year}`
}

/**
 * Visual state of a single day cell, in strict precedence: a disabled
 * (out-of-range) day is always 'disabled' even if it happens to be today or
 * selected; otherwise the pending selection wins over 'today'; otherwise
 * 'today'; otherwise 'default'. Kept pure so the precedence is unit-testable
 * (the codebase verifies UI rendering manually in /design-system).
 */
export function dayCellState(opts: {
  disabled: boolean
  selected: boolean
  isToday: boolean
}): 'disabled' | 'selected' | 'today' | 'default' {
  if (opts.disabled) return 'disabled'
  if (opts.selected) return 'selected'
  if (opts.isToday) return 'today'
  return 'default'
}
