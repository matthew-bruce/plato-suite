import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTeamScheduleSheet, teamScheduleColumns, columnLetter } from '../teamScheduleSheet'
import { buildSupplierScheduleSheet, SUPPLIER_SCHEDULE_COLUMNS } from '../supplierScheduleSheet'
import { buildSampleExportWorkbook, SCOPED_SHEET_FIXTURE } from './exportFormulaSample'
import { NOT_APPLICABLE } from '../scheduleVariantRows'
import type { CostVisibility } from '../exportVariants'

const VAT = 1.07082
const BLENDED = 60_500

const PLUTO_ROWS = SCOPED_SHEET_FIXTURE.filter((r) =>
  r.teams.some((t) => t.teamId === 't-pluto'),
)
const CAPGEMINI_ROWS = SCOPED_SHEET_FIXTURE.filter((r) => r.supplier_name === 'Capgemini')

function buildTeamSheet(costVisibility: CostVisibility = 'both') {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Pluto')
  const result = buildTeamScheduleSheet({
    ws,
    rows: PLUTO_ROWS,
    teamName: 'Pluto',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: VAT,
    blendedDayRatePence: BLENDED,
    costVisibility,
  })
  return { ws, result, columns: teamScheduleColumns(costVisibility) }
}

function buildSupplierSheet() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Capgemini')
  const result = buildSupplierScheduleSheet({
    ws,
    rows: CAPGEMINI_ROWS,
    supplierName: 'Capgemini',
    periodName: 'Q3 FY 26/27',
    dateRange: '01 Oct 2026 – 31 Dec 2026',
    exportedAt: 'Exported 10 Sep 2026 at 09:00',
    vatMultiplier: VAT,
  })
  return { ws, result }
}

/** The cell in a built sheet for a given allocation and column key. */
function cellFor(
  ws: ExcelJS.Worksheet,
  columns: readonly { key: string }[],
  firstDataRow: number,
  rows: readonly { allocation_id: string }[],
  allocationId: string,
  key: string,
): ExcelJS.Cell {
  const rowOffset = rows.findIndex((r) => r.allocation_id === allocationId)
  const colIndex = columns.findIndex((c) => c.key === key) + 1
  return ws.getCell(firstDataRow + rowOffset, colIndex)
}

describe('Team Schedule sheet', () => {
  it('writes one row per allocation record, not per person', () => {
    const { result } = buildTeamSheet()
    const rowCount = result.lastDataRow - result.firstDataRow + 1
    expect(rowCount).toBe(PLUTO_ROWS.length)
    // A. Patel holds two of them.
    const patelRows = PLUTO_ROWS.filter((r) => r.resource_id === 'person-1')
    expect(patelRows).toHaveLength(2)
  })

  it('leads with the team name, not the quarter', () => {
    const { ws } = buildTeamSheet()
    expect(ws.getCell(1, 1).value).toBe('TEAM SCHEDULE')
    expect(ws.getCell(2, 1).value).toBe('Pluto')
    // The quarter is present, but as secondary information to the right.
    expect(ws.getCell(2, 1).font?.size).toBeGreaterThan(16)
  })

  it('states no single working-days figure anywhere in the header', () => {
    // Working days vary by resource location, so any one number would be
    // wrong for part of the file.
    const { ws } = buildTeamSheet()
    for (let row = 1; row <= 5; row++) {
      for (let col = 1; col <= 20; col++) {
        const value = ws.getCell(row, col).value
        if (typeof value === 'string') {
          expect(value.toLowerCase()).not.toContain('working day')
        }
      }
    }
  })

  it('states the cross-charge rate once, in the stats line', () => {
    const { ws } = buildTeamSheet()
    const stats = String(ws.getCell(3, 1).value)
    expect(stats).toContain('£605/day, Current Rate')
    expect(stats).toContain('All costs include VAT')
    expect(stats).toContain('included in platform cost')
  })

  it('gives a PR row a cross-charge figure and an F_Gov row an em dash', () => {
    const { ws, result, columns } = buildTeamSheet()
    const at = (id: string, key: string) =>
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, id, key)

    expect(at('a-pr', 'xcQuarter').value).toBe((BLENDED * 64) / 100)
    expect(at('a-fgov', 'xcQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('a-bau', 'xcQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('a-npc', 'xcQuarter').value).toBe(NOT_APPLICABLE)
  })

  it('still prices F_Gov commercially — its cost is real, only not recharged', () => {
    const { ws, result, columns } = buildTeamSheet()
    const commercial = cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-fgov', 'commQuarter')
    expect(typeof commercial.value).toBe('number')
    expect(commercial.value as number).toBeGreaterThan(0)
  })

  it('withholds an NPC row’s commercial figure and its day rate', () => {
    const { ws, result, columns } = buildTeamSheet()
    const at = (key: string) =>
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-npc', key)
    expect(at('commQuarter').value).toBe(NOT_APPLICABLE)
    expect(at('dayRate').value).toBe(NOT_APPLICABLE)
  })

  it('prints the team split the way the live page’s badges read', () => {
    const { ws, result, columns } = buildTeamSheet()
    expect(
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-pr', 'teamSplit').value,
    ).toBe('Pluto 50%, Cygnus 50%')
    // A single team at full allocation carries no information worth printing.
    expect(
      cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-fgov', 'teamSplit').value,
    ).toBe('')
  })

  it('shows the supplier short code on the supplier’s own brand colour', () => {
    const { ws, result, columns } = buildTeamSheet()
    const chip = cellFor(ws, columns, result.firstDataRow, PLUTO_ROWS, 'a-pr', 'supplier')
    expect(chip.value).toBe('CG')
    // Text is the brand hex itself; the ground is its pale tint.
    expect(chip.font?.color?.argb).toBe('FF003C82')
    const fill = chip.fill as ExcelJS.FillPattern
    expect(fill.fgColor?.argb).toMatch(/^FF[0-9A-F]{6}$/)
    expect(fill.fgColor?.argb).not.toBe('FF003C82')
  })

  it('totals the cost columns but never the day rate column', () => {
    const { ws, result, columns } = buildTeamSheet()
    const dayRateCol = columns.findIndex((c) => c.key === 'dayRate') + 1
    expect(ws.getCell(result.totalRow, dayRateCol).value).toBe(NOT_APPLICABLE)

    for (const key of ['commSprint', 'commQuarter', 'xcSprint', 'xcQuarter']) {
      const col = columns.findIndex((c) => c.key === key) + 1
      const value = ws.getCell(result.totalRow, col).value
      expect(value).toHaveProperty('formula')
      const letter = columnLetter(col)
      expect((value as { formula: string }).formula).toBe(
        `SUM(${letter}${result.firstDataRow}:${letter}${result.lastDataRow})`,
      )
    }
  })

  it('carries the F_Gov / NPC footnote', () => {
    const { ws } = buildTeamSheet()
    let found = false
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string' && c.value.includes('are not cross-charged')) found = true
      })
    })
    expect(found).toBe(true)
  })

  it('reports team size in people and FTE, collapsing the transition to one', () => {
    const { ws } = buildTeamSheet()
    const text: string[] = []
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string') text.push(c.value)
      })
    })
    // person-1 (twice), person-2, person-3, person-4 → 4 people.
    expect(text).toContain('Team size: 4 named people')
    // 100 + 100 capped at 100 for person-1, + 80 + 50 + 100 → 3.3
    expect(text).toContain('Total FTE: 3.3')
  })

  it('drops both cost groups’ columns when only internal is asked for', () => {
    const internal = teamScheduleColumns('internal').map((c) => c.key)
    expect(internal).not.toContain('commQuarter')
    expect(internal).not.toContain('dayRate')
    expect(internal).toContain('xcQuarter')

    const commercial = teamScheduleColumns('commercial').map((c) => c.key)
    expect(commercial).toContain('dayRate')
    expect(commercial).not.toContain('xcQuarter')
  })
})

describe('Supplier Schedule sheet', () => {
  it('leads with the supplier name under a SUPPLIER SCHEDULE eyebrow', () => {
    const { ws } = buildSupplierSheet()
    expect(ws.getCell(1, 1).value).toBe('SUPPLIER SCHEDULE')
    expect(ws.getCell(2, 1).value).toBe('Capgemini')
  })

  it('says commercial cost only in its stats line', () => {
    const { ws } = buildSupplierSheet()
    const stats = String(ws.getCell(3, 1).value)
    expect(stats).toContain('Commercial cost only')
    expect(stats).toContain('named resources across the platform')
    expect(stats).toContain('All costs include VAT')
  })

  it('prices the NPC resource for real — the divergence from Team Schedule', () => {
    const { ws, result } = buildSupplierSheet()
    const quarter = cellFor(
      ws,
      SUPPLIER_SCHEDULE_COLUMNS,
      result.firstDataRow,
      CAPGEMINI_ROWS,
      'a-npc',
      'quarter',
    )
    expect(typeof quarter.value).toBe('number')
    expect(quarter.value as number).toBeGreaterThan(0)
  })

  // The same fixture row, rendered by both sheets, on purpose disagreeing.
  it('disagrees with the Team Schedule about that exact row', () => {
    const supplier = buildSupplierSheet()
    const team = buildTeamSheet()

    const onSupplier = cellFor(
      supplier.ws,
      SUPPLIER_SCHEDULE_COLUMNS,
      supplier.result.firstDataRow,
      CAPGEMINI_ROWS,
      'a-npc',
      'quarter',
    ).value
    const onTeam = cellFor(
      team.ws,
      team.columns,
      team.result.firstDataRow,
      PLUTO_ROWS,
      'a-npc',
      'commQuarter',
    ).value

    expect(onTeam).toBe(NOT_APPLICABLE)
    expect(typeof onSupplier).toBe('number')
  })

  it('carries no cross-charge column at all', () => {
    const keys = SUPPLIER_SCHEDULE_COLUMNS.map((c) => c.key)
    expect(keys).not.toContain('xcQuarter')
    expect(keys).toContain('quarter')
    // Team is a column here precisely because this file spans teams.
    expect(keys).toContain('team')
  })

  it('reports people, FTE and the number of teams covered', () => {
    const { ws } = buildSupplierSheet()
    const text: string[] = []
    ws.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === 'string') text.push(c.value)
      })
    })
    expect(text.some((t) => t.startsWith('Supplier size:'))).toBe(true)
    expect(text.some((t) => t.startsWith('Total FTE:'))).toBe(true)
    expect(text.some((t) => t.startsWith('Teams covered:'))).toBe(true)
  })
})

describe('the two new sheets are genuinely covered by the doubled-"=" guard', () => {
  // noDoubledFormulaEquals walks every sheet in this same sample workbook.
  // This asserts the new sheets actually contribute formula cells to it, so
  // that guard cannot pass vacuously for them.
  it('contributes formula cells from both scoped sheets to the sample workbook', () => {
    const { cells } = buildSampleExportWorkbook()
    expect(cells.teamScheduleTotals.length).toBeGreaterThan(0)
    expect(cells.supplierScheduleTotals.length).toBeGreaterThan(0)
  })

  it('writes none of them with a leading "="', () => {
    const { workbook, cells } = buildSampleExportWorkbook()
    for (const ref of [...cells.teamScheduleTotals, ...cells.supplierScheduleTotals]) {
      const [sheetName, address] = ref.split('!')
      const value = workbook.getWorksheet(sheetName)?.getCell(address).value
      expect(value).toHaveProperty('formula')
      expect((value as { formula: string }).formula.startsWith('=')).toBe(false)
    }
  })
})
