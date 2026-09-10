// The Supplier Schedule sheet: everyone one supplier has on the platform,
// across every team, with what each of them costs.
//
// A flat list, deliberately: the file is already scoped to one supplier, so
// banding it by supplier would band it by nothing, and banding by team would
// bury the fact that this is one invoice. Team is a column instead.
//
// Commercial cost only — there is no cost-visibility choice to make. The
// internal cross-charge is Royal Mail Group's own arithmetic and is none of a
// supplier's business.

import type ExcelJS from 'exceljs'
import { formulaCell } from './formulaCell'
import {
  MONEY_FORMAT,
  writeScopedHeader,
  writeTableHeader,
  writePlanviewCell,
  writeMoneyCell,
  writeRule,
} from './scopedSheetChrome'
import type { SheetColumn } from './scopedSheetChrome'
import {
  supplierCommercialFigures,
  formatTeamSplits,
  uniqueNamedPeopleCount,
  distinctTeamCount,
  totalFte,
} from './scheduleVariantRows'
import type { VariantAllocationRow } from './scheduleVariantRows'
import { columnLetter } from './teamScheduleSheet'
import type { ScopedSheetResult } from './teamScheduleSheet'

export const SUPPLIER_SCHEDULE_COLUMNS: readonly SheetColumn[] = [
  { key: 'name', header: 'Name', width: 24 },
  { key: 'role', header: 'Role', width: 24 },
  // Present here and absent from the Team Schedule for the same reason: this
  // file spans teams, that one is a team.
  { key: 'team', header: 'Team', width: 24 },
  { key: 'planview', header: 'Planview', width: 10, align: 'center' },
  { key: 'location', header: 'Location', width: 13 },
  { key: 'utilisation', header: 'Utilisation', width: 11, align: 'right' },
  { key: 'days', header: 'Total days', width: 11, align: 'right' },
  { key: 'dayRate', header: 'Day rate', width: 13, align: 'right' },
  { key: 'sprint', header: 'Sprint (10d)', width: 14, align: 'right' },
  { key: 'month', header: 'Month (21d)', width: 14, align: 'right' },
  { key: 'quarter', header: 'Quarter', width: 15, align: 'right' },
]

export interface SupplierScheduleSheetParams {
  ws: ExcelJS.Worksheet
  rows: readonly VariantAllocationRow[]
  supplierName: string
  periodName: string
  dateRange: string
  exportedAt: string
  vatMultiplier: number
}

function statsLine(rows: readonly VariantAllocationRow[]): string {
  const named = uniqueNamedPeopleCount(rows)
  return [
    'Commercial cost only',
    `${named} named ${named === 1 ? 'resource' : 'resources'} across the platform`,
    'All costs include VAT',
  ].join('  ·  ')
}

export function buildSupplierScheduleSheet(
  params: SupplierScheduleSheetParams,
): ScopedSheetResult {
  const { ws, rows, supplierName, periodName, dateRange, exportedAt, vatMultiplier } = params

  const columns = SUPPLIER_SCHEDULE_COLUMNS
  const colCount = columns.length

  ws.views = [{ showGridLines: false }]

  let row = writeScopedHeader({
    ws,
    startRow: 1,
    eyebrow: 'SUPPLIER SCHEDULE',
    title: supplierName,
    periodName,
    dateRange,
    exportedAt,
    statsLine: statsLine(rows),
    colCount,
  })

  const headerRow = row
  row = writeTableHeader(ws, row, columns)
  ws.views = [{ showGridLines: false, state: 'frozen', ySplit: row - 1 }]

  const firstDataRow = row
  const indexOf = (key: string): number => columns.findIndex((c) => c.key === key) + 1

  for (const alloc of rows) {
    ws.getCell(row, indexOf('name')).value = alloc.resource_name ?? 'TBC / Vacant'
    ws.getCell(row, indexOf('role')).value = alloc.role_title ?? ''
    // The full split, not just the largest team: a supplier reconciling an
    // invoice needs to see that a person is halved across two teams.
    ws.getCell(row, indexOf('team')).value = formatTeamSplits(alloc.teams)
    writePlanviewCell(ws, row, indexOf('planview'), alloc.planview_code)
    ws.getCell(row, indexOf('location')).value = alloc.resource_location ?? ''

    const utilCell = ws.getCell(row, indexOf('utilisation'))
    utilCell.value = alloc.utilisation_percent / 100
    utilCell.numFmt = '0%'
    utilCell.alignment = { horizontal: 'right' }

    const daysCell = ws.getCell(row, indexOf('days'))
    daysCell.value = alloc.capacity_days ?? 0
    daysCell.numFmt = '0.#'
    daysCell.alignment = { horizontal: 'right' }

    // Every row is priced, NPC included — see supplierCommercialFigures for
    // why this file disagrees with the Team Schedule on exactly that point.
    const figures = supplierCommercialFigures(alloc, vatMultiplier)
    writeMoneyCell(ws, row, indexOf('dayRate'), alloc.day_rate)
    writeMoneyCell(ws, row, indexOf('sprint'), figures.sprintPence)
    writeMoneyCell(ws, row, indexOf('month'), figures.monthPence)
    writeMoneyCell(ws, row, indexOf('quarter'), figures.quarterPence)

    row++
  }

  const lastDataRow = row - 1
  const hasRows = lastDataRow >= firstDataRow

  writeRule(ws, row, colCount)
  const totalRow = row
  ws.getCell(totalRow, 1).value = 'Supplier total'
  ws.getCell(totalRow, 1).font = { bold: true, size: 10 }

  // Day rate is not summed, for the same reason as on the Team Schedule.
  const rateTotal = ws.getCell(totalRow, indexOf('dayRate'))
  rateTotal.value = '—'
  rateTotal.alignment = { horizontal: 'right' }
  rateTotal.font = { bold: true, size: 10 }

  for (const key of ['sprint', 'month', 'quarter']) {
    const colIndex = indexOf(key)
    const letter = columnLetter(colIndex)
    const cell = ws.getCell(totalRow, colIndex)
    cell.value = hasRows
      ? formulaCell(`SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`)
      : 0
    cell.numFmt = MONEY_FORMAT
    cell.font = { bold: true, size: 10 }
    cell.alignment = { horizontal: 'right' }
  }
  row += 2

  const people = uniqueNamedPeopleCount(rows)
  const fte = totalFte(rows)
  const teamCount = distinctTeamCount(rows)
  ws.getCell(row, 1).value = `Supplier size: ${people} named ${people === 1 ? 'person' : 'people'}`
  ws.getCell(row, 1).font = { bold: true, size: 10 }
  row++
  ws.getCell(row, 1).value = `Total FTE: ${fte.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
  ws.getCell(row, 1).font = { bold: true, size: 10 }
  row++
  ws.getCell(row, 1).value = `Teams covered: ${teamCount}`
  ws.getCell(row, 1).font = { bold: true, size: 10 }

  ws.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: colCount },
  }

  return { firstDataRow, lastDataRow, totalRow, columnCount: colCount }
}
