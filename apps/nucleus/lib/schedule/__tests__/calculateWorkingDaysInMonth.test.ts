import { describe, expect, it } from 'vitest'
import {
  calculateWorkingDaysInMonth,
  getPeriodMonths,
  sumMonthlyDays,
  hasAnyMonthlyValue,
} from '../monthlyDays'

// All fixtures use Q3 FY26/27 (1 Oct – 31 Dec 2026) and are hand-verified:
//   Oct 2026 starts Thursday  → 22 weekdays, no bank holidays
//   Dec 2026 starts Tuesday   → 23 weekdays, minus 25 Dec (Fri) + 28 Dec (Mon)
//   Oct  3 2026 is a Saturday → used for the weekend-holiday case
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

const PERIOD_START = utc(2026, 10, 1)
const PERIOD_END = utc(2026, 12, 31)

describe('calculateWorkingDaysInMonth', () => {
  it('counts a full calendar month that sits entirely within the period', () => {
    // October 2026: 31 days from Thu 1 Oct, no bank holidays.
    expect(
      calculateWorkingDaysInMonth(utc(2026, 10, 1), utc(2026, 10, 31), PERIOD_START, PERIOD_END, []),
    ).toBe(22)
  })

  it('clips a month that only partially overlaps the period start', () => {
    // Period starts mid-month (15 Oct, a Thursday) — only 15–31 Oct counts.
    expect(
      calculateWorkingDaysInMonth(
        utc(2026, 10, 1),
        utc(2026, 10, 31),
        utc(2026, 10, 15),
        PERIOD_END,
        [],
      ),
    ).toBe(12)
  })

  it('clips a month that only partially overlaps the period end', () => {
    // Period ends mid-month (15 Dec, a Tuesday) — only 1–15 Dec counts.
    expect(
      calculateWorkingDaysInMonth(
        utc(2026, 12, 1),
        utc(2026, 12, 31),
        PERIOD_START,
        utc(2026, 12, 15),
        [],
      ),
    ).toBe(11)
  })

  it('subtracts bank holidays that fall on a weekday', () => {
    // December 2026 has 23 weekdays; 25 Dec (Fri) and 28 Dec (Mon) are both
    // weekday bank holidays, so 23 - 2 = 21.
    const holidays = [utc(2026, 12, 25), utc(2026, 12, 28)]
    expect(
      calculateWorkingDaysInMonth(utc(2026, 12, 1), utc(2026, 12, 31), PERIOD_START, PERIOD_END, holidays),
    ).toBe(21)
  })

  it('does not subtract a bank holiday that falls on a weekend', () => {
    // 3 Oct 2026 is a Saturday — it was never in the weekday count, so the
    // total must stay at the unadjusted 22 rather than dropping to 21.
    const holidays = [utc(2026, 10, 3)]
    expect(
      calculateWorkingDaysInMonth(utc(2026, 10, 1), utc(2026, 10, 31), PERIOD_START, PERIOD_END, holidays),
    ).toBe(22)
  })

  it('returns 0 when the month and period do not overlap at all', () => {
    expect(
      calculateWorkingDaysInMonth(utc(2026, 9, 1), utc(2026, 9, 30), PERIOD_START, PERIOD_END, []),
    ).toBe(0)
  })

  it('ignores holidays that fall outside the clipped range', () => {
    // 25 Dec is a weekday holiday but lies beyond a period ending 15 Dec,
    // so it must not reduce the clipped count of 11.
    expect(
      calculateWorkingDaysInMonth(
        utc(2026, 12, 1),
        utc(2026, 12, 31),
        PERIOD_START,
        utc(2026, 12, 15),
        [utc(2026, 12, 25)],
      ),
    ).toBe(11)
  })
})

describe('getPeriodMonths', () => {
  it('returns each calendar month a quarter spans', () => {
    const months = getPeriodMonths('2026-10-01', '2026-12-31')
    expect(months.map((m) => m.key)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
    expect(months.map((m) => m.label)).toEqual(['Oct', 'Nov', 'Dec'])
    expect(months.map((m) => m.year)).toEqual([2026, 2026, 2026])
  })

  it('includes a partial trailing month and spans a year boundary', () => {
    const months = getPeriodMonths('2026-12-15', '2027-01-10')
    expect(months.map((m) => m.key)).toEqual(['2026-12-01', '2027-01-01'])
    expect(months.map((m) => m.year)).toEqual([2026, 2027])
  })

  it('returns whole-month bounds, not period-clipped ones', () => {
    // Clipping is calculateWorkingDaysInMonth's job — the month itself always
    // reports its own first/last day.
    const [oct] = getPeriodMonths('2026-10-15', '2026-10-20')
    expect(oct.monthStart.toISOString().slice(0, 10)).toBe('2026-10-01')
    expect(oct.monthEnd.toISOString().slice(0, 10)).toBe('2026-10-31')
  })

  it('returns an empty list when the range is inverted', () => {
    expect(getPeriodMonths('2026-12-31', '2026-10-01')).toEqual([])
  })
})

describe('sumMonthlyDays', () => {
  it('returns 0 for an empty breakdown', () => {
    expect(sumMonthlyDays({})).toBe(0)
  })
  it('sums only the populated months', () => {
    expect(sumMonthlyDays({ a: 22, b: null, c: 21 })).toBe(43)
  })
  it('supports half days', () => {
    expect(sumMonthlyDays({ a: 21.5, b: 0.5 })).toBe(22)
  })
  it('treats 0 as a populated value, not a blank', () => {
    expect(sumMonthlyDays({ a: 0, b: 10 })).toBe(10)
  })
})

describe('hasAnyMonthlyValue', () => {
  it('is false for an empty or fully-blank breakdown', () => {
    expect(hasAnyMonthlyValue({})).toBe(false)
    expect(hasAnyMonthlyValue({ a: null, b: undefined })).toBe(false)
  })
  it('is true as soon as one month carries a value', () => {
    expect(hasAnyMonthlyValue({ a: null, b: 5 })).toBe(true)
  })
  it('treats an explicit 0 as monthly mode (locks the total)', () => {
    expect(hasAnyMonthlyValue({ a: 0 })).toBe(true)
  })
})
