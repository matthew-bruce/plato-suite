import { describe, expect, it } from 'vitest'
import {
  describeRateConflict,
  resolveKeepRoleRate,
  resolveUseResourceRate,
} from '../rateConflict'

// Rates are integer pence: £600/day = 60000.
const ROLE_RATE = 60000
const RESOURCE_RATE = 72500

describe('describeRateConflict', () => {
  it('prompts when both rates are set and differ', () => {
    const c = describeRateConflict(ROLE_RATE, RESOURCE_RATE)
    expect(c.needsPrompt).toBe(true)
    expect(c.roleDayRate).toBe(ROLE_RATE)
    expect(c.resourceDayRate).toBe(RESOURCE_RATE)
  })

  it('does not prompt when both rates are set and identical', () => {
    const c = describeRateConflict(ROLE_RATE, ROLE_RATE)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(ROLE_RATE)
  })

  it('does not prompt when the resource has no override — keeps the role rate', () => {
    const c = describeRateConflict(ROLE_RATE, null)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(ROLE_RATE)
  })

  it('does not prompt when the role rate is null — takes the resource rate', () => {
    const c = describeRateConflict(null, RESOURCE_RATE)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(RESOURCE_RATE)
  })

  it('treats a zero role rate as unset and takes the resource rate', () => {
    const c = describeRateConflict(0, RESOURCE_RATE)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(RESOURCE_RATE)
  })

  it('treats a zero resource override as unset and keeps the role rate', () => {
    const c = describeRateConflict(ROLE_RATE, 0)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(ROLE_RATE)
  })

  it('resolves to 0 when neither rate is recorded', () => {
    const c = describeRateConflict(null, null)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(0)
  })

  it('treats undefined the same as null', () => {
    const c = describeRateConflict(undefined, undefined)
    expect(c.needsPrompt).toBe(false)
    expect(c.resolvedDayRate).toBe(0)
  })

  it('normalises zero to null on both sides', () => {
    const c = describeRateConflict(0, 0)
    expect(c.roleDayRate).toBeNull()
    expect(c.resourceDayRate).toBeNull()
    expect(c.needsPrompt).toBe(false)
  })
})

describe('the two resolved outcomes of a prompted conflict', () => {
  const conflict = describeRateConflict(ROLE_RATE, RESOURCE_RATE)

  it('keeping the role rate writes the role figure', () => {
    expect(resolveKeepRoleRate(conflict)).toBe(ROLE_RATE)
  })

  it('using the resource rate writes the resource figure', () => {
    expect(resolveUseResourceRate(conflict)).toBe(RESOURCE_RATE)
  })

  it('the two outcomes differ — that is what made it a conflict', () => {
    expect(resolveKeepRoleRate(conflict)).not.toBe(resolveUseResourceRate(conflict))
  })

  it('falls back to the other side when one is missing', () => {
    const roleOnly = describeRateConflict(ROLE_RATE, null)
    expect(resolveUseResourceRate(roleOnly)).toBe(ROLE_RATE)

    const resourceOnly = describeRateConflict(null, RESOURCE_RATE)
    expect(resolveKeepRoleRate(resourceOnly)).toBe(RESOURCE_RATE)
  })
})
