// Pure RMG-financial-quarter helpers for the "Create New Period" wizard.
//
// RMG financial year runs April→March: Q1 = Apr–Jun, Q2 = Jul–Sep,
// Q3 = Oct–Dec, Q4 = Jan–Mar. The FY label is named after the quarter that
// starts it — Apr–Dec quarters are "this calendar year → next" (e.g. Q2 that
// starts Jul 2026 = "Q2 FY 26/27"); the Jan–Mar quarter belongs to the FY that
// began the previous April (e.g. Jan 2027 = "Q4 FY 26/27").
//
// All dates are handled as YYYY-MM-DD strings in UTC to match how period dates
// are stored and parsed everywhere else in the app.

export interface RmgQuarter {
  /** 1 = Apr–Jun, 2 = Jul–Sep, 3 = Oct–Dec, 4 = Jan–Mar. */
  quarter: 1 | 2 | 3 | 4
  /** Calendar year the financial year started in (the April). */
  fyStartYear: number
}

export interface DerivedPeriod {
  period_name: string
  period_start_date: string
  period_end_date: string
}

function yy(year: number): string {
  return String(((year % 100) + 100) % 100).padStart(2, '0')
}

/** RMG quarter + FY-start-year that a given calendar month falls in. */
export function rmgQuarterOfMonth(calendarYear: number, month0: number): RmgQuarter {
  if (month0 >= 3 && month0 <= 5) return { quarter: 1, fyStartYear: calendarYear }
  if (month0 >= 6 && month0 <= 8) return { quarter: 2, fyStartYear: calendarYear }
  if (month0 >= 9 && month0 <= 11) return { quarter: 3, fyStartYear: calendarYear }
  // Jan–Mar belongs to the FY that began the previous April.
  return { quarter: 4, fyStartYear: calendarYear - 1 }
}

/** "Q2 FY 26/27" for the given quarter. */
export function rmgQuarterLabel(q: RmgQuarter): string {
  return `Q${q.quarter} FY ${yy(q.fyStartYear)}/${yy(q.fyStartYear + 1)}`
}

/** Inclusive start/end ISO dates (YYYY-MM-DD) for a quarter's fixed calendar boundaries. */
export function rmgQuarterDates(q: RmgQuarter): { start: string; end: string } {
  switch (q.quarter) {
    case 1:
      return { start: iso(q.fyStartYear, 3, 1), end: iso(q.fyStartYear, 5, 30) } // Apr 1 – Jun 30
    case 2:
      return { start: iso(q.fyStartYear, 6, 1), end: iso(q.fyStartYear, 8, 30) } // Jul 1 – Sep 30
    case 3:
      return { start: iso(q.fyStartYear, 9, 1), end: iso(q.fyStartYear, 11, 31) } // Oct 1 – Dec 31
    case 4:
      return { start: iso(q.fyStartYear + 1, 0, 1), end: iso(q.fyStartYear + 1, 2, 31) } // Jan 1 – Mar 31
  }
}

/** The quarter immediately following the given one, rolling FY over after Q4. */
export function nextRmgQuarter(q: RmgQuarter): RmgQuarter {
  if (q.quarter === 4) return { quarter: 1, fyStartYear: q.fyStartYear + 1 }
  return { quarter: (q.quarter + 1) as 1 | 2 | 3 | 4, fyStartYear: q.fyStartYear }
}

/**
 * Given the latest existing period's start date, derive the next quarter's
 * pre-fill: name + fixed start/end dates. Derived from the date (not the
 * stored name) so it's correct even if a name was hand-edited, and works
 * regardless of when the wizard is run.
 */
export function deriveNextQuarterPeriod(latestStartISO: string): DerivedPeriod {
  const d = new Date(latestStartISO + 'T00:00:00Z')
  const current = rmgQuarterOfMonth(d.getUTCFullYear(), d.getUTCMonth())
  const next = nextRmgQuarter(current)
  const { start, end } = rmgQuarterDates(next)
  return { period_name: rmgQuarterLabel(next), period_start_date: start, period_end_date: end }
}

function iso(year: number, month0: number, day: number): string {
  const mm = String(month0 + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}
