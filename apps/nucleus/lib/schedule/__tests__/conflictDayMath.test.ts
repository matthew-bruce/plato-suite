import { describe, expect, it } from 'vitest'
import { computeConflictDayMath, describeConflictPresentation } from '../conflictDayMath'

// A normal quarter is ~61 working days (see workingDaysBetween / format.ts).
const PERIOD = 61

describe('computeConflictDayMath', () => {
  it('reports no existing allocations (empty array)', () => {
    const r = computeConflictDayMath([], 20, PERIOD)
    expect(r.existingCount).toBe(0)
    expect(r.existingTotalCapacityDays).toBe(0)
    expect(r.combinedCapacityDays).toBe(20)
    expect(r.overCapacity).toBe(false)
  })

  it('combined well under period capacity is not over', () => {
    const r = computeConflictDayMath([10], 20, PERIOD)
    expect(r.existingCount).toBe(1)
    expect(r.existingTotalCapacityDays).toBe(10)
    expect(r.combinedCapacityDays).toBe(30)
    expect(r.overCapacity).toBe(false)
  })

  it('combined exactly at period capacity is not over', () => {
    const r = computeConflictDayMath([41], 20, PERIOD)
    expect(r.combinedCapacityDays).toBe(61)
    expect(r.combinedCapacityDays).toBe(PERIOD)
    expect(r.overCapacity).toBe(false)
  })

  it('combined over period capacity is over', () => {
    const r = computeConflictDayMath([50], 20, PERIOD)
    expect(r.combinedCapacityDays).toBe(70)
    expect(r.overCapacity).toBe(true)
  })

  it('sums multiple existing allocations correctly', () => {
    const r = computeConflictDayMath([15, 10, 20], 5, PERIOD)
    expect(r.existingCount).toBe(3)
    expect(r.existingTotalCapacityDays).toBe(45)
    expect(r.combinedCapacityDays).toBe(50)
    expect(r.overCapacity).toBe(false)
  })

  it('sums multiple existing allocations that together exceed capacity', () => {
    const r = computeConflictDayMath([30, 25, 20], 10, PERIOD)
    expect(r.existingTotalCapacityDays).toBe(75)
    expect(r.combinedCapacityDays).toBe(85)
    expect(r.overCapacity).toBe(true)
  })

  it('treats null/undefined capacity_days as zero', () => {
    const r = computeConflictDayMath([null, undefined, 10], null, PERIOD)
    expect(r.existingCount).toBe(3)
    expect(r.existingTotalCapacityDays).toBe(10)
    expect(r.combinedCapacityDays).toBe(10)
    expect(r.overCapacity).toBe(false)
  })
})

describe('describeConflictPresentation', () => {
  // Boundary: exactly one existing row + a vacant seat = 2 total rows.
  it('1 existing with vacant seat → comparison cards, "both" wording, 4 options', () => {
    const p = describeConflictPresentation(1, true)
    expect(p.totalRows).toBe(2)
    expect(p.layout).toBe('compare')
    expect(p.showConnectOptions).toBe(true)
    expect(p.optionCount).toBe(4)
    expect(p.keepLabel).toBe('Keep both as separate rows')
  })

  // Boundary: two or more existing rows = 3+ total rows.
  it('2 existing with vacant seat → list, dynamic count of 3, 2 options only', () => {
    const p = describeConflictPresentation(2, true)
    expect(p.totalRows).toBe(3)
    expect(p.layout).toBe('list')
    expect(p.showConnectOptions).toBe(false)
    expect(p.optionCount).toBe(2)
    expect(p.keepLabel).toBe('Keep all 3 as separate rows')
  })

  it('3 existing with vacant seat → list, dynamic count of 4', () => {
    const p = describeConflictPresentation(3, true)
    expect(p.totalRows).toBe(4)
    expect(p.layout).toBe('list')
    expect(p.optionCount).toBe(2)
    expect(p.keepLabel).toBe('Keep all 4 as separate rows')
  })

  // No vacant seat (new-role path) never offers the merge options, even for a
  // single existing row.
  it('1 existing, no vacant seat → list, "both" wording, 2 options', () => {
    const p = describeConflictPresentation(1, false)
    expect(p.totalRows).toBe(2)
    expect(p.layout).toBe('list')
    expect(p.showConnectOptions).toBe(false)
    expect(p.optionCount).toBe(2)
    expect(p.keepLabel).toBe('Keep both as separate rows')
  })

  it('2 existing, no vacant seat → list, "Keep all 3" wording, 2 options', () => {
    const p = describeConflictPresentation(2, false)
    expect(p.layout).toBe('list')
    expect(p.keepLabel).toBe('Keep all 3 as separate rows')
    expect(p.optionCount).toBe(2)
  })
})
