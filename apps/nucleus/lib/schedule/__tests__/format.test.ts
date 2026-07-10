import { describe, expect, it } from 'vitest'
import {
  formatMoneyPence,
  workingDaysBetween,
  computeVatTotalPence,
  shortQuarterLabel,
} from '../format'

describe('formatMoneyPence', () => {
  it('formats whole pounds with comma thousand separators', () => {
    expect(formatMoneyPence(55000)).toBe('£550')
    expect(formatMoneyPence(1677385_00)).toBe('£1,677,385')
  })

  it('formats with two decimals when requested', () => {
    expect(formatMoneyPence(55000, { decimals: 2 })).toBe('£550.00')
    expect(formatMoneyPence(91485, { decimals: 2 })).toBe('£914.85')
  })

  it('handles zero', () => {
    expect(formatMoneyPence(0)).toBe('£0')
  })
})

describe('workingDaysBetween', () => {
  it('counts business days inclusive', () => {
    // Mon 2025-01-06 → Fri 2025-01-10: 5 working days
    expect(workingDaysBetween('2025-01-06', '2025-01-10')).toBe(5)
  })

  it('skips weekends', () => {
    // Fri 2025-01-03 → Mon 2025-01-06: Fri + Mon = 2
    expect(workingDaysBetween('2025-01-03', '2025-01-06')).toBe(2)
  })

  it('counts Q4 FY25/26 (Jan–Mar 2025) at roughly 64 business days', () => {
    const n = workingDaysBetween('2025-01-01', '2025-03-31')
    expect(n).toBeGreaterThanOrEqual(63)
    expect(n).toBeLessThanOrEqual(65)
  })

  it('excludes the two UK bank holidays in Q3 FY26/27 (Oct–Dec 2026)', () => {
    // The next-quarter the Create New Period wizard pre-fills. Oct–Dec 2026 has
    // 66 weekdays; Christmas Day (Fri 2026-12-25) and the Boxing Day substitute
    // (Mon 2026-12-28) both fall on weekdays, so working days = 64.
    expect(workingDaysBetween('2026-10-01', '2026-12-31')).toBe(64)
  })

  it('returns 0 for invalid ranges', () => {
    expect(workingDaysBetween('2025-03-31', '2025-01-01')).toBe(0)
  })
})

describe('computeVatTotalPence', () => {
  it('returns base unchanged for internal supplier rows', () => {
    expect(computeVatTotalPence(100_000, 7.082, true)).toBe(100_000)
  })

  it('applies VAT uplift for external supplier rows', () => {
    expect(computeVatTotalPence(100_000, 7.082, false)).toBe(107_082)
  })

  it('handles zero uplift', () => {
    expect(computeVatTotalPence(50_000, 0, false)).toBe(50_000)
  })
})

describe('shortQuarterLabel', () => {
  it('removes the "FY" token for a short label', () => {
    expect(shortQuarterLabel('Q4 FY 25/26')).toBe('Q4 25/26')
    expect(shortQuarterLabel('Q1 FY 26/27')).toBe('Q1 26/27')
  })
})
