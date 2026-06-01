import { describe, it, expect } from 'vitest'
import { calcCostItemVat } from '../costItems'

describe('calcCostItemVat', () => {
  it('returns amount unchanged when vat does not apply', () => {
    expect(calcCostItemVat(10_000_00, false, 20)).toBe(10_000_00)
  })

  it('applies vat uplift when vat_applies is true', () => {
    expect(calcCostItemVat(10_000_00, true, 20)).toBe(12_000_00)
  })

  it('handles zero vatPct with vat_applies true', () => {
    expect(calcCostItemVat(10_000_00, true, 0)).toBe(10_000_00)
  })

  it('rounds fractional pence to nearest integer', () => {
    // 3p * 1.2 = 3.6p → rounds to 4p
    expect(calcCostItemVat(3, true, 20)).toBe(4)
  })

  it('handles zero amount', () => {
    expect(calcCostItemVat(0, true, 20)).toBe(0)
    expect(calcCostItemVat(0, false, 20)).toBe(0)
  })
})
