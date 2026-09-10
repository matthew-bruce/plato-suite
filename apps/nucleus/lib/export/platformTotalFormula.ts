// The in-sheet formula for Total Platform Cost in the exported Rate
// Calculator workbook.
//
// Both the Rate Calculator sheet and the Raw Data tab carry a subtotal that
// has to mean what the Schedule page's Total Platform Cost card means:
// allocations the platform actually bears, plus every cost-item row. BAU and
// NPC allocations stay visible in the sheet with their own figures — they are
// simply not platform-borne, the same rule isIncludedInBaseCost applies on the
// page — so the resource portion is summed by planview code rather than over
// every row.
//
// The subtotal is also filter-aware: both sheets carry an autofilter, and an
// analyst who filters to one supplier expects the total beneath to follow.
// Plain SUMIFS cannot do that, so the resource portion uses the standard
// SUMPRODUCT + SUBTOTAL + OFFSET idiom — SUBTOTAL evaluated one row at a time
// through OFFSET, which yields nothing for a row the filter has hidden.
//
// Both tabs build the formula here rather than each writing its own, and the
// string is unit-tested (and evaluated against a simulated sheet), because a
// wrong column letter or a dropped criterion would be silently wrong in a
// workbook Finance acts on.

export interface RowRange {
  /** 1-based first row, inclusive. */
  first: number
  /** 1-based last row, inclusive. */
  last: number
}

/** Planview codes whose rows are shown but never counted toward cost. */
export const EXCLUDED_PLANVIEW_CODES = ['BAU', 'NPC'] as const

/**
 * SUBTOTAL's "SUM, ignoring rows hidden by a filter" function code.
 *
 * 109 rather than 103 (COUNTA) deliberately. A visibility flag from 103 would
 * have to be multiplied by the money column, and that column is not all
 * numbers: zero-cost allocations carry an em dash and each supplier band row
 * carries "avg/day £…" in the +VAT column. SUMPRODUCT raises #VALUE! the
 * moment text lands in one of its arrays. Summing each cell through
 * SUBTOTAL(109) sidesteps that entirely — SUM ignores text, so those cells
 * contribute 0 — while still returning 0 for any row the filter has hidden.
 */
const SUBTOTAL_SUM_VISIBLE_ONLY = 109

export interface PlatformTotalFormulaOptions {
  /** Money column to sum — 'L' (base) or 'M' (+VAT). */
  column: string
  /** Column holding each allocation's planview code. */
  planviewColumn: string
  /** The allocation rows. */
  resources: RowRange
  /** Ad-hoc / ETP / Shared Services blocks, summed whole. */
  costSections: RowRange[]
}

function isUsable(range: RowRange): boolean {
  return range.first > 0 && range.last >= range.first
}

/**
 * One SUBTOTAL per row of `column`, as an array — the value where the row is
 * visible, 0 where the filter has hidden it or the cell holds text.
 */
function perRowVisibleValues(column: string, range: RowRange): string {
  const anchor = `$${column}$${range.first}`
  const span = `$${column}$${range.first}:$${column}$${range.last}`
  return `SUBTOTAL(${SUBTOTAL_SUM_VISIBLE_ONLY},OFFSET(${anchor},ROW(${span})-ROW(${anchor}),0))`
}

/**
 * Build the subtotal formula body (no leading "=").
 *
 * The three criteria are deliberate: two exclusions, plus `<>""` for
 * "not blank". That last one drops the supplier band rows and any allocation
 * with no planview code at all, matching isIncludedInBaseCost, which treats a
 * missing code as not-platform-borne.
 */
export function buildPlatformTotalFormula(opts: PlatformTotalFormulaOptions): string {
  const { column, planviewColumn, resources, costSections } = opts
  const parts: string[] = []

  if (isUsable(resources)) {
    const codeRange = `$${planviewColumn}$${resources.first}:$${planviewColumn}$${resources.last}`
    const criteria = [
      ...EXCLUDED_PLANVIEW_CODES.map((code) => `(${codeRange}<>"${code}")`),
      `(${codeRange}<>"")`,
    ].join('*')
    parts.push(`SUMPRODUCT(${perRowVisibleValues(column, resources)},${criteria})`)
  }

  for (const section of costSections) {
    if (!isUsable(section)) continue
    // Cost-item blocks need no criteria, so a plain SUBTOTAL over the block is
    // already both filter-aware and text-safe.
    parts.push(
      `SUBTOTAL(${SUBTOTAL_SUM_VISIBLE_ONLY},${column}${section.first}:${column}${section.last})`,
    )
  }

  // A schedule with no rows at all still needs a valid numeric cell.
  return parts.length > 0 ? parts.join('+') : '0'
}
