import { describe, expect, it } from 'vitest'
import { buildSampleExportWorkbook } from './exportFormulaSample'

/* ══════════════════════════════════════════════════════════════════════
   Every formula cell in the exported workbook used to be written as
   `{ formula: `=${expr}` }` directly. ExcelJS does not strip a leading "="
   from that string — it writes it verbatim into the cell's <f> element, so
   the stored XML read "=<formula>" instead of the OOXML-valid "<formula>".
   Confirmed present identically in BOTH the Rate Calculator and Platform
   Schedule exports (same shared formula-writing code, same defect, same
   ~28 call sites across route.ts and rawDataTotalsTable.ts) — this was
   never specific to Platform Schedule's new formulas.

   formulaCell() (see ../formulaCell.ts) is now the one place a formula
   string becomes an ExcelJS cell value, and every one of those ~28 call
   sites goes through it. This test asserts the resulting property directly,
   over a workbook built the same way route.ts builds one, rather than only
   at the unit level: no formula string written to any cell starts with "==".
══════════════════════════════════════════════════════════════════════ */

describe('no exported formula cell has a doubled leading "="', () => {
  it('across every sheet and every formula cell in a representative sample', () => {
    const { workbook } = buildSampleExportWorkbook()

    let formulaCellCount = 0
    const offenders: string[] = []

    workbook.eachSheet((ws) => {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          const v = cell.value
          if (v && typeof v === 'object' && 'formula' in v) {
            formulaCellCount++
            const formula = (v as { formula: string }).formula
            if (formula.startsWith('=')) {
              offenders.push(`${ws.name}!${cell.address}: ${formula}`)
            }
          }
        })
      })
    })

    // The sample genuinely contains formula cells — otherwise this test
    // would pass vacuously.
    expect(formulaCellCount).toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })
})
