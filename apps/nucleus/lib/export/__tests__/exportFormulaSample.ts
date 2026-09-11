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
import { buildTeamScheduleSheet } from '../teamScheduleSheet'
import { buildSupplierScheduleSheet } from '../supplierScheduleSheet'
import type { VariantAllocationRow } from '../scheduleVariantRows'

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
    /** The two scoped sheets' SUM totals, which are formula cells too. */
    teamScheduleTotals: string[]
    supplierScheduleTotals: string[]
  }
}

/**
 * A small mixed fixture for the two scoped sheets: all four planview codes,
 * two suppliers, a multi-team split, and one person holding two allocation
 * records — enough that every branch of those sheets writes something.
 */
export const SCOPED_SHEET_FIXTURE: VariantAllocationRow[] = [
  {
    allocation_id: 'a-pr',
    resource_id: 'person-1',
    resource_name: 'A. Patel',
    role_title: 'Engineer',
    planview_code: 'PR',
    supplier_name: 'Capgemini',
    supplier_abbreviation: 'CG',
    supplier_colour: '#003C82',
    resource_location: 'onshore',
    utilisation_percent: 100,
    capacity_days: 64,
    day_rate: 60_000,
    vat_applies: true,
    teams: [
      { teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 0.5 },
      { teamId: 't-cygnus', teamName: 'Cygnus', capacitySplit: 0.5 },
    ],
  },
  {
    allocation_id: 'a-fgov',
    resource_id: 'person-2',
    resource_name: 'B. Okafor',
    role_title: 'Architect',
    planview_code: 'F_Gov',
    supplier_name: 'Capgemini',
    supplier_abbreviation: 'CG',
    supplier_colour: '#003C82',
    resource_location: 'nearshore',
    utilisation_percent: 80,
    capacity_days: 63,
    day_rate: 72_000,
    vat_applies: true,
    teams: [{ teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 1 }],
  },
  {
    allocation_id: 'a-bau',
    resource_id: 'person-3',
    resource_name: 'C. Nowak',
    role_title: 'Product Owner',
    planview_code: 'BAU',
    supplier_name: 'Royal Mail Group',
    supplier_abbreviation: 'RMG',
    supplier_colour: '#E2001A',
    resource_location: 'onshore',
    utilisation_percent: 50,
    capacity_days: 64,
    day_rate: 0,
    vat_applies: true,
    teams: [{ teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 1 }],
  },
  {
    allocation_id: 'a-npc',
    resource_id: 'person-4',
    resource_name: 'D. Marchetti',
    role_title: 'Engineer',
    planview_code: 'NPC',
    supplier_name: 'Capgemini',
    supplier_abbreviation: 'CG',
    supplier_colour: '#003C82',
    resource_location: 'offshore',
    utilisation_percent: 100,
    capacity_days: 11,
    day_rate: 54_000,
    vat_applies: true,
    teams: [{ teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 1 }],
  },
  // Same person as a-pr, after a mid-quarter supplier transition.
  {
    allocation_id: 'a-transition',
    resource_id: 'person-1',
    resource_name: 'A. Patel',
    role_title: 'Engineer',
    planview_code: 'PR',
    supplier_name: 'Tata Consultancy Services',
    supplier_abbreviation: 'TCS',
    supplier_colour: '#9B0A6E',
    resource_location: 'onshore',
    utilisation_percent: 100,
    capacity_days: 20,
    day_rate: 58_000,
    vat_applies: true,
    teams: [{ teamId: 't-pluto', teamName: 'Pluto', capacitySplit: 1 }],
  },
]

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

  // The two scoped sheets, built by the real renderers rather than mimicked,
  // so their SUM totals are covered by the same no-doubled-"=" guard as
  // everything else in the workbook. "Both" cost visibility is used
  // deliberately: it is the layout carrying the most formula cells.
  const teamWs = workbook.addWorksheet('Pluto')
  const teamResult = buildTeamScheduleSheet({
    ws: teamWs,
    rows: SCOPED_SHEET_FIXTURE.filter((r) => r.teams.some((t) => t.teamId === 't-pluto')),
    teamName: 'Pluto',
    teamScope: 't-pluto',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: 1.07082,
    blendedDayRatePence: 60_500,
    costVisibility: 'both',
  })

  const supplierWs = workbook.addWorksheet('Capgemini')
  const supplierResult = buildSupplierScheduleSheet({
    ws: supplierWs,
    rows: SCOPED_SHEET_FIXTURE.filter((r) => r.supplier_name === 'Capgemini'),
    supplierName: 'Capgemini',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: 1.07082,
  })

  const formulaTotalsIn = (
    sheetName: string,
    ws: ExcelJS.Worksheet,
    totalRow: number,
  ): string[] => {
    const refs: string[] = []
    ws.getRow(totalRow).eachCell((cell) => {
      const v = cell.value
      if (v && typeof v === 'object' && 'formula' in v) refs.push(`${sheetName}!${cell.address}`)
    })
    return refs
  }

  return {
    workbook,
    cells: {
      teamScheduleTotals: formulaTotalsIn('Pluto', teamWs, teamResult.totalRow),
      supplierScheduleTotals: formulaTotalsIn('Capgemini', supplierWs, supplierResult.totalRow),
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
