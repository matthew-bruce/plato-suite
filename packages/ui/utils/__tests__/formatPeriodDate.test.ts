import { describe, expect, it } from 'vitest'
import { formatPeriodDate } from '../formatPeriodDate'

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day)

describe('formatPeriodDate', () => {
  it('uses "st" for the 1st', () => {
    expect(formatPeriodDate(d(2026, 4, 1))).toBe('1st April 2026')
  })

  it('uses "nd" for the 2nd', () => {
    expect(formatPeriodDate(d(2026, 4, 2))).toBe('2nd April 2026')
  })

  it('uses "rd" for the 3rd', () => {
    expect(formatPeriodDate(d(2026, 4, 3))).toBe('3rd April 2026')
  })

  it('uses "th" for the 4th', () => {
    expect(formatPeriodDate(d(2026, 4, 4))).toBe('4th April 2026')
  })

  it('uses "th" for the 11th', () => {
    expect(formatPeriodDate(d(2026, 4, 11))).toBe('11th April 2026')
  })

  it('uses "th" for the 12th', () => {
    expect(formatPeriodDate(d(2026, 4, 12))).toBe('12th April 2026')
  })

  it('uses "th" for the 13th', () => {
    expect(formatPeriodDate(d(2026, 4, 13))).toBe('13th April 2026')
  })

  it('uses "st" for the 21st', () => {
    expect(formatPeriodDate(d(2026, 4, 21))).toBe('21st April 2026')
  })

  it('uses "nd" for the 22nd', () => {
    expect(formatPeriodDate(d(2026, 4, 22))).toBe('22nd April 2026')
  })

  it('uses "rd" for the 23rd', () => {
    expect(formatPeriodDate(d(2026, 4, 23))).toBe('23rd April 2026')
  })
})
