import { describe, expect, it } from 'vitest'
import { computeConflictDayMath } from '../conflictDayMath'

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
