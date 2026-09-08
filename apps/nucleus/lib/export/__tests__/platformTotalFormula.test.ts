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
      'SUMIFS(M3:M104,E3:E104,"<>BAU",E3:E104,"<>NPC",E3:E104,"<>")' +
        '+SUM(M108:M109)+SUM(M113:M114)',
    )
  })

  it('excludes both BAU and NPC, and blank planview cells', () => {
    const f = buildPlatformTotalFormula(base)
    expect(f).toContain('"<>BAU"')
    expect(f).toContain('"<>NPC"')
    expect(f).toContain('"<>"')
  })

  it('sums the column it is asked for, and reads codes from the code column', () => {
    const l = buildPlatformTotalFormula({ ...base, column: 'L' })
    expect(l).toContain('SUMIFS(L3:L104,')
    expect(l).toContain('E3:E104')
    expect(l).not.toContain('SUMIFS(M')
  })

  it('omits cost blocks that have no rows', () => {
    const f = buildPlatformTotalFormula({
      ...base,
      costSections: [{ first: 0, last: 0 }, { first: 113, last: 114 }],
    })
    expect(f).toBe(
      'SUMIFS(M3:M104,E3:E104,"<>BAU",E3:E104,"<>NPC",E3:E104,"<>")+SUM(M113:M114)',
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
