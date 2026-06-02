import { describe, expect, it } from 'vitest'
import { calcVat } from '../calcVat'

describe('calcVat', () => {
  it('returns amount unchanged when vat does not apply', () => {
    expect(calcVat(100_000, false, 20)).toBe(100_000)
  })
  it('applies vat uplift when vat applies', () => {
    expect(calcVat(100_000, true, 20)).toBe(120_000)
  })
  it('rounds fractional pence', () => {
    expect(calcVat(1, true, 20)).toBe(1)
    expect(calcVat(10, true, 7)).toBe(11)
  })
  it('handles zero uplift', () => {
    expect(calcVat(50_000, true, 0)).toBe(50_000)
  })
  it('handles zero amount', () => {
    expect(calcVat(0, true, 20)).toBe(0)
    expect(calcVat(0, false, 20)).toBe(0)
  })
})
