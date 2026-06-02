import { describe, expect, it } from 'vitest'
import { getPeriodStatus } from '../getPeriodStatus'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('getPeriodStatus', () => {
  it('returns active when today is within the period', () => {
    expect(getPeriodStatus(d(2026, 4, 1), d(2026, 6, 30), d(2026, 5, 15))).toBe('active')
  })

  it('returns active when today is exactly the start date', () => {
    expect(getPeriodStatus(d(2026, 4, 1), d(2026, 6, 30), d(2026, 4, 1))).toBe('active')
  })

  it('returns active when today is exactly the end date', () => {
    expect(getPeriodStatus(d(2026, 4, 1), d(2026, 6, 30), d(2026, 6, 30))).toBe('active')
  })

  it('returns historic when period end is yesterday', () => {
    expect(getPeriodStatus(d(2026, 1, 1), d(2026, 3, 31), d(2026, 4, 1))).toBe('historic')
  })

  it('returns historic when period ended months ago', () => {
    expect(getPeriodStatus(d(2025, 4, 1), d(2025, 6, 30), d(2026, 1, 1))).toBe('historic')
  })

  it('returns draft when period start is tomorrow', () => {
    expect(getPeriodStatus(d(2026, 7, 1), d(2026, 9, 30), d(2026, 6, 30))).toBe('draft')
  })

  it('returns draft when period starts months away', () => {
    expect(getPeriodStatus(d(2027, 1, 1), d(2027, 3, 31), d(2026, 6, 1))).toBe('draft')
  })
})
