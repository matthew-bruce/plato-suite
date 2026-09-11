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
//
// VAT is shown as a real split rather than assumed. SOWs are quoted ex VAT, so
// Base leads; the inc-VAT total is there because that is the figure that
// actually hits a budget. VAT chargeability is a per-resource fact — some
// resources are exempt and land on exactly £0 VAT — so the VAT column is the
// difference between the two figures the live page itself derives, never a
// rate applied independently. See supplierRowMoney.
//
// There is no Sprint or Month column: this file exists to reconcile a period
// against a SOW, and a sprint cadence has no part in that.

import type ExcelJS from 'exceljs'
import { formulaCell } from './formulaCell'
import {
  MONEY_FORMAT,
  writeScopedHeader,
  writeTableHeader,
  writePlanviewCell,
  writeMoneyCell,
  writeDaysCell,
  writeRule,
  writeFootnote,
} from './scopedSheetChrome'
import type { SheetColumn } from './scopedSheetChrome'
import {
  supplierRowMoney,
  proratedDays,
  formatTeamSplits,
  uniqueNamedPeopleCount,
  distinctTeamCount,
  totalFte,
} from './scheduleVariantRows'
import type { VariantAllocationRow } from './scheduleVariantRows'
import { darkenForWhiteText, toArgb } from './richText'
import { columnLetter } from './teamScheduleSheet'
import type { ScopedSheetResult } from './teamScheduleSheet'

const COMMERCIAL_GROUP = 'COMMERCIAL COST — SUPPLIER RATES'

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
  // Ex-VAT columns say so in their header: a supplier reconciling against a
  // SOW needs to know which of these to compare it against without asking.
  { key: 'dayRate', header: 'Day rate (ex VAT)', width: 16, align: 'right', group: COMMERCIAL_GROUP },
  { key: 'base', header: 'Base (ex VAT)', width: 16, align: 'right', group: COMMERCIAL_GROUP },
  { key: 'vat', header: 'VAT', width: 14, align: 'right', group: COMMERCIAL_GROUP },
  { key: 'total', header: 'Total (inc VAT)', width: 16, align: 'right', group: COMMERCIAL_GROUP },
]

export interface SupplierScheduleSheetParams {
  ws: ExcelJS.Worksheet
  rows: readonly VariantAllocationRow[]
  supplierName: string
  periodName: string
  dateRange: string
  exportedAt: string
  vatMultiplier: number
  /**
   * The supplier's brand colour, read live from suppliers.supplier_colour —
   * never a per-name lookup, since the table is the source of truth and a
   * supplier can change theirs. Drives the header's left-edge accent stripe,
   * and the title text too where it is light enough to read on the dark band.
   */
  /**
   * The supplier's TRUE brand colour, straight from suppliers.supplier_colour.
   * Passed raw: this module decides where the authentic colour is used (the
   * divider band, the Excel tab) and where it must be darkened first (the
   * masthead, so white text survives on it).
   */
  supplierColour?: string | null
}

function statsLine(rows: readonly VariantAllocationRow[]): string {
  const named = uniqueNamedPeopleCount(rows)
  return [
    'Commercial cost only',
    `${named} named ${named === 1 ? 'resource' : 'resources'} across the platform`,
    'Ex-VAT and inc-VAT shown separately',
  ].join('  ·  ')
}

/** "7.082%" from a 1.07082 multiplier — the rate the figures were built with. */
export function formatVatRate(vatMultiplier: number): string {
  const percent = (vatMultiplier - 1) * 100
  return `${percent.toLocaleString('en-GB', { maximumFractionDigits: 3 })}%`
}

export function buildSupplierScheduleSheet(
  params: SupplierScheduleSheetParams,
): ScopedSheetResult {
  const { ws, rows, supplierName, periodName, dateRange, exportedAt, vatMultiplier, supplierColour } =
    params

  const columns = SUPPLIER_SCHEDULE_COLUMNS
  const colCount = columns.length

  ws.views = [{ showGridLines: false }]
  // The Excel tab strip itself — the true brand colour, so a workbook of many
  // supplier tabs is scannable without reading a single label.
  if (supplierColour) {
    ws.properties.tabColor = { argb: toArgb(supplierColour) }
  }

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
    // Darkened only if it must be — most suppliers keep their true colour here.
    bandArgb: supplierColour ? darkenForWhiteText(supplierColour) : null,
  })

  const headerRow = row
  // The divider band always carries the TRUE brand colour, undarkened, so the
  // authentic colour is on every tab even where the masthead was adjusted.
  row = writeTableHeader(ws, row, columns, supplierColour ?? null)
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

    // Unscoped, so this is the resource's full period — this file is not a
    // team's view of them.
    writeDaysCell(ws, row, indexOf('days'), proratedDays(alloc, null))

    // Every row is priced, NPC included — see supplierRowMoney for why this
    // file disagrees with the Team Schedule on exactly that point.
    const money = supplierRowMoney(alloc, vatMultiplier)
    writeMoneyCell(ws, row, indexOf('dayRate'), money.dayRatePence)
    writeMoneyCell(ws, row, indexOf('base'), money.basePence)
    writeMoneyCell(ws, row, indexOf('vat'), money.vatPence)
    writeMoneyCell(ws, row, indexOf('total'), money.totalPence)

    row++
  }

  const lastDataRow = row - 1
  const hasRows = lastDataRow >= firstDataRow

  writeRule(ws, row, colCount)
  const totalRow = row
  ws.getCell(totalRow, 1).value = 'Supplier total'
  ws.getCell(totalRow, 1).font = { bold: true, size: 10 }

  // Day rate is not summed: adding up per-person rates produces a number that
  // looks like a supplier figure and means nothing.
  const rateTotal = ws.getCell(totalRow, indexOf('dayRate'))
  rateTotal.value = '—'
  rateTotal.alignment = { horizontal: 'right' }
  rateTotal.font = { bold: true, size: 10 }

  // Each total is a SUM over the column printed above it, so the bar can only
  // ever agree with the rows a reader can see — never a parallel recomputation
  // that could drift from them.
  for (const key of ['base', 'vat', 'total']) {
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

  // Summary bar: the two totals a SOW reconciliation needs, plus the rate they
  // were built with so the arithmetic can be checked without opening a cell.
  const exVatRef = `${columnLetter(indexOf('base'))}${totalRow}`
  const incVatRef = `${columnLetter(indexOf('total'))}${totalRow}`

  ws.getCell(row, 1).value = 'Ex VAT total'
  ws.getCell(row, 1).font = { bold: true, size: 10 }
  const exVatCell = ws.getCell(row, 2)
  exVatCell.value = hasRows ? formulaCell(exVatRef) : 0
  exVatCell.numFmt = MONEY_FORMAT
  exVatCell.font = { bold: true, size: 10 }
  row++

  ws.getCell(row, 1).value = 'Inc VAT total'
  ws.getCell(row, 1).font = { bold: true, size: 10 }
  const incVatCell = ws.getCell(row, 2)
  incVatCell.value = hasRows ? formulaCell(incVatRef) : 0
  incVatCell.numFmt = MONEY_FORMAT
  incVatCell.font = { bold: true, size: 10 }
  row++

  ws.getCell(row, 1).value = 'VAT rate applied'
  ws.getCell(row, 1).font = { bold: true, size: 10 }
  ws.getCell(row, 2).value = formatVatRate(vatMultiplier)
  ws.getCell(row, 2).font = { bold: true, size: 10 }
  row++

  writeFootnote(
    ws,
    row,
    'VAT is set per resource — an exempt resource shows £0 VAT, so its Base and Total match.',
  )
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
    from: { row: headerRow + 1, column: 1 },
    to: { row: headerRow + 1, column: colCount },
  }

  return { firstDataRow, lastDataRow, totalRow, columnCount: colCount }
}
