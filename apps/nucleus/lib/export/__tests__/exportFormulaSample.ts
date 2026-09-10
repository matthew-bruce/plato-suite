// A sample workbook built the same way route.ts builds the real export's
// formula cells — same helper (formulaCell), same shapes (the per-row
// Chargeable/Total/+VAT formulas, the buildPlatformTotalFormula SUBTOTAL
// split, the Advised Rate divide, a cross-sheet SUM) — shared by the two
// regression tests in this directory rather than duplicated between them.
//
// This exists because route.ts's own GET() cannot be unit-tested directly:
// it calls Next.js's cookies() via @plato/schema/server, which throws
// outside a real request scope, and no other route in this codebase attempts
// to mock around that. Exercising the actual shared formula-writing pieces
// against representative data is the faithful alternative — it is the same
// code, in the same shapes, that route.ts calls for these cells.

import ExcelJS from 'exceljs'
import { formulaCell } from '../formulaCell'
import { buildPlatformTotalFormula } from '../platformTotalFormula'

export interface SampleWorkbook {
  workbook: ExcelJS.Workbook
  /** Cell coordinates of the specific formulas this regression guards,
   *  named the way the bug report did (Advised Rate, per-row cost columns,
   *  the L/M subtotal split). */
  cells: {
    advisedRate: string
    perRowChargeable: string[]
    perRowTotal: string[]
    perRowVat: string[]
    subtotalL: string
    subtotalM: string
    crossSheetSum: string
  }
}

/** Mirrors route.ts's Web/Rate Calculator sheet: a header, 3 resource rows
 *  (one BAU, so the SUBTOTAL's exclusion criteria has something to exclude),
 *  a VAT multiplier row, and the SUBTOTAL/Advised-Rate rows beneath. */
export function buildSampleExportWorkbook(): SampleWorkbook {
  const workbook = new ExcelJS.Workbook()
  const ws = workbook.addWorksheet('Web')

  const FIRST_DATA_ROW = 3
  ws.addRow([])
  ws.addRow(['Role', 'Resource', 'PO', 'Team', 'Planview', 'Org', 'Loc', 'Util', 'Days', 'Rate', 'Chargeable', 'Total', '+VAT'])

  const rows: [string, number][] = [
    ['PR', 50000],
    ['F_Gov', 40000],
    ['BAU', 0],
  ]
  const perRowChargeable: string[] = []
  const perRowTotal: string[] = []
  const perRowVat: string[] = []

  let rowNum = FIRST_DATA_ROW
  for (const [code, rate] of rows) {
    ws.addRow([
      'Role', 'Person', 'WEB', 'Team', code, 'Org', 'Onshore', 1, 10, rate / 100,
      formulaCell(`IF(E${rowNum}="PR","Yes","No")`),
      formulaCell(`(H${rowNum}*I${rowNum})*J${rowNum}`),
      formulaCell(`L${rowNum}`), // VAT placeholder, same as route.ts's pass 1
    ])
    perRowChargeable.push(`K${rowNum}`)
    perRowTotal.push(`L${rowNum}`)
    perRowVat.push(`M${rowNum}`)
    rowNum++
  }
  const lastResourceRow = rowNum - 1

  ws.addRow([])
  const vatMultiplierRow = ws.rowCount + 1
  ws.addRow(['VAT Multiplier', '', '', '', '', '', '', '', 1.07082])

  // Pass 2, as route.ts does: back-fill the VAT column now the multiplier
  // row is known.
  for (const ref of perRowVat) {
    const r = parseInt(ref.slice(1), 10)
    ws.getCell(`M${r}`).value = formulaCell(`L${r}*$I$${vatMultiplierRow}`)
  }

  const subtotalRow = ws.rowCount + 1
  const subtotalFormula = (col: 'L' | 'M') =>
    buildPlatformTotalFormula({
      column: col,
      planviewColumn: 'E',
      resources: { first: FIRST_DATA_ROW, last: lastResourceRow },
      costSections: [],
    })
  ws.addRow([
    'SUBTOTAL', '', '', '', '', '', '', '', '', '', '',
    formulaCell(subtotalFormula('L')),
    formulaCell(subtotalFormula('M')),
  ])

  const billableDaysRow = ws.rowCount + 1
  ws.addRow([
    'Total Billable Days', '', '', '', '', '', '', '',
    formulaCell(
      `SUMPRODUCT((K${FIRST_DATA_ROW}:K${lastResourceRow}="Yes")*(H${FIRST_DATA_ROW}:H${lastResourceRow})*(I${FIRST_DATA_ROW}:I${lastResourceRow}))`,
    ),
  ])

  const advisedRateRow = ws.rowCount + 1
  ws.addRow([
    'Advised Rate', '', '', '', '', '', '', '',
    formulaCell(`M${subtotalRow}/I${billableDaysRow}`),
  ])

  // A second sheet, so the cross-sheet SUM (Raw Data's Totals table) has
  // somewhere real to point at — mirrors buildRawDataTotalsTable.
  const ws2 = workbook.addWorksheet('Summary')
  ws2.getCell('C10').value = 500
  const crossSheetRow = 1
  ws2.getCell(`B${crossSheetRow}`).value = formulaCell(`'Web'!L${subtotalRow}`)

  return {
    workbook,
    cells: {
      advisedRate: `Web!I${advisedRateRow}`,
      perRowChargeable: perRowChargeable.map((r) => `Web!${r}`),
      perRowTotal: perRowTotal.map((r) => `Web!${r}`),
      perRowVat: perRowVat.map((r) => `Web!${r}`),
      subtotalL: `Web!L${subtotalRow}`,
      subtotalM: `Web!M${subtotalRow}`,
      crossSheetSum: `Summary!B${crossSheetRow}`,
    },
  }
}
