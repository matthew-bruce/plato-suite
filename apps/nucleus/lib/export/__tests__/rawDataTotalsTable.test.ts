import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { buildRawDataTotalsTable } from '../rawDataTotalsTable'

describe('buildRawDataTotalsTable', () => {
  it('writes one row per supplier, in the given order, as Summary formulas', () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Raw Data')
    const supplierNames = ['Alpha Co', 'Beta Ltd', 'Gamma Inc']

    const result = buildRawDataTotalsTable({
      ws,
      startRow: 50,
      summarySheetName: 'Summary',
      supplierNames,
      summaryCostColumn: 'C',
      summaryResourceColumn: 'H',
      summaryFirstSupplierRow: 10,
      headerFillArgb: 'FF404044',
    })

    expect(ws.getCell(result.headerRow, 1).value).toBe('Totals')
    expect(ws.getCell(result.headerRow, 2).value).toBe('Costs')
    expect(ws.getCell(result.headerRow, 3).value).toBe('Resources')

    // Row count matches the supplier list passed in (which mirrors Summary's order).
    expect(result.lastSupplierRow - result.firstSupplierRow + 1).toBe(supplierNames.length)

    supplierNames.forEach((name, i) => {
      const row = result.firstSupplierRow + i
      expect(ws.getCell(row, 1).value).toBe(name)
      expect(ws.getCell(row, 2).value).toEqual({ formula: `='Summary'!C${10 + i}` })
      expect(ws.getCell(row, 3).value).toEqual({ formula: `='Summary'!H${10 + i}` })
    })

    // Total row sums exactly the supplier rows written above, no more, no less.
    expect(ws.getCell(result.totalRow, 1).value).toBe('Total')
    expect(ws.getCell(result.totalRow, 2).value).toEqual({
      formula: `=SUM(B${result.firstSupplierRow}:B${result.lastSupplierRow})`,
    })
    expect(ws.getCell(result.totalRow, 3).value).toEqual({
      formula: `=SUM(C${result.firstSupplierRow}:C${result.lastSupplierRow})`,
    })
  })

  it('matches Summary tab row count exactly for a single-supplier period', () => {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Raw Data')
    const result = buildRawDataTotalsTable({
      ws,
      startRow: 1,
      summarySheetName: 'Summary',
      supplierNames: ['Solo Supplier'],
      summaryCostColumn: 'C',
      summaryResourceColumn: 'H',
      summaryFirstSupplierRow: 20,
      headerFillArgb: 'FF404044',
    })
    expect(result.totalRow).toBe(result.firstSupplierRow + 1)
    expect(ws.getCell(result.totalRow, 2).value).toEqual({ formula: 'SUM(B2:B2)'.replace('SUM', '=SUM') })
  })
})
