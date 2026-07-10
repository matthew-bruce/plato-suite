import { describe, expect, it } from 'vitest'
import {
  rmgQuarterOfMonth,
  rmgQuarterLabel,
  rmgQuarterDates,
  nextRmgQuarter,
  deriveNextQuarterPeriod,
} from '../periodQuarters'

describe('rmgQuarterOfMonth', () => {
  it('maps Apr–Jun to Q1 of the current FY', () => {
    expect(rmgQuarterOfMonth(2026, 3)).toEqual({ quarter: 1, fyStartYear: 2026 }) // Apr
    expect(rmgQuarterOfMonth(2026, 5)).toEqual({ quarter: 1, fyStartYear: 2026 }) // Jun
  })
  it('maps Jul–Sep to Q2', () => {
    expect(rmgQuarterOfMonth(2026, 6)).toEqual({ quarter: 2, fyStartYear: 2026 })
  })
  it('maps Oct–Dec to Q3', () => {
    expect(rmgQuarterOfMonth(2026, 9)).toEqual({ quarter: 3, fyStartYear: 2026 })
  })
  it('maps Jan–Mar to Q4 of the FY that began the previous April', () => {
    expect(rmgQuarterOfMonth(2027, 0)).toEqual({ quarter: 4, fyStartYear: 2026 }) // Jan 2027
    expect(rmgQuarterOfMonth(2027, 2)).toEqual({ quarter: 4, fyStartYear: 2026 }) // Mar 2027
  })
})

describe('rmgQuarterLabel', () => {
  it('labels each quarter of FY 26/27', () => {
    expect(rmgQuarterLabel({ quarter: 1, fyStartYear: 2026 })).toBe('Q1 FY 26/27')
    expect(rmgQuarterLabel({ quarter: 4, fyStartYear: 2026 })).toBe('Q4 FY 26/27')
  })
})

describe('rmgQuarterDates', () => {
  it('gives fixed calendar boundaries for each quarter', () => {
    expect(rmgQuarterDates({ quarter: 1, fyStartYear: 2026 })).toEqual({ start: '2026-04-01', end: '2026-06-30' })
    expect(rmgQuarterDates({ quarter: 2, fyStartYear: 2026 })).toEqual({ start: '2026-07-01', end: '2026-09-30' })
    expect(rmgQuarterDates({ quarter: 3, fyStartYear: 2026 })).toEqual({ start: '2026-10-01', end: '2026-12-31' })
    // Q4 lands in the following calendar year.
    expect(rmgQuarterDates({ quarter: 4, fyStartYear: 2026 })).toEqual({ start: '2027-01-01', end: '2027-03-31' })
  })
})

describe('nextRmgQuarter', () => {
  it('advances within a FY', () => {
    expect(nextRmgQuarter({ quarter: 2, fyStartYear: 2026 })).toEqual({ quarter: 3, fyStartYear: 2026 })
  })
  it('rolls Q4 over into Q1 of the next FY', () => {
    expect(nextRmgQuarter({ quarter: 4, fyStartYear: 2026 })).toEqual({ quarter: 1, fyStartYear: 2027 })
  })
})

describe('deriveNextQuarterPeriod', () => {
  it('derives Q3 FY26/27 from the latest period being Q2 (the task example)', () => {
    expect(deriveNextQuarterPeriod('2026-07-01')).toEqual({
      period_name: 'Q3 FY 26/27',
      period_start_date: '2026-10-01',
      period_end_date: '2026-12-31',
    })
  })

  it('rolls a year boundary: Q4 → Q1 of the next FY', () => {
    // Latest = Q4 FY26/27 (starts Jan 2027) → next = Q1 FY27/28 (Apr–Jun 2027).
    expect(deriveNextQuarterPeriod('2027-01-01')).toEqual({
      period_name: 'Q1 FY 27/28',
      period_start_date: '2027-04-01',
      period_end_date: '2027-06-30',
    })
  })

  it('derives the Jan–Mar quarter (crossing into the next calendar year)', () => {
    // Latest = Q3 FY26/27 (starts Oct 2026) → next = Q4 FY26/27 (Jan–Mar 2027).
    expect(deriveNextQuarterPeriod('2026-10-01')).toEqual({
      period_name: 'Q4 FY 26/27',
      period_start_date: '2027-01-01',
      period_end_date: '2027-03-31',
    })
  })
})
