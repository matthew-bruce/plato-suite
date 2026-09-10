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
// Both tabs build the formula here rather than each writing its own, and the
// string is unit-tested, because a wrong column letter or a dropped criterion
// would be silently wrong in a workbook Finance acts on.

export interface RowRange {
  /** 1-based first row, inclusive. */
  first: number
  /** 1-based last row, inclusive. */
  last: number
}

/** Planview codes whose rows are shown but never counted toward cost. */
export const EXCLUDED_PLANVIEW_CODES = ['BAU', 'NPC'] as const

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
 * Build the subtotal formula body (no leading "=").
 *
 * The three criteria are deliberate: two exclusions, plus `"<>"` for
 * "not blank". That last one drops the supplier band rows and any allocation
 * with no planview code at all, matching isIncludedInBaseCost, which treats a
 * missing code as not-platform-borne.
 */
export function buildPlatformTotalFormula(opts: PlatformTotalFormulaOptions): string {
  const { column, planviewColumn, resources, costSections } = opts
  const parts: string[] = []

  if (isUsable(resources)) {
    const sumRange = `${column}${resources.first}:${column}${resources.last}`
    const codeRange = `${planviewColumn}${resources.first}:${planviewColumn}${resources.last}`
    const criteria = EXCLUDED_PLANVIEW_CODES.map((code) => `${codeRange},"<>${code}"`).join(',')
    parts.push(`SUMIFS(${sumRange},${criteria},${codeRange},"<>")`)
  }

  for (const section of costSections) {
    if (!isUsable(section)) continue
    parts.push(`SUM(${column}${section.first}:${column}${section.last})`)
  }

  // A schedule with no rows at all still needs a valid numeric cell.
  return parts.length > 0 ? parts.join('+') : '0'
}
