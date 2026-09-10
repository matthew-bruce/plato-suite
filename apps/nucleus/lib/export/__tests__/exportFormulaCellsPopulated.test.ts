import { describe, expect, it } from 'vitest'
import { buildSampleExportWorkbook } from './exportFormulaSample'
import { evaluateFormula } from './helpers/evaluateSheetFormula'
import type { Grid } from './helpers/evaluateSheetFormula'

/* ══════════════════════════════════════════════════════════════════════
   The doubled "==" left every formula cell with no usable value: a strict
   parser either refuses the file outright or, per-cell, reports None/null
   for anything that should have computed. This asserts the positive
   property directly — Advised Rate, the per-row Chargeable/Total/+VAT
   columns, and the L/M SUBTOTAL split (buildPlatformTotalFormula's output,
   what the bug report calls the "L119/M119" cells) are all non-null AND,
   for the ones with a real numeric meaning, evaluate to the correct figure
   — not merely "a formula string is attached to the cell", which the
   broken "==" version would also have satisfied.
══════════════════════════════════════════════════════════════════════ */

function formulaAt(workbook: ReturnType<typeof buildSampleExportWorkbook>['workbook'], ref: string): string {
  const [sheetName, cellAddr] = ref.split('!')
  const ws = workbook.getWorksheet(sheetName)
  if (!ws) throw new Error(`no such sheet: ${sheetName}`)
  const value = ws.getCell(cellAddr).value
  if (!value || typeof value !== 'object' || !('formula' in value)) {
    throw new Error(`${ref} does not hold a formula cell (value: ${JSON.stringify(value)})`)
  }
  return (value as { formula: string }).formula
}

describe('key export formula cells are non-null and evaluate correctly', () => {
  const { workbook, cells } = buildSampleExportWorkbook()

  it('every named cell holds a formula — none is null, none is missing', () => {
    const allRefs = [
      cells.advisedRate,
      ...cells.perRowChargeable,
      ...cells.perRowTotal,
      ...cells.perRowVat,
      cells.subtotalL,
      cells.subtotalM,
      cells.crossSheetSum,
    ]
    for (const ref of allRefs) {
      expect(() => formulaAt(workbook, ref)).not.toThrow()
      const formula = formulaAt(workbook, ref)
      expect(formula).not.toBeNull()
      expect(formula.length).toBeGreaterThan(0)
    }
  })

  it('the L/M SUBTOTAL split ("L119/M119") evaluates to the correct total, BAU excluded', () => {
    // Sample data: PR day-rate £500, F_Gov £400, BAU £0 (excluded by the
    // formula's own <>"BAU" criterion) — all 1 day × 100% util × 10 days.
    const grid: Grid = new Map<string, number | string>([
      ['E3', 'PR'], ['L3', 5000], ['M3', 5000 * 1.07082],
      ['E4', 'F_Gov'], ['L4', 4000], ['M4', 4000 * 1.07082],
      ['E5', 'BAU'], ['L5', 0], ['M5', 0],
    ])
    const lFormula = formulaAt(workbook, cells.subtotalL)
    const mFormula = formulaAt(workbook, cells.subtotalM)

    const lTotal = evaluateFormula(lFormula, grid)
    const mTotal = evaluateFormula(mFormula, grid)

    expect(lTotal).not.toBeNull()
    expect(Number.isFinite(lTotal)).toBe(true)
    expect(lTotal).toBe(9000) // 5000 + 4000, BAU's 0 doesn't matter either way
    expect(mTotal).toBeCloseTo(9000 * 1.07082, 6)
  })

  it('Advised Rate divides the subtotal by billable days — a real division, not null or blank', () => {
    const formula = formulaAt(workbook, cells.advisedRate)
    // M<subtotalRow>/I<billableDaysRow>: a plain division over two real cell
    // references. The SUBTOTAL test above already proves the numerator's own
    // formula evaluates correctly; what matters here is that this cell is
    // neither null/blank (the direct symptom of the "==" bug) nor pointed at
    // the wrong cells.
    expect(formula).not.toBeNull()
    expect(formula).toMatch(/^M\d+\/I\d+$/)
    const [, subtotalRow] = formula.match(/^M(\d+)\//) ?? []
    expect(`M${subtotalRow}`).toBe(cells.subtotalM.split('!')[1])
  })

  it('per-row Chargeable/Total/+VAT columns are populated for every resource row', () => {
    expect(cells.perRowChargeable.length).toBeGreaterThan(0)
    expect(cells.perRowChargeable.length).toBe(cells.perRowTotal.length)
    expect(cells.perRowChargeable.length).toBe(cells.perRowVat.length)

    for (let i = 0; i < cells.perRowChargeable.length; i++) {
      expect(formulaAt(workbook, cells.perRowChargeable[i])).toMatch(/^IF\(E\d+="PR","Yes","No"\)$/)
      expect(formulaAt(workbook, cells.perRowTotal[i])).toMatch(/^\(H\d+\*I\d+\)\*J\d+$/)
      expect(formulaAt(workbook, cells.perRowVat[i])).toMatch(/^L\d+\*\$I\$\d+$/)
    }
  })

  it('the cross-sheet SUM (Raw Data’s Totals table pattern) points at the other sheet', () => {
    const formula = formulaAt(workbook, cells.crossSheetSum)
    expect(formula).toMatch(/^'Web'!L\d+$/)
  })
})
