import { describe, expect, it } from 'vitest'
import { buildPlatformTotalFormula } from '../platformTotalFormula'
import { evaluateFormula } from './helpers/evaluateSheetFormula'
import type { Grid } from './helpers/evaluateSheetFormula'

describe('buildPlatformTotalFormula — the string written into the sheet', () => {
  const base = {
    column: 'M',
    planviewColumn: 'E',
    resources: { first: 3, last: 104 },
    costSections: [
      { first: 108, last: 109 },
      { first: 113, last: 114 },
    ],
  }

  it('sums the allocation rows by planview, then each cost block whole', () => {
    expect(buildPlatformTotalFormula(base)).toBe(
      'SUMPRODUCT(SUBTOTAL(109,OFFSET($M$3,ROW($M$3:$M$104)-ROW($M$3),0)),' +
        '($E$3:$E$104<>"BAU")*($E$3:$E$104<>"NPC")*($E$3:$E$104<>""))' +
        '+SUBTOTAL(109,M108:M109)+SUBTOTAL(109,M113:M114)',
    )
  })

  it('is filter-aware: every part goes through SUBTOTAL, never a bare SUM', () => {
    const f = buildPlatformTotalFormula(base)
    expect(f).toContain('SUBTOTAL(109,OFFSET(')
    expect(f).not.toMatch(/(^|[^A-Z])SUM\(/)
    expect(f).not.toContain('SUMIFS(')
  })

  it('excludes both BAU and NPC, and blank planview cells', () => {
    const f = buildPlatformTotalFormula(base)
    expect(f).toContain('<>"BAU"')
    expect(f).toContain('<>"NPC"')
    expect(f).toContain('<>""')
  })

  it('sums the column it is asked for, and reads codes from the code column', () => {
    const l = buildPlatformTotalFormula({ ...base, column: 'L' })
    expect(l).toContain('OFFSET($L$3,')
    expect(l).toContain('$E$3:$E$104')
    expect(l).not.toContain('$M$')
  })

  it('omits cost blocks that have no rows', () => {
    const f = buildPlatformTotalFormula({
      ...base,
      costSections: [{ first: 0, last: 0 }, { first: 113, last: 114 }],
    })
    expect(f).toBe(
      'SUMPRODUCT(SUBTOTAL(109,OFFSET($M$3,ROW($M$3:$M$104)-ROW($M$3),0)),' +
        '($E$3:$E$104<>"BAU")*($E$3:$E$104<>"NPC")*($E$3:$E$104<>""))' +
        '+SUBTOTAL(109,M113:M114)',
    )
  })

  it('falls back to a valid numeric cell when there is nothing at all', () => {
    expect(
      buildPlatformTotalFormula({
        column: 'M',
        planviewColumn: 'E',
        resources: { first: 0, last: 0 },
        costSections: [],
      }),
    ).toBe('0')
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Evaluating the formula against a simulated sheet.

   The string above is only correct if it reads the right cells, so this
   evaluates it over a grid laid out the way the export lays out the Rate
   Calculator sheet — supplier band rows included, since those carry text in
   the +VAT column and no planview code, and must not be counted.
══════════════════════════════════════════════════════════════════════ */

describe('the formula evaluated over a simulated Rate Calculator sheet', () => {
  // Rows 3..9: a supplier band (no planview, text in M) then six allocations.
  const grid: Grid = new Map<string, number | string>([
    ['E3', ''], ['L3', ''], ['M3', 'avg/day  £450.00'], // supplier band row
    ['E4', 'PR'], ['L4', 1000], ['M4', 1070],
    ['E5', 'PR'], ['L5', 2000], ['M5', 2140],
    ['E6', 'F_Gov'], ['L6', 500], ['M6', 535],
    ['E7', 'BAU'], ['L7', 800], ['M7', 856],
    ['E8', 'NPC'], ['L8', 900], ['M8', 963],
    ['E9', ''], ['L9', 700], ['M9', 749], // allocation with no planview code
    // Ad-hoc block
    ['L12', 100], ['M12', 107],
    ['L13', 200], ['M13', 200],
    // ETP / Shared Services block
    ['L16', 50], ['M16', 50],
  ])

  const opts = {
    planviewColumn: 'E',
    resources: { first: 3, last: 9 },
    costSections: [
      { first: 12, last: 13 },
      { first: 16, last: 16 },
    ],
  }

  it('counts PR and F_Gov, and both cost blocks', () => {
    const m = evaluateFormula(buildPlatformTotalFormula({ ...opts, column: 'M' }), grid)
    // 1070 + 2140 + 535 (allocations) + 107 + 200 (ad-hoc) + 50 (ETP)
    expect(m).toBe(4102)
  })

  it('leaves BAU, NPC and no-code rows out of the total though their rows exist', () => {
    const m = evaluateFormula(buildPlatformTotalFormula({ ...opts, column: 'M' }), grid)
    const everyRow = 1070 + 2140 + 535 + 856 + 963 + 749 + 107 + 200 + 50
    expect(m).toBeLessThan(everyRow)
    expect(everyRow - m).toBe(856 + 963 + 749)
  })

  it('ignores the supplier band row despite its text in the +VAT column', () => {
    expect(() =>
      evaluateFormula(buildPlatformTotalFormula({ ...opts, column: 'M' }), grid),
    ).not.toThrow()
  })

  it('sums the base column the same way', () => {
    const l = evaluateFormula(buildPlatformTotalFormula({ ...opts, column: 'L' }), grid)
    expect(l).toBe(1000 + 2000 + 500 + 100 + 200 + 50)
  })
})

/* ══════════════════════════════════════════════════════════════════════
   Filter-awareness.

   Both sheets carry an autofilter, so an analyst who filters to one
   supplier expects the subtotal beneath to follow. The previous SUMIFS
   form could not do that — it ignored the filter entirely and always
   reported the whole period.
══════════════════════════════════════════════════════════════════════ */

describe('the subtotal follows the sheet autofilter', () => {
  const grid: Grid = new Map<string, number | string>([
    ['E3', ''], ['L3', ''], ['M3', 'avg/day  £450.00'], // supplier band row
    ['E4', 'PR'], ['L4', 1000], ['M4', 1070],
    ['E5', 'PR'], ['L5', 2000], ['M5', 2140],
    ['E6', 'F_Gov'], ['L6', 500], ['M6', 535],
    ['E7', 'BAU'], ['L7', 800], ['M7', 856],
    ['E8', 'NPC'], ['L8', 900], ['M8', 963],
    ['E9', 'PR'], ['L9', '—'], ['M9', '—'], // zero-cost row: em dash, not a number
    ['L12', 100], ['M12', 107],
    ['L13', 200], ['M13', 200],
  ])

  const opts = {
    column: 'M',
    planviewColumn: 'E',
    resources: { first: 3, last: 9 },
    costSections: [{ first: 12, last: 13 }],
  }
  const formula = buildPlatformTotalFormula(opts)

  it('with nothing hidden, totals every costed row plus the cost block', () => {
    // 1070 + 2140 + 535 allocations, + 107 + 200 ad-hoc. BAU/NPC excluded by
    // criteria; the em-dash row contributes 0 without erroring.
    expect(evaluateFormula(formula, grid)).toBe(4052)
  })

  it('drops an allocation row the filter hides', () => {
    const hidden = new Set([5]) // the £2,140 PR row
    expect(evaluateFormula(formula, grid, hidden)).toBe(4052 - 2140)
  })

  it('drops a cost-item row the filter hides', () => {
    expect(evaluateFormula(formula, grid, new Set([12]))).toBe(4052 - 107)
  })

  it('hiding a BAU row changes nothing — it was never counted', () => {
    expect(evaluateFormula(formula, grid, new Set([7]))).toBe(4052)
  })

  it('hiding everything leaves zero, not an error', () => {
    expect(evaluateFormula(formula, grid, new Set([3, 4, 5, 6, 7, 8, 9, 12, 13]))).toBe(0)
  })

  it('survives text in the money column rather than raising #VALUE!', () => {
    // The band row's "avg/day £450.00" and the em dashes both sit inside the
    // summed range; SUBTOTAL(109) treats them as 0 the way SUM does.
    expect(() => evaluateFormula(formula, grid)).not.toThrow()
  })
})
