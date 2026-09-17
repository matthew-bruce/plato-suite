// The seam between the two derivation passes.
//
// The granular pass cannot tell an arrival from a continuation on its own: the
// coarse period carries no month-level data, so "were they here in September?"
// is only answerable by the coarse pass. These cover that hand-off directly,
// rather than only through the segments it eventually produces.

import { describe, expect, it } from 'vitest'
import { buildPriorPresence, hadPresenceBefore } from '../deriveSegments'
import type { AllocationInput, TimelineSegment } from '../types'

const Q3 = { start: '2026-10-01', end: '2026-12-31' }

function alloc(supplier: string, monthlyDays: Record<string, number> = {}): AllocationInput {
  return { supplier, code: 'REG', monthlyDays }
}

function coarseSegment(end: string): TimelineSegment {
  return {
    supplier: 'CG',
    code: 'REG',
    start: '2026-07-01',
    end,
    realStart: false,
    realEnd: true,
    tentative: false,
    flag: null,
    commercialStartMismatch: null,
  }
}

describe('buildPriorPresence', () => {
  it('records only the months carrying booked days', () => {
    const presence = buildPriorPresence(
      [],
      [alloc('TCS', { '2026-10-01': 0, '2026-11-01': 11, '2026-12-01': 21 })],
      Q3,
    )

    expect([...presence.granularMonths].sort()).toEqual(['2026-11-01', '2026-12-01'])
  })

  it('treats an allocation with no monthly rows as present all quarter', () => {
    // No breakdown means a flat whole-quarter block, so they were here
    // throughout — not absent.
    const presence = buildPriorPresence([], [alloc('EPAM')], Q3)

    expect([...presence.granularMonths].sort()).toEqual([
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ])
  })

  it('merges every allocation, whatever its supplier', () => {
    // Presence is a fact about the person, not about one piece of paper.
    const presence = buildPriorPresence(
      [],
      [alloc('CG', { '2026-10-01': 22 }), alloc('TCS', { '2026-12-01': 21 })],
      Q3,
    )

    expect([...presence.granularMonths].sort()).toEqual(['2026-10-01', '2026-12-01'])
  })

  it('takes the furthest-reaching coarse segment as the coverage end', () => {
    const presence = buildPriorPresence(
      [coarseSegment('2026-08-13'), coarseSegment('2026-09-30')],
      [],
      Q3,
    )

    expect(presence.coarseCoverageEnd).toBe('2026-09-30')
  })

  it('reports no coarse coverage when the period is empty', () => {
    expect(buildPriorPresence([], [], Q3).coarseCoverageEnd).toBeNull()
  })
})

describe('hadPresenceBefore', () => {
  it('looks up the previous month inside the granular window', () => {
    const presence = buildPriorPresence([], [alloc('TCS', { '2026-10-01': 22 })], Q3)

    expect(hadPresenceBefore('2026-11-01', presence, Q3)).toBe(true)
    expect(hadPresenceBefore('2026-12-01', presence, Q3)).toBe(false)
  })

  it('falls through to the coarse period for the window’s first month', () => {
    const present = buildPriorPresence([coarseSegment('2026-09-30')], [], Q3)
    expect(hadPresenceBefore('2026-10-01', present, Q3)).toBe(true)

    const absent = buildPriorPresence([], [], Q3)
    expect(hadPresenceBefore('2026-10-01', absent, Q3)).toBe(false)
  })

  it('returns false when coarse cover stopped well before the seam', () => {
    // Left in July. By October nobody was here last month, so an October start
    // is a genuine arrival even though a Q2 allocation existed.
    const presence = buildPriorPresence([coarseSegment('2026-07-10')], [], Q3)

    expect(hadPresenceBefore('2026-10-01', presence, Q3)).toBe(false)
  })

  it('counts cover reaching any part of the prior month', () => {
    // Finished mid-September: they were still here in September, so October is
    // a continuation rather than an arrival.
    const presence = buildPriorPresence([coarseSegment('2026-09-04')], [], Q3)

    expect(hadPresenceBefore('2026-10-01', presence, Q3)).toBe(true)
  })
})
