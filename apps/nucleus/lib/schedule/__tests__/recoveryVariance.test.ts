import { describe, expect, it } from 'vitest'
import { computeRecoveryVariance } from '../recoveryVariance'
import { Q3_EXPECTED } from './fixtures/q3Fy2627'

/* ══════════════════════════════════════════════════════════════════════
   The exported workbook's Blended Rate Summary block computed this
   comparison itself, as (advised − current), and hard-coded a
   "▲ Shortfall" / "under-recovery" label onto the result regardless of
   its actual sign. Advised Rate is the break-even rate; if Current Rate
   is HIGHER, more is being recovered than the platform costs — a
   surplus — not a shortfall. The Schedule page's Recovery Variance card
   already had this the right way round: (current − advised) × days,
   positive is a surplus. This module is that same comparison, shared.

   Q3 FY 26/27's own advised rate (£575.58, from the fixture other tests in
   this suite already pin) anchors the surplus case in a real number rather
   than an arbitrary one; the genuine-shortfall case is synthetic, as the
   comparison is pure arithmetic and doesn't depend on which period it runs
   against.
══════════════════════════════════════════════════════════════════════ */

describe('computeRecoveryVariance', () => {
  const advisedRate = Q3_EXPECTED.advisedRateGbp // 575.58
  const days = Q3_EXPECTED.xChargeableDays // 4596.1

  it('Current Rate above Advised Rate is a surplus, not a shortfall', () => {
    const currentRate = advisedRate + 10 // £585.58/day, £10/day over cost
    const result = computeRecoveryVariance(currentRate, advisedRate, days)
    expect(result.direction).toBe('surplus')
    expect(result.triangle).toBe('▲')
    expect(result.perUnitVariance).toBeCloseTo(10, 6)
    // Positive: more is being recovered than the platform costs.
    expect(result.totalVariance).toBeGreaterThan(0)
    expect(result.totalVariance).toBeCloseTo(10 * days, 4)
  })

  it('Current Rate below Advised Rate is a genuine shortfall', () => {
    const currentRate = advisedRate - 15 // £560.58/day, £15/day under cost
    const result = computeRecoveryVariance(currentRate, advisedRate, days)
    expect(result.direction).toBe('shortfall')
    expect(result.triangle).toBe('▼')
    expect(result.perUnitVariance).toBeCloseTo(-15, 6)
    // Negative: less is being recovered than the platform costs.
    expect(result.totalVariance).toBeLessThan(0)
    expect(result.totalVariance).toBeCloseTo(-15 * days, 4)
  })

  it('Current Rate exactly equal to Advised Rate is on target, not either', () => {
    const result = computeRecoveryVariance(advisedRate, advisedRate, days)
    expect(result.direction).toBe('onTarget')
    expect(result.triangle).toBe('')
    expect(result.perUnitVariance).toBe(0)
    expect(result.totalVariance).toBe(0)
  })

  it('zero chargeable days collapses the total to zero without dividing by it', () => {
    // This module only multiplies by days, so it never risks a divide-by-zero
    // the way an advised-rate calculation (cost ÷ days) would.
    const result = computeRecoveryVariance(advisedRate + 50, advisedRate, 0)
    expect(result.direction).toBe('surplus')
    expect(result.perUnitVariance).toBeCloseTo(50, 6)
    expect(result.totalVariance).toBe(0)
  })

  it('the sign of totalVariance always matches perUnitVariance, never the reverse', () => {
    // The bug this guards against: a formula that negates the comparison
    // (advised − current instead of current − advised) but keeps otherwise
    // reasonable-looking rounding, sizes, and formatting, so the wrongness is
    // only visible in the sign.
    const surplus = computeRecoveryVariance(600, 575.58, days)
    const shortfall = computeRecoveryVariance(550, 575.58, days)
    expect(Math.sign(surplus.perUnitVariance)).toBe(Math.sign(surplus.totalVariance))
    expect(Math.sign(shortfall.perUnitVariance)).toBe(Math.sign(shortfall.totalVariance))
    expect(surplus.direction).toBe('surplus')
    expect(shortfall.direction).toBe('shortfall')
  })
})
