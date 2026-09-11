// The Team Schedule sheet: one team's people, days and cross-charge for the
// quarter.
//
// One row per ALLOCATION RECORD, not per person — a mid-quarter supplier
// transition or a split across two teams is genuinely two records and both
// belong in the table. Only the footer collapses them back to people.
//
// This file carries NO commercial content: no supplier day rate, no supplier
// cost, in any state. Its readers are the internal stakeholders who pay the
// Platform Head a cross-charge for a team; what the Platform Head pays
// suppliers is a different number and not theirs to see. That is enforced
// structurally — there is no commercial column set in this module to switch
// on — rather than by a visibility option, because an option only protects
// anyone if every person exporting the file remembers to pick the right one.
//
// Every figure here is VAT-inclusive. The blended cross-charge rate is derived
// from a VAT-inclusive total, so there is no ex/inc split to make; the header
// says so rather than leaving a reader to assume either way.

import type ExcelJS from 'exceljs'
import { formulaCell } from './formulaCell'
import {
  MONEY_FORMAT,
  writeScopedHeader,
  writeTableHeader,
  writeSupplierChip,
  writePlanviewCell,
  writeMoneyCell,
  writeDaysCell,
  writeRule,
  writeFootnote,
} from './scopedSheetChrome'
import type { SheetColumn } from './scopedSheetChrome'
import {
  proratedDays,
  teamCrossChargeFigures,
  teamSplitCell,
  uniqueNamedPeopleCount,
  crossChargedPeopleCount,
  totalFte,
} from './scheduleVariantRows'
import type { CostGroupFigures, VariantAllocationRow } from './scheduleVariantRows'

const CROSS_CHARGE_GROUP = 'CROSS-CHARGE — INTERNAL (VAT INCLUSIVE)'

/**
 * F_Gov is the line most likely to be read as a mistake, so the file says why
 * itself rather than relying on whoever forwards it to explain.
 */
export const CROSS_CHARGE_FOOTNOTE =
  'F_Gov and NPC resources are not cross-charged — F_Gov costs the platform but isn’t recovered against a PR ticket; NPC is borne elsewhere entirely.'

/** Stated near the header, so no reader has to guess which way VAT runs. */
export const VAT_INCLUSIVE_NOTE =
  'Cross-charge figures are VAT-inclusive — the blended day rate already includes VAT.'

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
  /** Integer pence — the applied cross-charge rate, stated once in the header. */
  blendedDayRatePence: number
}

export interface ScopedSheetResult {
  firstDataRow: number
  lastDataRow: number
  totalRow: number
  columnCount: number
}

/**
 * The Team Schedule's columns — a fixed list, taking no parameters.
 *
 * It used to take a cost-visibility argument and conditionally append a
 * commercial group. That argument is gone along with the group: there is no
 * input to this function that can produce a supplier rate or supplier cost.
 */
export function teamScheduleColumns(): SheetColumn[] {
  return [
    { key: 'name', header: 'Name', width: 24 },
    { key: 'role', header: 'Role', width: 24 },
    { key: 'supplier', header: 'Supplier', width: 10, align: 'center' },
    { key: 'planview', header: 'Planview', width: 10, align: 'center' },
    { key: 'location', header: 'Location', width: 13 },
    { key: 'teamSplit', header: 'Team split', width: 24 },
    { key: 'utilisation', header: 'Utilisation', width: 11, align: 'right' },
    { key: 'days', header: 'Total days', width: 11, align: 'right' },
    // No Day rate column in this group on purpose: the cross-charge rate is
    // flat across the platform, so a column of it would repeat one number down
    // the page. It is stated once, in the stats line.
    { key: 'xcSprint', header: 'Sprint (10d)', width: 14, align: 'right', group: CROSS_CHARGE_GROUP },
    { key: 'xcMonth', header: 'Month (21d)', width: 14, align: 'right', group: CROSS_CHARGE_GROUP },
    { key: 'xcQuarter', header: 'Quarter', width: 15, align: 'right', group: CROSS_CHARGE_GROUP },
  ]
}

function statsLine(
  rows: readonly VariantAllocationRow[],
  blendedDayRatePence: number,
): string {
  const named = uniqueNamedPeopleCount(rows)
  const crossCharged = crossChargedPeopleCount(rows)
  const rate = (blendedDayRatePence / 100).toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  })
  return [
    `${named} named ${named === 1 ? 'person' : 'people'}`,
    // Replaces the old "included in platform cost", which measured commercial
    // cost inclusion — a question this file no longer asks.
    `${crossCharged} of ${named} cross-charged`,
    `${rate}/day, Current Rate`,
    'All figures include VAT',
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
    blendedDayRatePence,
  } = params

  const columns = teamScheduleColumns()
  const colCount = columns.length

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

  writeFootnote(ws, row, VAT_INCLUSIVE_NOTE)
  row += 2

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
    writeDaysCell(ws, row, indexOf('days'), proratedDays(alloc, teamScope))

    writeCostGroup(ws, row, teamCrossChargeFigures(alloc, blendedDayRatePence, teamScope), {
      sprint: indexOf('xcSprint'),
      month: indexOf('xcMonth'),
      quarter: indexOf('xcQuarter'),
    })

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

  sumColumn(indexOf('xcSprint'))
  sumColumn(indexOf('xcMonth'))
  sumColumn(indexOf('xcQuarter'))
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
