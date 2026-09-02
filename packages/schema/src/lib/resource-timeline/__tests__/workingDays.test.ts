import { describe, expect, it } from 'vitest'
import {
  addDays,
  clampIso,
  firstWorkingDayOfMonth,
  fullMonthWorkingDays,
  lastWorkingDayOfMonth,
  monthStartOf,
  nthWorkingDay,
  weekdaysInMonth,
  workingDaysInMonth,
} from '../workingDays'

// England-and-Wales bank holidays touching the Q2/Q3 FY26/27 window, as seeded
// in uk_bank_holidays. December's two are what make the month 21 days, not 23.
const BANK_HOLIDAYS = ['2026-08-31', '2026-12-25', '2026-12-28']

describe('weekdaysInMonth', () => {
  it('returns every Mon-Fri and excludes weekends', () => {
    const days = weekdaysInMonth('2026-10-01')
    expect(days).toHaveLength(22)
    expect(days[0]).toBe('2026-10-01')
    expect(days[days.length - 1]).toBe('2026-10-30')
    expect(days).not.toContain('2026-10-03') // Saturday
    expect(days).not.toContain('2026-10-04') // Sunday
  })

  it('counts December 2026 as 23 weekdays before holidays are removed', () => {
    expect(weekdaysInMonth('2026-12-01')).toHaveLength(23)
  })
})

describe('workingDaysInMonth / fullMonthWorkingDays', () => {
  it('matches the validated Q3 month lengths of 22 / 21 / 21', () => {
    expect(fullMonthWorkingDays('2026-10-01', BANK_HOLIDAYS)).toBe(22)
    expect(fullMonthWorkingDays('2026-11-01', BANK_HOLIDAYS)).toBe(21)
    expect(fullMonthWorkingDays('2026-12-01', BANK_HOLIDAYS)).toBe(21)
  })

  it('removes bank holidays from December', () => {
    const days = workingDaysInMonth('2026-12-01', BANK_HOLIDAYS)
    expect(days).not.toContain('2026-12-25')
    expect(days).not.toContain('2026-12-28')
    expect(days).toContain('2026-12-24')
  })

  it('degrades to plain weekdays when no holidays are supplied', () => {
    expect(fullMonthWorkingDays('2026-12-01')).toBe(23)
  })
})

describe('firstWorkingDayOfMonth / lastWorkingDayOfMonth', () => {
  it('finds the real October boundaries, not the calendar ones', () => {
    expect(firstWorkingDayOfMonth('2026-10-01', BANK_HOLIDAYS)).toBe('2026-10-01')
    // 31 October 2026 is a Saturday — the real last working day is the 30th.
    expect(lastWorkingDayOfMonth('2026-10-01', BANK_HOLIDAYS)).toBe('2026-10-30')
  })

  it('skips a leading weekend', () => {
    // 1 November 2026 is a Sunday.
    expect(firstWorkingDayOfMonth('2026-11-01', BANK_HOLIDAYS)).toBe('2026-11-02')
  })

  it('skips trailing bank holidays in December', () => {
    expect(lastWorkingDayOfMonth('2026-12-01', BANK_HOLIDAYS)).toBe('2026-12-31')
  })
})

describe('nthWorkingDay', () => {
  it('is 0-indexed over working days', () => {
    expect(nthWorkingDay('2026-10-01', 0, BANK_HOLIDAYS)).toBe('2026-10-01')
    expect(nthWorkingDay('2026-10-01', 7, BANK_HOLIDAYS)).toBe('2026-10-12')
    expect(nthWorkingDay('2026-10-01', 11, BANK_HOLIDAYS)).toBe('2026-10-16')
    // Weekends push the 13th working day well past the 13th of the month.
    expect(nthWorkingDay('2026-10-01', 12, BANK_HOLIDAYS)).toBe('2026-10-19')
  })

  it('clamps an out-of-range index to the last working day', () => {
    expect(nthWorkingDay('2026-10-01', 99, BANK_HOLIDAYS)).toBe('2026-10-30')
    expect(nthWorkingDay('2026-10-01', -5, BANK_HOLIDAYS)).toBe('2026-10-01')
  })
})

describe('date helpers', () => {
  it('adds days across a month boundary without timezone drift', () => {
    expect(addDays('2026-10-30', 2)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('derives the containing month', () => {
    expect(monthStartOf('2026-10-16')).toBe('2026-10-01')
  })

  it('clamps into a window', () => {
    expect(clampIso('2026-06-01', '2026-07-01', '2026-12-31')).toBe('2026-07-01')
    expect(clampIso('2027-02-01', '2026-07-01', '2026-12-31')).toBe('2026-12-31')
    expect(clampIso('2026-09-15', '2026-07-01', '2026-12-31')).toBe('2026-09-15')
  })
})
