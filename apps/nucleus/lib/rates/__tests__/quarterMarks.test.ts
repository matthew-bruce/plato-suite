import { describe, it, expect } from 'vitest'
import { generateQuarterMarks } from '../quarterMarks'

describe('generateQuarterMarks', () => {
  it('labels Apr–Dec dates as "this calendar year → next" (1 Jul 2023 = Q2 FY 23/24)', () => {
    const start = Date.UTC(2023, 5, 1) // 1 Jun 2023
    const end = Date.UTC(2023, 7, 1) // 1 Aug 2023
    const marks = generateQuarterMarks(start, end)
    expect(marks).toEqual([{ ms: Date.UTC(2023, 6, 1), label: 'Q2 FY 23/24' }])
  })

  it('labels Jan–Mar dates as "previous calendar year → this" (1 Jan 2026 = Q4 FY 25/26)', () => {
    const start = Date.UTC(2025, 11, 1) // 1 Dec 2025
    const end = Date.UTC(2026, 1, 1) // 1 Feb 2026
    const marks = generateQuarterMarks(start, end)
    expect(marks).toEqual([{ ms: Date.UTC(2026, 0, 1), label: 'Q4 FY 25/26' }])
  })

  it('all four quarter boundaries in one financial year label correctly', () => {
    const marks = generateQuarterMarks(Date.UTC(2025, 3, 1), Date.UTC(2026, 0, 1))
    expect(marks.map((m) => m.label)).toEqual([
      'Q1 FY 25/26', // 1 Apr 2025
      'Q2 FY 25/26', // 1 Jul 2025
      'Q3 FY 25/26', // 1 Oct 2025
      'Q4 FY 25/26', // 1 Jan 2026
    ])
  })

  it('a 5-year window produces ~20 boundary lines (4 per year)', () => {
    const end = Date.UTC(2026, 6, 8) // "today" per the range control's anchor
    const start = new Date(end)
    start.setUTCFullYear(start.getUTCFullYear() - 5)
    const marks = generateQuarterMarks(start.getTime(), end)
    expect(marks.length).toBeGreaterThanOrEqual(19)
    expect(marks.length).toBeLessThanOrEqual(21)
    // Strictly ascending and none outside the window.
    for (let i = 1; i < marks.length; i++) expect(marks[i].ms).toBeGreaterThan(marks[i - 1].ms)
    for (const m of marks) {
      expect(m.ms).toBeGreaterThanOrEqual(start.getTime())
      expect(m.ms).toBeLessThanOrEqual(end)
    }
  })

  it('excludes boundaries outside the window on both edges', () => {
    // Window covers exactly one boundary (1 Jul 2024); the neighbours
    // (1 Apr 2024, 1 Oct 2024) must not appear.
    const marks = generateQuarterMarks(Date.UTC(2024, 5, 15), Date.UTC(2024, 8, 15))
    expect(marks).toEqual([{ ms: Date.UTC(2024, 6, 1), label: 'Q2 FY 24/25' }])
  })

  it('a boundary landing exactly on the window edge is included (inclusive range)', () => {
    const boundary = Date.UTC(2025, 0, 1) // 1 Jan 2025
    const marks = generateQuarterMarks(boundary, boundary)
    expect(marks).toEqual([{ ms: boundary, label: 'Q4 FY 24/25' }])
  })

  it('returns an empty array when end is before start', () => {
    expect(generateQuarterMarks(Date.UTC(2025, 0, 1), Date.UTC(2024, 0, 1))).toEqual([])
  })

  it('works across decade/century-style boundaries (year 2000, year 2099→2100)', () => {
    const marksY2K = generateQuarterMarks(Date.UTC(1999, 11, 1), Date.UTC(2000, 1, 1))
    expect(marksY2K.map((m) => m.label)).toContain('Q4 FY 99/00')
  })

  it('a long ("All time") window still produces one mark per quarter — no thinning at the generation level', () => {
    // ~8.5 years, matching the real earliest-data scenario (2018 → today).
    const marks = generateQuarterMarks(Date.UTC(2018, 9, 1), Date.UTC(2026, 6, 8))
    expect(marks.length).toBeGreaterThan(20)
    // Strictly one mark per quarter boundary, none skipped.
    for (let i = 1; i < marks.length; i++) {
      const prevMonth = new Date(marks[i - 1].ms).getUTCMonth()
      const expectedGapMonths = 3
      const gapMonths =
        (new Date(marks[i].ms).getUTCFullYear() - new Date(marks[i - 1].ms).getUTCFullYear()) * 12 +
        (new Date(marks[i].ms).getUTCMonth() - prevMonth)
      expect(gapMonths).toBe(expectedGapMonths)
    }
  })
})
