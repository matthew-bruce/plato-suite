// The Team Schedule sheet: one team's people, days and cost for the quarter.
//
// One row per ALLOCATION RECORD, not per person — a mid-quarter supplier
// transition or a split across two teams is genuinely two records and both
// belong in the table. Only the footer collapses them back to people.
//
// Which figures appear is the caller's choice (internal cross-charge,
// commercial supplier rates, or both); which rows get a figure at all is not,
// and is decided by the planview rules in ./scheduleVariantRows.

import type ExcelJS from 'exceljs'
import { formulaCell } from './formulaCell'
import {
  MONEY_FORMAT,
  writeScopedHeader,
  writeTableHeader,
  writeSupplierChip,
  writePlanviewCell,
  writeMoneyCell,
  writeRule,
  writeFootnote,
} from './scopedSheetChrome'
import type { SheetColumn } from './scopedSheetChrome'
import {
  NOT_APPLICABLE,
  proratedDays,
  teamCommercialFigures,
  teamCrossChargeFigures,
  teamSplitCell,
  uniqueNamedPeopleCount,
  costIncludedPeopleCount,
  totalFte,
} from './scheduleVariantRows'
import type { CostGroupFigures, VariantAllocationRow } from './scheduleVariantRows'
import type { CostVisibility } from './exportVariants'
import { showsCommercialCost, showsInternalCost } from './exportVariants'

const COMMERCIAL_GROUP = 'COMMERCIAL COST — SUPPLIER RATES'
const CROSS_CHARGE_GROUP = 'CROSS-CHARGE — INTERNAL'

/**
 * F_Gov is the line most likely to be read as a mistake, so the file says why
 * itself rather than relying on whoever forwards it to explain.
 */
export const CROSS_CHARGE_FOOTNOTE =
  'F_Gov and NPC resources are not cross-charged — F_Gov costs the platform but isn’t recovered against a PR ticket; NPC is borne elsewhere entirely.'

export interface TeamScheduleSheetParams {
  ws: ExcelJS.Worksheet
  rows: readonly VariantAllocationRow[]
  teamName: string
  /**
   * The team this file is scoped to, as an id (or name — getCapacitySplit
   * accepts either). Every day count and cost figure on the sheet is prorated
   * to this team's share of each resource, the same way the live Schedule page
   * prorates under a team filter. Without it the file would credit this team
   * with the whole of a person it only half has.
   */
  teamScope: string
  periodName: string
  dateRange: string
  exportedAt: string
  vatMultiplier: number
  /** Integer pence — the applied cross-charge rate, stated once in the header. */
  blendedDayRatePence: number
  costVisibility: CostVisibility
}

export interface ScopedSheetResult {
  firstDataRow: number
  lastDataRow: number
  totalRow: number
  columnCount: number
}

export function teamScheduleColumns(costVisibility: CostVisibility): SheetColumn[] {
  const columns: SheetColumn[] = [
    { key: 'name', header: 'Name', width: 24 },
    { key: 'role', header: 'Role', width: 24 },
    { key: 'supplier', header: 'Supplier', width: 10, align: 'center' },
    { key: 'planview', header: 'Planview', width: 10, align: 'center' },
    { key: 'location', header: 'Location', width: 13 },
    { key: 'teamSplit', header: 'Team split', width: 24 },
    { key: 'utilisation', header: 'Utilisation', width: 11, align: 'right' },
    { key: 'days', header: 'Total days', width: 11, align: 'right' },
  ]

  if (showsCommercialCost(costVisibility)) {
    columns.push(
      // Unscaled by utilisation, deliberately: a half-time person is not on a
      // discounted rate, they are on their contracted rate for half the time.
      { key: 'dayRate', header: 'Day rate', width: 13, align: 'right', group: COMMERCIAL_GROUP },
      { key: 'commSprint', header: 'Sprint (10d)', width: 14, align: 'right', group: COMMERCIAL_GROUP },
      { key: 'commMonth', header: 'Month (21d)', width: 14, align: 'right', group: COMMERCIAL_GROUP },
      { key: 'commQuarter', header: 'Quarter', width: 15, align: 'right', group: COMMERCIAL_GROUP },
    )
  }

  if (showsInternalCost(costVisibility)) {
    // No Day rate column here on purpose: the cross-charge rate is flat across
    // the platform, so a column of it would repeat one number down the page.
    // It is stated once, in the stats line.
    columns.push(
      { key: 'xcSprint', header: 'Sprint (10d)', width: 14, align: 'right', group: CROSS_CHARGE_GROUP },
      { key: 'xcMonth', header: 'Month (21d)', width: 14, align: 'right', group: CROSS_CHARGE_GROUP },
      { key: 'xcQuarter', header: 'Quarter', width: 15, align: 'right', group: CROSS_CHARGE_GROUP },
    )
  }

  return columns
}

function statsLine(
  rows: readonly VariantAllocationRow[],
  blendedDayRatePence: number,
): string {
  const named = uniqueNamedPeopleCount(rows)
  const costIncluded = costIncludedPeopleCount(rows)
  const rate = (blendedDayRatePence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  })
  return [
    `${named} named ${named === 1 ? 'person' : 'people'}`,
    `${costIncluded} included in platform cost`,
    `${rate}/day, Current Rate`,
    'All costs include VAT',
  ].join('  ·  ')
}

export function buildTeamScheduleSheet(params: TeamScheduleSheetParams): ScopedSheetResult {
  const {
    ws,
    rows,
    teamName,
    teamScope,
    periodName,
    dateRange,
    exportedAt,
    vatMultiplier,
    blendedDayRatePence,
    costVisibility,
  } = params

  const columns = teamScheduleColumns(costVisibility)
  const colCount = columns.length
  const withCommercial = showsCommercialCost(costVisibility)
  const withInternal = showsInternalCost(costVisibility)

  ws.views = [{ showGridLines: false }]

  let row = writeScopedHeader({
    ws,
    startRow: 1,
    eyebrow: 'TEAM SCHEDULE',
    title: teamName,
    periodName,
    dateRange,
    exportedAt,
    statsLine: statsLine(rows, blendedDayRatePence),
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
    writeSupplierChip(ws, row, indexOf('supplier'), alloc.supplier_abbreviation, alloc.supplier_colour)
    writePlanviewCell(ws, row, indexOf('planview'), alloc.planview_code)
    ws.getCell(row, indexOf('location')).value = alloc.resource_location ?? ''
    ws.getCell(row, indexOf('teamSplit')).value = teamSplitCell(alloc.teams)

    const utilCell = ws.getCell(row, indexOf('utilisation'))
    utilCell.value = alloc.utilisation_percent / 100
    utilCell.numFmt = '0%'
    utilCell.alignment = { horizontal: 'right' }

    // This team's share of the resource's days, not their whole period —
    // matching what the page shows under a team filter, where it labels the
    // totals "(PROPORTIONAL)".
    const daysCell = ws.getCell(row, indexOf('days'))
    daysCell.value = proratedDays(alloc, teamScope)
    daysCell.numFmt = '0.#'
    daysCell.alignment = { horizontal: 'right' }

    if (withCommercial) {
      const figures = teamCommercialFigures(alloc, vatMultiplier, teamScope)
      // The day rate shows whenever the row has a commercial figure at all —
      // a BAU/NPC row's rate is withheld along with its cost, so the file
      // can't be used to infer a rate it declined to price.
      const showsRate = figures.quarterPence !== null
      writeMoneyCell(ws, row, indexOf('dayRate'), showsRate ? alloc.day_rate : null)
      writeCostGroup(ws, row, figures, {
        sprint: indexOf('commSprint'),
        month: indexOf('commMonth'),
        quarter: indexOf('commQuarter'),
      })
    }

    if (withInternal) {
      writeCostGroup(ws, row, teamCrossChargeFigures(alloc, blendedDayRatePence, teamScope), {
        sprint: indexOf('xcSprint'),
        month: indexOf('xcMonth'),
        quarter: indexOf('xcQuarter'),
      })
    }

    row++
  }

  const lastDataRow = row - 1
  const hasRows = lastDataRow >= firstDataRow

  writeRule(ws, row, colCount)
  const totalRow = row
  ws.getCell(totalRow, 1).value = 'Total'
  ws.getCell(totalRow, 1).font = { bold: true, size: 10 }

  const sumColumn = (colIndex: number): void => {
    const letter = columnLetter(colIndex)
    const cell = ws.getCell(totalRow, colIndex)
    // SUM ignores the "—" text cells, so a column of part-excluded rows totals
    // only the rows that actually carried a figure.
    cell.value = hasRows
      ? formulaCell(`SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`)
      : 0
    cell.numFmt = MONEY_FORMAT
    cell.font = { bold: true, size: 10 }
    cell.alignment = { horizontal: 'right' }
  }

  if (withCommercial) {
    // Not summed on purpose: adding up per-person day rates produces a number
    // that looks like a team figure and means nothing.
    const rateTotal = ws.getCell(totalRow, indexOf('dayRate'))
    rateTotal.value = NOT_APPLICABLE
    rateTotal.alignment = { horizontal: 'right' }
    rateTotal.font = { bold: true, size: 10 }
    sumColumn(indexOf('commSprint'))
    sumColumn(indexOf('commMonth'))
    sumColumn(indexOf('commQuarter'))
  }
  if (withInternal) {
    sumColumn(indexOf('xcSprint'))
    sumColumn(indexOf('xcMonth'))
    sumColumn(indexOf('xcQuarter'))
  }
  row++

  row++
  writeFootnote(ws, row, CROSS_CHARGE_FOOTNOTE)
  row += 2

  const people = uniqueNamedPeopleCount(rows)
  // Prorated too: how many whole people this team has, not how many touch it.
  const fte = totalFte(rows, teamScope)
  ws.getCell(row, 1).value = `Team size: ${people} named ${people === 1 ? 'person' : 'people'}`
  ws.getCell(row, 1).font = { bold: true, size: 10 }
  row++
  ws.getCell(row, 1).value = `Total FTE: ${fte.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`
  ws.getCell(row, 1).font = { bold: true, size: 10 }

  ws.autoFilter = {
    from: { row: headerRow + 1, column: 1 },
    to: { row: headerRow + 1, column: colCount },
  }

  return { firstDataRow, lastDataRow, totalRow, columnCount: colCount }
}

function writeCostGroup(
  ws: ExcelJS.Worksheet,
  row: number,
  figures: CostGroupFigures,
  at: { sprint: number; month: number; quarter: number },
): void {
  writeMoneyCell(ws, row, at.sprint, figures.sprintPence)
  writeMoneyCell(ws, row, at.month, figures.monthPence)
  writeMoneyCell(ws, row, at.quarter, figures.quarterPence)
}

/** 1 → "A", 27 → "AA". */
export function columnLetter(index: number): string {
  let n = index
  let letter = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    letter = String.fromCharCode(65 + rem) + letter
    n = Math.floor((n - 1) / 26)
  }
  return letter
}
