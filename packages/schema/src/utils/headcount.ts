/**
 * The minimum an allocation row needs for headcount. Only allocations carry
 * an allocation_id — cost items (Ad-hoc, ETP, Shared Services) do not.
 */
export interface HeadcountRow {
  allocation_id: string
  /** NULL for a vacant / TBC seat. */
  resource_id: string | null
}

/**
 * Platform headcount: distinct named people (by resource_id) plus vacant
 * seats (one per row with no resource_id).
 *
 * Counts people, not rows: a CG→TCS mover holds two allocation rows in the
 * period and is still one person. Planview code plays no part — BAU and NPC
 * people are headcount like anyone else.
 *
 * This is the in-app rule (Schedule page, homepage, export-view modal). The
 * workbook exports keep their own per-variant rules — see
 * apps/nucleus/lib/export/rowPopulations.ts — and do not call this.
 */
export function countHeadcount(rows: readonly HeadcountRow[]): number {
  const people = new Set<string>()
  let vacantSeats = 0
  for (const row of rows) {
    // Cost items are sometimes spread into the same array as allocations
    // (the Confirmed footer does this); they must never count as a seat.
    if (!row.allocation_id) continue
    if (row.resource_id) people.add(row.resource_id)
    else vacantSeats++
  }
  return people.size + vacantSeats
}
