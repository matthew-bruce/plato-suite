// Shared furniture for the two scoped export sheets — Team Schedule and
// Supplier Schedule.
//
// Both files are built the same way and differ only in what they are scoped
// to and which cost groups they carry, so the header, the column machinery,
// the supplier chip and the footer live here once. Anything genuinely
// specific to one variant belongs in that variant's own module, not behind a
// flag in this one.
//
// Every colour written here goes through toArgb() and every formula through
// formulaCell(); neither is re-implemented locally.

import type ExcelJS from 'exceljs'
import { toArgb, supplierTint } from './richText'
import { planviewStyle, planviewLabel } from './planviewColours'
import { NOT_APPLICABLE } from './scheduleVariantRows'

export const DARK_BAND = 'FF2A2A2D'
const HEADER_BAND = 'FF404044'
const GROUP_BAND = 'FF5A5A5E'
const SUBTLE_TEXT = 'FF8F9495'
const BODY_TEXT = 'FF2A2A2D'
const RULE = 'FFDDDDDD'
const WHITE = 'FFFFFFFF'

export const MONEY_FORMAT = '£#,##0.00'
export const WHOLE_MONEY_FORMAT = '£#,##0'

/** Where a column's values sit, and how wide it is. */
export interface SheetColumn {
  key: string
  header: string
  width: number
  align?: 'left' | 'right' | 'center'
  /** Label of the banded cost group this column belongs to, if any. */
  group?: string
  numFmt?: string
}

/**
 * The header block: a small eyebrow, then the thing this file is ABOUT as the
 * dominant element, with the quarter as secondary information to its right.
 *
 * The quarter deliberately does not lead. A Delivery Manager opening
 * "Cygnus" wants to see Cygnus; which quarter it is matters, but it is not
 * what the file is.
 *
 * No single working-days figure appears anywhere in this block. A quarter's
 * real working days vary by resource location (UK 64 vs India 63 in Q3
 * FY26/27), so there is no one number that is true for the whole file — and
 * printing one invites every figure below it to be checked against the wrong
 * denominator.
 */
export function writeScopedHeader(params: {
  ws: ExcelJS.Worksheet
  startRow: number
  eyebrow: string
  title: string
  periodName: string
  dateRange: string
  exportedAt: string
  statsLine: string
  colCount: number
}): number {
  const { ws, startRow, eyebrow, title, periodName, dateRange, exportedAt, statsLine, colCount } =
    params
  let row = startRow

  const band = (r: number) => {
    for (let c = 1; c <= colCount; c++) {
      ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(DARK_BAND) } }
    }
  }

  // Row 1 — eyebrow, plus the quarter sitting top-right.
  band(row)
  ws.getRow(row).height = 16
  ws.getCell(row, 1).value = eyebrow
  ws.getCell(row, 1).font = { bold: true, color: { argb: toArgb(SUBTLE_TEXT) }, size: 9 }
  const quarterCell = ws.getCell(row, Math.max(1, colCount - 2))
  quarterCell.value = periodName
  quarterCell.font = { bold: true, color: { argb: toArgb(WHITE) }, size: 10 }
  quarterCell.alignment = { horizontal: 'right' }
  row++

  // Row 2 — the dominant line: the team or supplier this file is for.
  band(row)
  ws.getRow(row).height = 30
  ws.getCell(row, 1).value = title
  ws.getCell(row, 1).font = { bold: true, color: { argb: toArgb(WHITE) }, size: 22 }
  const rangeCell = ws.getCell(row, Math.max(1, colCount - 2))
  rangeCell.value = dateRange
  rangeCell.font = { color: { argb: toArgb(SUBTLE_TEXT) }, size: 10 }
  rangeCell.alignment = { horizontal: 'right' }
  row++

  // Row 3 — stats line.
  band(row)
  ws.getCell(row, 1).value = statsLine
  ws.getCell(row, 1).font = { color: { argb: toArgb(WHITE) }, size: 10 }
  row++

  // Row 4 — exported-at.
  band(row)
  ws.getCell(row, 1).value = exportedAt
  ws.getCell(row, 1).font = { italic: true, color: { argb: toArgb(SUBTLE_TEXT) }, size: 9 }
  row++

  // Row 5 — breathing room before the table.
  ws.getRow(row).height = 6
  row++

  return row
}

/**
 * The two header rows: a banded row naming each cost group above the columns
 * it covers, then the column headers themselves. The group band is what makes
 * "Sprint / Month / Quarter" appearing twice legible — one set is the
 * supplier's money, the other is the internal recharge.
 */
export function writeTableHeader(
  ws: ExcelJS.Worksheet,
  startRow: number,
  columns: readonly SheetColumn[],
): number {
  let row = startRow

  const hasGroups = columns.some((c) => c.group)
  if (hasGroups) {
    for (let c = 1; c <= columns.length; c++) {
      const cell = ws.getCell(row, c)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(GROUP_BAND) } }
      cell.font = { bold: true, color: { argb: toArgb(WHITE) }, size: 9 }
      cell.alignment = { horizontal: 'center' }
    }
    // One merged span per contiguous run of columns sharing a group label.
    let i = 0
    while (i < columns.length) {
      const group = columns[i].group
      let j = i
      while (j + 1 < columns.length && columns[j + 1].group === group) j++
      if (group) {
        ws.getCell(row, i + 1).value = group
        if (j > i) ws.mergeCells(row, i + 1, row, j + 1)
      }
      i = j + 1
    }
    row++
  }

  for (let c = 1; c <= columns.length; c++) {
    const col = columns[c - 1]
    const cell = ws.getCell(row, c)
    cell.value = col.header
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(HEADER_BAND) } }
    cell.font = { bold: true, color: { argb: toArgb(WHITE) }, size: 9 }
    cell.alignment = { horizontal: col.align ?? 'left', wrapText: true }
  }
  ws.getRow(row).height = 20
  row++

  ws.columns = columns.map((c) => ({ width: c.width }))
  return row
}

/**
 * The supplier code chip: the supplier's short code on its own brand colour,
 * pale ground with the brand hex as the text.
 *
 * A real cell fill rather than a drawn shape — xlsx has no rounded corners to
 * offer, so this is a rectangle by necessity, not by preference. Colours come
 * from the suppliers table, never a literal here.
 */
export function writeSupplierChip(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  abbreviation: string | null,
  colourHex: string | null,
): void {
  const cell = ws.getCell(row, col)
  cell.value = abbreviation ?? ''
  cell.alignment = { horizontal: 'center' }
  if (!colourHex) {
    cell.font = { bold: true, size: 9, color: { argb: toArgb(SUBTLE_TEXT) } }
    return
  }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: toArgb(supplierTint(colourHex)) } }
  cell.font = { bold: true, size: 9, color: { argb: toArgb(colourHex) } }
}

/** The planview code, coloured by the shared export palette. */
export function writePlanviewCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  code: string | null,
): void {
  const style = planviewStyle(code)
  const cell = ws.getCell(row, col)
  cell.value = planviewLabel(code)
  cell.font = { bold: true, size: 9, color: { argb: toArgb(style.font) } }
  cell.alignment = { horizontal: 'center' }
}

/**
 * A money cell, or an em dash where a figure would mislead.
 *
 * Null is not zero. "—" says this row has no such cost; £0.00 would say it
 * has one and it happens to be nothing.
 */
export function writeMoneyCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  pence: number | null,
  numFmt: string = MONEY_FORMAT,
): void {
  const cell = ws.getCell(row, col)
  if (pence === null) {
    cell.value = NOT_APPLICABLE
    cell.font = { color: { argb: toArgb(SUBTLE_TEXT) }, size: 10 }
    cell.alignment = { horizontal: 'right' }
    return
  }
  cell.value = pence / 100
  cell.numFmt = numFmt
  cell.font = { color: { argb: toArgb(BODY_TEXT) }, size: 10 }
  cell.alignment = { horizontal: 'right' }
}

/** A thin rule under the last data row, before totals. */
export function writeRule(ws: ExcelJS.Worksheet, row: number, colCount: number): void {
  for (let c = 1; c <= colCount; c++) {
    ws.getCell(row, c).border = { top: { style: 'thin', color: { argb: toArgb(RULE) } } }
  }
}

/** A footnote line under the table, in the muted voice of a caption. */
export function writeFootnote(ws: ExcelJS.Worksheet, row: number, text: string): void {
  const cell = ws.getCell(row, 1)
  cell.value = text
  cell.font = { italic: true, color: { argb: toArgb(SUBTLE_TEXT) }, size: 9 }
}
