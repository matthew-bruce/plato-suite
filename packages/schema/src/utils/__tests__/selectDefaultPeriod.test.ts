import { describe, expect, it } from 'vitest'
import { selectDefaultPeriod, type DefaultPeriodCandidate } from '../schedule'

function period(id: string, start: string, end: string): DefaultPeriodCandidate {
  return { period_id: id, period_start_date: start, period_end_date: end }
}

describe('selectDefaultPeriod', () => {
  it('returns null for an empty list', () => {
    expect(selectDefaultPeriod([])).toBeNull()
  })

  it('returns the sole period when there is only one', () => {
    const only = period('a', '2026-04-01', '2026-06-30')
    expect(selectDefaultPeriod([only])).toBe(only)
  })

  it('picks the period with the latest end date, not the one flagged active (the reported bug)', () => {
    // Mirrors live data: Q1 is status="active" but Q2 is the genuinely-latest
    // quarter. Selection must land on Q2 regardless of any status flag.
    const q4 = period('q4', '2026-01-01', '2026-03-31')
    const q1 = period('q1', '2026-04-01', '2026-06-30')
    const q2 = period('q2', '2026-07-01', '2026-09-30')
    expect(selectDefaultPeriod([q4, q1, q2])?.period_id).toBe('q2')
  })

  it('is independent of array order — periods created / listed out of chronological order still resolve correctly', () => {
    const q4 = period('q4', '2026-01-01', '2026-03-31')
    const q1 = period('q1', '2026-04-01', '2026-06-30')
    const q2 = period('q2', '2026-07-01', '2026-09-30')
    // Deliberately scrambled (e.g. inserted newest-first, or created out of order).
    expect(selectDefaultPeriod([q2, q4, q1])?.period_id).toBe('q2')
    expect(selectDefaultPeriod([q1, q2, q4])?.period_id).toBe('q2')
  })

  it('a newly-created next-quarter draft becomes the default once its dates make it latest', () => {
    const q2 = period('q2', '2026-07-01', '2026-09-30')
    const existing = [period('q1', '2026-04-01', '2026-06-30'), q2]
    // Before creation, Q2 is the default.
    expect(selectDefaultPeriod(existing)?.period_id).toBe('q2')
    // After the wizard adds Q3 (Oct–Dec 2026), it takes over.
    const q3 = period('q3', '2026-10-01', '2026-12-31')
    expect(selectDefaultPeriod([...existing, q3])?.period_id).toBe('q3')
  })

  it('breaks an exact end-date tie deterministically by later start date', () => {
    const shorter = period('short', '2026-08-01', '2026-09-30')
    const longer = period('long', '2026-07-01', '2026-09-30')
    // Same end date → later start date wins, regardless of input order.
    expect(selectDefaultPeriod([longer, shorter])?.period_id).toBe('short')
    expect(selectDefaultPeriod([shorter, longer])?.period_id).toBe('short')
  })
})
