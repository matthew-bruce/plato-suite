import { describe, expect, it } from 'vitest'
import { getPeriodIdentity } from '../getPeriodIdentity'

describe('getPeriodIdentity', () => {
  it('Q1: April start', () => {
    const result = getPeriodIdentity(new Date('2026-04-01'))
    expect(result.quarter).toBe(1)
    expect(result.fiscalYearStart).toBe(2026)
    expect(result.fiscalYearEnd).toBe(2027)
    expect(result.fiscalYearLabel).toBe('26/27')
  })

  it('Q2: July start', () => {
    const result = getPeriodIdentity(new Date('2026-07-01'))
    expect(result.quarter).toBe(2)
    expect(result.fiscalYearStart).toBe(2026)
    expect(result.fiscalYearEnd).toBe(2027)
    expect(result.fiscalYearLabel).toBe('26/27')
  })

  it('Q3: October start', () => {
    const result = getPeriodIdentity(new Date('2025-10-01'))
    expect(result.quarter).toBe(3)
    expect(result.fiscalYearStart).toBe(2025)
    expect(result.fiscalYearEnd).toBe(2026)
    expect(result.fiscalYearLabel).toBe('25/26')
  })

  it('Q4: January start', () => {
    const result = getPeriodIdentity(new Date('2026-01-01'))
    expect(result.quarter).toBe(4)
    expect(result.fiscalYearStart).toBe(2025)
    expect(result.fiscalYearEnd).toBe(2026)
    expect(result.fiscalYearLabel).toBe('25/26')
  })

  it('Q4: March start (edge)', () => {
    const result = getPeriodIdentity(new Date('2026-03-01'))
    expect(result.quarter).toBe(4)
    expect(result.fiscalYearStart).toBe(2025)
    expect(result.fiscalYearEnd).toBe(2026)
    expect(result.fiscalYearLabel).toBe('25/26')
  })

  it('Q1: April (new FY)', () => {
    const result = getPeriodIdentity(new Date('2025-04-01'))
    expect(result.quarter).toBe(1)
    expect(result.fiscalYearStart).toBe(2025)
    expect(result.fiscalYearEnd).toBe(2026)
    expect(result.fiscalYearLabel).toBe('25/26')
  })
})
