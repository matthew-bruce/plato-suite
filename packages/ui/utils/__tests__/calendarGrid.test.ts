import { describe, expect, it } from 'vitest'
import {
  toISO,
  parseISO,
  mondayIndex,
  daysInMonth,
  addMonths,
  buildMonthGrid,
  isDateDisabled,
  clampISO,
  addDaysISO,
  monthLabel,
  formatDisplay,
  dayCellState,
} from '../calendarGrid'

describe('toISO / parseISO', () => {
  it('formats zero-padded ISO', () => {
    expect(toISO(2026, 9, 6)).toBe('2026-10-06') // month0=9 → October
    expect(toISO(2026, 0, 1)).toBe('2026-01-01')
  })
  it('round-trips through parseISO', () => {
    expect(parseISO('2026-10-06')).toEqual({ year: 2026, month0: 9, day: 6 })
  })
  it('rejects malformed strings', () => {
    expect(parseISO('2026-13-01')).toBeNull()
    expect(parseISO('not-a-date')).toBeNull()
    expect(parseISO('2026-10-00')).toBeNull()
  })
})

describe('mondayIndex', () => {
  it('is 0 for a Monday and 6 for a Sunday', () => {
    expect(mondayIndex(2026, 5, 1)).toBe(0) // 1 Jun 2026 is a Monday
    expect(mondayIndex(2026, 10, 1)).toBe(6) // 1 Nov 2026 is a Sunday
  })
  it('puts 1 Oct 2026 on Thursday (index 3) per the real calendar', () => {
    // NB: the hand-drawn approval mockup placed the 1st on Friday, but the
    // actual weekday is Thursday — the component follows the true calendar.
    expect(mondayIndex(2026, 9, 1)).toBe(3)
  })
})

describe('daysInMonth', () => {
  it('handles 30/31-day months and February leap years', () => {
    expect(daysInMonth(2026, 9)).toBe(31) // October
    expect(daysInMonth(2026, 8)).toBe(30) // September
    expect(daysInMonth(2026, 1)).toBe(28) // Feb 2026 (non-leap)
    expect(daysInMonth(2028, 1)).toBe(29) // Feb 2028 (leap)
  })
})

describe('addMonths', () => {
  it('advances and rolls the year over in both directions', () => {
    expect(addMonths(2026, 9, 1)).toEqual({ year: 2026, month0: 10 }) // Oct → Nov
    expect(addMonths(2026, 11, 1)).toEqual({ year: 2027, month0: 0 }) // Dec → Jan next yr
    expect(addMonths(2026, 0, -1)).toEqual({ year: 2025, month0: 11 }) // Jan → Dec prev yr
  })
})

describe('buildMonthGrid', () => {
  it('builds October 2026: 3 leading blanks (1st is a Thursday) then 31 days', () => {
    const grid = buildMonthGrid(2026, 9)
    expect(grid.leadingBlanks).toBe(3)
    expect(grid.days).toHaveLength(31)
    expect(grid.days[0]).toEqual({ iso: '2026-10-01', day: 1 })
    expect(grid.days[5]).toEqual({ iso: '2026-10-06', day: 6 })
    expect(grid.days[30]).toEqual({ iso: '2026-10-31', day: 31 })
  })
  it('a month starting on Monday has zero leading blanks', () => {
    const grid = buildMonthGrid(2026, 5) // June 2026 starts Monday
    expect(grid.leadingBlanks).toBe(0)
    expect(grid.days).toHaveLength(30)
  })
})

describe('isDateDisabled', () => {
  it('is false when no bounds are given', () => {
    expect(isDateDisabled('2026-10-06')).toBe(false)
  })
  it('disables dates before min and after max (inclusive bounds stay enabled)', () => {
    expect(isDateDisabled('2026-10-05', '2026-10-06', '2026-10-20')).toBe(true)
    expect(isDateDisabled('2026-10-21', '2026-10-06', '2026-10-20')).toBe(true)
    expect(isDateDisabled('2026-10-06', '2026-10-06', '2026-10-20')).toBe(false)
    expect(isDateDisabled('2026-10-20', '2026-10-06', '2026-10-20')).toBe(false)
  })
})

describe('clampISO', () => {
  it('pulls an out-of-range date to the nearest bound', () => {
    expect(clampISO('2026-10-01', '2026-10-06', '2026-10-20')).toBe('2026-10-06')
    expect(clampISO('2026-10-25', '2026-10-06', '2026-10-20')).toBe('2026-10-20')
    expect(clampISO('2026-10-10', '2026-10-06', '2026-10-20')).toBe('2026-10-10')
  })
})

describe('addDaysISO', () => {
  it('steps across month and year boundaries', () => {
    expect(addDaysISO('2026-10-06', 1)).toBe('2026-10-07')
    expect(addDaysISO('2026-10-06', 7)).toBe('2026-10-13')
    expect(addDaysISO('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-10-01', -1)).toBe('2026-09-30')
  })
})

describe('dayCellState (precedence)', () => {
  it('disabled beats everything, even today/selected', () => {
    expect(dayCellState({ disabled: true, selected: true, isToday: true })).toBe('disabled')
  })
  it('a selected day beats today', () => {
    expect(dayCellState({ disabled: false, selected: true, isToday: true })).toBe('selected')
  })
  it('today shows only when not selected/disabled', () => {
    expect(dayCellState({ disabled: false, selected: false, isToday: true })).toBe('today')
  })
  it('otherwise default', () => {
    expect(dayCellState({ disabled: false, selected: false, isToday: false })).toBe('default')
  })
})

describe('monthLabel / formatDisplay', () => {
  it('labels the month header', () => {
    expect(monthLabel(2026, 9)).toBe('October 2026')
  })
  it('formats the trigger display as DD/MM/YYYY', () => {
    expect(formatDisplay('2026-10-01')).toBe('01/10/2026')
    expect(formatDisplay('')).toBe('')
  })
})
