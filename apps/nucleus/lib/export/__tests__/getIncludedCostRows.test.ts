import { describe, expect, it } from 'vitest'
import { getIncludedCostRows } from '../rowPopulations'
import type { PopulationRow } from '../rowPopulations'
import { isIncludedInBaseCost } from '../../schedule/ui'

/* ══════════════════════════════════════════════════════════════════════
   getIncludedCostRows answers "which rows cost the platform money" — the
   population behind every money total in BOTH export variants. It must
   delegate to isIncludedInBaseCost rather than restate the rule, so the
   Platform Schedule export cannot drift from the Rate Calculator's figures.
══════════════════════════════════════════════════════════════════════ */

const row = (over: Partial<PopulationRow>): PopulationRow => ({
  planview_code: 'PR',
  resource_id: 'res-1',
  ...over,
})

describe('getIncludedCostRows', () => {
  it('includes PR and F_Gov — the codes the platform bears', () => {
    const rows = [row({ planview_code: 'PR' }), row({ planview_code: 'F_Gov' })]
    expect(getIncludedCostRows(rows)).toHaveLength(2)
  })

  it('excludes BAU and NPC — visible or not, they cost the platform nothing', () => {
    const rows = [row({ planview_code: 'BAU' }), row({ planview_code: 'NPC' })]
    expect(getIncludedCostRows(rows)).toHaveLength(0)
  })

  it('excludes rows with no planview code at all', () => {
    expect(getIncludedCostRows([row({ planview_code: null })])).toHaveLength(0)
    expect(getIncludedCostRows([row({ planview_code: undefined })])).toHaveLength(0)
  })

  it('INCLUDES a vacant seat that carries a rate — cost does not require a person', () => {
    // The trap this guards: a vacant PR seat is budgeted, has a day rate, and
    // is counted in Total Platform Cost. It is not headcount (nobody is in
    // it), so anything driving cost off a "named person" filter loses it.
    const vacant = row({ planview_code: 'PR', resource_id: null })
    expect(getIncludedCostRows([vacant])).toEqual([vacant])
  })

  it('is exactly isIncludedInBaseCost, not a second rule that resembles it', () => {
    // Pinned against the shared predicate directly: if someone reimplements
    // this filter inline and the two drift, this fails on the first code
    // whose answers diverge.
    for (const code of ['PR', 'F_Gov', 'ETP', 'BAU', 'NPC', null, undefined, '']) {
      const candidate = row({ planview_code: code })
      const kept = getIncludedCostRows([candidate]).length === 1
      expect(kept).toBe(isIncludedInBaseCost(code))
    }
  })

  it('preserves input order and returns the original row objects', () => {
    const a = row({ planview_code: 'PR' })
    const b = row({ planview_code: 'BAU' })
    const c = row({ planview_code: 'F_Gov' })
    expect(getIncludedCostRows([a, b, c])).toEqual([a, c])
  })

  it('returns an empty array rather than throwing on no rows', () => {
    expect(getIncludedCostRows([])).toEqual([])
  })
})
