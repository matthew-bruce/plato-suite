import { describe, expect, it } from 'vitest'
import { computeRowMoneyPence, computeVatPence, vatRateMilliPct } from '../money'

const RATE = 7082 // 7.082%

describe('vatRateMilliPct — exact, from the decimal digits', () => {
  it('converts the stored rate in either shape the database returns', () => {
    expect(vatRateMilliPct(7.082)).toBe(7082)
    expect(vatRateMilliPct('7.08200')).toBe(7082) // numeric(10,5) as text
    expect(vatRateMilliPct(20)).toBe(20_000)
    expect(vatRateMilliPct(0)).toBe(0)
  })

  it('refuses a rate it cannot hold exactly rather than rounding it', () => {
    expect(() => vatRateMilliPct(7.0825)).toThrow(/exactly/)
    expect(() => vatRateMilliPct('abc')).toThrow(/plain decimal/)
  })
})

describe('computeVatPence', () => {
  it('a row whose VAT is exactly x.5p rounds UP', () => {
    // £250.00 × 7.082% = 1,770.5p
    expect(computeVatPence(25_000, true, RATE)).toBe(1_771)
    // £750.00 × 7.082% = 5,311.5p
    expect(computeVatPence(75_000, true, RATE)).toBe(5_312)
  })

  it('regression: the float multiplier 1 + 7.082/100 rounds that half-penny DOWN; this does not', () => {
    const base = 25_000
    const floatIncVat = Math.round(base * (1 + 7.082 / 100)) // 1.0708199999999999
    expect(floatIncVat).toBe(26_770) // the old, wrong answer
    expect(base + computeVatPence(base, true, RATE)).toBe(26_771)
  })

  it('is 0 when VAT does not apply', () => {
    expect(computeVatPence(25_000, false, RATE)).toBe(0)
  })

  it('rounds below a half-penny down', () => {
    expect(computeVatPence(100, true, RATE)).toBe(7) // 7.082p
  })
})

describe('computeRowMoneyPence', () => {
  it('base = days × rate × utilisation; inc-VAT = base + VAT', () => {
    expect(
      computeRowMoneyPence({ capacityDays: 64, dayRatePence: 60_500, utilisationPercent: 100, vatApplies: true, vatRateMilliPct: RATE }),
    ).toEqual({ basePence: 3_872_000, vatPence: 274_215, incVatPence: 4_146_215 })
  })

  it('handles fractional capacity_days exactly', () => {
    // 64.5 × £453.33 = £29,239.785 → 2,923,979p (half-up)
    expect(
      computeRowMoneyPence({ capacityDays: 64.5, dayRatePence: 45_333, utilisationPercent: 100, vatApplies: false, vatRateMilliPct: RATE }).basePence,
    ).toBe(2_923_979)
    expect(
      computeRowMoneyPence({ capacityDays: '0.50', dayRatePence: 50_000, utilisationPercent: '100.00', vatApplies: true, vatRateMilliPct: RATE }),
    ).toEqual({ basePence: 25_000, vatPence: 1_771, incVatPence: 26_771 })
  })

  it('scales by utilisation, not the rate', () => {
    expect(
      computeRowMoneyPence({ capacityDays: 40, dayRatePence: 60_000, utilisationPercent: 50, vatApplies: true, vatRateMilliPct: RATE }).basePence,
    ).toBe(1_200_000)
  })

  it('costs float noise at the stored precision (64.30000000000001 → 64.30 days)', () => {
    const noisy = 21.1 + 21.1 + 22.1 // 64.30000000000001 in IEEE double
    expect(noisy).not.toBe(64.3)
    const money = (d: number) =>
      computeRowMoneyPence({ capacityDays: d, dayRatePence: 50_000, utilisationPercent: 100, vatApplies: false, vatRateMilliPct: RATE })
    expect(money(noisy)).toEqual(money(64.3))
  })

  it('treats null capacity_days as zero', () => {
    expect(
      computeRowMoneyPence({ capacityDays: null, dayRatePence: 50_000, utilisationPercent: 100, vatApplies: true, vatRateMilliPct: RATE }),
    ).toEqual({ basePence: 0, vatPence: 0, incVatPence: 0 })
  })
})
