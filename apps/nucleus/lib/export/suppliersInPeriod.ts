// Which suppliers a period's export covers, and in what order.
//
// Derived from the period's own allocations rather than from the suppliers
// table, which is the whole point: a supplier with no resources on the
// platform this period simply never appears, the same way the live Schedule
// page's supplier filter chips only offer suppliers that are actually on the
// schedule. There is no exclusion list to maintain and nothing to update when
// a supplier joins or leaves — HCL is absent from a Q3 export because it has
// no Q3 rows, not because anything names it.
//
// Ordering is supplier_sort_order ascending, matching the Rate Calculator's
// Summary tab supplier breakdown exactly (see route.ts's orderedSuppliers), so
// a supplier sits in the same position wherever it appears across the export.

export interface SupplierAllocationRow {
  supplier_id?: string | null
  supplier_name: string | null
  supplier_abbreviation?: string | null
  supplier_colour?: string | null
  supplier_sort_order?: number | null
}

export interface PeriodSupplier {
  name: string
  /** Short code (RMG, TCS, CG…), used for the Excel tab label. */
  abbreviation: string | null
  colour: string | null
  sortOrder: number
}

/**
 * Every supplier with at least one allocation in the given rows, ordered by
 * the supplier table's own sort_order. A row with no supplier_name (a vacant
 * seat not yet assigned to anyone) contributes no supplier.
 */
export function suppliersInPeriod(
  rows: readonly SupplierAllocationRow[],
): PeriodSupplier[] {
  const byName = new Map<string, PeriodSupplier>()
  for (const row of rows) {
    if (!row.supplier_name || byName.has(row.supplier_name)) continue
    byName.set(row.supplier_name, {
      name: row.supplier_name,
      abbreviation: row.supplier_abbreviation ?? null,
      colour: row.supplier_colour ?? null,
      sortOrder: row.supplier_sort_order ?? Number.POSITIVE_INFINITY,
    })
  }
  return [...byName.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * The worksheet tab label for a supplier: its short code where it has one,
 * falling back to the full name.
 *
 * Excel caps a sheet name at 31 characters and forbids : \ / ? * [ ], so the
 * fallback is trimmed the same way the rest of the export sanitises names. A
 * short code is a handful of characters and never comes close to the cap —
 * the truncation exists for the fallback, not for the codes.
 *
 * Duplicate labels are disambiguated by the caller (see uniqueTabNames): Excel
 * rejects a workbook with two identically-named sheets outright, so two
 * suppliers sharing an abbreviation must not silently collide.
 */
export function supplierTabName(supplier: PeriodSupplier): string {
  const label = supplier.abbreviation?.trim() || supplier.name
  return label.replace(/[\\/?*[\]:]/g, '-').slice(0, 31)
}

/**
 * Tab labels for a set of suppliers, guaranteed unique.
 *
 * A collision is not expected — abbreviations are distinct today — but Excel
 * refuses to open a workbook containing two sheets of the same name, so a
 * future duplicate has to degrade into a numbered suffix rather than produce
 * a file nobody can open.
 */
export function uniqueTabNames(suppliers: readonly PeriodSupplier[]): string[] {
  const used = new Set<string>()
  return suppliers.map((supplier) => {
    const base = supplierTabName(supplier)
    if (!used.has(base)) {
      used.add(base)
      return base
    }
    for (let n = 2; ; n++) {
      const suffixed = `${base.slice(0, 31 - String(n).length - 1)} ${n}`
      if (!used.has(suffixed)) {
        used.add(suffixed)
        return suffixed
      }
    }
  })
}
