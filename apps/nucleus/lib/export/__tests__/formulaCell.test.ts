import { describe, expect, it } from 'vitest'
import { formulaCell } from '../formulaCell'

/* ══════════════════════════════════════════════════════════════════════
   Every formula in the export used to be written as
   `{ formula: `=${expr}` }` directly, which stored a doubled "=="
   inside the cell's <f> element in the raw XML — invalid OOXML, no cached
   value, present identically in the Rate Calculator and Platform Schedule
   exports since both write formulas through the same code. formulaCell()
   is now the one place a formula string becomes an ExcelJS cell value.
══════════════════════════════════════════════════════════════════════ */

describe('formulaCell', () => {
  it('strips a leading "=" — the bug this exists to prevent', () => {
    expect(formulaCell('=A1+A2')).toEqual({ formula: 'A1+A2' })
  })

  it('leaves an expression with no leading "=" unchanged', () => {
    expect(formulaCell('A1+A2')).toEqual({ formula: 'A1+A2' })
  })

  it('strips only the one leading "=", not "=" characters inside the expression', () => {
    // IF(...) and comparison formulas contain "=" mid-expression; only a
    // leading one is the bug.
    expect(formulaCell('=IF(E4="PR","Yes","No")')).toEqual({
      formula: 'IF(E4="PR","Yes","No")',
    })
    expect(formulaCell('IF(C13=0,0,C11/C13)')).toEqual({
      formula: 'IF(C13=0,0,C11/C13)',
    })
  })

  it('never produces a value starting with "=="', () => {
    for (const input of ['=A1', 'A1', '==A1', '=SUM(A1:A2)']) {
      expect(formulaCell(input).formula.startsWith('==')).toBe(false)
    }
  })

  it('==A1 (an already-doubled input) strips only the first "="', () => {
    // Defensive edge case, not a real input this codebase produces: proves
    // the function does exactly one strip, not a loop that could mask a
    // different bug producing triple+ equals signs.
    expect(formulaCell('==A1')).toEqual({ formula: '=A1' })
  })
})
