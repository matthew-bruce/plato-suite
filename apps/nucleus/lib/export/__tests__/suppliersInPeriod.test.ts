import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import ExcelJS from 'exceljs'
import {
  suppliersInPeriod,
  supplierTabName,
  uniqueTabNames,
} from '../suppliersInPeriod'
import type { SupplierAllocationRow } from '../suppliersInPeriod'
import { buildSupplierScheduleSheet } from '../supplierScheduleSheet'
import type { VariantAllocationRow } from '../scheduleVariantRows'

/* ══════════════════════════════════════════════════════════════════════
   Which suppliers get a tab.

   Derived from the period's own allocations, never from the suppliers table
   — so a supplier with no resources this period has no tab, automatically,
   with nothing anywhere naming it. HCL is the live example: it exists in the
   suppliers table and currently has zero resources, and it must be absent
   from an export for that reason alone.
══════════════════════════════════════════════════════════════════════ */

const RMG = { supplier_name: 'Royal Mail Group', supplier_abbreviation: 'RMG', supplier_colour: '#E2001A', supplier_sort_order: 1 }
const NH = { supplier_name: 'North Highland', supplier_abbreviation: 'NH', supplier_colour: '#1A2B5B', supplier_sort_order: 2 }
const CG = { supplier_name: 'Capgemini', supplier_abbreviation: 'CG', supplier_colour: '#003C82', supplier_sort_order: 4 }
const TCS = { supplier_name: 'Tata Consultancy Services', supplier_abbreviation: 'TCS', supplier_colour: '#9B0A6E', supplier_sort_order: 5 }
const HT = { supplier_name: 'Happy Team', supplier_abbreviation: 'HT', supplier_colour: '#FF8C00', supplier_sort_order: 3 }
/** In the suppliers table, but with no resources this period. */
const HCL = { supplier_name: 'HCL', supplier_abbreviation: 'HCL', supplier_colour: '#1976F2', supplier_sort_order: 9 }

describe('suppliersInPeriod', () => {
  it('returns every supplier that has at least one allocation', () => {
    const rows: SupplierAllocationRow[] = [{ ...CG }, { ...TCS }, { ...CG }]
    expect(suppliersInPeriod(rows).map((s) => s.name)).toEqual([
      'Capgemini',
      'Tata Consultancy Services',
    ])
  })

  it('excludes a supplier with zero resources — HCL gets no tab, and no rule names it', () => {
    // HCL is deliberately absent from the ROWS, not filtered out by name.
    const rows: SupplierAllocationRow[] = [{ ...CG }, { ...TCS }]
    const names = suppliersInPeriod(rows).map((s) => s.name)
    expect(names).not.toContain('HCL')

    // And the moment HCL does have a resource, it appears with no code change.
    const withHcl = suppliersInPeriod([...rows, { ...HCL }])
    expect(withHcl.map((s) => s.name)).toContain('HCL')
  })

  it('orders by supplier_sort_order, matching the Rate Calculator Summary tab', () => {
    // Fed deliberately out of order.
    const rows: SupplierAllocationRow[] = [{ ...TCS }, { ...RMG }, { ...HT }, { ...NH }]
    expect(suppliersInPeriod(rows).map((s) => s.abbreviation)).toEqual([
      'RMG', // 1
      'NH', // 2
      'HT', // 3
      'TCS', // 5
    ])
  })

  it('is not alphabetical — sort_order is the convention, and the two differ', () => {
    // Happy Team sorts at 3, Capgemini at 4, so sort_order puts Happy Team
    // first while the alphabet puts Capgemini first. Chosen precisely because
    // the two orderings disagree; a pair that agreed would prove nothing.
    const rows: SupplierAllocationRow[] = [{ ...CG }, { ...HT }]
    const bySortOrder = suppliersInPeriod(rows).map((s) => s.name)
    const alphabetical = [...bySortOrder].sort((a, b) => a.localeCompare(b))
    expect(bySortOrder).toEqual(['Happy Team', 'Capgemini'])
    expect(bySortOrder).not.toEqual(alphabetical)
  })

  it('puts a supplier with no sort_order last rather than first', () => {
    const rows: SupplierAllocationRow[] = [
      { supplier_name: 'Unranked', supplier_abbreviation: 'UNR', supplier_colour: null, supplier_sort_order: null },
      { ...RMG },
    ]
    expect(suppliersInPeriod(rows).map((s) => s.abbreviation)).toEqual(['RMG', 'UNR'])
  })

  it('ignores rows with no supplier — a vacant seat contributes no tab', () => {
    const rows: SupplierAllocationRow[] = [
      { ...CG },
      { supplier_name: null, supplier_abbreviation: null, supplier_colour: null, supplier_sort_order: null },
    ]
    expect(suppliersInPeriod(rows)).toHaveLength(1)
  })

  it('carries the colour and abbreviation through for the sheet to use', () => {
    const [only] = suppliersInPeriod([{ ...HT }])
    expect(only.abbreviation).toBe('HT')
    expect(only.colour).toBe('#FF8C00')
  })
})

describe('supplier tab naming', () => {
  it('uses the short code, not the full name', () => {
    expect(supplierTabName({ name: 'Tata Consultancy Services', abbreviation: 'TCS', colour: null, sortOrder: 1 }))
      .toBe('TCS')
  })

  it('falls back to the full name when a supplier has no short code', () => {
    expect(supplierTabName({ name: 'Lean Tree', abbreviation: null, colour: null, sortOrder: 1 }))
      .toBe('Lean Tree')
  })

  it('fits Excel’s 31-character sheet-name cap with room to spare', () => {
    for (const abbr of ['RMG', 'TCS', 'CG', 'HT', 'NH', 'EPAM', 'TAAS', 'LT', 'HCL']) {
      const name = supplierTabName({ name: 'x', abbreviation: abbr, colour: null, sortOrder: 1 })
      expect(name.length).toBeLessThanOrEqual(31)
      // Not merely under the cap — nowhere near it.
      expect(name.length).toBeLessThanOrEqual(5)
    }
  })

  it('truncates and sanitises a long fallback name Excel would reject', () => {
    const name = supplierTabName({
      name: 'A Supplier With A Preposterously Long Legal Name [Holdings]',
      abbreviation: null,
      colour: null,
      sortOrder: 1,
    })
    expect(name.length).toBeLessThanOrEqual(31)
    expect(name).not.toMatch(/[\\/?*[\]:]/)
  })

  // Excel refuses to open a workbook containing two identically-named sheets,
  // so a duplicate has to degrade into something openable rather than a file
  // nobody can use.
  it('disambiguates a duplicate rather than emitting two identical tab names', () => {
    const names = uniqueTabNames([
      { name: 'Acme Ltd', abbreviation: 'AC', colour: null, sortOrder: 1 },
      { name: 'Acme Corp', abbreviation: 'AC', colour: null, sortOrder: 2 },
      { name: 'Acme GmbH', abbreviation: 'AC', colour: null, sortOrder: 3 },
    ])
    expect(new Set(names).size).toBe(3)
    expect(names[0]).toBe('AC')
  })

  it('leaves distinct codes untouched', () => {
    const names = uniqueTabNames([
      { name: 'Royal Mail Group', abbreviation: 'RMG', colour: null, sortOrder: 1 },
      { name: 'Capgemini', abbreviation: 'CG', colour: null, sortOrder: 2 },
    ])
    expect(names).toEqual(['RMG', 'CG'])
  })
})

/* ══════════════════════════════════════════════════════════════════════
   One workbook, N tabs.
══════════════════════════════════════════════════════════════════════ */

// Carries supplier_sort_order alongside the sheet's own row shape, exactly as
// the export route's AllocationRow does — that field is what orders the tabs,
// so a fixture without it would test insertion order and prove nothing.
function allocFor(
  supplier: typeof CG,
  id: string,
): VariantAllocationRow & { supplier_sort_order: number } {
  return {
    supplier_sort_order: supplier.supplier_sort_order,
    allocation_id: id,
    resource_id: `r-${id}`,
    resource_name: 'A. Example',
    role_title: 'Engineer',
    planview_code: 'PR',
    supplier_name: supplier.supplier_name,
    supplier_abbreviation: supplier.supplier_abbreviation,
    supplier_colour: supplier.supplier_colour,
    resource_location: 'onshore',
    utilisation_percent: 100,
    capacity_days: 64,
    day_rate: 50_000,
    vat_applies: true,
    teams: [{ teamId: 't1', teamName: 'Cygnus', capacitySplit: 1 }],
  }
}

/** Mirrors what the export route does: one sheet per supplier, in order. */
function buildMultiTabWorkbook(rows: VariantAllocationRow[]) {
  const suppliers = suppliersInPeriod(rows)
  const tabNames = uniqueTabNames(suppliers)
  const wb = new ExcelJS.Workbook()
  suppliers.forEach((supplier, i) => {
    buildSupplierScheduleSheet({
      ws: wb.addWorksheet(tabNames[i]),
      rows: rows.filter((r) => r.supplier_name === supplier.name),
      supplierName: supplier.name,
      periodName: 'Q3 FY 26/27',
      dateRange: '01 Oct 2026 – 31 Dec 2026',
      exportedAt: 'Exported 11 Sep 2026 at 09:00',
      vatMultiplier: 1.07082,
      supplierColour: supplier.colour,
    })
  })
  return wb
}

describe('one workbook, one tab per supplier', () => {
  const rows = [
    allocFor(CG, 'a1'),
    allocFor(TCS, 'a2'),
    allocFor(HT, 'a3'),
    allocFor(CG, 'a4'), // second Capgemini row — still one tab
  ]

  it('produces exactly one sheet per supplier with resources, not per row', () => {
    const wb = buildMultiTabWorkbook(rows)
    expect(wb.worksheets).toHaveLength(3)
  })

  it('names the tabs by short code, in sort_order', () => {
    const wb = buildMultiTabWorkbook(rows)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['HT', 'CG', 'TCS'])
  })

  it('gives HCL no tab, because it has no rows', () => {
    const wb = buildMultiTabWorkbook(rows)
    expect(wb.worksheets.map((w) => w.name)).not.toContain('HCL')
    // N suppliers in, N sheets out — the count follows the data.
    expect(wb.worksheets).toHaveLength(suppliersInPeriod(rows).length)
  })

  it('adds a tab for HCL as soon as it has a resource, with no code change', () => {
    const wb = buildMultiTabWorkbook([...rows, allocFor(HCL, 'a5')])
    expect(wb.worksheets.map((w) => w.name)).toContain('HCL')
    expect(wb.worksheets).toHaveLength(4)
  })

  it('puts only that supplier’s rows on each tab', () => {
    const wb = buildMultiTabWorkbook(rows)
    const cg = wb.getWorksheet('CG')!
    // Capgemini has two allocation rows; the other tabs have one each.
    expect(cg.getCell(2, 1).value).toBe('Capgemini')
    expect(wb.getWorksheet('TCS')!.getCell(2, 1).value).toBe('Tata Consultancy Services')
  })

  it('colours every tab with its own supplier’s true brand colour', () => {
    const wb = buildMultiTabWorkbook(rows)
    expect(wb.getWorksheet('HT')!.properties.tabColor?.argb).toBe('FFFF8C00')
    expect(wb.getWorksheet('CG')!.properties.tabColor?.argb).toBe('FF003C82')
    expect(wb.getWorksheet('TCS')!.properties.tabColor?.argb).toBe('FF9B0A6E')
  })
})

/* ══════════════════════════════════════════════════════════════════════
   The supplier-selection machinery is genuinely gone.

   Source-scanned rather than behaviour-tested, the same way the Team
   Schedule's commercial-absence is pinned: asserting the generated file
   happens to contain every supplier would still pass if a selector were
   quietly reintroduced alongside it.
══════════════════════════════════════════════════════════════════════ */

describe('no supplier selection survives anywhere', () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8')

  it('has no supplierId query parameter in the export route', () => {
    const route = read('../../../app/api/export/schedule/route.ts')
    expect(route).not.toContain("searchParams.get('supplierId')")
    expect(route).not.toContain('scopeSupplierId')
  })

  it('has no supplier picker or supplier state in the export modal', () => {
    const modal = read('../../../components/schedule/ExportChoiceModal.tsx')
    expect(modal).not.toContain('supplierId')
    expect(modal).not.toContain('setSupplierId')
    expect(modal).not.toContain('Choose a supplier')
  })

  it('passes no supplier options into the modal from the Schedule page', () => {
    const page = read('../../../components/schedule/SchedulePageClient.tsx')
    expect(page).not.toContain('exportSupplierOptions')
  })

  it('leaves no supplier scope in the variant registry for nothing to construct', () => {
    const registry = read('../exportVariants.ts')
    expect(registry).not.toContain("scope: 'supplier'")
    // The union member itself is gone too, not just its last usage.
    expect(registry).not.toContain("'team' | 'supplier'")
  })
})
