import { describe, expect, it } from 'vitest'
import { isVisibleInRateCalculatorExport } from '../rateCalculatorVisibility'

/* ══════════════════════════════════════════════════════════════════════
   NPC-coded roles never appear on supplier SOWs and are irrelevant to
   Finance's reconciliation, so unlike BAU (a real, known person the export
   correctly shows at £0 cost), NPC rows must not be visible anywhere in the
   Rate Calculator export — not merely excluded from cost or headcount. This
   is a third, independent rule from isIncludedInBaseCost (cost) and
   isCountedInHeadcount (headcount) in lib/schedule/ui.ts.
══════════════════════════════════════════════════════════════════════ */

describe('isVisibleInRateCalculatorExport', () => {
  it('shows PR, F_Gov, ETP and BAU', () => {
    for (const code of ['PR', 'F_Gov', 'ETP', 'BAU']) {
      expect(isVisibleInRateCalculatorExport(code)).toBe(true)
    }
  })

  it('hides NPC — the one code none of the cost/headcount rules alone hide from display', () => {
    expect(isVisibleInRateCalculatorExport('NPC')).toBe(false)
  })

  it('BAU is the deliberate exception: excluded from cost, but visible and counted', () => {
    // Pinning this explicitly, not just implicitly via the truth table above:
    // a future change that hides BAU (mistaking it for NPC) or shows NPC
    // (reverting this rule) both fail here.
    expect(isVisibleInRateCalculatorExport('BAU')).toBe(true)
    expect(isVisibleInRateCalculatorExport('NPC')).toBe(false)
  })

  it('null/undefined/empty are visible — this is not a "has a real code" filter', () => {
    // A row with no planview code at all is a data anomaly, not an NPC row;
    // this function's only job is "is this NPC", so it must not silently
    // hide anything else. (isIncludedInBaseCost and isCountedInHeadcount
    // both separately treat a missing code as excluded — that's a different
    // question, deliberately not this function's.)
    expect(isVisibleInRateCalculatorExport(null)).toBe(true)
    expect(isVisibleInRateCalculatorExport(undefined)).toBe(true)
    expect(isVisibleInRateCalculatorExport('')).toBe(true)
  })
})
