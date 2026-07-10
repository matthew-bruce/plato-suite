import type ExcelJS from 'exceljs'

/**
 * Writes the "Totals" reflection table to the bottom of the Raw Data tab.
 * Every supplier cell is a cross-sheet formula into the Summary tab's own
 * supplier breakdown — never a recomputed SUMIF/SUMPRODUCT and never a
 * hardcoded supplier list — so this table can never drift out of sync with
 * whatever Summary currently reports.
 */
export interface RawDataTotalsTableParams {
  ws: ExcelJS.Worksheet
  startRow: number
  summarySheetName: string
  supplierNames: string[]
  summaryCostColumn: string
  summaryResourceColumn: string
  summaryFirstSupplierRow: number
  headerFillArgb: string
}

export interface RawDataTotalsTableResult {
  headerRow: number
  firstSupplierRow: number
  lastSupplierRow: number
  totalRow: number
}

export function buildRawDataTotalsTable(
  params: RawDataTotalsTableParams,
): RawDataTotalsTableResult {
  const {
    ws,
    startRow,
    summarySheetName,
    supplierNames,
    summaryCostColumn,
    summaryResourceColumn,
    summaryFirstSupplierRow,
    headerFillArgb,
  } = params

  const headerRow = startRow
  ws.getCell(headerRow, 1).value = 'Totals'
  ws.getCell(headerRow, 2).value = 'Costs'
  ws.getCell(headerRow, 3).value = 'Resources'
  for (let c = 1; c <= 3; c++) {
    ws.getCell(headerRow, c).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerFillArgb },
    }
    ws.getCell(headerRow, c).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
  }

  const firstSupplierRow = headerRow + 1
  supplierNames.forEach((name, i) => {
    const row = firstSupplierRow + i
    const summaryRow = summaryFirstSupplierRow + i
    ws.getCell(row, 1).value = name
    ws.getCell(row, 2).value = {
      formula: `='${summarySheetName}'!${summaryCostColumn}${summaryRow}`,
    }
    ws.getCell(row, 2).numFmt = '£#,##0.00'
    ws.getCell(row, 3).value = {
      formula: `='${summarySheetName}'!${summaryResourceColumn}${summaryRow}`,
    }
    ws.getCell(row, 3).numFmt = '0'
  })
  const lastSupplierRow = firstSupplierRow + supplierNames.length - 1

  const totalRow = lastSupplierRow + 1
  ws.getCell(totalRow, 1).value = 'Total'
  ws.getCell(totalRow, 1).font = { bold: true }
  ws.getCell(totalRow, 2).value = { formula: `=SUM(B${firstSupplierRow}:B${lastSupplierRow})` }
  ws.getCell(totalRow, 2).numFmt = '£#,##0.00'
  ws.getCell(totalRow, 2).font = { bold: true }
  ws.getCell(totalRow, 3).value = { formula: `=SUM(C${firstSupplierRow}:C${lastSupplierRow})` }
  ws.getCell(totalRow, 3).numFmt = '0'
  ws.getCell(totalRow, 3).font = { bold: true }
  for (let c = 1; c <= 3; c++) {
    ws.getCell(totalRow, c).border = { top: { style: 'thin', color: { argb: 'FF888888' } } }
  }

  return { headerRow, firstSupplierRow, lastSupplierRow, totalRow }
}
